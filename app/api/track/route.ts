import { serverSupabase } from "@/lib/supabase/server";
import { trackingSchema } from "@/lib/report-schema";
import { boundedBody, json } from "@/lib/http";
import { sameOrigin } from "@/lib/security";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid origin" }, 403);
  try {
    const parsed = trackingSchema.safeParse(await boundedBody(request, 2048));
    if (!parsed.success)
      return json(
        { error: "Check the tracking reference and access key" },
        400,
      );
    const client = await serverSupabase();
    const { data, error } = await client.rpc("track_civic_report", {
      reference: parsed.data.reference,
      access_secret: parsed.data.secret,
    });
    if (error)
      return json({ error: "Tracking is temporarily unavailable" }, 503);
    return data
      ? json(data)
      : json(
          {
            error:
              "No accessible report found. Sign in as the owner or supply the private access key.",
          },
          404,
        );
  } catch {
    return json({ error: "Invalid tracking request" }, 400);
  }
}
