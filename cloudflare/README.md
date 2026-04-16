# TheGood OCR Proxy (Cloudflare Worker)

Proxy ซ่อน Gemini API key จาก browser + CORS control สำหรับ TheGood webapp

## Deploy (first time)

### 1. ติดตั้ง wrangler CLI (ถ้ายังไม่มี)
```bash
npm install -g wrangler
```

### 2. Login Cloudflare
```bash
wrangler login
```
เปิด browser → login → authorize

### 3. ตั้ง Gemini API key (เป็น Secret — ไม่อยู่ใน git)
```bash
cd cloudflare
wrangler secret put GEMINI_API_KEY
```
→ paste Gemini API key ของ TheGood แล้ว Enter

### 4. (Optional) จำกัด origin สำหรับ production
แก้ `wrangler.toml` uncomment:
```toml
[vars]
ALLOWED_ORIGINS = "https://officethegood.github.io"
```

### 5. Deploy
```bash
wrangler deploy
```

### 6. เช็ค URL
หลัง deploy สำเร็จ wrangler จะพิมพ์ URL เช่น:
```
https://thegood-ocr-proxy.<your-subdomain>.workers.dev
```

### 7. เอา URL ไปใส่ใน webapp
แก้ `shared/config.js` (TheGood repo):
```js
OCR_PROXY_URL: 'https://thegood-ocr-proxy.<your-subdomain>.workers.dev'
```

## ดูคู่มือแบบ step-by-step
เปิดที่ `docs/THEGOOD_OCR_WORKER_SETUP.html`

## Free tier limits
- **100,000 requests/วัน** (มากพอสำหรับองค์กรกลาง-เล็ก)
- **10ms CPU time/request** (OCR call ส่วนใหญ่ใช้ <5ms ฝั่ง worker)
- ถ้าเกิน → upgrade Workers Paid $5/เดือน = 10 ล้าน req/วัน

## Update worker
หลังแก้ `ocr-proxy-worker.js`:
```bash
wrangler deploy
```

## Rotate Gemini API key
```bash
wrangler secret put GEMINI_API_KEY
# paste new key
```
ไม่ต้อง redeploy — secret update ทันที

## Test
```bash
curl -X POST https://thegood-ocr-proxy.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```
ควรได้ response จาก Gemini (text completion)
