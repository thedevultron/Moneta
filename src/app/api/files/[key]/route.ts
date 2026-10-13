import { getCurrentUser } from "@/lib/auth";
import { getStorageProvider, readLocalFile, storageBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };

/** Auth-gated file download. Local backend streams from ./data/uploads. */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await ctx.params;
  const decoded = decodeURIComponent(key);

  if (storageBackend() === "firebase") {
    // Firebase objects are served via signed URLs, not streamed locally.
    try {
      const url = await getStorageProvider().getUrl(decoded);
      return Response.redirect(url, 302);
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Not found" }, { status: 404 });
    }
  }

  const hit = await readLocalFile(decoded);
  if (!hit) return Response.json({ error: "Not found" }, { status: 404 });

  const bytes = new Uint8Array(hit.buffer);
  return new Response(bytes, {
    headers: {
      "Content-Type": hit.meta.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${hit.meta.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
