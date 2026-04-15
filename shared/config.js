// PT Medical System — Configuration (Thegood)
const CONFIG = {
  SUPABASE_URL: 'https://bztzsjuwyduveaqjvjma.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_caWu7knCmMs_MJNRMbsyCg_dzzX93Sc',
  CLOUDINARY_CLOUD_NAME: 'ddummbyql',
  CLOUDINARY_UPLOAD_PRESET: 'pt-medical',
  BASE_URL: '/pt-medical-system',
  GAS_AUTH_API_URL: 'https://script.google.com/macros/s/AKfycbxV5tbmeFx8SxEENtFgHNhZJfM26QocQX1bfqSzxxOPFd_CSiRCINGE2FfXuRAVF-IYGw/exec',
  // GPS Proxy — ต้อง deploy Render ของ thegood เอง แล้วอัปเดต URL นี้
  // GPS Proxy — ใช้ร่วมกับ supwilai ไปก่อน (thegood ยังไม่มี GPS devices)
  GPS_PROXY_URL: 'https://gps-proxy-lpdq.onrender.com',
  GPS_PROXY_FALLBACK: 'https://script.google.com/macros/s/AKfycbxXbDS4vXO9v_q5bgyxv0WJeIR5CAr_6kZ-LrCINEFLFe1_VPV3Ls8geNv4jPT_FNPfNg/exec',
  // OCR Proxy (Cloudflare Worker) — ใช้ร่วมกับ supwilai (key กลาง)
  // ถ้าอยาก deploy ของ thegood เอง: see supwilai's cloudflare/README.md
  OCR_PROXY_URL: 'https://gps-proxy.supwilai-ambulance.workers.dev'
};
