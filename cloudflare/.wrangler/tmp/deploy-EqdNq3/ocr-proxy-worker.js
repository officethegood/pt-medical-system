var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ocr-proxy-worker.js
var ocr_proxy_worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request, env) });
    }
    if (request.method === "GET") {
      return jsonResponse({
        ok: true,
        service: "ocr-proxy",
        hasKey: !!env.GEMINI_API_KEY,
        note: "POST with {image, prompt} for OCR"
      }, 200, request, env);
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. Use POST." }, 405, request, env);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: "Server not configured: missing GEMINI_API_KEY secret" }, 500, request, env);
    }
    try {
      const url = new URL(request.url);
      const model = url.searchParams.get("model") || "gemini-2.5-pro";
      const allowedModels = [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
      ];
      if (!allowedModels.includes(model)) {
        return jsonResponse({ error: "Model not allowed", model }, 400, request, env);
      }
      const origin = request.headers.get("origin") || "";
      if (!isAllowedOrigin(origin, env)) {
        return jsonResponse({ error: "Origin not allowed", origin }, 403, request, env);
      }
      const body = await request.text();
      try {
        const parsed = JSON.parse(body);
        if (!parsed.contents) throw new Error("missing contents");
      } catch (e) {
        return jsonResponse({ error: "Invalid request body: " + e.message }, 400, request, env);
      }
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      const text = await resp.text();
      return new Response(text, {
        status: resp.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(request, env)
        }
      });
    } catch (err) {
      return jsonResponse({ error: err.message }, 500, request, env);
    }
  }
};
function isAllowedOrigin(origin, env) {
  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === "") {
    return true;
  }
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) || allowed.includes("*");
}
__name(isAllowedOrigin, "isAllowedOrigin");
function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "*";
  const allowedOrigin = isAllowedOrigin(origin, env) ? origin || "*" : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request, env)
    }
  });
}
__name(jsonResponse, "jsonResponse");
export {
  ocr_proxy_worker_default as default
};
//# sourceMappingURL=ocr-proxy-worker.js.map
