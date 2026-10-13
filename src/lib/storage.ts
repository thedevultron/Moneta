import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { dataDir } from "@/db/jsondb";

export type UploadResult = { url: string; key: string };

export interface StorageProvider {
  upload(userId: number, filename: string, buffer: Buffer, mime: string): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

/** Strip directories + unsafe chars so the key is a single URL-safe segment. */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name || "file").trim() || "file";
  const clean = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-{2,}/g, "-").slice(0, 100);
  return clean.replace(/^[.-]+/, "") || "file";
}

/** Keys are flat single-segment ids: "<userId>_<time36>_<rand>_<sanitized>". */
export function buildKey(userId: number, filename: string): string {
  const rand = randomBytes(8).toString("hex");
  return `${userId}_${Date.now().toString(36)}_${rand}_${sanitizeFilename(filename)}`;
}

function assertSafeKey(key: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(key) || key.includes("..")) {
    throw new Error("Invalid file key.");
  }
}

type FileMeta = { mime: string; filename: string; userId: number; size: number; createdAt: string };

export class LocalStorageProvider implements StorageProvider {
  async upload(userId: number, filename: string, buffer: Buffer, mime: string): Promise<UploadResult> {
    const key = buildKey(userId, filename);
    const dir = uploadsDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), buffer);
    const meta: FileMeta = {
      mime: mime || "application/octet-stream",
      filename: sanitizeFilename(filename),
      userId,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(dir, `${key}.meta.json`), JSON.stringify(meta) + "\n", "utf8");
    return { key, url: await this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    const dir = uploadsDir();
    await fs.unlink(path.join(dir, key)).catch(() => {});
    await fs.unlink(path.join(dir, `${key}.meta.json`)).catch(() => {});
  }

  async getUrl(key: string): Promise<string> {
    assertSafeKey(key);
    return `/api/files/${encodeURIComponent(key)}`;
  }
}

/** Read a locally stored upload (used by GET /api/files/[key]). */
export async function readLocalFile(key: string): Promise<{ buffer: Buffer; meta: FileMeta } | null> {
  try {
    assertSafeKey(key);
  } catch {
    return null;
  }
  const dir = uploadsDir();
  try {
    const [buffer, rawMeta] = await Promise.all([
      fs.readFile(path.join(dir, key)),
      fs.readFile(path.join(dir, `${key}.meta.json`), "utf8").catch(() => null),
    ]);
    let meta: FileMeta;
    try {
      meta = rawMeta ? (JSON.parse(rawMeta) as FileMeta) : ({} as FileMeta);
    } catch {
      meta = {} as FileMeta;
    }
    return {
      buffer,
      meta: {
        mime: meta.mime || "application/octet-stream",
        filename: meta.filename || key,
        userId: meta.userId ?? 0,
        size: meta.size ?? buffer.length,
        createdAt: meta.createdAt || new Date().toISOString(),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Future Firebase Storage migration path.
 *
 * Intended design:
 * - Server uses firebase-admin: `getStorage(app).bucket(bucketName)` where
 *   bucketName = FIREBASE_STORAGE_BUCKET (e.g. "<project-id>.appspot.com").
 * - upload() -> bucket.file(key).save(buffer, { contentType: mime }) with
 *   per-user prefixes (e.g. `uploads/<userId>/<key>`).
 * - getUrl() -> bucket.file(key).getSignedUrl({ action: "read", expires: … })
 *   or a public URL when the bucket/object is public.
 * - delete() -> bucket.file(key).delete().
 */
export class FirebaseStorageProvider implements StorageProvider {
  private bucketName(): string {
    const name = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!name) {
      throw new Error(
        "Firebase Storage is not configured. Set FIREBASE_STORAGE_BUCKET (e.g. <project-id>.appspot.com) plus Firebase credentials (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_JSON) to enable the firebase storage backend.",
      );
    }
    return name;
  }

  private async bucket() {
    const { getApp, getApps, initializeApp, applicationDefault, cert } = await import("firebase-admin/app");
    const { getStorage } = await import("firebase-admin/storage");
    let app;
    if (getApps().length) {
      app = getApp();
    } else {
      const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (inline) {
        const svc = JSON.parse(inline) as { project_id?: string; client_email?: string; private_key?: string };
        app = initializeApp({
          credential: cert({ projectId: svc.project_id, clientEmail: svc.client_email, privateKey: svc.private_key } as never),
          storageBucket: this.bucketName(),
        });
      } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        app = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          } as never),
          storageBucket: this.bucketName(),
        });
      } else {
        try {
          app = initializeApp({ credential: applicationDefault(), storageBucket: this.bucketName() });
        } catch {
          app = initializeApp({ storageBucket: this.bucketName() });
        }
      }
    }
    return getStorage(app).bucket(this.bucketName());
  }

  async upload(userId: number, filename: string, buffer: Buffer, mime: string): Promise<UploadResult> {
    const key = `uploads/${userId}/${buildKey(userId, filename)}`;
    const b = await this.bucket();
    await b.file(key).save(buffer, { contentType: mime || "application/octet-stream", resumable: false });
    return { key, url: await this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const b = await this.bucket();
    await b.file(key).delete({ ignoreNotFound: true });
  }

  async getUrl(key: string): Promise<string> {
    const b = await this.bucket();
    const [url] = await b.file(key).getSignedUrl({ action: "read", expires: Date.now() + 7 * 24 * 3600_000 });
    return url;
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  private bucketName(): string {
    return (process.env.SUPABASE_STORAGE_BUCKET || "moneta-uploads").trim();
  }

  private async client() {
    const { getSupabaseAdmin, getSupabase } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin() || getSupabase();
    if (!supabase) {
      throw new Error(
        "Supabase Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.",
      );
    }
    return supabase;
  }

  async upload(userId: number, filename: string, buffer: Buffer, mime: string): Promise<UploadResult> {
    const key = `uploads/${userId}/${buildKey(userId, filename)}`;
    const supabase = await this.client();
    const bucket = this.bucketName();

    const { error } = await supabase.storage.from(bucket).upload(key, buffer, {
      contentType: mime || "application/octet-stream",
      upsert: true,
    });

    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }

    return { key, url: await this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const supabase = await this.client();
    const bucket = this.bucketName();
    await supabase.storage.from(bucket).remove([key]);
  }

  async getUrl(key: string): Promise<string> {
    const supabase = await this.client();
    const bucket = this.bucketName();
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  }
}

function resolveStorageProvider(): StorageProvider {
  const backend = process.env.STORAGE_BACKEND?.toLowerCase();
  if (backend === "supabase") return new SupabaseStorageProvider();
  if (backend === "firebase") return new FirebaseStorageProvider();
  return new LocalStorageProvider();
}

let provider: StorageProvider = resolveStorageProvider();

/** Swap the active storage backend (tests / future migration). */
export function setStorageProvider(p: StorageProvider): void {
  provider = p;
}

export function getStorageProvider(): StorageProvider {
  const backend = process.env.STORAGE_BACKEND?.toLowerCase();
  if (backend === "supabase" && !(provider instanceof SupabaseStorageProvider)) {
    provider = new SupabaseStorageProvider();
  } else if (backend === "firebase" && !(provider instanceof FirebaseStorageProvider)) {
    provider = new FirebaseStorageProvider();
  }
  return provider;
}

export function storageBackend(): "local" | "firebase" | "supabase" {
  const backend = process.env.STORAGE_BACKEND?.toLowerCase();
  if (backend === "supabase") return "supabase";
  if (backend === "firebase") return "firebase";
  return "local";
}

export const storage: StorageProvider = new Proxy({} as StorageProvider, {
  get(_t, prop: keyof StorageProvider) {
    const p = getStorageProvider() as unknown as Record<string, unknown>;
    const v = p[prop as string];
    return typeof v === "function" ? (v as (...a: never[]) => unknown).bind(p) : v;
  },
});

