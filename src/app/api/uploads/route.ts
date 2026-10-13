import { getCurrentUser } from "@/lib/auth";
import { getStorageProvider, storageBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

/** Auth-gated multipart upload. Form field: "file". Returns { url, key }. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const f = form.get("file");
  if (!(f instanceof File)) {
    return Response.json({ error: "Attach a file as form field “file”." }, { status: 400 });
  }
  if (f.size === 0) return Response.json({ error: "File is empty." }, { status: 400 });
  if (f.size > MAX_BYTES) {
    return Response.json({ error: "File too large — 8MB max." }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await f.arrayBuffer());
    const result = await getStorageProvider().upload(user.id, f.name || "file", buffer, f.type || "application/octet-stream");
    return Response.json({ ...result, backend: storageBackend() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 500 });
  }
}
