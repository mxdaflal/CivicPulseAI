import { serverSupabase } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/security";
import { validImageHeader } from "@/lib/report-schema";
import { json } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid origin" }, 403);
  const client = await serverSupabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to upload private evidence" }, 401);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "File required" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5242880 + 16384) {
        await reader.cancel();
        return json({ error: "Image must be under 5 MB" }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 5242880 ||
      file.size < 12 ||
      !validImageHeader(
        new Uint8Array(await file.slice(0, 12).arrayBuffer()),
        file.type,
      )
    )
      return json(
        { error: "Choose a valid JPEG, PNG or WebP image under 5 MB" },
        400,
      );
    const path = `${user.id}/${crypto.randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"}`;
    const { error } = await client.storage
      .from("evidence")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error)
      return json({ error: "Private evidence could not be saved" }, 400);
    return json({ path }, 201);
  } catch {
    return json({ error: "Invalid evidence upload" }, 400);
  }
}
