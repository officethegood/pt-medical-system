# CMSV6 / 808gps API Reference

Snapshot จาก `http://203.170.193.90/808gps/open/webApi.html`
Version: **7.33.0.7_20240508** (ดึงมาเมื่อ 2026-04-15)

## ไฟล์

- **`cmsv6-apiPage.js`** — 8917 บรรทัด — JS object ที่เก็บ metadata ทุก endpoint (request params, response fields, examples)
- **`cmsv6-webApi.js`** — UI loader สำหรับหน้า docs

> ⚠️ ไฟล์เหล่านี้เป็น **reference only** ไม่ได้ใช้ใน runtime ของเรา
> เอาไว้เปิดดูเวลาจะเขียน adapter หรือเพิ่มฟีเจอร์ใหม่

## วิธีใช้ตอนพัฒนา

1. หา endpoint ที่ต้องการใน list ด้านล่าง
2. `grep` ชื่อ endpoint ใน `cmsv6-apiPage.js` เพื่อดู params + response
   ```
   grep -A 30 "StandardApiAction_queryTrackDetail" cmsv6-apiPage.js
   ```
3. เขียน function ใน `shared/gps-providers.js` → `cmsv6` adapter

---

## Endpoints ทั้งหมด (87 ตัว)

### 🔐 Auth / Session
| Endpoint | ใช้งาน | หน้าที่ |
|---|---|---|
| `StandardApiAction_login.action` | ✅ ใช้อยู่ | Login → jsession |
| `StandardApiAction_loginEx.action` | | Login แบบ extended |
| `StandardApiAction_logout.action` | | Logout |
| `StandardApiAction_saveUserSessionEx.action` | | Save session config |
| `StandardApiAction_delUserSession.action` | | Revoke session |

### 📍 Realtime Query
| Endpoint | ใช้งาน | หน้าที่ |
|---|---|---|
| `StandardApiAction_queryUserVehicle.action` | ✅ ใช้อยู่ | List รถของ user |
| `StandardApiAction_getDeviceStatus.action` | ✅ ใช้อยู่ | ตำแหน่งล่าสุด (lat/lng/speed/online) |
| `StandardApiAction_getDeviceOlStatus.action` | | online/offline status ย่อ |
| `StandardApiAction_vehicleStatus.action` | | สถานะรถ |
| `StandardApiAction_findVehicleInfoByDeviceId.action` | | ข้อมูลรถจาก device ID |
| `StandardApiAction_findVehicleInfoByDeviceJn.action` | | ข้อมูลรถจาก JN |

### 🛣️ Track / History ⭐
| Endpoint | ประโยชน์ | หน้าที่ |
|---|---|---|
| `StandardApiAction_queryTrackDetail.action` | 🔥 สูง | เส้นทางย้อนหลัง |
| `StandardApiAction_parkDetail.action` | | จุดจอด |
| `StandardApiAction_runMileage.action` | | ไมล์สะสม |
| `StandardApiAction_getOilTrackDetail.action` | | การใช้น้ำมัน |

### 🚨 Alarms
`queryAlarmDetail` · `vehicleAlarm` · `queryIdentifyAlarm` · `alarmEvidence` · `zipAlarmEvidence`

### 📹 Video / Camera ⭐
| Endpoint | ประโยชน์ |
|---|---|
| `realTimeVedio` | สตรีม live |
| `capturePicture` | 🔥 ถ่ายภาพทันทีจาก DVR |
| `queryPhoto` · `queryAudioOrVideo` · `getVideoFileInfo` · `getVideoHistoryFile` | ดูไฟล์ใน DVR |
| `addDownloadTask` · `downloadTasklist` · `delDownloadTasklist` · `controllDownLoad` · `queryDownLoadReplayEx` | 🔥 Download วิดีโอย้อนหลัง |
| `ftpUpload` · `queryFtpStatus` | ส่งไฟล์ไป FTP |

### 🎮 Vehicle Control
| Endpoint | หน้าที่ |
|---|---|
| `sendPTZControl` | หมุนกล้อง PTZ |
| `vehicleControlGPSReport` | บังคับส่งตำแหน่งทันที |
| `vehicleControlOthers` | ควบคุมอื่น (ตัดน้ำมัน/ปลดล็อก) |
| `vehicleTTS` | ส่งข้อความเสียงให้คนขับ |

### 🚗 Device / Vehicle CRUD
`addDevice` · `editDevice` · `deleteDevice` · `addVehicle` · `updVehicle` · `deleteVehicle` · `installVehicle` · `uninstallDevice` · `getDeviceByVehicle`

### 👤 User / Driver / Role
`queryDriverList` · `savaUser` · `findUserAccount` · `mergeUserAccount` · `deleteUserAccount` · `findUserRole` · `mergeUserRole` · `deleteUserRole` · `findDriverInfoByDeviceId`

### 🏢 Company / Group
`findCompany` · `mergeCompany` · `deleteCompany` · `deleteGroup` · `marginGroup` · `delGroupMember`

### 🚧 Geofence / Rules
`loadRules` · `queryRuleList` · `mergeRule` · `editRule` · `delRule` · `loadDevRuleByRuleId` · `delDevRule` · `devRulePermit`

### 📡 SIM Management
`findSIMInfo` · `loadSIMInfos` · `mergeSIMInfo` · `deleteSIMInfo` · `unbindingSIM`

### 📋 Reports / Misc
`performanceReportPhotoListSafe` · `userMediaRateOfFlow` · `getFlowInfo` · `saveFlowConfig` · `callDetail` · `queryPunchCardRecode` · `queryAccessAreaInfo` · `getLoadDeviceInfo`

### 📂 Catalog / Markers / Media
`catalogSummaryApi` · `catalogDetailApi` · `getUserMarkers` · `addMediaInformation` · `delMediaInformation`

---

## ข้อสังเกต

- ✅ **ครอบคลุม CRUD หลักๆ** ของ Device, Vehicle, User, Company, Rule, SIM
- ✅ **Realtime + Track + Alarm** ครบถ้วน
- ✅ **Video/Camera ครบ** ทั้ง live, capture, download
- ⚠️ **HLS streaming** (port 6604) ไม่อยู่ใน docs นี้ — เป็น feature เสริมนอก standard API
- ⚠️ **WebSocket / Push** ถ้ามีก็ไม่ได้ document ที่นี่ — ระบบเรา poll HTTP ทุก 10s
- ⚠️ **Error code table** — docs ไม่แสดง error codes ครบ (รู้แค่ result=0 success, result=24 session expired จาก experience)

## Version note

ถ้า CMSV6 server upgrade เวอร์ชันใหม่ — ดึง snapshot ใหม่โดย:
```bash
curl -s http://<server>/808gps/open/js/apiPage.js -o cmsv6-apiPage.js
```
