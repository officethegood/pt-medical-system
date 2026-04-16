// PT Medical System — Configuration (TheGood deployment)
// APP_VERSION: bump on every significant update + add entry in memory/version.md
window.APP_VERSION = '5.6.2';
window.APP_VERSION_DATE = '2026-04-17';
const CONFIG = {
  // ========== SUPABASE (TheGood own project) ==========
  SUPABASE_URL: 'https://bztzsjuwyduveaqjvjma.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_caWu7knCmMs_MJNRMbsyCg_dzzX93Sc',

  // ========== CLOUDINARY (TheGood own account) ==========
  CLOUDINARY_CLOUD_NAME: 'ddummbyql',
  CLOUDINARY_UPLOAD_PRESET: 'pt-medical',

  // ========== BASE ==========
  BASE_URL: '/pt-medical-system',

  // ========== AUTH (TheGood own GAS) ==========
  GAS_AUTH_API_URL: 'https://script.google.com/macros/s/AKfycbxV5tbmeFx8SxEENtFgHNhZJfM26QocQX1bfqSzxxOPFd_CSiRCINGE2FfXuRAVF-IYGw/exec',

  // ========== GPS PROXY (DISABLED for TheGood — no vehicles) ==========
  // TheGood ไม่ได้ใช้ GPS — GPS_ENABLED=0 ในตาราง settings (default)
  // ถ้า TheGood จะใช้ GPS ในอนาคต → setup Synology proxy ของตัวเอง (หรือขอใช้ของ Supwilai)
  GPS_PROXY_SYNOLOGY: '',
  GPS_PROXY_URL: '',
  GPS_PROXY_FALLBACK: '',

  // ========== OCR PROXY (TheGood own Cloudflare Worker) ==========
  // Deployed via cloudflare/ folder — see docs/THEGOOD_OCR_WORKER_SETUP.html
  OCR_PROXY_URL: 'https://thegood-ocr-proxy.officethegood.workers.dev'
};
