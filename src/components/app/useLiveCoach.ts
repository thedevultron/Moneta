"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COACH_BASE_PROMPT, AI_PERSONALITIES } from "@/lib/personalities";
import { TOOLS } from "@/lib/tools";

export type LiveStatus = "idle" | "connecting" | "live" | "error";
export type LiveAction = { tool: string; ok: boolean; summary: string; navigate?: string };
export type LiveTurn = { role: "user" | "model"; text: string; actions?: LiveAction[] };

type Ctx = {
  context: string;
  name: string;
  currency: string;
  persona: string;
  aiPersonality: string;
  thinkingLevel: string;
};

const THINK_BUDGET: Record<string, "LOW" | "MEDIUM" | "HIGH"> = { minimal: "LOW", low: "LOW", medium: "MEDIUM", high: "HIGH" };

function floatToPCM16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function b64encodeBytes(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

/** Resample mic audio to 16kHz (Safari often ignores the 16k constraint). */
function downsampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (!fromRate || Math.abs(fromRate - 16000) < 50) return input;
  const ratio = fromRate / 16000;
  const len = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))];
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function parseOutRate(mime?: string): number {
  const m = /rate=(\d+)/.exec(mime ?? "");
  const r = m ? Number(m[1]) : 24000;
  return r >= 8000 && r <= 96000 ? r : 24000;
}

/**
 * True Gemini Live API session (native audio in/out + live transcriptions).
 * Key never touches the browser: the server mints a short-lived token.
 */
export function useLiveCoach(opts: { onDataChanged?: () => void; onNavigate?: (href: string) => void } = {}) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [liveUser, setLiveUser] = useState("");
  const [liveModel, setLiveModel] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioInRef = useRef<{ ctx: AudioContext; proc: ScriptProcessorNode; src: MediaStreamAudioSourceNode } | null>(null);
  const audioOutRef = useRef<{ ctx: AudioContext; nextAt: number } | null>(null);
  const accRef = useRef<{ user: string; model: string }>({ user: "", model: "" });
  const pendingActions = useRef<LiveAction[]>([]);
  const stoppedRef = useRef(false);
  // Guards a second start() while token/context fetches are still in flight
  // (two rapid taps would otherwise open TWO live sessions at once).
  const startingRef = useRef(false);
  const [processing, setProcessing] = useState(false);
  const lastInputAt = useRef(0);
  const lastOutputAt = useRef(0);
  const onDataChanged = useRef(opts.onDataChanged);
  onDataChanged.current = opts.onDataChanged;
  const onNavigate = useRef(opts.onNavigate);
  onNavigate.current = opts.onNavigate;

  const teardown = useCallback((keepTurns = true) => {
    stoppedRef.current = true;
    startingRef.current = false;
    setProcessing(false);
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    try { audioInRef.current?.proc.disconnect(); } catch {}
    try { audioInRef.current?.src.disconnect(); } catch {}
    try { audioInRef.current?.ctx.close(); } catch {}
    audioInRef.current = null;
    streamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    streamRef.current = null;
    try { audioOutRef.current?.ctx.close(); } catch {}
    audioOutRef.current = null;
    setMicLevel(0);
    setSpeaking(false);
    if (!keepTurns) {
      setTurns([]);
      setLiveUser("");
      setLiveModel("");
      accRef.current = { user: "", model: "" };
      pendingActions.current = [];
    }
  }, []);

  useEffect(() => () => teardown(false), [teardown]);

  const pushTurn = useCallback((turn: LiveTurn) => {
    setTurns((t) => [...t.slice(-29), turn]);
  }, []);

  // Per-utterance segmentation: the extended-thinking model often holds one
  // "turn" open across several back-and-forths, which would merge everything
  // into a single user bubble + single model bubble. So when the user pauses
  // (~1.5s of no new speech) we close their bubble, and when the model goes
  // quiet with its audio drained we close its bubble. turnComplete below
  // remains the final boundary and only flushes whatever is left.
  useEffect(() => {
    if (status !== "live") return;
    const t = setInterval(() => {
      if (stoppedRef.current) return;
      const now = Date.now();
      const u = accRef.current.user.trim();
      if (u && now - lastInputAt.current > 1500) {
        accRef.current.user = "";
        setLiveUser("");
        pushTurn({ role: "user", text: u });
      }
      const m = accRef.current.model.trim();
      if (m && now - lastOutputAt.current > 2200) {
        const out = audioOutRef.current;
        const drained = !out || out.ctx.currentTime >= out.nextAt - 0.3;
        if (drained) {
          accRef.current.model = "";
          setLiveModel("");
          const acts = pendingActions.current.splice(0);
          pushTurn({ role: "model", text: m, actions: acts.length ? acts : undefined });
          setSpeaking(false);
          setProcessing(false);
        }
      }
    }, 600);
    return () => clearInterval(t);
  }, [status, pushTurn]);

  const runToolCalls = useCallback(async (ws: WebSocket, calls: { name: string; args?: Record<string, unknown>; id?: string }[]) => {
    const responses: { name: string; id?: string; response: Record<string, unknown> }[] = [];
    for (const c of calls) {
      try {
        const r = await fetch("/api/ai/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: c.name, args: c.args ?? {} }),
        });
        const j = (await r.json()) as LiveAction;
        pendingActions.current.push(j);
        responses.push({ name: c.name, id: c.id, response: { ok: j.ok, result: j.summary } });
        if (j.ok) onDataChanged.current?.();
        if (j.ok && typeof j.navigate === "string" && j.navigate.startsWith("/app")) onNavigate.current?.(j.navigate);
      } catch {
        const fail = { tool: c.name, ok: false, summary: "Tool failed" } as LiveAction;
        pendingActions.current.push(fail);
        responses.push({ name: c.name, id: c.id, response: { ok: false, result: "Tool failed" } });
      }
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }
  }, []);

  const start = useCallback(async () => {
    if (wsRef.current || startingRef.current) return;
    setError("");
    setStatus("connecting");
    setProcessing(false);
    stoppedRef.current = false;
    startingRef.current = true;
    lastInputAt.current = 0;
    lastOutputAt.current = 0;
    try {
      // 1. Short-lived token (server holds the real key)
      const tRes = await fetch("/api/ai/live-token", { method: "POST" });
      const tText = await tRes.text();
      let tj: { token?: string; model?: string; wsUrl?: string; error?: string } = {};
      try {
        tj = JSON.parse(tText) as typeof tj;
      } catch {
        throw new Error("Voice service returned an unreadable response. Reload and try again.");
      }
      if (!tRes.ok || !tj.token) throw new Error(tj.error || "Couldn't start live voice.");
      // 2. Live context for the system instruction
      const cRes = await fetch("/api/ai/context", { cache: "no-store" });
      const cx = (await cRes.json()) as Ctx & { error?: string };
      if (!cRes.ok) throw new Error((cx as { error?: string }).error || "Couldn't load your data.");
      const personality = AI_PERSONALITIES[cx.aiPersonality] ?? AI_PERSONALITIES.calm;
      const sys = `${COACH_BASE_PROMPT}\nCoach personality (${personality.label}): ${personality.prompt}\nThe user is ${cx.name} (${cx.persona}), currency ${cx.currency}.\n\n--- USER DATA ---\n${cx.context}`;

      const ws = new WebSocket(`${tj.wsUrl}?access_token=${encodeURIComponent(tj.token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: `models/${tj.model}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              thinkingConfig: { thinkingLevel: THINK_BUDGET[cx.thinkingLevel] ?? "MEDIUM" },
            },
            systemInstruction: { parts: [{ text: sys }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
            tools: TOOLS,
          },
        }));
      };

      const decodeFrame = async (data: unknown): Promise<string> => {
        // Live API sends JSON frames as text AND binary — handle both.
        if (typeof data === "string") return data;
        try {
          if (data instanceof Blob) return await data.text();
          if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
        } catch {}
        return "";
      };

      ws.onmessage = async (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(await decodeFrame(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        if (msg.setupComplete) {
          startingRef.current = false;
          setStatus("live");
          void startMic(ws);
          return;
        }
        if (msg.goAway) {
          // Server is retiring the session: keep the transcript, invite a fresh tap.
          const u = accRef.current.user.trim();
          const m = accRef.current.model.trim();
          const acts = pendingActions.current.splice(0);
          if (u) pushTurn({ role: "user", text: u });
          if (m || acts.length) pushTurn({ role: "model", text: m, actions: acts.length ? acts : undefined });
          accRef.current = { user: "", model: "" };
          setLiveUser("");
          setLiveModel("");
          setError("Live session ended — tap the pill to start a fresh one.");
          teardown(true);
          setStatus("idle");
          return;
        }
        const sc = msg.serverContent as {
          modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
          turnComplete?: boolean;
          interrupted?: boolean;
          interactionStatus?: string;
        } | undefined;
        if (sc) {
          // Extended-thinking lifecycle: fillers arrive with turnComplete +
          // IN_PROGRESS; only IDLE means the whole interaction is done.
          const statusNow = (msg.interactionStatus ?? sc.interactionStatus) as string | undefined;
          if (sc.interrupted) {
            // User barged in: drop queued playback, finalize what we have.
            if (audioOutRef.current) audioOutRef.current.nextAt = audioOutRef.current.ctx.currentTime;
            setSpeaking(false);
            setProcessing(false);
          }
          if (sc.inputTranscription?.text) {
            accRef.current.user += sc.inputTranscription.text;
            setLiveUser(accRef.current.user);
            lastInputAt.current = Date.now();
            // Fresh user speech takes visual priority over "thinking".
            setProcessing(false);
          }
          if (sc.outputTranscription?.text) {
            accRef.current.model += sc.outputTranscription.text;
            setLiveModel(accRef.current.model);
            lastOutputAt.current = Date.now();
          }
          for (const part of sc.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) void playAudio(part.inlineData.data, part.inlineData.mimeType);
          }
          const done = !!sc.turnComplete && statusNow !== "IN_PROGRESS";
          if (done) {
            const u = accRef.current.user.trim();
            const m = accRef.current.model.trim();
            const acts = pendingActions.current.splice(0);
            if (u) pushTurn({ role: "user", text: u });
            if (m || acts.length) pushTurn({ role: "model", text: m, actions: acts.length ? acts : undefined });
            accRef.current = { user: "", model: "" };
            setLiveUser("");
            setLiveModel("");
            setProcessing(false);
            if (!u && !m) setSpeaking(false);
          } else if (sc.modelTurn?.parts?.length) {
            // Real audio/content arriving: the model is speaking, not thinking.
            setSpeaking(true);
            setProcessing(false);
          } else if (statusNow === "IN_PROGRESS") {
            // Extended-thinking filler: the model is working, no voice yet.
            // Only show "thinking" when no voice audio is actively queued.
            const out = audioOutRef.current;
            const audioActive = !!out && out.ctx.currentTime < out.nextAt - 0.1;
            if (!audioActive) setProcessing(true);
          }
        }
        const tc = msg.toolCall as { functionCalls?: { name: string; args?: Record<string, unknown>; id?: string }[] } | undefined;
        if (tc?.functionCalls?.length) void runToolCalls(ws, tc.functionCalls);
      };

      ws.onerror = () => {
        if (stoppedRef.current) return;
        setError("Live connection failed. Check your connection and API key, then try again.");
        setStatus("error");
      };
      ws.onclose = () => {
        if (stoppedRef.current) {
          setStatus("idle");
          return;
        }
        // Session ended by server (e.g. token/session expiry) — flush any
        // in-progress speech into bubbles, then surface, keep transcript.
        const u = accRef.current.user.trim();
        const m = accRef.current.model.trim();
        const acts = pendingActions.current.splice(0);
        if (u) pushTurn({ role: "user", text: u });
        if (m || acts.length) pushTurn({ role: "model", text: m, actions: acts.length ? acts : undefined });
        accRef.current = { user: "", model: "" };
        setLiveUser("");
        setLiveModel("");
        setStatus((s) => (s === "live" ? "idle" : s));
        teardown(true);
      };
    } catch (e) {
      teardown(true);
      setError(e instanceof Error ? e.message : "Couldn't start live voice.");
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushTurn, runToolCalls, teardown]);

  async function startMic(ws: WebSocket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      if (stoppedRef.current || ws.readyState !== WebSocket.OPEN) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // Use the device's native rate and downsample in JS (mobile Safari
      // ignores the sampleRate constraint, which would garble live audio).
      const ctx = new AudioContext();
      try { await ctx.resume(); } catch {}
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const levelBuf = new Uint8Array(analyser.frequencyBinCount);
      proc.onaudioprocess = (e) => {
        if (stoppedRef.current || ws.readyState !== WebSocket.OPEN) return;
        const ch = downsampleTo16k(e.inputBuffer.getChannelData(0), e.inputBuffer.sampleRate);
        analyser.getByteTimeDomainData(levelBuf);
        let peak = 0;
        for (let i = 0; i < levelBuf.length; i += 4) {
          const v = Math.abs(levelBuf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setMicLevel((p) => p * 0.7 + Math.min(1, peak * 1.6) * 0.3);
        const pcm = floatToPCM16(ch);
        ws.send(JSON.stringify({
          realtimeInput: { audio: { data: b64encodeBytes(new Uint8Array(pcm.buffer)), mimeType: "audio/pcm;rate=16000" } },
        }));
      };
      src.connect(proc);
      // Route through a muted gain node (not the speakers): keeps the
      // processor running with zero feedback/echo on phones.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      proc.connect(mute);
      mute.connect(ctx.destination);
      audioInRef.current = { ctx, proc, src };
    } catch {
      setError("Microphone blocked — allow mic access in the browser, then try again.");
      setStatus("error");
      try { ws.close(); } catch {}
    }
  }

  async function playAudio(b64: string, mime?: string) {
    try {
      if (!audioOutRef.current) {
        audioOutRef.current = { ctx: new AudioContext({ sampleRate: 24000 }), nextAt: 0 };
      }
      const out = audioOutRef.current;
      const rate = parseOutRate(mime);
      const raw = b64ToBytes(b64);
      const samples = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 2));
      const buf = out.ctx.createBuffer(1, samples.length, rate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 0x8000;
      const src = out.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out.ctx.destination);
      const at = Math.max(out.ctx.currentTime + 0.02, out.nextAt);
      src.start(at);
      out.nextAt = at + buf.duration;
      setSpeaking(true);
      src.onended = () => {
        if (out.ctx.currentTime >= out.nextAt - 0.05 && !accRef.current.model) setSpeaking(false);
      };
    } catch {
      /* drop bad chunk */
    }
  }

  const stop = useCallback(() => {
    // Ending the session closes the current exchange: flush whatever was
    // said into its own bubbles instead of dropping it.
    const u = accRef.current.user.trim();
    const m = accRef.current.model.trim();
    const acts = pendingActions.current.splice(0);
    if (u) pushTurn({ role: "user", text: u });
    if (m || acts.length) pushTurn({ role: "model", text: m, actions: acts.length ? acts : undefined });
    accRef.current = { user: "", model: "" };
    setLiveUser("");
    setLiveModel("");
    teardown(true);
    setStatus("idle");
  }, [teardown, pushTurn]);

  const reset = useCallback(() => {
    teardown(false);
    setStatus("idle");
    setError("");
  }, [teardown]);

  return { status, turns, liveUser, liveModel, micLevel, speaking, processing, error, start, stop, reset };
}
