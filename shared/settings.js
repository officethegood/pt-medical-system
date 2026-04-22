// =============================================
// Settings Loader — DB-first with config.js DEFAULTS fallback
// =============================================
// Pattern:
//   1. admin.html writes rows to `settings` table
//   2. Other pages call settingsBootstrap(supabaseClient) once on init
//   3. Any code reads settingsGet(key) synchronously — returns DB value or DEFAULTS fallback
//
// Rules:
//   - Key missing in DB    → use CONFIG.DEFAULTS[key]  (first-deploy safety)
//   - Key exists, value='' → respect empty (intentional disable by admin)
//   - Key exists, non-empty→ use DB value
//
// ALSO syncs legacy CONFIG.GPS_PROXY_* / CONFIG.OCR_PROXY_URL / CONFIG.CLOUDINARY_*
// so existing code that reads CONFIG directly keeps working.

(function() {
  var _cache = null;             // { key: value, ... } — DB values only (may include empty strings)
  var _bootstrapped = false;
  var _bootstrapPromise = null;

  // Keys managed by admin — each has a corresponding entry in CONFIG.DEFAULTS
  var MANAGED_KEYS = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_UPLOAD_PRESET',
    'GPS_PROXY_SYNOLOGY',
    'GPS_PROXY_RENDER',
    'GPS_PROXY_GAS',
    'GPS_PROXY_SYNOLOGY_ENABLED',
    'GPS_PROXY_RENDER_ENABLED',
    'GPS_PROXY_GAS_ENABLED',
    'OCR_PROXY_URL',
    'NOTIFY_PROXY_URL',
    'NOTIFY_LINE_ENABLED',
    'NOTIFY_LINE_TARGET_TYPE',
    'NOTIFY_LINE_TARGETS',
    'NOTIFY_TELEGRAM_ENABLED',
    'NOTIFY_TELEGRAM_CHAT_ID',
    'NOTIFY_EVENTS_ARREST',
    'NOTIFY_EVENTS_SPO2_LOW',
    'NOTIFY_EVENTS_HR_ABNORMAL',
    'NOTIFY_EVENTS_RR_ABNORMAL',
    'NOTIFY_EVENTS_BP_ABNORMAL',
    'NOTIFY_EVENTS_GCS_LOW'
  ];

  async function settingsBootstrap(supabaseClient) {
    if (_bootstrapped) return _cache;
    if (_bootstrapPromise) return _bootstrapPromise;
    _bootstrapPromise = (async function() {
      _cache = {};
      if (!supabaseClient || typeof CONFIG === 'undefined') {
        _bootstrapped = true;
        return _cache;
      }
      try {
        var r = await supabaseClient.from('settings')
          .select('key, value')
          .in('key', MANAGED_KEYS);
        if (r && r.data) {
          r.data.forEach(function(row) {
            _cache[row.key] = row.value == null ? '' : String(row.value);
          });
        }
      } catch(e) {
        console.warn('settingsBootstrap:', e.message || e);
      }
      // Sync legacy CONFIG.* aliases
      CONFIG.GPS_PROXY_SYNOLOGY        = settingsGet('GPS_PROXY_SYNOLOGY');
      CONFIG.GPS_PROXY_URL             = settingsGet('GPS_PROXY_RENDER');
      CONFIG.GPS_PROXY_FALLBACK        = settingsGet('GPS_PROXY_GAS');
      CONFIG.OCR_PROXY_URL             = settingsGet('OCR_PROXY_URL');
      CONFIG.CLOUDINARY_CLOUD_NAME     = settingsGet('CLOUDINARY_CLOUD_NAME');
      CONFIG.CLOUDINARY_UPLOAD_PRESET  = settingsGet('CLOUDINARY_UPLOAD_PRESET');
      _bootstrapped = true;
      return _cache;
    })();
    return _bootstrapPromise;
  }

  // Sync getter — safe to call anywhere after bootstrap
  function settingsGet(key) {
    if (_cache && Object.prototype.hasOwnProperty.call(_cache, key)) {
      return _cache[key]; // may be '' (intentional disable)
    }
    if (CONFIG && CONFIG.DEFAULTS && Object.prototype.hasOwnProperty.call(CONFIG.DEFAULTS, key)) {
      return CONFIG.DEFAULTS[key];
    }
    return '';
  }

  // Boolean convenience for *_ENABLED flags
  function settingsEnabled(key) {
    var v = settingsGet(key);
    return v === '1' || v === 1 || v === true || v === 'true';
  }

  // Force-refresh (call after admin saves)
  async function settingsRefresh(supabaseClient) {
    _bootstrapped = false;
    _bootstrapPromise = null;
    _cache = null;
    return settingsBootstrap(supabaseClient);
  }

  window.settingsBootstrap = settingsBootstrap;
  window.settingsGet = settingsGet;
  window.settingsEnabled = settingsEnabled;
  window.settingsRefresh = settingsRefresh;
})();
