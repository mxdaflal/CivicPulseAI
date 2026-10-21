const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const identity = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/auth/v1/user`,
      {
        headers: {
          Authorization: authorization,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!identity.ok)
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: corsHeaders,
      });
    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");

    if (
      !lat ||
      !lon ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lon)) ||
      Math.abs(Number(lat)) > 90 ||
      Math.abs(Number(lon)) > 180
    ) {
      return new Response(
        JSON.stringify({ error: "Missing lat or lon parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;

    const geoRes = await fetch(geoUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "CivicPulseAI/1.0 (civic-pulse-app)",
        "Accept-Language": "en",
        Accept: "application/json",
      },
    });

    if (!geoRes.ok) {
      const errText = await geoRes.text();
      console.error(`Nominatim API error ${geoRes.status}`);
      return new Response(
        JSON.stringify({ error: `Geocoding failed (${geoRes.status})` }),
        {
          status: geoRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await geoRes.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Geocode error:", err);
    return new Response(JSON.stringify({ error: "Geocoding request failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
