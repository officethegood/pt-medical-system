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
      const isServerToServer = path === "/notify/check";
      if (!isServerToServer) {
        const origin = request.headers.get("origin") || "";
        if (!isAllowedOrigin(origin, env)) {
          return jsonResponse({ error: "Origin not allowed", origin }, 403, request, env);
        }
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
      if (path === "/notify/check" && request.method === "POST") return await handleNotifyCheck(request, env);
      if (path === "/notify/send" && request.method === "POST") return await handleNotifySend(request, env);
      if (path === "/notify/test" && request.method === "POST") return await handleNotifyTest(request, env);
      return jsonResponse({ error: "Unknown /notify route", path }, 404, request, env);
    }
    return await handleOcr(request, env);
  }
};
async function handleNotifyCheck(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: "Worker missing SUPABASE_URL / SUPABASE_SERVICE_KEY" }, 500, request, env);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request, env);
  }
  const rec = body.record || body.new || body;
  if (!rec || !rec.case_id) {
    return jsonResponse({ ok: true, skipped: "no case_id in payload" }, 200, request, env);
  }
  const oldRec = body.old_record || body.old || null;
  if (oldRec && JSON.stringify(oldRec.raw_data || {}) === JSON.stringify(rec.raw_data || {})) {
    return jsonResponse({ ok: true, skipped: "raw_data unchanged" }, 200, request, env);
  }
  const detected = detectCritical(rec);
  if (!detected.critical) {
    return jsonResponse({ ok: true, skipped: "not critical" }, 200, request, env);
  }
  const stateRows = await sbSelect(
    env,
    "notification_state",
    `case_id=eq.${encodeURIComponent(rec.case_id)}&alert_type=eq.CRITICAL`
  );
  const state = stateRows && stateRows[0];
  let decision = "send";
  let reason = "first send";
  if (state) {
    if (state.acknowledged === true) {
      decision = "send";
      reason = "refire after ack";
    } else {
      const diff = compareSeverity(state.last_payload && state.last_payload.severity, detected.severity);
      if (diff.worse) {
        decision = "send";
        reason = diff.reason;
      } else {
        decision = "skip";
        reason = diff.reason;
      }
    }
  }
  if (decision === "skip") {
    await sbInsert(env, "notification_log", [{
      case_id: rec.case_id,
      alert_type: "CRITICAL",
      channel: "all",
      status: "skipped",
      error: reason,
      payload: { severity: detected.severity, alerts: detected.alerts }
    }]);
    return jsonResponse({ ok: true, skipped: reason }, 200, request, env);
  }
  const msg = composeCriticalMessage(rec, detected);
  const baseUrl = (env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const deepLink = baseUrl ? `${baseUrl}/monitor/?case=${encodeURIComponent(rec.case_id)}` : "";
  const fullText = deepLink ? `${msg}
${deepLink}` : msg;
  const settings = await loadNotifySettings(env);
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
      case_id: rec.case_id,
      alert_type: "CRITICAL",
      channel: r.channel,
      status: r.ok ? "sent" : "failed",
      error: r.ok ? reason : r.error || "unknown",
      payload: { message: fullText, severity: detected.severity, alerts: detected.alerts }
    })));
  }
  await sbUpsert(env, "notification_state", [{
    case_id: rec.case_id,
    alert_type: "CRITICAL",
    first_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    last_payload: { severity: detected.severity, alerts: detected.alerts, at: (/* @__PURE__ */ new Date()).toISOString() }
  }], "case_id,alert_type");
  if (Math.random() < 0.05) {
    await sbRpc(env, "notification_log_cleanup").catch(() => {
    });
  }
  return jsonResponse({ ok: true, sent: results, reason }, 200, request, env);
}
__name(handleNotifyCheck, "handleNotifyCheck");
function detectCritical(row) {
  const snap = safeParseJSON(row.raw_data && row.raw_data.rawSnapshot) || {};
  const vArr = safeParseJSON(row.raw_data && row.raw_data.vitalsJson) || [];
  let hasArrest = false;
  for (const v of vArr) {
    if (v.type === "arrest" && v.arrest_outcome !== "ROSC" && v.arrest_outcome !== "Terminate CPR" && v.arrest_outcome !== "Dead") {
      hasArrest = true;
      break;
    }
  }
  if (!hasArrest && (snap["circ_arrest"] || snap["arrest_pre_arrest"])) hasArrest = true;
  const initVs = {
    bp: snap["init_bp"] || "",
    pr: snap["init_pr"] || "",
    rr: snap["init_rr"] || "",
    spo2: snap["init_spo2"] || "",
    gcs_e: snap["gcs_e"] || "",
    gcs_v: snap["gcs_v"] || "",
    gcs_m: snap["gcs_m"] || ""
  };
  let latestLog = null;
  for (let i = vArr.length - 1; i >= 0; i--) {
    if (vArr[i].type !== "arrest") {
      latestLog = vArr[i];
      break;
    }
  }
  const pick = /* @__PURE__ */ __name((k) => latestLog && latestLog[k] != null && latestLog[k] !== "" ? latestLog[k] : initVs[k], "pick");
  const vs = {
    bp: pick("bp"),
    pr: pick("pr"),
    rr: pick("rr"),
    spo2: pick("spo2"),
    gcs_e: pick("gcs_e"),
    gcs_v: pick("gcs_v"),
    gcs_m: pick("gcs_m")
  };
  const toInt = /* @__PURE__ */ __name((s) => {
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  }, "toInt");
  const alerts = [];
  const severity = {};
  if (hasArrest) {
    alerts.push({ type: "ARREST", label: "Cardiac Arrest" });
    severity.arrest = true;
  }
  const spo2 = toInt(vs.spo2);
  if (spo2 !== null) {
    severity.spo2 = spo2;
    if (spo2 < 90) alerts.push({ type: "SPO2_LOW", label: `SpO2 ${spo2}%` });
  }
  const pr = toInt(vs.pr);
  if (pr !== null) {
    severity.hr = pr;
    if (pr < 50 || pr > 140) alerts.push({ type: "HR_ABNORMAL", label: `HR ${pr}` });
  }
  const rr = toInt(vs.rr);
  if (rr !== null) {
    severity.rr = rr;
    if (rr < 10 || rr > 30) alerts.push({ type: "RR_ABNORMAL", label: `RR ${rr}` });
  }
  if (vs.bp && /^(\d+)\s*\/\s*(\d+)$/.test(String(vs.bp).trim())) {
    const m = String(vs.bp).trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    const sbp = parseInt(m[1], 10);
    severity.bp_sbp = sbp;
    severity.bp_raw = vs.bp;
    if (sbp < 90 || sbp > 200) alerts.push({ type: "BP_ABNORMAL", label: `BP ${vs.bp}` });
  }
  const ge = toInt(vs.gcs_e), gm = toInt(vs.gcs_m);
  const gv = vs.gcs_v === "VT" ? 1 : toInt(vs.gcs_v);
  if (ge !== null && gv !== null && gm !== null) {
    const total = ge + gv + gm;
    severity.gcs = total;
    if (total < 8) alerts.push({ type: "GCS_LOW", label: `GCS ${total}` });
  }
  return { critical: alerts.length > 0, alerts, severity };
}
__name(detectCritical, "detectCritical");
function compareSeverity(oldSev, newSev) {
  if (!oldSev) return { worse: true, reason: "no previous severity" };
  if (newSev.arrest && !oldSev.arrest) return { worse: true, reason: "arrest new" };
  const distHR = /* @__PURE__ */ __name((v) => v == null ? 0 : v < 50 ? 50 - v : v > 140 ? v - 140 : 0, "distHR");
  const distRR = /* @__PURE__ */ __name((v) => v == null ? 0 : v < 10 ? 10 - v : v > 30 ? v - 30 : 0, "distRR");
  const distSpO2 = /* @__PURE__ */ __name((v) => v == null ? 0 : v < 90 ? 90 - v : 0, "distSpO2");
  const distBP = /* @__PURE__ */ __name((v) => v == null ? 0 : v < 90 ? 90 - v : v > 200 ? v - 200 : 0, "distBP");
  const distGCS = /* @__PURE__ */ __name((v) => v == null ? 0 : v < 8 ? 8 - v : 0, "distGCS");
  const pairs = [
    ["HR", distHR(oldSev.hr), distHR(newSev.hr)],
    ["RR", distRR(oldSev.rr), distRR(newSev.rr)],
    ["SpO2", distSpO2(oldSev.spo2), distSpO2(newSev.spo2)],
    ["BP", distBP(oldSev.bp_sbp), distBP(newSev.bp_sbp)],
    ["GCS", distGCS(oldSev.gcs), distGCS(newSev.gcs)]
  ];
  for (const [name, od, nd] of pairs) {
    if (nd > od && nd > 0) return { worse: true, reason: `${name} worse (${od} \u2192 ${nd})` };
    if (od === 0 && nd > 0) return { worse: true, reason: `${name} new alert` };
  }
  return { worse: false, reason: "same or better" };
}
__name(compareSeverity, "compareSeverity");
function composeCriticalMessage(rec, detected) {
  const pi = rec.patient_info || {};
  const op = rec.op_info || {};
  const shortId = (rec.case_id || "").replace("CASE-", "");
  const alertList = detected.alerts.map((a) => a.label).join(" \xB7 ");
  return [
    `\u{1F6A8} CRITICAL \u2014 #${shortId}`,
    `\u0E1C\u0E39\u0E49\u0E1B\u0E48\u0E27\u0E22: ${pi.name || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"} (${pi.age || "-"} \u0E1B\u0E35)`,
    `\u0E08\u0E32\u0E01: ${pi.origin || "-"} \u2192 ${pi.destination || "-"}`,
    `\u0E23\u0E16: ${op.level || "-"} / ${op.unitNo || "-"}`,
    `\u26A0\uFE0F ${alertList}`
  ].join("\n");
}
__name(composeCriticalMessage, "composeCriticalMessage");
function safeParseJSON(v) {
  if (!v) return null;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
__name(safeParseJSON, "safeParseJSON");
async function handleNotifySend(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: "Worker missing SUPABASE_URL / SUPABASE_SERVICE_KEY" }, 500, request, env);
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
  const stateRows = await sbSelect(
    env,
    "notification_state",
    `case_id=eq.${encodeURIComponent(caseId)}&alert_type=eq.${encodeURIComponent(alertType)}`
  );
  const state = stateRows && stateRows[0];
  if (state && state.acknowledged === false) {
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
    results.push({ channel: "line", ...await sendLine(env, settings, fullText) });
  }
  if (settings.NOTIFY_TELEGRAM_ENABLED === "true" && env.TELEGRAM_BOT_TOKEN && settings.NOTIFY_TELEGRAM_CHAT_ID) {
    results.push({ channel: "telegram", ...await sendTelegram(env, settings.NOTIFY_TELEGRAM_CHAT_ID, fullText) });
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
    if (!chatId) return jsonResponse({ error: "No chat_id" }, 400, request, env);
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
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.LINE_ACCESS_TOKEN}` },
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
  const keys = ["NOTIFY_LINE_ENABLED", "NOTIFY_LINE_TARGET_TYPE", "NOTIFY_LINE_TARGETS", "NOTIFY_TELEGRAM_ENABLED", "NOTIFY_TELEGRAM_CHAT_ID"];
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
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders(env) });
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
    return jsonResponse({ ok: true, service: "ocr-proxy", hasKey: !!env.GEMINI_API_KEY, note: "POST with {image, prompt} for OCR" }, 200, request, env);
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed. Use POST." }, 405, request, env);
  if (!env.GEMINI_API_KEY) return jsonResponse({ error: "Server not configured: missing GEMINI_API_KEY secret" }, 500, request, env);
  try {
    const url = new URL(request.url);
    const model = url.searchParams.get("model") || "gemini-2.5-pro";
    const allowedModels = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro"];
    if (!allowedModels.includes(model)) return jsonResponse({ error: "Model not allowed", model }, 400, request, env);
    const origin = request.headers.get("origin") || "";
    if (!isAllowedOrigin(origin, env)) return jsonResponse({ error: "Origin not allowed", origin }, 403, request, env);
    const body = await request.text();
    try {
      const parsed = JSON.parse(body);
      if (!parsed.contents) throw new Error("missing contents");
    } catch (e) {
      return jsonResponse({ error: "Invalid request body: " + e.message }, 400, request, env);
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
    const resp = await fetch(geminiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { "Content-Type": "application/json", ...corsHeaders(request, env) } });
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
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders(request, env) } });
}
__name(jsonResponse, "jsonResponse");
export {
  ocr_proxy_worker_default as default
};
//# sourceMappingURL=ocr-proxy-worker.js.map
