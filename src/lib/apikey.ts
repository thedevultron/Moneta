import { promises as fs } from "node:fs";
import path from "node:path";
import { dataDir } from "@/db/jsondb";

const FILE = "ai-key.json";

/** Runtime key: in-app override (data/ai-key.json) wins, otherwise .env. */
export async function getApiKey(): Promise<string> {
  const clean = (v: unknown) => {
    if (typeof v !== "string") return "";
    let k = v.trim();
    if (k.length >= 2 && k.startsWith('"') && k.endsWith('"')) k = k.slice(1, -1).trim();
    return k;
  };
  try {
    const raw = await fs.readFile(path.join(dataDir(), FILE), "utf8");
    const k = clean((JSON.parse(raw) as { key?: unknown }).key);
    if (k) return k;
  } catch {}
  return clean(process.env.GEMINI_API_KEY);
}

export async function keySource(): Promise<"app" | "env" | "none"> {
  try {
    const raw = await fs.readFile(path.join(dataDir(), FILE), "utf8");
    const k = (JSON.parse(raw) as { key?: unknown }).key;
    if (typeof k === "string" && k.trim()) return "app";
  } catch {}
  return process.env.GEMINI_API_KEY?.trim() ? "env" : "none";
}

export async function setApiKey(key: string): Promise<void> {
  const k = key.trim();
  if (!k) throw new Error("Empty key");
  if (k.length > 500) throw new Error("Key looks too long");
  await fs.mkdir(dataDir(), { recursive: true });
  const file = path.join(dataDir(), FILE);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ key: k, updatedAt: new Date().toISOString() }) + "\n", "utf8");
  await fs.rename(tmp, file);
}

export async function clearApiKey(): Promise<void> {
  try {
    await fs.unlink(path.join(dataDir(), FILE));
  } catch {}
}

/** Ask Google whether a key is accepted (checks a real text model). */
export async function validateKey(key: string): Promise<{ ok: boolean; message: string }> {
  const k = key.trim();
  if (!k) return { ok: false, message: "Enter a key first." };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite?key=${encodeURIComponent(k)}`,
      { signal: AbortSignal.timeout(20000) },
    );
    if (res.ok) return { ok: true, message: "Key works — Gemini text, chat tools and Live voice are enabled." };
    const j = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string } } | null;
    const m = j?.error?.message || `Google returned ${res.status}.`;
    if (/API_KEY_INVALID/i.test(m)) {
      return { ok: false, message: "Google says: API key not valid. This string isn't a recognized Google API key — copy the full key from AI Studio (Get API key → Create API key), no extra characters." };
    }
    if (/SERVICE_DISABLED|not enabled/i.test(m)) {
      return { ok: false, message: "Key is real but the Generative Language API isn't enabled for its project. Enable it in Google Cloud Console, or create the key in a fresh AI Studio project." };
    }
    return { ok: false, message: `Google says: ${m.slice(0, 160)}` };
  } catch {
    return { ok: false, message: "Couldn't reach Google — check your connection and try again." };
  }
}
