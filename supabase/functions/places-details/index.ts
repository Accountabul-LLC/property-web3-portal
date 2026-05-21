import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ALLOWED_ORIGIN") ?? "https://accountabul.lovable.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { placeId } = await req.json();
    if (!placeId) {
      return new Response(JSON.stringify({ error: "placeId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldMask = "addressComponents,formattedAddress";
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=en`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Google Places API error [${res.status}]: ${JSON.stringify(data)}`);
    }

    // Parse address components
    const components = data.addressComponents || [];
    const get = (type: string) =>
      components.find((c: any) => c.types?.includes(type))?.longText || "";
    const getShort = (type: string) =>
      components.find((c: any) => c.types?.includes(type))?.shortText || "";

    const parsed = {
      streetNumber: get("street_number"),
      route: get("route"),
      city: get("locality") || get("sublocality") || get("administrative_area_level_2"),
      state: getShort("administrative_area_level_1"),
      zip: get("postal_code"),
      country: getShort("country"),
      formattedAddress: data.formattedAddress || "",
    };

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Places details error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
