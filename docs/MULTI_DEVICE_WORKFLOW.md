# คู่มือการทำงานหลายอุปกรณ์ (Multi-Device Workflow)

## สถานการณ์ที่ครอบคลุม
- **Device A** (เจ้าหน้าที่) บันทึก V/S, IV, timeline ระหว่างนำส่ง
- **Device B** (แท็บเล็ตสำหรับญาติ) ให้ญาติ/ผู้ป่วยเซ็น Consent

> ทั้งสองเครื่องใช้ Case เดียวกัน (`case_id` เดียวกัน) บน Supabase เดียวกัน

---

## สถาปัตยกรรมข้อมูลที่ต้องเข้าใจ

| ตาราง | เนื้อหา | พฤติกรรมการบันทึก |
|---|---|---|
| `cases` | ข้อมูลผู้ป่วย + V/S + IV + timeline ทั้งหมด | **Upsert ทั้งก้อน** — เขียนทับทุกฟิลด์จากฟอร์ม |
| `transport_consents` | Consent แต่ละฉบับ (version) | **Insert แถวใหม่** ทุกครั้งที่เซ็น — ไม่ชนกับ V/S |

### จุดที่ต้องระวัง
1. `cases.patient_info` (ชื่อ, อายุ, เลขบัตร, route) และ `cases.raw_data.rawSnapshot` จะถูก Device A **เขียนทับทั้งก้อน** ทุกครั้งที่กด Save
2. การเซ็น Consent บน Device B จะ **sync-back เลขบัตรกลับ `cases`** เฉพาะเมื่อ `patient_info.idCard` ยังว่าง (ใช้ตรรกะ `if (!piCur.idCard)`)
3. ถ้า Device A เปิดฟอร์มค้างไว้ก่อน Device B sync-back → Device A กด Save ทีหลัง → **ข้อมูลของ Device B หาย**

---

## แนวทางที่แนะนำ (เรียงจากปลอดภัยที่สุด)

### ✅ Pattern 1: Sequential — ปลอดภัยที่สุด
```
1. Device A: กรอกข้อมูลผู้ป่วย (ชื่อ/อายุ/เลขบัตร/route) → กด Save
2. Device B: เปิด Case จาก Dashboard → ให้ญาติเซ็น Consent → Submit
3. Device A: เพิ่ม V/S, IV, timeline ได้ตามปกติ
```
- Device A บันทึกเลขบัตรก่อน → Device B ไม่ต้อง sync-back → ไม่เสี่ยง overwrite
- V/S ที่ Device A เพิ่มภายหลังไม่ชนกับ Consent (คนละตาราง)

### ✅ Pattern 2: Parallel แบบแบ่งหน้าที่ชัดเจน
```
Device A: เฉพาะ V/S + IV + timeline (ล็อกไม่แตะข้อมูลผู้ป่วย/route)
Device B: เฉพาะ Consent (modal ไม่ touch main form)
```
**เงื่อนไข**:
- Device A ต้อง **กรอก demographics + route ให้ครบก่อนแตะ V/S เสมอ**
- ห้ามแก้ชื่อ/อายุ/เลขบัตร/route หลังจาก Device B เริ่มกระบวนการ Consent
- ถ้าจำเป็นต้องแก้ demographics → ให้ Device A **Refresh หน้าก่อน** เพื่อโหลดค่าล่าสุดจาก DB

### ⚠️ Pattern 3: Ad-hoc (ไม่แนะนำ)
สลับแก้ไขอิสระระหว่างสองเครื่อง — มีโอกาสเกิด race condition เสมอ  
**ถ้าจำเป็นต้องทำ ให้ Refresh Device A ทุกครั้งก่อนกด Save**

---

## กฎทอง 5 ข้อเพื่อไม่ให้ข้อมูลหาย

1. **กรอกเลขบัตรผู้ป่วยให้เสร็จก่อนเริ่มกระบวนการ Consent**  
   — เพราะ idCard คือข้อมูลสำคัญที่สุดทางกฎหมาย

2. **Device A เป็นผู้ "owner" ของ Case เสมอ**  
   — Device B ทำหน้าที่เฉพาะ Consent, ห้ามแก้ข้อมูลผู้ป่วยบน Device B

3. **ก่อน Device A กด Save V/S → เช็คว่าข้อมูลผู้ป่วยบน form ยัง sync กับ DB ล่าสุดหรือไม่**  
   — หากไม่แน่ใจ ให้ Refresh / เปิด Case ใหม่ก่อน

4. **ห้ามเปิด Case เดียวกันบน 2 เครื่องพร้อมกันโดยทั้งสองเครื่องมีสิทธิ์แก้ form หลัก**  
   — ใช้กฎ "A = Form, B = Consent" เท่านั้น

5. **หลัง Consent ถูกเซ็น → Device A ควร Refresh ก่อนกด Save ครั้งต่อไป**  
   — เพื่อให้ form ของ Device A โหลด idCard ที่ถูก sync-back กลับมาแล้ว

---

## สถานการณ์ที่พบบ่อย + วิธีแก้

### Q1: Device A กำลังกรอก V/S อยู่, Device B ส่ง Consent — จะเกิดอะไรขึ้น?
- Consent ถูกบันทึกในตาราง `transport_consents` (ไม่ชน)
- ถ้า `patient_info.idCard` ใน DB ยังว่าง → ระบบจะ sync-back เลขบัตรจาก Consent กลับ `cases`
- **แต่** ถ้า Device A กด Save หลังจากนั้น → Device A จะเขียนทับ patient_info ด้วยค่าจาก form ของตน
- **วิธีแก้**: Device A Refresh หน้า หรือเปิด Case ใหม่ก่อนกด Save

### Q2: Device A กด Save ก่อน, Device B ส่ง Consent ทีหลัง — ปลอดภัยไหม?
- ✅ ปลอดภัย ถ้า Device A ใส่เลขบัตรไปแล้ว
- Device B ส่ง Consent → ระบบเช็คว่า `patient_info.idCard` ไม่ว่าง → ไม่ sync-back (เคารพค่าเดิม)

### Q3: Device A ลืมกรอกเลขบัตร, Device B ให้ญาติกรอกใน Consent แทน
- ✅ Device B's Consent Submit → sync-back เลขบัตรเข้า `cases` อัตโนมัติ
- **ระวัง**: Device A ห้ามกด Save ซ้ำ (ด้วยค่าเลขบัตรว่างจาก form เก่า) จนกว่าจะ Refresh
- หาก Device A Save ด้วยค่าว่าง → เลขบัตรจะหายอีกรอบ

### Q4: ต้องแก้ Consent ย้อนหลัง ทำอย่างไรไม่ให้กระทบ V/S?
- เปิด Case จาก Dashboard → เปิด Consent preview → กด "✏️ แก้ไข (เวอร์ชันใหม่)"
- ระบบจะสร้างเวอร์ชันใหม่ (v2, v3, ...) โดยไม่ยุ่งกับ `cases.raw_data`
- V/S บน Device A ไม่ได้รับผลกระทบ (คนละตาราง)

### Q5: Admin ลบ Consent ที่ผิด ทำอย่างไร?
- เปิด Case → Preview Consent → เลือกเวอร์ชันจาก dropdown → กด "🗑️ ลบฉบับนี้ (Admin)"
- ถ้าลบฉบับ active → ระบบ promote เวอร์ชันก่อนหน้าเป็น active ให้อัตโนมัติ
- ไม่กระทบ V/S / timeline

---

## ตัวอย่าง Timeline ที่ปลอดภัย

```
09:00  Device A: เปิด Case ใหม่ → กรอกชื่อ/อายุ/เลขบัตร/route → Save (ID auto-gen)
09:02  Device A: เริ่มบันทึก V/S แรก
09:05  Device B: เปิด Case จาก Dashboard (ดึงข้อมูลล่าสุด)
09:07  Device B: ให้ญาติเซ็น Consent → Submit
       → transport_consents v1 created
       → cases.patient_info.idCard มีค่าอยู่แล้ว → ไม่ sync-back
09:10  Device A: บันทึก V/S ถัดไป → Save (ปลอดภัย — idCard ใน form ยังครบ)
09:30  Device A: ถึงปลายทาง → Complete Case
```

```
09:00  Device A: เปิด Case ใหม่ → กรอกแค่ชื่อ + route → Save (ลืมเลขบัตร)
09:02  Device B: เปิด Case → ญาติกรอกเลขบัตรใน Consent + เซ็น → Submit
       → cases.patient_info.idCard ถูก sync-back จาก Consent
09:05  Device A: 🔄 Refresh หน้า (สำคัญ!) → form โหลด idCard ที่ sync-back แล้ว
09:06  Device A: เริ่มบันทึก V/S → Save ได้ตามปกติ
```

---

## หลักเทคนิคเบื้องหลัง (สำหรับทีม Dev)

- **Consent sync-back เป็น partial update**: `.update({ patient_info, raw_data })` โดยอ่าน raw_data จาก DB ก่อนแล้ว merge เฉพาะ `pt_idcard` → ไม่ทำลาย vitalsJson / ivJson ที่ Device A เคย save
- **Device A's saveData เป็น full upsert**: `.upsert({ ... raw_data: { rawSnapshot, vitalsJson, ivJson } })` → เขียนทับทุกฟิลด์จาก form state
- **แก้ไขในอนาคต (ถ้าต้องการ strong consistency)**:
  - ย้าย V/S / IV ไปตารางแยกที่ append-only (เช่น `case_vitals_log`)
  - หรือใช้ Supabase Realtime subscribe ให้ Device A รับ event เมื่อ `cases` ถูก update โดยเครื่องอื่น → prompt Refresh
  - หรือ merge แบบ JSON patch แทน upsert
