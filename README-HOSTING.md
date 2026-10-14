# Moneta — run + host from your PC (production-ready)

App renamed **Amir → Moneta**. Copyright kept: **© Moneta · Made by Amir Bagawan**.

## 1. Run it (production, from npm)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-prod.ps1 -Port 3000
```

This installs deps, typechecks, builds, and starts on `http://localhost:3000`.
Data lives in readable text documents: `data/*.json` (users, sessions, categories,
transactions, budgets, goals, recurring). Back up the `data/` folder to back up everything.
The server always reads fresh from disk — editing the JSON while running is safe.

## 2. Storage: JSON files or Firestore

Default is local JSON (`DB_BACKEND=json`, files in `data/`). For Firebase:

1. console.firebase.google.com → create project → **Firestore Database** → Create database
2. Project Settings → Service accounts → **Generate new private key** (keep it secret)
3. Put the key in `.env` (see `.env.example`: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — or the whole JSON as `FIREBASE_SERVICE_ACCOUNT_JSON`)
4. Copy your data up: `npm run migrate:firestore` (safe to re-run; `--dry-run` previews)
5. Switch the backend: create `data/backend.json` containing `{"backend":"firestore"}`, restart
6. Check `/api/health` → `"store":"firestore"`

Local Firestore testing (no billing): `npx firebase emulators:start --only firestore`,
then `DB_BACKEND=firestore` + `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` — the full
suite (signup → transactions → chat tools → PIN → logout) was verified against it.

Deploy: `firebase login` → `firebase use --add` (select project) → create secrets
(one time each — you will be prompted to paste the value):

```powershell
firebase apphosting:secrets:set GEMINI_API_KEY
firebase apphosting:secrets:set FIREBASE_PROJECT_ID
firebase apphosting:secrets:set FIREBASE_CLIENT_EMAIL
firebase apphosting:secrets:set FIREBASE_PRIVATE_KEY
firebase apphosting:secrets:grantAccess --backend <backend-id>
```

then `firebase deploy` (config: `firebase.json`, `apphosting.yaml`, locked-down `firestore.rules`).

## 2b. Deploy: Netlify (+ local storage)

The repo is Netlify-ready (`netlify.toml` + `@netlify/plugin-nextjs`, Node pinned via `NODE_VERSION`/`engines`).

1. Push the repo to GitHub (`.env`, `service-account.json` and `data/*.json` are gitignored — secrets never ship).
2. Netlify → Add new site → Import from Git → pick `moneta` (or `moneta-ai`) as the site name.
3. Build settings are automatic from `netlify.toml` (`npm run build`, Next.js plugin).
4. Site settings → Environment variables — add:
   - `GEMINI_API_KEY` = your AI Studio key (required for Coach/voice; app runs in local mode without it)
   - `NEXT_PUBLIC_SITE_URL` = `https://YOUR-SITE.netlify.app`
   - Optional AI tuning: `GEMINI_LITE_MODEL`, `GEMINI_AGENT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_TRANSCRIBE_MODEL`, `GEMINI_THINKING_LEVEL` (defaults in `.env.example` are verified working)
   - Leave `DB_BACKEND` unset for local JSON storage
5. Deploy. Health check: `https://YOUR-SITE.netlify.app/api/health` → `{ "ok": true, ... }`.

> Local storage on Netlify is ephemeral: JSON files and uploads reset on redeploy/sleep. Fine for a demo; for permanent data use the Supabase Postgres backend (coming next), which works unchanged on Netlify — just set its env vars instead.

## 2c. Supabase (auth + storage)

Wiring (already done in this repo's `.env`; values never committed):

- Supabase project ref from the earlier session, publishable (anon) key, `moneta-uploads` bucket.
- Local `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET=moneta-uploads`, `AUTH_BACKEND=supabase`, `STORAGE_BACKEND=supabase`.
- One dashboard step you must do once: Supabase Dashboard → Storage → New bucket → name `moneta-uploads`, **Public ON** (the anon key can't create buckets — RLS blocks it, verified). Until the bucket exists, uploads fail with a clear `Supabase storage upload failed` message; everything else works.
- What "auth" means here: `SupabaseAuthProvider` extends the local session provider — sign-in sessions keep working exactly as before, plus best-effort Supabase linkage (sign-out propagates, `getUser` lookup with local fallback). No login migration needed.
- Netlify production: Site settings → Environment variables — set the same five vars (see 2b list + `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET`, `AUTH_BACKEND=supabase`, `STORAGE_BACKEND=supabase`). Never commit values.

Pre-deploy checklist (all true right now):

- `npm run build` passes with zero errors (SSR build — no `output: "export"`, so API routes work in production).
- Secrets live in App Hosting, never in the repo (`.env`, `service-account.json`, `data/*.json` are all gitignored).
- `data/backend.json` is gitignored, so production always uses `DB_BACKEND=firestore` from `apphosting.yaml`, no matter what your localhost is set to.
- `firestore.rules` denies all direct browser access (the app only talks to Firestore through the server Admin SDK).
- Note: file uploads on hosting use the local disk (`STORAGE_BACKEND` unset), which is ephemeral — uploads survive while the instance runs but not redeploys. For permanent uploads, set `FIREBASE_STORAGE_BUCKET` plus `STORAGE_BACKEND=firebase` in `apphosting.yaml`.

## 3. Expose it (same Wi-Fi, no Cloudflare)

The server listens on all interfaces (`0.0.0.0`), so any phone on the same Wi-Fi
can open it directly:

- Find your PC's address: `ipconfig` → IPv4 (e.g. `192.168.1.114`)
- On your phone (same Wi-Fi): open `http://192.168.1.114:3000`
- If it doesn't load, allow Node through Windows Firewall (private networks).

For internet access outside your home, either port-forward 3000 on your router
or use `scripts/expose-cloudflared.ps1` (Cloudflare tunnel, optional).

## 3. API key (easiest: in the app)

No file editing needed: open **Settings → AI key**, paste the key, hit
**Save & test key**. The app asks Google itself whether the key is accepted and
only stores it when Google says yes (stored on your PC in `data/ai-key.json`,
never committed). Fallback: put `GEMINI_API_KEY=...` in `.env` and restart.

Models wired:
- Text/insights: `GEMINI_LITE_MODEL=gemini-3.5-flash-lite`
- Agentic chat (read + write tools): `GEMINI_AGENT_MODEL=gemini-3.5-flash`
- Voice transcription fallback: `GEMINI_TRANSCRIBE_MODEL=gemini-3.1-flash-lite`
- True Live voice: `GEMINI_LIVE_MODEL=gemini-3.8-live-extended-thinking`

Without a working key everything still runs in **local mode** — the app never crashes.

> Never share keys in chat. If a key leaks, delete it in AI Studio and make a new one.

## 4. Phone / PWA install

- On your phone (same Wi-Fi): open `http://<your-PC-IP>:3000` → browser menu → **Install app / Add to Home Screen**.
- Manifest: `/manifest.webmanifest` (PNG 192 + 512, any + maskable), Apple touch icon, offline shell via `/sw.js`, standalone display.
- The layout is locked: no sideways panning on mobile (`overflow-x: clip` + single-column grids).

## 5. Verify it works

- `/api/health` → `{ ok: true, store: "json", app: "Moneta" }`
- Visiting `/` logged out shows the landing page; sign up → `/app` automatically.
- Visiting `/` while signed in redirects to `/app`.
- Settings (`/app/settings`): profile, currency convert, sample data, sign out, delete.
- `/app/ai`: Coach chat with tool confirmations; works with or without key.

## Phase 2 (shipped)

- Guided signup at `/onboarding`: name → student/adult → coach vibe (CometDial) → 4-digit app PIN (CodeSlots, skippable) → income/currency/sample data → ready screen. New accounts land here automatically; existing accounts skip it.
- App PIN lock: guards `/app` per tab (scrypt-hashed, verified server-side). Forgot-PIN recovery via account password. Change/remove in Settings → PIN lock.
- TRUE Live voice (Coach → Live tab + mic button in Coach bar): real Gemini Live API over WebSocket (`gemini-3.8-live-extended-thinking`) with native audio in/out, live input/output transcription, barge-in, session resumption, function tools (add/edit/delete + search transactions, spending, totals, budgets, goals, recurring), and the user's thinking level mapped to the session. The browser never holds the API key: the server mints a short-lived token per tap (`/api/ai/live-token`).
- Voice needs a secure context: phone browsers block the mic on plain `http://` LAN addresses. The app detects this and shows a 30-second fix (Chrome flag for your PC's address). With HTTPS or on localhost, voice just works.
- Thinking levels (Quick/Low/Deep/Max): settable in Settings → Coach, on the Coach page, and on the Voice page. Applies to chat agent + Live sessions.
- Micro-interactions (`src/components/micro.tsx`, tap-first, no hover): TapSparks, CodeSlots, HoldButton (Tx delete, clear data, delete account), RubberSegment (persona, trend switch, coach vibe), SquishSwitch, SpringCheck, BellToggle, Shredder (category delete), VoicePill, CometDial.
- Charts (`src/components/app/StatCharts.tsx`): line/area/bar trend with tap-to-select month, pie breakdown with side legend + markers, savings-rate gauge. Reports rebuilt around them. Note: blkit.com didn't load from here, so charts are hand-built SVG in the app's visual language.
- Notifications: Settings → bell toggle (permission-aware) + test button; dashboard fires one bill reminder per day for bills due within 3 days.

## API key status

Working — verified live against Google (chat, tools, Live token mint). If Coach
ever falls back to local mode with a "rejected" notice, open Settings → AI key:
the app tests the key with Google and shows the exact verdict. Quotes/whitespace
around pasted keys are sanitized automatically.
