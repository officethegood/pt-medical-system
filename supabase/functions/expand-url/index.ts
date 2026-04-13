// Supabase Edge Function: expand-url
// ทำหน้าที่เหมือน GAS loc_expandGoogleMapsLink() — follow redirects แล้วดึงพิกัด
// Deploy: supabase functions deploy expand-url --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, message: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Follow redirects manually (like GAS UrlFetchApp with followRedirects: false)
    let currentUrl = url;
    for (let i = 0; i < 10; i++) {
      const response = await fetch(currentUrl, { redirect: "manual" });
      const code = response.status;
      if (code >= 300 && code < 400) {
        const location = response.headers.get("location");
        if (location) {
          currentUrl = location;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Try to extract lat/lng from the final URL
    const patterns = [
      /!3d([-]?[0-9]+\.[0-9]+)!4d([-]?[0-9]+\.[0-9]+)/,
      /@([-]?[0-9]+\.[0-9]+),([-]?[0-9]+\.[0-9]+)/,
      /[?&/]q=([-]?[0-9]+\.[0-9]+),([-]?[0-9]+\.[0-9]+)/,
      /\/search\/([-]?[0-9]+\.[0-9]+)[,+]+([-]?[0-9]+\.[0-9]+)/,
      /[?&]ll=([-]?[0-9]+\.[0-9]+),([-]?[0-9]+\.[0-9]+)/,
      /[?&]center=([-]?[0-9]+\.[0-9]+),([-]?[0-9]+\.[0-9]+)/,
    ];

    for (const pattern of patterns) {
      const match = currentUrl.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return new Response(
            JSON.stringify({ success: true, lat: lat.toFixed(6), lng: lng.toFixed(6), resolvedUrl: currentUrl }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: "ไม่พบพิกัดในลิงก์", resolvedUrl: currentUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, message: "Error: " + (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
