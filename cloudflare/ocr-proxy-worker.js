/**
 * OCR Proxy — Cloudflare Worker
 * ซ่อน Gemini API key จาก browser + centralize billing
 *
 * Secrets required (ตั้งผ่าน `wrangler secret put`):
 *   GEMINI_API_KEY  — Gemini API key ของหน่วยงาน
 *
 * Optional env:
 *   ALLOWED_ORIGINS — comma-separated (e.g. "https://xxx.pages.dev,https://abc.com")
 *                     ถ้าไม่ตั้ง → อนุญาตทุก origin (ไม่แนะนำ production)
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request, env) });
    }

    // Health check — admin latency panel pings GET /; return 200 instead of 405
    // so Chrome DevTools doesn't spam red errors. Real OCR still requires POST below.
    if (request.method === 'GET') {
      return jsonResponse({
        ok: true,
        service: 'ocr-proxy',
        hasKey: !!env.GEMINI_API_KEY,
        note: 'POST with {image, prompt} for OCR'
      }, 200, request, env);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405, request, env);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'Server not configured: missing GEMINI_API_KEY secret' }, 500, request, env);
    }

    try {
      const url = new URL(request.url);
      const model = url.searchParams.get('model') || 'gemini-2.5-pro';

      // Whitelist models to prevent abuse
      const allowedModels = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
      ];
      if (!allowedModels.includes(model)) {
        return jsonResponse({ error: 'Model not allowed', model }, 400, request, env);
      }

      const origin = request.headers.get('origin') || '';
      if (!isAllowedOrigin(origin, env)) {
        return jsonResponse({ error: 'Origin not allowed', origin }, 403, request, env);
      }

      // Forward body as-is to Gemini
      const body = await request.text();

      // Basic sanity check: must be JSON with `contents` field (Gemini request shape)
      try {
        const parsed = JSON.parse(body);
        if (!parsed.contents) throw new Error('missing contents');
      } catch (e) {
        return jsonResponse({ error: 'Invalid request body: ' + e.message }, 400, request, env);
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const resp = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      const text = await resp.text();
      return new Response(text, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request, env)
        }
      });

    } catch (err) {
      return jsonResponse({ error: err.message }, 500, request, env);
    }
  }
};

function isAllowedOrigin(origin, env) {
  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === '') {
    // No whitelist configured → allow all (dev mode)
    return true;
  }
  const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(origin) || allowed.includes('*');
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '*';
  const allowedOrigin = isAllowedOrigin(origin, env) ? (origin || '*') : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request, env)
    }
  });
}
