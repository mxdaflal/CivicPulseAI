import { json } from "@/lib/http";
// Manual, user-initiated reverse lookup only. At most one upstream request per second per process.
let nextRequest = 0;
const cache = new Map<string, { expires: number; data: unknown }>();
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const lat = Number(query.get("lat")),
    lon = Number(query.get("lon"));
  if (
    !query.has("lat") ||
    !query.has("lon") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return json({ error: "Invalid coordinates" }, 400);
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return json(hit.data);
  // Authenticated lookup prevents an unrestricted proxy. Guests may enter a location manually.
  const { serverSupabase } = await import("@/lib/supabase/server");
  const client = await serverSupabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return json(
      { error: "Sign in for address lookup, or enter the location manually" },
      401,
    );
  if (Date.now() < nextRequest)
    return json({ error: "Please wait a moment before another lookup" }, 429);
  nextRequest = Date.now() + 1100;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "CivicPulseAI prototype reverse-geocoder",
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok)
      return json(
        { error: "Address service unavailable. Enter an address manually." },
        503,
      );
    const data = await response.json();
    if (cache.size > 500) cache.clear();
    cache.set(key, { expires: Date.now() + 86400000, data });
    return json(data);
  } catch {
    return json(
      {
        error:
          "Address lookup timed out. Your coordinates are still available.",
      },
      503,
    );
  }
}
