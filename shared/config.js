// PT Medical System — Configuration
// APP_VERSION: bump on every significant update + add entry in memory/version.md
window.APP_VERSION = '5.6';
window.APP_VERSION_DATE = '2026-04-17';
const CONFIG = {
  SUPABASE_URL: 'https://rwxaalgvkzlsyfzdebcj.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_5jmlKl7w2H_Qb4Yp1Y8gWA_-SMZfB0a',
  CLOUDINARY_CLOUD_NAME: 'deimrg3xs',
  CLOUDINARY_UPLOAD_PRESET: 'pt-medical',
  BASE_URL: '/pt-medical-system',
  GAS_AUTH_API_URL: 'https://script.google.com/macros/s/AKfycbybpea7XetHbLnibNWUHV_Mg9CpmIWzXR_5lCKzPWoWUAjPcy-wUVAgAP_dWd0Avf4jug/exec',
  // GPS Proxy chain (primary → fallback → last resort):
  //   1. GPS_PROXY_SYNOLOGY (Supabase runtime) — path-rewrite, fastest when NAS is up
  //   2. GPS_PROXY_URL (Render) — query-param ?url=
  //   3. GPS_PROXY_FALLBACK (GAS) — query-param ?url=
  // GPS_PROXY_SYNOLOGY is intentionally empty here — set it in Admin > Settings > GPS
  // (stored in Supabase settings table with key "GPS_PROXY_SYNOLOGY")
  GPS_PROXY_SYNOLOGY: '',
  GPS_PROXY_URL: 'https://gps-proxy-lpdq.onrender.com',
  GPS_PROXY_FALLBACK: 'https://script.google.com/macros/s/AKfycbxXbDS4vXO9v_q5bgyxv0WJeIR5CAr_6kZ-LrCINEFLFe1_VPV3Ls8geNv4jPT_FNPfNg/exec',
  // OCR Proxy (Cloudflare Worker) — ซ่อน Gemini API key จาก browser
  // Deploy: see cloudflare/README.md
  // ว่างไว้ = fallback ใช้ API key ใน localStorage ต่อเครื่อง
  OCR_PROXY_URL: 'https://gps-proxy.supwilai-ambulance.workers.dev'
};
