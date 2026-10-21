import { NextResponse } from "next/server";
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
export async function boundedBody(request: Request, max = 16000) {
  if (Number(request.headers.get("content-length")) > max)
    throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body required");
  let body = "",
    bytes = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    body += decoder.decode(value, { stream: true });
  }
  return JSON.parse(body + decoder.decode());
}
