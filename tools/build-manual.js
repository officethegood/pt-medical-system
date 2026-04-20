// Build user-manual.pdf + admin-manual.pdf from HTML templates
// Run: node tools/build-manual.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SHOTS = path.join(DOCS, 'manual-screenshots');

function img(name, caption, width) {
  const p = path.join(SHOTS, name + '.png');
  if (!fs.existsSync(p)) return `<div class="img-missing">[ภาพ ${name} ไม่พบ]</div>`;
  const b64 = fs.readFileSync(p).toString('base64');
  const w = width || 560;
  return `<figure><img src="data:image/png;base64,${b64}" style="max-width:${w}px"><figcaption>${caption || ''}</figcaption></figure>`;
}

const CSS = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Sarabun', sans-serif; font-size: 12pt; line-height: 1.55; color: #1f2937; }
@page { size: A4 portrait; margin: 18mm 16mm 20mm 16mm; }
h1 { font-size: 26pt; color: #0d47a1; margin-top: 0; padding-bottom: 8pt; border-bottom: 3px solid #0d47a1; }
h2 { font-size: 18pt; color: #0d47a1; margin-top: 24pt; margin-bottom: 10pt; page-break-after: avoid; }
h3 { font-size: 14pt; color: #1565c0; margin-top: 14pt; margin-bottom: 6pt; page-break-after: avoid; }
h4 { font-size: 12pt; color: #374151; margin-top: 10pt; margin-bottom: 4pt; }
p { margin: 6pt 0; }
ul, ol { margin: 6pt 0 6pt 22pt; }
li { margin: 3pt 0; }
code, .kbd { font-family: 'Courier New', monospace; background: #f3f4f6; padding: 1pt 4pt; border-radius: 3pt; font-size: 10.5pt; }
.kbd { border: 1px solid #9ca3af; box-shadow: 0 1px 0 #9ca3af; }
.en { color: #6b7280; font-size: 0.92em; }
figure { margin: 10pt 0; page-break-inside: avoid; text-align: center; }
figure img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4pt; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
figcaption { font-size: 10pt; color: #6b7280; margin-top: 4pt; font-style: italic; }
.img-missing { padding: 20pt; background: #fee2e2; color: #991b1b; border-radius: 4pt; text-align: center; }
.tip { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 8pt 12pt; margin: 10pt 0; border-radius: 0 4pt 4pt 0; }
.tip::before { content: "💡 Tip: "; font-weight: 700; color: #1e40af; }
.warn { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 8pt 12pt; margin: 10pt 0; border-radius: 0 4pt 4pt 0; }
.warn::before { content: "⚠️ ข้อควรระวัง: "; font-weight: 700; color: #92400e; }
.note { background: #f0fdf4; border-left: 4px solid #10b981; padding: 8pt 12pt; margin: 10pt 0; border-radius: 0 4pt 4pt 0; }
.note::before { content: "📘 หมายเหตุ: "; font-weight: 700; color: #065f46; }
table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 11pt; page-break-inside: avoid; }
th, td { border: 1px solid #d1d5db; padding: 6pt 8pt; text-align: left; vertical-align: top; }
th { background: #0d47a1; color: #fff; font-weight: 600; }
tr:nth-child(even) td { background: #f9fafb; }
.cover { text-align: center; padding: 60mm 0 40mm; page-break-after: always; }
.cover .logo { font-size: 36pt; margin-bottom: 10pt; }
.cover h1 { font-size: 32pt; border: none; color: #0d47a1; }
.cover .sub { font-size: 16pt; color: #6b7280; margin-top: 10pt; }
.cover .version { margin-top: 40mm; font-size: 11pt; color: #9ca3af; }
.toc { page-break-after: always; }
.toc ul { list-style: none; margin-left: 0; }
.toc li { border-bottom: 1px dotted #d1d5db; padding: 6pt 0; }
.page-break { page-break-before: always; }
.step { counter-reset: step; list-style: none; padding-left: 0; }
.step li { counter-increment: step; padding-left: 32pt; position: relative; margin: 8pt 0; }
.step li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 24pt; height: 24pt; background: #0d47a1; color: #fff; border-radius: 50%; text-align: center; line-height: 24pt; font-weight: 700; font-size: 11pt; }
.badge { display: inline-block; padding: 1pt 6pt; border-radius: 3pt; font-size: 10pt; font-weight: 600; color: #fff; }
.badge-a { background: #16a34a; }
.badge-v { background: #f59e0b; }
.badge-p { background: #ea580c; }
.badge-u { background: #dc2626; }
.badge-new { background: #8b5cf6; }
.role-note { background: #f3e8ff; border: 1px dashed #8b5cf6; padding: 10pt; margin: 10pt 0; border-radius: 4pt; font-size: 11pt; }
.role-note::before { content: "👁️ "; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 16pt 0; }
</style>
`;

// ==========================================================
// USER MANUAL CONTENT
// ==========================================================
const USER_HTML = `
<!doctype html><html lang="th"><head><meta charset="utf-8"><title>คู่มือผู้ใช้งาน</title>${CSS}</head><body>

<div class="cover">
  <div class="logo">📘</div>
  <h1>คู่มือการใช้งาน</h1>
  <div class="sub">สำหรับผู้ใช้ทั่วไป <span class="en">(User Manual)</span></div>
  <div class="sub">ระบบนำส่งผู้ป่วย · PT Medical System</div>
  <div class="version">เวอร์ชัน 5.8.0 — ${new Date().toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' })}</div>
</div>

<div class="toc">
  <h1>สารบัญ</h1>
  <ul>
    <li>1. ภาพรวมระบบ <span class="en">(System Overview)</span></li>
    <li>2. การเข้าสู่ระบบ <span class="en">(Login)</span></li>
    <li>3. หน้า Landing · เลือกโมดูล</li>
    <li>4. Patient Transport · ระบบบันทึกการนำส่งผู้ป่วย</li>
    <li>5. First Aid · ระบบบันทึกปฐมพยาบาล</li>
    <li>6. PT Location · ระบบจัดการพิกัดสถานที่</li>
    <li>7. GPS Tracking · ติดตามตำแหน่งรถ (ใช้งานบางส่วน)</li>
    <li>8. Monitor Dashboard (มอง Admin เห็นเท่านั้น)</li>
    <li>9. คำถามที่พบบ่อย <span class="en">(FAQ)</span></li>
  </ul>
</div>

<h1>1. ภาพรวมระบบ <span class="en">(System Overview)</span></h1>
<p>PT Medical System เป็นระบบจัดการข้อมูลทางการแพทย์สำหรับทีมปฏิบัติการภาคสนาม ประกอบด้วย <strong>4 โมดูลหลัก</strong> ที่ผู้ใช้ทั่วไปใช้งานได้:</p>
<table>
  <tr><th style="width:25%">โมดูล</th><th>หน้าที่</th><th style="width:22%">ผู้ใช้ <span class="en">(User)</span> เห็นไหม</th></tr>
  <tr><td><strong>Patient Transport</strong><br><span class="en">นำส่งผู้ป่วย</span></td><td>บันทึกเคสรับ-ส่งผู้ป่วยระหว่างโรงพยาบาล บันทึกสัญญาณชีพ (Vital Signs), ยา, IV, ความยินยอม (Consent)</td><td>✅ เห็น</td></tr>
  <tr><td><strong>First Aid</strong><br><span class="en">ปฐมพยาบาล</span></td><td>บันทึกงานออกหน่วยปฐมพยาบาล (Event) และคนไข้ที่เข้ารับการดูแลแต่ละงาน</td><td>✅ เห็น</td></tr>
  <tr><td><strong>PT Location</strong><br><span class="en">พิกัดสถานที่</span></td><td>บันทึกและจัดการพิกัด GPS ของโรงพยาบาล / จุดนัดรับ / สถานที่ประจำ</td><td>✅ เห็น</td></tr>
  <tr><td><strong>GPS Tracking</strong><br><span class="en">ติดตามรถ</span></td><td>ดูตำแหน่งรถพยาบาลบนแผนที่แบบ Real-time รวมถึงค้นหา รพ. ใกล้รถ</td><td>✅ เห็น (มุมมองทีม)</td></tr>
  <tr><td><strong>Monitor Dashboard</strong></td><td>Dashboard รวมสถิติและข้อมูลภาพรวม</td><td>❌ เฉพาะ Admin</td></tr>
  <tr><td><strong>Admin Settings</strong></td><td>ตั้งค่าระบบ ผู้ใช้ รถ ฯลฯ</td><td>❌ เฉพาะ Admin</td></tr>
</table>

<div class="tip">ระบบรองรับการใช้งานบนทั้ง Desktop และ Mobile สามารถติดตั้งเป็น PWA (Progressive Web App) บนมือถือได้ — ที่เบราว์เซอร์กดปุ่ม "Install app" / "เพิ่มที่หน้าแรก"</div>

<h1 class="page-break">2. การเข้าสู่ระบบ <span class="en">(Login)</span></h1>
<p>เปิดเบราว์เซอร์ไปที่ URL ของระบบ (ฝ่าย Admin จะแจ้งให้) หากยังไม่ได้ล็อกอิน จะแสดงหน้ารหัสผ่าน</p>
${img('u01-landing', 'หน้า Landing หลัง Login สำเร็จ — ผู้ใช้ทั่วไปเห็น 4 กล่องโมดูล')}

<h3>ขั้นตอน</h3>
<ol class="step">
  <li>กรอกรหัสพนักงาน <span class="en">(Username)</span> ในช่องแรก</li>
  <li>กรอกรหัสผ่าน <span class="en">(Password)</span> ในช่องที่สอง</li>
  <li>กดปุ่ม <strong>เข้าสู่ระบบ (Login)</strong></li>
  <li>ระบบจะพาไปยังหน้า Landing ที่แสดงโมดูลที่เข้าใช้ได้</li>
</ol>
<div class="warn">หากเข้าใช้ในอุปกรณ์สาธารณะ/ร่วมกับคนอื่น อย่าลืมกด <strong>ออกจากระบบ (Logout)</strong> ที่หน้า Landing ทุกครั้งหลังใช้งานเสร็จ</div>

<h1 class="page-break">3. หน้า Landing · เลือกโมดูล</h1>
<p>หน้า Landing เป็นจุดเริ่มต้นหลังล็อกอิน แสดงกล่องโมดูลที่ผู้ใช้เข้าถึงได้ กดคลิกกล่องใดกล่องหนึ่งเพื่อเข้าโมดูลนั้น</p>
${img('u01-landing', 'กล่องโมดูลที่ผู้ใช้ทั่วไปเห็น: Patient Transport, First Aid, PT Location, GPS Tracking')}
<p>ด้านบนสุดจะมี <strong>ชื่อผู้ใช้งาน</strong> พร้อมแท็ก <code>(Employee)</code> บอกสิทธิ์ปัจจุบัน ส่วนด้านล่างมีปุ่ม <strong>ออกจากระบบ</strong></p>

<h1 class="page-break">4. Patient Transport · นำส่งผู้ป่วย</h1>
<p>โมดูลนี้ใช้บันทึกเคสรับ-ส่งผู้ป่วยระหว่างโรงพยาบาลหรือจากจุดเกิดเหตุ ข้อมูลรวมถึงสัญญาณชีพ (Vital Signs), ยา, IV Fluid, รูปภาพ และความยินยอม (Consent)</p>
${img('u04-transport-main', 'หน้า Patient List แสดงเคสทั้งหมด')}

<h3>4.1 โครงสร้างหน้า</h3>
<ul>
  <li><strong>แถบค้นหา</strong> — ค้นจากชื่อผู้ป่วยหรือรหัสเคส (Case ID)</li>
  <li><strong>ตัวกรองวันที่นำส่ง</strong> <span class="en">(Transfer Date Filter)</span></li>
  <li><strong>รายการเคส</strong> — แสดง วันที่/เวลา, ชื่อผู้ป่วย, รพ. ต้นทาง→ปลายทาง, ระดับ (BLS/ALS), จำนวนครั้ง</li>
  <li><strong>ปุ่ม +</strong> (มุมขวาล่าง) — สร้างเคสใหม่</li>
</ul>

<h3>4.2 สร้างเคสใหม่</h3>
<ol class="step">
  <li>กดปุ่ม <strong>+</strong> วงกลมสีฟ้ามุมขวาล่าง</li>
  <li>กรอกข้อมูลพื้นฐาน: ชื่อผู้ป่วย, เพศ, อายุ, HN, รพ. ต้นทาง, รพ. ปลายทาง, ระดับ (<code>BLS</code> / <code>ALS</code>)</li>
  <li>บันทึกสัญญาณชีพในแท็บ <strong>Vital Signs</strong> (BP, HR, RR, SpO₂, Temp, GCS) — เพิ่มได้หลายครั้งตามเวลา</li>
  <li>บันทึกยา/IV ในแท็บ <strong>Medications</strong> / <strong>IV Fluid</strong></li>
  <li>แนบรูป (ถ้ามี) ในแท็บ <strong>Images</strong> — อัพโหลด Cloudinary</li>
  <li>ให้ผู้ป่วยหรือญาติเซ็น Consent ผ่านแท็บ <strong>Consent</strong> หรือส่งลิงก์ให้เซ็นผ่านมือถือ</li>
  <li>กด <strong>บันทึก</strong> เมื่อเสร็จ</li>
</ol>

<h3>4.3 ไอคอนประจำแถว</h3>
<table>
  <tr><th>ไอคอน</th><th>ความหมาย</th></tr>
  <tr><td>🔗 Share</td><td>สร้างลิงก์แชร์เคสให้ผู้อื่นดูผ่าน Public Share Token</td></tr>
  <tr><td>🖨️ Print</td><td>พิมพ์ใบบันทึกการนำส่ง (PT Record Form)</td></tr>
  <tr><td>🟢 Consent</td><td>เคสนี้มีการยินยอมครบถ้วนแล้ว</td></tr>
  <tr><td>📎 2</td><td>มีรูปภาพแนบ 2 รูป</td></tr>
</table>

<div class="tip">เคสที่เพิ่งแก้ไขจะเด้งขึ้นด้านบนอัตโนมัติ เนื่องจากระบบใช้ Realtime sync — ไม่ต้องรีเฟรชหน้า</div>

<h1 class="page-break">5. First Aid · ปฐมพยาบาล</h1>
<p>ใช้บันทึกงานออกหน่วยปฐมพยาบาล (Event) เช่น งานวิ่ง, งานกีฬา, งานเทศกาล โครงสร้างคือ <strong>Event → Patients/Registry → Record</strong></p>
${img('u02-firstaid-main', 'หน้า First Aid Events แสดง Event ที่กำลังทำงาน (Active)')}

<h3>5.1 โครงสร้าง</h3>
<ul>
  <li><strong>Active</strong> — งานที่กำลังดำเนินอยู่ (ยังไม่ปิด)</li>
  <li><strong>Complete</strong> — งานที่ปิดแล้ว</li>
  <li>แต่ละการ์ด Event แสดง: ชื่องาน, สถานที่, วันที่, จำนวนผู้ป่วย</li>
</ul>

<h3>5.2 สร้าง Event ใหม่</h3>
<ol class="step">
  <li>กดปุ่ม <strong>+ สร้างงาน</strong> (มุมขวาบน)</li>
  <li>กรอก: ชื่องาน, สถานที่, วันเริ่ม-สิ้นสุด, ทีมที่รับผิดชอบ</li>
  <li>อัพโหลด <strong>Cover Image</strong> (ถ้ามี) — แสดงเป็นภาพหน้าการ์ด</li>
  <li>กด <strong>บันทึก</strong></li>
</ol>

<h3>5.3 บันทึกผู้ป่วยใน Event</h3>
<ol class="step">
  <li>กด <strong>เข้าจัดการ</strong> ที่การ์ด Event</li>
  <li>เพิ่มผู้ป่วย/Registry ด้วยปุ่ม <strong>+</strong></li>
  <li>กรอก Triage, เพศ, ชื่อ, อายุ, Chief Complaint (CC), Problem/Diagnosis, Treatment, Allergy, Vital Signs</li>
  <li>เลือกผลลัพธ์: <strong>D/C จำหน่าย</strong> หรือ <strong>Transfer</strong> (ส่งต่อ)</li>
</ol>

<h4>Triage Scale</h4>
<p>
  <span class="badge badge-a">A</span> Alert · รู้สึกตัวดี ·
  <span class="badge badge-v">V</span> Verbal · ตอบสนองเสียง ·
  <span class="badge badge-p">P</span> Pain · ตอบสนองเมื่อเจ็บ ·
  <span class="badge badge-u">U</span> Unresponsive · ไม่รู้สึกตัว
</p>

<div class="warn">ช่อง <strong>เพศ</strong> จำเป็นต้องเลือก (M/F/U) มิเช่นนั้นจะบันทึกไม่ผ่าน ระบบจะแจ้งเตือนและไฮไลต์สีแดง</div>

<h1 class="page-break">6. PT Location · จัดการพิกัดสถานที่</h1>
<p>ใช้บันทึกพิกัด GPS ของ <strong>โรงพยาบาล</strong>, <strong>จุดนัดรับ</strong>, <strong>สถานที่ประจำ</strong> เพื่อใช้ในการค้นหา/ค้นหาใกล้ฉันในโมดูลอื่น</p>
${img('u06-location-main', 'หน้า PT Location แสดงรายการสถานที่ที่บันทึกไว้')}

<h3>เพิ่มสถานที่ใหม่</h3>
<ol class="step">
  <li>กดปุ่ม <strong>+</strong> ที่มุมขวาบนหรือด้านล่าง</li>
  <li>เลือกประเภท: รพ., จุดนัดรับ, อื่นๆ</li>
  <li>กรอก: ชื่อสถานที่, เบอร์โทร (ถ้ามี)</li>
  <li>กดปุ่ม <strong>📍 ใช้ตำแหน่งปัจจุบัน</strong> หรือกรอก Lat/Lng เองหรือคลิกบนแผนที่</li>
  <li>กด <strong>บันทึก</strong></li>
</ol>

<div class="tip">สถานที่ที่บันทึกในโมดูลนี้จะใช้ได้ในโมดูล Patient Transport (เลือกเป็น รพ. ต้นทาง/ปลายทาง) และ GPS Tracking (ค้นหาใกล้รถ)</div>

<h1 class="page-break">7. GPS Tracking · ติดตามรถ</h1>
<p>ดูตำแหน่งรถพยาบาลบนแผนที่ Real-time ผู้ใช้ทั่วไปดู <strong>Fleet</strong> (รายการรถของทีม) ได้ แต่ไม่สามารถจัดการ Share Links</p>
${img('u07-gps-main', 'หน้า GPS Tracking — แผนที่ + รายการรถ')}

<h3>7.1 โครงสร้าง (Desktop)</h3>
<ul>
  <li>แผนที่ด้านซ้าย · รายการรถด้านขวา</li>
  <li>คลิกรถเพื่อโฟกัสที่ตำแหน่ง + เปิดโหมด <strong>Follow</strong> (แผนที่จะตามรถเคลื่อนที่)</li>
  <li>ลากแผนที่หรือซูม = ปิด Follow อัตโนมัติ</li>
</ul>

<h3>7.2 โครงสร้าง (Mobile / Bottom Sheet)</h3>
<ul>
  <li>แผนที่เต็มจอ รายการรถอยู่ใน Bottom Sheet ด้านล่าง</li>
  <li>ลาก Bottom Sheet ขึ้น-ลงเพื่อขยาย/ย่อ (3 ระดับ: peek / half / full)</li>
</ul>

<h3>7.3 ค้นหาใกล้รถ</h3>
<ol class="step">
  <li>เลือกรถ 1 คัน (คลิกที่มาร์กเกอร์หรือแถวในรายการ)</li>
  <li>กด <strong>🔍 ค้นหาใกล้รถ</strong></li>
  <li>เลือกประเภทสถานที่: รพ., คลินิก, ร้านยา, ATM, ปั๊มน้ำมัน</li>
  <li>ระบบแสดงผลรอบรัศมีที่เลือก พร้อมระยะทางและปุ่มนำทาง</li>
</ol>

<div class="note">ระบบกรองข้อมูลให้อัตโนมัติ — เช่น "รพ." จะไม่รวมคลินิกทันตกรรม ห้องพัก ร้านแว่น</div>

<h1 class="page-break">8. Monitor Dashboard (มอง Admin เห็นเท่านั้น)</h1>
<p>โมดูล Monitor Dashboard ใช้ดูภาพรวมสถิติและตัวเลขสำคัญของระบบ เช่น:</p>
<ul>
  <li>จำนวนเคสวันนี้ / สัปดาห์ / เดือน</li>
  <li>สัดส่วน BLS / ALS</li>
  <li>จำนวน Event First Aid ที่กำลังทำงาน</li>
  <li>กราฟแนวโน้มย้อนหลัง</li>
  <li>Live feed เคสล่าสุด (Realtime update)</li>
</ul>
<div class="role-note">ผู้ใช้ทั่วไป <strong>ไม่สามารถ</strong> เข้าโมดูลนี้ได้ ฟีเจอร์นี้เปิดให้เฉพาะผู้ที่มีสิทธิ์ระดับ <strong>Admin</strong> หากต้องการดูข้อมูลภาพรวม ติดต่อผู้ดูแลระบบเพื่อขอให้ดูด้วยกัน</div>

<h1 class="page-break">9. คำถามที่พบบ่อย <span class="en">(FAQ)</span></h1>

<h3>Q: เปิดระบบแล้วขึ้นหน้าขาว / หมุนไม่จบ</h3>
<p>A: ลองรีเฟรช 1 ครั้ง หากยังไม่หาย กดค้าง <span class="kbd">Ctrl+Shift+R</span> (Windows) หรือ <span class="kbd">Cmd+Shift+R</span> (Mac) เพื่อ Hard Reload ล้าง cache ถ้ายังไม่หายแจ้ง Admin</p>

<h3>Q: จุดสถานะ Realtime ไม่เป็นสีเขียว (ส้ม/แดง)</h3>
<p>A: เขียว = เชื่อมต่อปกติ, ส้ม = กำลังเชื่อม/timeout, แดง = ไม่เชื่อม ลองรีเฟรช ถ้ายังแดงแจ้ง Admin</p>

<h3>Q: กดบันทึกแล้วไม่มีอะไรเกิดขึ้น</h3>
<p>A: ตรวจสอบ <strong>ช่องที่มีดอกจัน *</strong> (Required) ว่ากรอกครบหรือยัง โดยเฉพาะ เพศ, Triage, จุดรักษา, Etiology</p>

<h3>Q: พิมพ์เอกสารแล้วหัวกระดาษไม่ตรง</h3>
<p>A: หัวกระดาษมาจากตั้งค่า Admin — หากไม่ถูกต้องต้องแจ้ง Admin แก้ไข</p>

<h3>Q: อัพโหลดรูปแล้วค้าง</h3>
<p>A: ตรวจสอบสัญญาณเน็ต ระบบใช้ Cloudinary ถ้ารูปใหญ่เกิน 10MB อาจไม่สามารถอัพได้ ลองย่อขนาดหรือถ่ายใหม่</p>

<h3>Q: ขอเปลี่ยนรหัสผ่านต้องทำอย่างไร</h3>
<p>A: รหัสผ่านอยู่ในระบบ HR ติดต่อฝ่าย HR หรือผู้ดูแลระบบ</p>

<h3>Q: อยากติดตั้งบนหน้าจอ Home มือถือ</h3>
<p>A: Android/Chrome: เมนู ⋮ → "เพิ่มไปยังหน้าจอหลัก" | iOS/Safari: ไอคอน Share → "Add to Home Screen"</p>

<hr>
<p style="text-align:center; color:#9ca3af; font-size:10pt; margin-top:30pt;">
© ${new Date().getFullYear()} PT Medical System — User Manual v5.8.0
</p>

</body></html>
`;

// ==========================================================
// ADMIN MANUAL CONTENT
// ==========================================================
const ADMIN_HTML = `
<!doctype html><html lang="th"><head><meta charset="utf-8"><title>คู่มือผู้ดูแลระบบ</title>${CSS}</head><body>

<div class="cover">
  <div class="logo">🛠️</div>
  <h1>คู่มือผู้ดูแลระบบ</h1>
  <div class="sub">สำหรับ Admin <span class="en">(Administrator Manual)</span></div>
  <div class="sub">ระบบนำส่งผู้ป่วย · PT Medical System</div>
  <div class="version">เวอร์ชัน 5.8.0 — ${new Date().toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' })}</div>
</div>

<div class="toc">
  <h1>สารบัญ</h1>
  <ul>
    <li>1. บทบาทและสิทธิ์ <span class="en">(Roles & Permissions)</span></li>
    <li>2. เข้าหน้า Admin Settings</li>
    <li>3. General · ข้อมูลองค์กรและ Branding</li>
    <li>4. Services · GPS, OCR, Integrations</li>
    <li>5. Security · Sessions และ Public Share</li>
    <li>6. Analytics · Statistics, Activity Log, Overview</li>
    <li>7. Monitor Dashboard</li>
    <li>8. GPS Tracking (มุมมอง Admin)</li>
    <li>9. การแก้ไขปัญหา <span class="en">(Troubleshooting)</span></li>
    <li>10. แนวทางปฏิบัติด้านความปลอดภัย <span class="en">(Security Best Practices)</span></li>
  </ul>
</div>

<h1>1. บทบาทและสิทธิ์ <span class="en">(Roles & Permissions)</span></h1>
<p>ระบบแบ่งสิทธิ์หลักเป็น 2 ระดับ:</p>
<table>
  <tr><th style="width:25%">Role</th><th>สิทธิ์</th></tr>
  <tr><td><strong>Employee</strong> (ผู้ใช้ทั่วไป)</td><td>เข้าถึง 4 โมดูล: Transport, First Aid, Location, GPS (view) — บันทึก/แก้ไขข้อมูลได้ แต่ไม่เห็นหน้า Settings/Monitor</td></tr>
  <tr><td><strong>Admin</strong></td><td>ทุกอย่างของ Employee + เข้า Admin Settings + Monitor Dashboard + จัดการ GPS Share Links + ดู Activity Log</td></tr>
</table>
<div class="note">Role มาจากระบบ HR (Google Apps Script Auth) โดยเก็บที่ตาราง users field <code>role</code> — หากต้องเปลี่ยน Role ของใคร ต้องแก้ที่ฐานข้อมูลหรือแผงจัดการ HR</div>

<h1 class="page-break">2. เข้าหน้า Admin Settings</h1>
<p>หลัง Login ด้วยบัญชีที่มี Role = admin หน้า Landing จะแสดงปุ่มเพิ่มเติม <strong>Monitor</strong> และ <strong>Admin Settings</strong></p>
${img('a01-landing-admin', 'Landing ของ Admin — เห็นปุ่ม Monitor และ Admin Settings เพิ่มเติม')}
<p>กดปุ่ม <strong>⚙ Admin Settings</strong> เพื่อเข้าแผง</p>
${img('a02-admin-main', 'หน้า Admin Settings แท็บ Organization — โครงสร้าง Sidebar ด้านซ้าย')}

<h3>โครงสร้าง Sidebar</h3>
<table>
  <tr><th style="width:20%">กลุ่ม</th><th>เมนู</th><th>หน้าที่</th></tr>
  <tr><td rowspan="2">GENERAL</td><td>Organization</td><td>ข้อมูลบริษัท/หน่วยงาน ใช้แสดงที่ Landing + เอกสารพิมพ์</td></tr>
  <tr><td>Branding</td><td>โลโก้ สีธีม favicon</td></tr>
  <tr><td rowspan="3">SERVICES</td><td>GPS Tracking</td><td>ตั้งค่า Proxy URL, Synology endpoints, refresh rate</td></tr>
  <tr><td>OCR</td><td>ตั้งค่า OCR service สำหรับ scan เอกสาร</td></tr>
  <tr><td>Integrations</td><td>Cloudinary, Google Places API, Supabase</td></tr>
  <tr><td rowspan="2">SECURITY</td><td>Sessions</td><td>ดู session ที่ active — บังคับ logout ได้</td></tr>
  <tr><td>Public Share</td><td>จัดการ Share Token สำหรับเผยแพร่สาธารณะ</td></tr>
  <tr><td rowspan="3">ANALYTICS</td><td>Statistics</td><td>สถิติรายเดือน/รายปี</td></tr>
  <tr><td>Activity Log</td><td>บันทึกการใช้งานของผู้ใช้ทั้งหมด</td></tr>
  <tr><td>Overview</td><td>ภาพรวมจำนวนข้อมูลในระบบ</td></tr>
  <tr><td>HELP</td><td>Documentation</td><td>คู่มือภายใน เอกสารทางเทคนิค</td></tr>
</table>

<h1 class="page-break">3. General · ข้อมูลองค์กรและ Branding</h1>

<h3>3.1 Organization</h3>
${img('a03-admin-org', 'Organization · ข้อมูลบริษัท/หน่วยงาน')}
<ul>
  <li><strong>ชื่อบริษัท</strong> — แสดงที่หน้า Landing และหัวเอกสารพิมพ์</li>
  <li><strong>ข้อมูลติดต่อ</strong> — เบอร์โทร / ที่อยู่ / อีเมล แสดงที่ footer</li>
  <li><strong>หัวกระดาษ (Print Header)</strong> — ข้อความบรรทัดบนสุดของเอกสาร PT Record Form</li>
</ul>
<div class="tip">กด <strong>บันทึก</strong> หลังแก้ไขทุกครั้ง — ระบบไม่มี auto-save</div>

<h3>3.2 Branding</h3>
<p>ตั้งค่า:</p>
<ul>
  <li>โลโก้บริษัท (Logo) — อัพโหลดเป็น PNG/SVG แนะนำสัดส่วน 1:1</li>
  <li>Favicon — ไอคอนบน tab เบราว์เซอร์</li>
  <li>สี Primary — สีเฮดเดอร์ ปุ่มหลัก</li>
  <li>สี Accent — ปุ่มรอง / highlight</li>
</ul>

<h1 class="page-break">4. Services · GPS, OCR, Integrations</h1>

<h3>4.1 GPS Tracking Settings</h3>
<p>ตั้งค่า endpoint สำหรับดึงตำแหน่งรถจากระบบ GPS ภายนอก:</p>
<ul>
  <li><strong>Proxy URL</strong> — Render proxy ที่ทำหน้า CORS bridge (เช่น <code>https://xxx.onrender.com</code>)</li>
  <li><strong>Synology Endpoint</strong> — สำรองกรณี Proxy ล่ม เรียก NAS ภายในตรง</li>
  <li><strong>Refresh rate</strong> — ความถี่ดึงข้อมูล (แนะนำ 5-10 วินาที)</li>
</ul>
<div class="warn">อย่าใส่ <code>Cache-Control</code> header ในการเรียก GPS endpoint — จะ trigger CORS preflight (OPTIONS) ที่ Render block</div>

<h3>4.2 OCR</h3>
<p>ตั้ง endpoint สำหรับ OCR scan เอกสาร (เช่น บัตรประชาชน) ในโมดูล Transport</p>

<h3>4.3 Integrations</h3>
${img('a08-admin-integrations', 'Integrations · Cloudinary, Places, Supabase')}
<ul>
  <li><strong>Cloudinary Cloud Name + Upload Preset</strong> — อัพรูปในทุกโมดูล</li>
  <li><strong>Google Places API Key</strong> — "ค้นหาใกล้รถ" ใน GPS module</li>
  <li><strong>Supabase URL + anon key</strong> — ฐานข้อมูล (แก้ที่ config.js เท่านั้น)</li>
</ul>
<div class="warn">Cloudinary Upload Preset ต้องเป็นแบบ <strong>Signed</strong> — ป้องกันการ abuse quota เปิดที่ Cloudinary Dashboard → Upload Presets</div>

<h1 class="page-break">5. Security · Sessions และ Public Share</h1>

<h3>5.1 Sessions</h3>
<p>ดูรายการ session ที่ active ในปัจจุบัน พร้อมข้อมูล:</p>
<ul>
  <li>ผู้ใช้, วันที่ login, IP address, User Agent</li>
  <li>ปุ่ม <strong>Force Logout</strong> — เลิก session ของผู้ใช้รายนั้น (ใช้เมื่อสงสัยว่าอุปกรณ์สูญหาย)</li>
  <li>ปุ่ม <strong>Force Logout All</strong> — บังคับออกทั้งระบบ (ใช้เมื่อ deploy สำคัญ หรือเปลี่ยน policy)</li>
</ul>

<h3>5.2 Public Share</h3>
<p>จัดการ Share Token ที่ผู้ใช้สร้างจากหน้า Transport หรือ GPS</p>
<ul>
  <li>ดูรายการ token ทั้งหมด + วันหมดอายุ</li>
  <li><strong>Revoke</strong> token ที่สงสัยว่าหลุดไปยังผู้ไม่เกี่ยวข้อง</li>
  <li>ตั้งค่า default TTL (Time To Live) ของ token ใหม่</li>
</ul>

<h1 class="page-break">6. Analytics · Statistics, Activity Log, Overview</h1>

<h3>6.1 Statistics</h3>
<p>กราฟ + ตารางสรุป:</p>
<ul>
  <li>จำนวนเคส Transport / First Aid / Location แยกรายเดือน</li>
  <li>สัดส่วน BLS / ALS</li>
  <li>Top 10 รพ. ต้นทาง-ปลายทาง</li>
  <li>กราฟแนวโน้มย้อนหลัง 12 เดือน</li>
</ul>

<h3>6.2 Activity Log</h3>
<p>บันทึกการกระทำของผู้ใช้ทุกคน:</p>
<ul>
  <li>Login / Logout</li>
  <li>สร้าง / แก้ไข / ลบ เคส/Event/ผู้ป่วย</li>
  <li>เปลี่ยนตั้งค่า Admin (ใครแก้อะไร เมื่อไร)</li>
</ul>
<div class="tip">ใช้ค้นหาได้ด้วย username, action type, date range — เหมาะสำหรับตรวจสอบปัญหาย้อนหลัง</div>

<h3>6.3 Overview</h3>
${img('a09-admin-system', 'System Overview · จำนวนข้อมูลรวม')}
<p>ภาพรวมจำนวนข้อมูลในระบบทั้งหมด: เคส, ผู้ป่วย, Event, สถานที่, ผู้ใช้ — ใช้เช็คสุขภาพของระบบ</p>

<h1 class="page-break">7. Monitor Dashboard</h1>
${img('a10-monitor-main', 'Monitor Dashboard · Live view')}
<p>Dashboard รวมที่แสดงข้อมูลสำคัญแบบ Real-time เหมาะสำหรับวางบน TV/จอใหญ่ที่ศูนย์ปฏิบัติการ</p>
<ul>
  <li>จำนวนเคสวันนี้ แยกตามสถานะ (In Progress / Done)</li>
  <li>Live feed เคสล่าสุด 10 รายการ</li>
  <li>Event First Aid ที่ Active</li>
  <li>ตำแหน่งรถ Real-time (ย่อ)</li>
  <li>แจ้งเตือนเมื่อมีเคสใหม่/Consent ใหม่</li>
</ul>

<h1 class="page-break">8. GPS Tracking (มุมมอง Admin)</h1>
${img('a11-gps-main', 'GPS Tracking · มุมมอง Admin เห็นทั้ง Fleet และ Shared Links')}
<p>ต่างจากผู้ใช้ทั่วไป Admin จะเห็นแท็บเพิ่มเติม <strong>Shared Links</strong>:</p>
<ul>
  <li><strong>Fleet</strong> — รายการรถของทีม (เหมือนผู้ใช้)</li>
  <li><strong>Shared Links</strong> — จัดการ Token แชร์ GPS ให้บุคคลภายนอก ดู/สร้าง/ยกเลิก/ตั้งวันหมดอายุ</li>
</ul>

<h1 class="page-break">9. การแก้ไขปัญหา <span class="en">(Troubleshooting)</span></h1>

<h3>9.1 Realtime ไม่ทำงาน (จุดส้ม/แดง)</h3>
<ol>
  <li>เปิด Supabase Dashboard → Database → Replication</li>
  <li>ตรวจสอบว่าตารางทั้งหมด (cases, fa_events, fa_registry, loc_customers, transport_consents) อยู่ใน publication <code>supabase_realtime</code></li>
  <li>หากหาย รัน SQL: <code>ALTER PUBLICATION supabase_realtime ADD TABLE &lt;table&gt;;</code></li>
  <li>ตรวจ RLS policies มี <code>anon_select_*</code> ที่ <code>USING (true)</code></li>
  <li>Hard reload เบราว์เซอร์ (Ctrl+Shift+R)</li>
</ol>

<h3>9.2 CORS Error ที่ GPS Proxy</h3>
<p>ถ้า Console แสดง <code>"Request header field cache-control is not allowed"</code>:</p>
<ul>
  <li>แปลว่าโค้ดส่ง <code>Cache-Control</code> request header ไปที่ Render → Render block เพราะไม่อยู่ใน CORS allowlist</li>
  <li>Fix: ลบ <code>Cache-Control</code> / <code>Pragma</code> header ใน <code>shared/gps-providers.js</code> — ใช้ <code>cache: 'no-store'</code> + query-string cache-buster แทน</li>
</ul>

<h3>9.3 Cloudinary Upload Fail</h3>
<ul>
  <li>ตรวจ Upload Preset ที่ Cloudinary Dashboard ว่ายังมีอยู่ + ตั้งเป็น Unsigned หรือ Signed ตรงกับโค้ด</li>
  <li>เช็ค Cloud Name ใน Integrations settings</li>
  <li>ไฟล์ใหญ่เกิน 10MB → ย่อก่อน</li>
</ul>

<h3>9.4 ผู้ใช้ล็อกอินไม่ได้</h3>
<ul>
  <li>ตรวจสอบที่ระบบ HR ว่า user ยัง active อยู่</li>
  <li>ลอง force-logout session เก่าที่อาจค้าง</li>
  <li>ตรวจ GAS_AUTH_API_URL ยังเข้าถึงได้ (HTTP 200)</li>
</ul>

<h3>9.5 Service Worker ค้างที่เวอร์ชันเก่า</h3>
<p>ผู้ใช้เห็นโค้ดเก่า ทั้งที่ Deploy ใหม่แล้ว:</p>
<ol>
  <li>Bump <code>CACHE_NAME</code> ใน <code>sw.js</code> (เช่น v11 → v12)</li>
  <li>Push code</li>
  <li>ให้ผู้ใช้ปิด-เปิด tab หรือ Hard reload</li>
</ol>

<h1 class="page-break">10. แนวทางปฏิบัติด้านความปลอดภัย <span class="en">(Security Best Practices)</span></h1>

<h3>10.1 การจัดการ Role</h3>
<ul>
  <li>ให้ Role = admin เฉพาะบุคคลที่จำเป็น (หลักการ Principle of Least Privilege)</li>
  <li>ทบทวนรายชื่อ admin ทุก 6 เดือน</li>
  <li>เมื่อพนักงานลาออก ให้ disable user ที่ HR ทันที (session ระบบจะหลุดภายใน 24 ชม.)</li>
</ul>

<h3>10.2 Sessions</h3>
<ul>
  <li>หากสงสัยว่าอุปกรณ์ของ user สูญหาย → Force Logout ทันทีที่หน้า Sessions</li>
  <li>ก่อนปรับ config หรือ deploy ใหญ่ → Force Logout All แล้วให้ทุกคน login ใหม่</li>
</ul>

<h3>10.3 Share Tokens</h3>
<ul>
  <li>Token ที่ไม่ได้ใช้ควร revoke</li>
  <li>ตั้ง TTL เริ่มต้นไม่เกิน 7 วัน — บังคับสร้างใหม่หากต้องใช้ต่อ</li>
  <li>อย่าส่ง token ผ่านช่องทางสาธารณะ (Facebook public post)</li>
</ul>

<h3>10.4 RLS & Database</h3>
<div class="warn">ปัจจุบันระบบใช้ RLS แบบ <code>USING (true)</code> สำหรับ anon role — นี่หมายความว่าผู้รู้ URL สามารถเรียก Supabase ตรงได้ แนะนำให้ติดตามงาน migration RLS ให้เข้มขึ้น (ดู issue tracker)</div>

<h3>10.5 Admin Panel Bypass</h3>
<p>ปัจจุบันการเช็ค role อยู่ฝั่ง client (localStorage) — ผู้ใช้ที่รู้เทคนิค DevTools อาจ bypass เข้า UI admin ได้ แต่ไม่สามารถแก้ข้อมูลได้ถ้า backend มี RLS ที่ดี (ดูข้อ 10.4)</p>

<h3>10.6 Backup</h3>
<ul>
  <li>Supabase มี Daily Backup ในตัว — ตรวจสอบที่ Supabase Dashboard → Database → Backups</li>
  <li>แนะนำให้ export ข้อมูลสำคัญเป็น CSV รายเดือนเก็บที่ Google Drive แยก</li>
</ul>

<hr>
<p style="text-align:center; color:#9ca3af; font-size:10pt; margin-top:30pt;">
© ${new Date().getFullYear()} PT Medical System — Administrator Manual v5.8.0
</p>

</body></html>
`;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  async function buildPdf(html, outPath, title) {
    console.log('Building', title, '...');
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // Wait for Sarabun font
    try { await Promise.race([page.evaluateHandle('document.fonts.ready'), new Promise(r => setTimeout(r, 10000))]); } catch(e) {}
    await new Promise(r => setTimeout(r, 2000));
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font-size:8pt;color:#9ca3af;width:100%;text-align:center;font-family:Sarabun,sans-serif;">${title} — หน้า <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' }
    });
    console.log('  → wrote', outPath);
  }

  await buildPdf(USER_HTML, path.join(DOCS, 'user-manual.pdf'), 'คู่มือผู้ใช้งาน');
  await buildPdf(ADMIN_HTML, path.join(DOCS, 'admin-manual.pdf'), 'คู่มือผู้ดูแลระบบ');

  await browser.close();
  console.log('All done.');
})();
