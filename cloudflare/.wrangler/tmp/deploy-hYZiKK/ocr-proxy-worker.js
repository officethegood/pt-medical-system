var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ocr-proxy-worker.js
var ocr_proxy_worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request, env) });
    }
    if (path.startsWith("/notify")) {
      const origin = request.headers.get("origin") || "";
      if (!isAllowedOrigin(origin, env)) {
        return jsonResponse({ error: "Origin not allowed", origin }, 403, request, env);
      }
      if (path === "/notify/health" && request.method === "GET") {
        return jsonResponse({
          ok: true,
          service: "notify",
          hasLine: !!env.LINE_ACCESS_TOKEN,
          hasTelegram: !!env.TELEGRAM_BOT_TOKEN,
          hasSupabase: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY)
        }, 200, request, env);
      }
      if (path === "/notify/send" && request.method === "POST") {
        return await handleNotifySend(request, env);
      }
      if (path === "/notify/test" && request.method === "POST") {
        return await handleNotifyTest(request, env);
      }
      return jsonResponse({ error: "Unknown /notify route", path }, 404, request, env);
    }
    return await handleOcr(request, env);
  }
};
async function handleNotifySend(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: "Worker missing SUPABASE_URL / SUPABASE_SERVICE_KEY secrets" }, 500, request, env);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request, env);
  }
  const caseId = String(body.case_id || "").trim();
  const alertType = String(body.alert_type || "").trim();
  const message = String(body.message || "").trim();
  const deepLink = String(body.deep_link || "").trim();
  if (!caseId || !alertType || !message) {
    return jsonResponse({ error: "case_id, alert_type, message required" }, 400, request, env);
  }
  const state = await sbSelect(
    env,
    "notification_state",
    `case_id=eq.${encodeURIComponent(caseId)}&alert_type=eq.${encodeURIComponent(alertType)}`
  );
  if (state && state.length > 0 && state[0].acknowledged === false) {
    await sbInsert(env, "notification_log", [{
      case_id: caseId,
      alert_type: alertType,
      channel: "all",
      status: "skipped",
      error: "debounced (not yet acked)",
      payload: { message }
    }]);
    return jsonResponse({ ok: true, skipped: true, reason: "debounced" }, 200, request, env);
  }
  const settings = await loadNotifySettings(env);
  const fullText = deepLink ? `${message}
${deepLink}` : message;
  const results = [];
  if (settings.NOTIFY_LINE_ENABLED === "true" && env.LINE_ACCESS_TOKEN) {
    const r = await sendLine(env, settings, fullText);
    results.push({ channel: "line", ...r });
  }
  if (settings.NOTIFY_TELEGRAM_ENABLED === "true" && env.TELEGRAM_BOT_TOKEN && settings.NOTIFY_TELEGRAM_CHAT_ID) {
    const r = await sendTelegram(env, settings.NOTIFY_TELEGRAM_CHAT_ID, fullText);
    results.push({ channel: "telegram", ...r });
  }
  if (results.length > 0) {
    await sbInsert(env, "notification_log", results.map((r) => ({
      case_id: caseId,
      alert_type: alertType,
      channel: r.channel,
      status: r.ok ? "sent" : "failed",
      error: r.ok ? null : r.error || "unknown",
      payload: { message: fullText }
    })));
  }
  await sbUpsert(env, "notification_state", [{
    case_id: caseId,
    alert_type: alertType,
    first_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
    acknowledged: false
  }], "case_id,alert_type");
  if (Math.random() < 0.05) {
    await sbRpc(env, "notification_log_cleanup").catch(() => {
    });
  }
  return jsonResponse({ ok: true, results }, 200, request, env);
}
__name(handleNotifySend, "handleNotifySend");
async function handleNotifyTest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request, env);
  }
  const channel = String(body.channel || "").toLowerCase();
  const message = String(body.message || "Test from PT Medical System").trim();
  const target = String(body.target || "").trim();
  if (channel === "line") {
    if (!env.LINE_ACCESS_TOKEN) return jsonResponse({ error: "LINE_ACCESS_TOKEN not set" }, 400, request, env);
    const settings = await loadNotifySettings(env).catch(() => ({}));
    if (target) settings.NOTIFY_LINE_TARGETS = target;
    const r = await sendLine(env, settings, message);
    return jsonResponse(r, r.ok ? 200 : 502, request, env);
  }
  if (channel === "telegram") {
    if (!env.TELEGRAM_BOT_TOKEN) return jsonResponse({ error: "TELEGRAM_BOT_TOKEN not set" }, 400, request, env);
    const chatId = target || (await loadNotifySettings(env).catch(() => ({}))).NOTIFY_TELEGRAM_CHAT_ID;
    if (!chatId) return jsonResponse({ error: "No chat_id (set NOTIFY_TELEGRAM_CHAT_ID or pass target)" }, 400, request, env);
    const r = await sendTelegram(env, chatId, message);
    return jsonResponse(r, r.ok ? 200 : 502, request, env);
  }
  return jsonResponse({ error: 'channel must be "line" or "telegram"' }, 400, request, env);
}
__name(handleNotifyTest, "handleNotifyTest");
async function sendLine(env, settings, text) {
  const targetType = (settings.NOTIFY_LINE_TARGET_TYPE || "broadcast").trim();
  const targetsRaw = (settings.NOTIFY_LINE_TARGETS || "").trim();
  let url, payload;
  const messages = [{ type: "text", text: text.slice(0, 5e3) }];
  if (targetType === "broadcast") {
    url = "https://api.line.me/v2/bot/message/broadcast";
    payload = { messages };
  } else {
    let ids;
    try {
      ids = targetsRaw.startsWith("[") ? JSON.parse(targetsRaw) : [targetsRaw];
    } catch {
      ids = [targetsRaw];
    }
    ids = ids.filter(Boolean);
    if (ids.length === 0) return { ok: false, error: "No Line targets configured" };
    if (targetType === "group" && ids.length === 1) {
      url = "https://api.line.me/v2/bot/message/push";
      payload = { to: ids[0], messages };
    } else {
      url = "https://api.line.me/v2/bot/message/multicast";
      payload = { to: ids, messages };
    }
  }
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { ok: false, error: `Line ${resp.status}: ${t.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
__name(sendLine, "sendLine");
async function sendTelegram(env, chatId, text) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4e3), disable_web_page_preview: false })
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { ok: false, error: `Telegram ${resp.status}: ${t.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
__name(sendTelegram, "sendTelegram");
async function loadNotifySettings(env) {
  const keys = [
    "NOTIFY_LINE_ENABLED",
    "NOTIFY_LINE_TARGET_TYPE",
    "NOTIFY_LINE_TARGETS",
    "NOTIFY_TELEGRAM_ENABLED",
    "NOTIFY_TELEGRAM_CHAT_ID"
  ];
  const inList = keys.map((k) => `"${k}"`).join(",");
  const rows = await sbSelect(env, "settings", `key=in.(${inList})`);
  const out = {};
  (rows || []).forEach((r) => {
    out[r.key] = r.value;
  });
  return out;
}
__name(loadNotifySettings, "loadNotifySettings");
async function sbSelect(env, table, query) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: sbHeaders(env)
  });
  if (!resp.ok) throw new Error(`sbSelect ${table}: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}
__name(sbSelect, "sbSelect");
async function sbInsert(env, table, rows) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders(env), "Prefer": "return=minimal" },
    body: JSON.stringify(rows)
  });
  if (!resp.ok) throw new Error(`sbInsert ${table}: ${resp.status} ${await resp.text()}`);
}
__name(sbInsert, "sbInsert");
async function sbUpsert(env, table, rows, onConflict) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { ...sbHeaders(env), "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  });
  if (!resp.ok) throw new Error(`sbUpsert ${table}: ${resp.status} ${await resp.text()}`);
}
__name(sbUpsert, "sbUpsert");
async function sbRpc(env, fn, params) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...sbHeaders(env), "Prefer": "return=minimal" },
    body: JSON.stringify(params || {})
  });
  if (!resp.ok) throw new Error(`sbRpc ${fn}: ${resp.status}`);
}
__name(sbRpc, "sbRpc");
function sbHeaders(env) {
  return {
    "apikey": env.SUPABASE_SERVICE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };
}
__name(sbHeaders, "sbHeaders");
async function handleOcr(request, env) {
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
      headers: { "Content-Type": "application/json", ...corsHeaders(request, env) }
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, request, env);
  }
}
__name(handleOcr, "handleOcr");
function isAllowedOrigin(origin, env) {
  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === "") return true;
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) || allowed.includes("*");
}
__name(isAllowedOrigin, "isAllowedOrigin");
function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "*";
  const allowedOrigin = isAllowedOrigin(origin, env) ? origin || "*" : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) }
  });
}
__name(jsonResponse, "jsonResponse");
export {
  ocr_proxy_worker_default as default
};
//# sourceMappingURL=ocr-proxy-worker.js.map
