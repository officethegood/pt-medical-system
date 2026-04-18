// PT Medical System — Configuration (TheGood deployment)
// APP_VERSION: bump on every significant update + add entry in memory/version.md
window.APP_VERSION = '5.8.0';
window.APP_VERSION_DATE = '2026-04-18';

const CONFIG = {
  // ===== REQUIRED (cannot be moved to admin — bootstrap/auth) =====
  SUPABASE_URL: 'https://bztzsjuwyduveaqjvjma.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_caWu7knCmMs_MJNRMbsyCg_dzzX93Sc',
  BASE_URL: '/pt-medical-system',
  // GAS Auth URL — NEVER expose in admin (breaks login if tampered)
  GAS_AUTH_API_URL: 'https://script.google.com/macros/s/AKfycbxV5tbmeFx8SxEENtFgHNhZJfM26QocQX1bfqSzxxOPFd_CSiRCINGE2FfXuRAVF-IYGw/exec',

  // ===== DEFAULTS (factory fallback — admin overrides in settings table) =====
  DEFAULTS: {
    // Cloudinary (TheGood own account)
    CLOUDINARY_CLOUD_NAME: 'ddummbyql',
    CLOUDINARY_UPLOAD_PRESET: 'pt-medical',

    // GPS proxy chain — TheGood ไม่ได้ใช้ GPS (GPS_ENABLED=0) ค่าว่างหมด
    GPS_PROXY_SYNOLOGY: '',
    GPS_PROXY_RENDER:   '',
    GPS_PROXY_GAS:      '',
    GPS_PROXY_SYNOLOGY_ENABLED: '1',
    GPS_PROXY_RENDER_ENABLED:   '1',
    GPS_PROXY_GAS_ENABLED:      '1',

    // OCR Proxy (TheGood own Cloudflare Worker)
    OCR_PROXY_URL: 'https://thegood-ocr-proxy.officethegood.workers.dev'
  }
};

// ===== Legacy aliases (populated at runtime by shared/settings.js) =====
CONFIG.GPS_PROXY_SYNOLOGY = CONFIG.DEFAULTS.GPS_PROXY_SYNOLOGY;
CONFIG.GPS_PROXY_URL      = CONFIG.DEFAULTS.GPS_PROXY_RENDER;
CONFIG.GPS_PROXY_FALLBACK = CONFIG.DEFAULTS.GPS_PROXY_GAS;
CONFIG.OCR_PROXY_URL      = CONFIG.DEFAULTS.OCR_PROXY_URL;
CONFIG.CLOUDINARY_CLOUD_NAME    = CONFIG.DEFAULTS.CLOUDINARY_CLOUD_NAME;
CONFIG.CLOUDINARY_UPLOAD_PRESET = CONFIG.DEFAULTS.CLOUDINARY_UPLOAD_PRESET;

window.CONFIG = CONFIG;
