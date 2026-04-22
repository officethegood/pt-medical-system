// =============================================
// External Notification Helpers (Line OA + Telegram)
// =============================================
// Browser-side wrappers around the worker /notify/* routes + ack-on-load.
// All calls are silent failures — never break the calling page.
//
// Usage:
//   await notifyTrigger({ caseId, alertType, message, deepLink });
//   await notifyAck(caseId, alertType);   // call when user opens that case
//   await notifyTest('line', 'hello');    // admin test button
//   await notifyHealth();                 // returns { ok, hasLine, hasTelegram, hasSupabase }

(function() {

  function _proxyBase() {
    var url = (typeof settingsGet === 'function' ? settingsGet('NOTIFY_PROXY_URL') : '') || '';
    if (!url && window.CONFIG) url = CONFIG.NOTIFY_PROXY_URL || CONFIG.OCR_PROXY_URL || '';
    return (url || '').replace(/\/+$/, '');
  }

  function _eventEnabled(alertType) {
    if (typeof settingsBool !== 'function') return true;
    var key = 'NOTIFY_EVENTS_' + String(alertType || '').toUpperCase();
    var raw = (typeof settingsGet === 'function') ? settingsGet(key) : '';
    if (raw === '' || raw == null) return true; // default ON
    return raw === 'true' || raw === '1';
  }

  async function notifyTrigger(opts) {
    try {
      if (!opts || !opts.caseId || !opts.alertType || !opts.message) return { ok: false, error: 'missing fields' };
      if (!_eventEnabled(opts.alertType)) return { ok: false, skipped: true, reason: 'event disabled' };
      var base = _proxyBase();
      if (!base) return { ok: false, error: 'NOTIFY_PROXY_URL not configured' };
      var resp = await fetch(base + '/notify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id:    opts.caseId,
          alert_type: opts.alertType,
          message:    opts.message,
          deep_link:  opts.deepLink || ''
        })
      });
      var data = await resp.json().catch(function() { return {}; });
      if (!resp.ok) console.warn('[notify] send failed:', resp.status, data);
      return data;
    } catch (e) {
      console.warn('[notify] trigger error:', e.message);
      return { ok: false, error: e.message };
    }
  }

  async function notifyAck(caseId, alertType) {
    // Direct Supabase update — no worker needed.
    try {
      if (!caseId || !window._supabase) return;
      var who = (typeof getUserName === 'function') ? getUserName() : '';
      var patch = { acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: who };
      var q = _supabase.from('notification_state').update(patch).eq('case_id', caseId);
      if (alertType) q = q.eq('alert_type', alertType);
      await q;
    } catch (e) {
      console.warn('[notify] ack error:', e.message);
    }
  }

  async function notifyTest(channel, message, target) {
    var base = _proxyBase();
    if (!base) return { ok: false, error: 'NOTIFY_PROXY_URL not configured' };
    var resp = await fetch(base + '/notify/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channel, message: message || 'Test from PT Medical System', target: target || '' })
    });
    return await resp.json().catch(function() { return { ok: false, error: 'invalid JSON response' }; });
  }

  async function notifyHealth() {
    var base = _proxyBase();
    if (!base) return { ok: false, error: 'NOTIFY_PROXY_URL not configured' };
    try {
      var resp = await fetch(base + '/notify/health');
      return await resp.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  window.notifyTrigger = notifyTrigger;
  window.notifyAck     = notifyAck;
  window.notifyTest    = notifyTest;
  window.notifyHealth  = notifyHealth;
})();
