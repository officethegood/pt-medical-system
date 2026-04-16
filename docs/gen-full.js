const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  PageBreak, HeadingLevel, TableOfContents } = require('docx');

const font = "Angsana New";
const sz = 32; // 16pt
const szH1 = 36; // 18pt
const szH2 = 34; // 17pt
const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function h1(text) {
  return new Paragraph({
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: szH1, font })]
  });
}
function h2(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: szH2, font })]
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: opts.afterSpacing || 120, line: 276 },
    indent: opts.noIndent ? {} : { firstLine: 720 },
    children: [new TextRun({ text, size: sz, font, ...(opts.bold ? { bold: true } : {}), ...(opts.italics ? { italics: true } : {}) })]
  });
}
function pMulti(runs) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 120, line: 276 },
    indent: { firstLine: 720 },
    children: runs.map(r => new TextRun({ size: sz, font, ...r }))
  });
}
function emptyP() { return new Paragraph({ children: [] }); }

function makeCell(text, opts = {}) {
  return new TableCell({
    borders,
    margins: cellMargins,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.header ? { fill: "E8F0FE", type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, size: sz, font, bold: !!opts.header })]
    })]
  });
}

// ============ COVER PAGE ============
const coverChildren = [
  emptyP(), emptyP(), emptyP(), emptyP(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", size: sz, font, color: "2E75B6" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "ประเภทผลงาน: สิ่งประดิษฐ์/นวัตกรรม", size: sz, font, color: "666666" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", size: sz, font, color: "2E75B6" })] }),
  emptyP(), emptyP(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "ระบบสารสนเทศดิจิทัลต้นทุนต่ำเพื่อบริหารการปฏิบัติการ\nของรถพยาบาลเอกชน: การลำเลียงผู้ป่วย การส่งต่อ\nและการตอบสนองต่อเหตุฉุกเฉิน", bold: true, size: 40, font, color: "1E3A5F" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "PT-Medical System", bold: true, size: 40, font, color: "2E75B6" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "A Low-Cost Digital Information System for Private Ambulance Operations: Inter-Facility Transport, Referral, and Emergency Response", italics: true, size: 30, font, color: "666666" })] }),
  emptyP(), emptyP(), emptyP(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "ผู้จัดทำ", size: sz, font, color: "666666" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "นายสิทธาคม ฐิติวร", bold: true, size: 36, font })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "พญ.กนกวรรณ กองจำปา", bold: true, size: 36, font })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "หน่วยปฏิบัติการแพทย์ระดับสูง บริษัท ทรัพย์วิไล เมดิคอล จำกัด (นครสวรรค์)", size: sz, font })] }),
  emptyP(), emptyP(),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "พ.ศ. 2569", size: sz, font, color: "666666" })] }),
];

// ============ TOC PAGE ============
const tocChildren = [
  h1("สารบัญ"),
  new TableOfContents("สารบัญ", { hyperlink: true, headingStyleRange: "1-2" }),
];

// ============ Chapter 1 ============
const ch1 = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: "บทที่ 1 บทนำ", bold: true, size: szH1, font })] }),

  h2("1.1 ความเป็นมาและความสำคัญของปัญหา"),
  p("หน่วยปฏิบัติการแพทย์ภาคเอกชนประเภทรถพยาบาลในประเทศไทย มีภารกิจหลักในการลำเลียงผู้ป่วยและส่งต่อระหว่างสถานพยาบาล (inter-facility transport/referral) การออกหน่วยปฐมพยาบาล (standby first aid) และการตอบสนองต่อเหตุฉุกเฉินในพื้นที่รับผิดชอบ โดยอยู่ภายใต้การกำกับดูแลของพระราชบัญญัติการแพทย์ฉุกเฉิน พ.ศ. 2551 และประกาศที่ออกตามกฎหมายดังกล่าว ได้แก่ ประกาศคณะกรรมการการแพทย์ฉุกเฉิน (กพฉ.) เรื่อง หลักเกณฑ์และเงื่อนไขเกี่ยวกับการปฏิบัติหน้าที่และการกำกับดูแลหน่วยปฏิบัติการแพทย์ พ.ศ. 2564 (ฉบับปรับปรุง ครั้งที่ 1 พ.ศ. 2567) ประกาศ กพฉ. เรื่อง ประเภท ระดับ อำนาจหน้าที่ ขอบเขต ความรับผิดชอบ หรือข้อจำกัดของผู้ปฏิบัติการ พ.ศ. 2566 (กำหนดระดับผู้ปฏิบัติการ 6 ระดับ ได้แก่ อฉพ./พฉพ./พฉพพ./จฉพ./จฉพส./นฉพ.) และประกาศ กพฉ. เรื่อง หลักเกณฑ์และเงื่อนไขเกี่ยวกับการปฏิบัติหน้าที่และการกำกับดูแลการปฏิบัติงานของผู้ปฏิบัติการ พ.ศ. 2567 (ราชกิจจานุเบกษา เล่ม 141 ตอนพิเศษ 337 ง, 9 ธันวาคม 2567) ซึ่งกำหนดให้หน่วยต้องมอบหมายการปฏิบัติหน้าที่ บันทึกปฏิบัติการประจำตัวผู้ปฏิบัติการ มีสัญลักษณ์ระบุตัว (EMS profile/QR code) และปฏิบัติตามข้อห้าม 10 ประการตามที่ประกาศกำหนด"),
  p("ทีมกู้ชีพและหน่วยปฏิบัติการแพทย์ระดับ BLS (Basic Life Support) และ ALS (Advance Life Support) ส่วนใหญ่ในประเทศไทยยังคงพึ่งพาระบบกระดาษเป็นหลักในการบันทึกข้อมูลผู้ป่วย ใบยินยอมรับบริการ และรายงานสถิติ ซึ่งก่อให้เกิดปัญหาหลายประการที่ส่งผลกระทบโดยตรงต่อความปลอดภัยของผู้ป่วยและประสิทธิภาพของทีมกู้ชีพ ได้แก่ ข้อมูลผู้ป่วยสูญหายหรืออ่านลายมือไม่ออก ข้อมูลสำคัญเช่น ชื่อยา สัญญาณชีพ หรือเวลาทำหัตถการ อาจบันทึกผิดพลาด ทำให้การส่งต่อข้อมูลระหว่างทีมกู้ชีพกับโรงพยาบาลปลายทางไม่สมบูรณ์"),
  p("ผู้บริหารหน่วยปฏิบัติการ (Admin) และแพทย์ที่ปรึกษา (Medical Director) ไม่สามารถเห็นข้อมูลเคสได้แบบ Real-time ทำให้การขอคำปรึกษา (Consult) ได้แค่การบอกเล่าทางโทรศัพท์ ไม่เห็นภาพรวมของเคสผ่านทางการบันทึกข้อมูลทางเอกสาร การที่แพทย์ที่ปรึกษาสามารถเห็นข้อมูลจริงขณะที่ทีมกู้ชีพกำลังปฏิบัติงาน จะช่วยให้สั่งการรักษาได้ถูกต้องและรวดเร็วกว่าเพียงแค่ฟังคำบอกเล่า"),
  p("สำหรับงาน First Aid ในเหตุการณ์ขนาดใหญ่ เช่น งานเทศกาลหรือคอนเสิร์ต แต่ละจุดบริการต้องจดข้อมูลลงกระดาษ เมื่อจบงานต้องรวบรวมกระดาษจากทุกจุดมาทำสถิติซึ่งใช้เวลาหลายชั่วโมง ผู้บัญชาการเหตุการณ์ไม่สามารถเห็นภาพรวมผู้ป่วยทุกจุดได้แบบ Real-time ทำให้การจัดสรรทรัพยากรเช่น ยา เวชภัณฑ์ หรือบุคลากร ไม่ทันท่วงที"),
  p("ใบยินยอมรับบริการ (Consent Form) กระดาษมีข้อจำกัดทั้งเรื่องเอกสารเปียก/ฉีกขาด ข้อมูลไม่ครบ ไม่มี audit trail ตรวจสอบย้อนหลัง และกรณีผู้ป่วยต่างชาติ ใบยินยอมภาษาไทยทำให้ผู้ป่วยไม่เข้าใจเนื้อหา ซึ่งอาจเป็นปัญหาทางกฎหมาย"),
  p("แม้ระบบ Telemedicine จะแก้ปัญหาได้บางส่วน แต่มีต้นทุนสูงทั้งอุปกรณ์ ซอฟต์แวร์ลิขสิทธิ์ และค่า license รายเดือน ซึ่งเกินงบประมาณของทีมกู้ชีพส่วนใหญ่ จึงเกิดเป็น \"ช่องว่าง\" ระหว่าง Telemedicine ราคาสูงกับระบบกระดาษที่ไม่มีประสิทธิภาพ PT-Medical System ถูกพัฒนาขึ้นเพื่อเติมเต็มช่องว่างนี้ โดยเป็นระบบดิจิทัลที่มีต้นทุนเป็นศูนย์ ใช้งานได้ทันทีบนมือถือผ่าน Web Browser"),

  h2("1.2 วัตถุประสงค์"),
  p("1) พัฒนาระบบบันทึกข้อมูลผู้ป่วยฉุกเฉินดิจิทัลที่มีต้นทุนเป็นศูนย์ ใช้งานได้บนมือถือผ่าน Web Browser", { noIndent: true }),
  p("2) พัฒนาระบบ Digital Consent ที่ถูกต้องตามกฎหมาย มี audit trail รองรับหลายภาษา", { noIndent: true }),
  p("3) พัฒนาระบบ Location Tracking สำหรับบันทึกพิกัดจุดเกิดเหตุและปลายทาง", { noIndent: true }),
  p("4) พัฒนา Real-time Monitor Dashboard สำหรับผู้บริหารและแพทย์ที่ปรึกษา ให้ consult ได้โดยเห็นข้อมูลจริง", { noIndent: true }),
  p("5) พัฒนา First Aid Dashboard รวมข้อมูลทุกจุดให้บริการแบบ Real-time", { noIndent: true }),
  p("6) ลดการใช้กระดาษและลดเวลาการรวบรวมสถิติจากหลายชั่วโมงเป็นทันที", { noIndent: true }),

  h2("1.3 ขอบเขตการศึกษา"),
  p("ทดสอบใช้งานจริงใน 2 หน่วยปฏิบัติการแพทย์ภาคเอกชน ได้แก่ (1) บริษัท ทรัพย์วิไล เมดิคอล จำกัด ซึ่งได้รับอนุมัติเป็นหน่วยปฏิบัติการแพทย์ระดับสูง (ALS) ในพื้นที่จังหวัดนครสวรรค์ ให้บริการลำเลียง/ส่งต่อผู้ป่วย ปฐมพยาบาล และตอบสนองเหตุฉุกเฉินตามชุดโปรโตคอลภายใน 3 ฉบับ (Protocol EMS, Protocol First Aid, Protocol Refer) และ (2) The Good Ambulance ซึ่งได้รับอนุมัติเป็นหน่วยปฏิบัติการแพทย์ระดับพื้นฐาน (BLS) ในพื้นที่กรุงเทพมหานคร ระยะดำเนินงานในเวอร์ชันที่เสนอบทความนี้อยู่ระหว่างเดือนมีนาคม\u2013ธันวาคม 2569 รวมระยะเวลา 10 เดือน ครอบคลุมงาน Transport/Referral, First Aid, Emergency Response, Digital Consent, Location Tracking, บันทึกปฏิบัติการประจำตัวผู้ปฏิบัติการ, ใบรายงานอุบัติการณ์ดิจิทัล และ Real-time Monitor Dashboard"),
];

// ============ Chapter 2 ============
const ch2 = [
  new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: "บทที่ 2 แนวคิดและทฤษฎีที่เกี่ยวข้อง", bold: true, size: szH1, font })] }),

  h2("2.1 ช่องว่างระหว่าง Telemedicine กับระบบกระดาษ"),
  p("ในปัจจุบัน การจัดการข้อมูลผู้ป่วยในระบบการแพทย์ฉุกเฉินมี 2 ขั้วหลัก ได้แก่ ระบบ Telemedicine ที่มีความสมบูรณ์แต่ต้นทุนสูง (ค่าอุปกรณ์เฉพาะทาง ค่าซอฟต์แวร์ ค่า license รายเดือน ค่าบำรุงรักษา) และระบบกระดาษที่ต้นทุนต่ำแต่ขาดประสิทธิภาพอย่างมาก ระบบ Telemedicine เต็มรูปแบบมักต้องใช้งบประมาณหลักแสนถึงหลักล้านบาท ซึ่งเป็นไปไม่ได้สำหรับหน่วยปฏิบัติการขนาดเล็กที่มีรายได้จำกัด"),
  p("PT-Medical System ถูกออกแบบมาเพื่ออยู่ตรงกลางของสองขั้วนี้ คือมีประสิทธิภาพใกล้เคียงระบบดิจิทัลในด้านการบันทึกข้อมูล การติดตามเคส และการให้คำปรึกษาแบบ Real-time แต่ต้นทุนเป็นศูนย์ โดยใช้ประโยชน์จากเทคโนโลยีคลาวด์ที่มี free tier เพียงพอสำหรับการใช้งานจริงของหน่วยปฏิบัติการขนาดเล็กถึงกลาง"),

  h2("2.2 ทำไมแอปส่งข้อความ (LINE/Messenger) ไม่ตอบโจทย์"),
  p("ในทางปฏิบัติ หลายหน่วยปฏิบัติการพยายามใช้ LINE หรือ Messenger แทนระบบกระดาษ โดยถ่ายรูปเอกสารหรือพิมพ์ข้อมูลส่งในกลุ่ม แม้จะสะดวกเบื้องต้น แต่มีข้อจำกัดสำคัญเมื่อพิจารณาจากมุมมองของผู้ปฏิบัติงานแต่ละบทบาท"),
  p("ในมุมมองของแพทย์อำนวยการ (Medical Director) และแพทย์เวชศาสตร์ฉุกเฉิน — LINE ไม่มี Dashboard รวม ข้อมูลกระจัดกระจายในแชทหลายห้อง ค้นเคสย้อนหลังไม่สะดวก ไม่มีระบบกรองเคสตามวันที่หรือสถานะ consult ได้แค่รูปภาพและข้อความไม่มีโครงสร้าง ไม่เห็นสัญญาณชีพหรือ timeline การรักษาแบบเป็นระบบ ในมุมมองนักฉุกเฉินการแพทย์ (Paramedic) พยาบาล และ EMT — พิมพ์ข้อมูลลง LINE ขณะฉุกเฉินยากลำบาก ไม่มีฟอร์มบังคับกรอก อาจลืมรายละเอียดสำคัญ ข้อมูลการแพทย์ปะปนข้อความส่วนตัว ไม่สามารถพิมพ์ใบส่งตัวจาก LINE ได้ ในมุมมอง EMR และเจ้าหน้าที่ First Aid — ไม่สามารถรวมข้อมูลจากหลายจุดให้บริการในหน้าเดียว ไม่มีระบบนับผู้ป่วยหรือสถิติยาอัตโนมัติ"),
  p("ในด้านกฎหมาย — ข้อความ LINE ลบ/แก้ไขได้ ไม่มี audit trail ทางนิติเวช การส่งข้อมูลผู้ป่วยในกลุ่มแชทเปิดเผยข้อมูลส่วนบุคคลให้ทุกคนเห็นซึ่งอาจละเมิด PDPA ไม่มีระบบ consent และไม่มีการควบคุมสิทธิ์การเข้าถึง PT-Medical System แก้ข้อจำกัดเหล่านี้ด้วยฟอร์มที่มีโครงสร้าง Dashboard รวมทุกเคส audit trail ที่ลบไม่ได้ และการควบคุมสิทธิ์ — ในขณะที่ใช้งานง่ายบนมือถือเหมือน LINE"),

  h2("2.3 Progressive Web App (PWA) ในงาน EMS"),
  p("Progressive Web App (PWA) คือเว็บแอปพลิเคชันที่ทำงานได้เหมือนแอปบนมือถือ โดยไม่ต้องติดตั้งผ่าน App Store/Play Store เปิด Web Browser เข้าเว็บไซต์ก็ใช้งานได้ทันที PWA รองรับทุกอุปกรณ์และทุกระบบปฏิบัติการ (Android, iOS, Windows) ไม่ต้องอัปเดตแอป สามารถ Add to Home Screen ได้ และรองรับ offline capability บางส่วน จึงเหมาะสมที่สุดสำหรับทีมกู้ชีพที่ใช้มือถือส่วนตัวในการทำงาน เพราะไม่ต้องลงทุนอุปกรณ์ใหม่"),

  h2("2.4 Digital Consent และกฎหมายที่เกี่ยวข้อง"),
  p("พ.ร.บ.ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544 และที่แก้ไขเพิ่มเติม รับรองให้ลายมือชื่ออิเล็กทรอนิกส์มีผลทางกฎหมายเทียบเท่าลายมือชื่อบนกระดาษ ทั้งนี้ลายมือชื่ออิเล็กทรอนิกส์ต้องมีคุณสมบัติที่สามารถระบุตัวเจ้าของลายมือชื่อได้ และสามารถแสดงเจตนาของเจ้าของลายมือชื่อเกี่ยวกับข้อมูลที่ลงนามได้"),
  p("ระบบ Digital Consent ที่พัฒนาขึ้นใช้หลักการ audit trail คือเก็บบันทึกทุก version ของใบยินยอม ไม่ลบและไม่แก้ไขย้อนหลัง (Immutable Record) เมื่อมีการเซ็นใหม่ ฉบับเดิมจะถูกเปลี่ยนสถานะเป็น \"superseded\" (ถูกแทนที่) แทนการลบทิ้ง หลักการนี้สอดคล้องกับแนวปฏิบัติทางนิติเวชที่ต้องการให้สามารถตรวจสอบหลักฐานย้อนหลังได้ทุกขั้นตอน"),
  p("นอกจากนี้ ระบบยังรองรับ พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) โดยมีข้อความแจ้งสิทธิ์ผู้ป่วยครบถ้วนในทุกภาษา แจ้งวัตถุประสงค์ในการเก็บข้อมูล ระยะเวลาการเก็บ และสิทธิ์ของเจ้าของข้อมูลในการเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลของตน"),

  h2("2.5 Real-time Dashboard ในการบริหารจัดการ EMS"),
  p("Real-time Dashboard เป็นเครื่องมือสำคัญในการบริหารจัดการงาน EMS สมัยใหม่ จากการศึกษาขององค์การอนามัยโลก (WHO, 2019) ระบบสารสนเทศสุขภาพดิจิทัลสามารถเพิ่มประสิทธิภาพการตัดสินใจของบุคลากรทางการแพทย์ได้อย่างมีนัยสำคัญ"),
  p("ในบริบทของงาน EMS การที่แพทย์ที่ปรึกษาสามารถเห็นข้อมูลเคสได้ทันที หมายถึงการสามารถให้คำปรึกษาและสั่งการรักษาได้โดยเห็นข้อมูลจริง ไม่ใช่แค่ฟังคำบอกเล่าทางโทรศัพท์ ซึ่งลดโอกาสเกิดความผิดพลาดจากการสื่อสารที่ไม่ครบถ้วน สำหรับงาน First Aid ในเหตุการณ์ขนาดใหญ่ Dashboard ที่รวมข้อมูลทุกจุดให้บริการไว้ในที่เดียวช่วยให้ผู้บัญชาการเหตุการณ์เห็นภาพรวมและจัดสรรทรัพยากรได้อย่างมีประสิทธิภาพ เช่น การส่งยาเพิ่มไปยังจุดที่กำลังจะหมด หรือการส่งบุคลากรเสริมไปยังจุดที่มีผู้ป่วยหนาแน่น"),

  h2("2.6 Location Tracking ในงานการแพทย์ฉุกเฉิน"),
  p("การบันทึกพิกัดจุดเกิดเหตุเป็นข้อมูลที่มีความสำคัญในงาน EMS ทั้งในด้านการปฏิบัติงาน (เพื่อให้หน่วยอื่นหรือโรงพยาบาลปลายทางทราบตำแหน่ง) และในด้านการเก็บสถิติ (เพื่อวิเคราะห์จุดที่เกิดเหตุบ่อย) มือถือสมัยใหม่ทุกเครื่องมี GPS ในตัว ซึ่งสามารถระบุพิกัดได้แม่นยำระดับ 5\u201310 เมตร จึงเป็นอุปกรณ์ที่เหมาะสมสำหรับการบันทึกตำแหน่งโดยไม่ต้องลงทุนอุปกรณ์เพิ่มเติม"),
];

// ============ Chapter 3 ============
const ch3 = [
  new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: "บทที่ 3 วิธีการดำเนินงาน", bold: true, size: szH1, font })] }),

  h2("3.1 การออกแบบสถาปัตยกรรมระบบ"),
  p("ระบบ PT-Medical System ออกแบบบนหลักการ \"Zero-Cost Architecture\" โดยคัดเลือกเทคโนโลยีที่มี free tier เพียงพอสำหรับการใช้งานจริงของหน่วยปฏิบัติการขนาดเล็กถึงกลาง สถาปัตยกรรมประกอบด้วย:"),
  p("\u2022 Frontend: HTML5/JavaScript/CSS ในรูปแบบ Progressive Web App (PWA) เน้นการทำงานบน mobile browser เป็นหลัก", { noIndent: true }),
  p("\u2022 Backend/Database: Supabase (Cloud PostgreSQL Database) ที่มี free tier รองรับ 500 MB storage, 50,000 API requests/เดือน และ Real-time subscriptions สำหรับอัปเดตข้อมูลอัตโนมัติ", { noIndent: true }),
  p("\u2022 Hosting: GitHub Pages ที่ให้บริการ static hosting ฟรี ไม่จำกัดแบนด์วิดท์ พร้อม HTTPS", { noIndent: true }),
  p("\u2022 Authentication: Supabase Auth ด้วย email/password สำหรับควบคุมการเข้าถึง", { noIndent: true }),
  p("ด้วยสถาปัตยกรรมข้างต้น ต้นทุนการดำเนินการทั้งระบบเป็น 0 บาทต่อเดือน ไม่มีค่า license ค่า hosting หรือค่าบำรุงรักษาใด ๆ หน่วยปฏิบัติการใด ๆ ที่มีมือถือและอินเทอร์เน็ตสามารถเริ่มใช้งานได้ทันที"),
  p("ระบบแบ่งออกเป็น 5 โมดูลหลัก ได้แก่ Transport (บันทึกเคสการนำส่ง), Digital Consent (ใบยินยอมดิจิทัล), First Aid (งานปฐมพยาบาลในอีเวนต์), Location Tracking (บันทึกพิกัด GPS) และ Monitor Dashboard (หน้าจอติดตามสำหรับ Admin/แพทย์) แต่ละโมดูลทำงานอิสระแต่เชื่อมข้อมูลถึงกัน"),

  h2("3.2 โมดูล Transport"),
  p("โมดูล Transport สำหรับบันทึกข้อมูลเคสการนำส่งผู้ป่วยฉุกเฉิน ครอบคลุมข้อมูลผู้ป่วย (ชื่อ อายุ เลขบัตรประชาชน/Passport) ข้อมูลทางการแพทย์ (ประวัติอาการ สัญญาณชีพ ระดับความรู้สึกตัว การรักษาเบื้องต้น) ข้อมูลเส้นทาง (ต้นทาง ปลายทาง) และสถานะเคส ระบบสร้าง Case ID อัตโนมัติในรูปแบบ CASE-YYYYMMDD-XXX ทำให้ระบุวันที่เปิดเคสได้ทันที และมีฟังก์ชันพิมพ์ใบส่งตัว (Referral Form) จากมือถือโดยตรง"),

  h2("3.3 โมดูล Digital Consent"),
  p("โมดูล Digital Consent เป็นระบบใบยินยอม/ปฏิเสธการรับบริการรถพยาบาลฉุกเฉินในรูปแบบดิจิทัล ออกแบบให้ครอบคลุมข้อกำหนดทางกฎหมายทุกประการ และใช้งานได้จริงในสถานการณ์ฉุกเฉิน โดยมีคุณสมบัติดังนี้:"),
  p("\u2022 ลายเซ็นดิจิทัลบนหน้าจอมือถือ: ผู้ป่วยหรือญาติเซ็นชื่อบนหน้าจอโดยตรง พร้อมบันทึกเวลาที่เซ็น (timestamp) ไว้เป็นหลักฐาน", { noIndent: true }),
  p("\u2022 Audit trail แบบ immutable: เก็บทุก version (ฉบับที่ 1, 2, 3...) ในฐานข้อมูล ไม่มีการลบหรือแก้ไขย้อนหลัง หากต้องเซ็นใหม่ ฉบับเก่าจะถูกเปลี่ยนสถานะเป็น \"superseded\" (ถูกแทนที่) ไม่ใช่ถูกลบ แม้เคสถูกลบ consent ก็ยังอยู่ในฐานข้อมูลด้วยสถานะ \"case_deleted\"", { noIndent: true }),
  p("\u2022 รองรับ 4 ภาษา: ไทย อังกฤษ จีนกลาง เมียนมาร์ ผู้ป่วยสามารถเลือกภาษาที่เข้าใจได้ทันที เนื้อหาทางกฎหมายและสิทธิ์ผู้ป่วยแปลครบถ้วนทุกภาษา", { noIndent: true }),
  p("\u2022 PDPA Consent: มีข้อความแจ้งสิทธิ์ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคลในทุกภาษา", { noIndent: true }),
  p("\u2022 ถ่ายรูปบัตรประชาชน/Passport: แนบภาพเป็นหลักฐานยืนยันตัวตนผู้เซ็น", { noIndent: true }),
  p("\u2022 Superseded Watermark: เมื่อเปิดดู consent ฉบับเก่าที่ถูกแทนที่แล้ว ระบบจะแสดง watermark \"ถูกแทนที่แล้ว ไม่ใช่ฉบับปัจจุบัน\" อย่างชัดเจน ป้องกันความสับสนระหว่างฉบับเก่ากับฉบับปัจจุบัน", { noIndent: true }),
  p("\u2022 การเชื่อมข้อมูลกับ Transport: เมื่อผู้ป่วยเซ็น consent แล้ว ข้อมูลที่กรอกใน consent (ชื่อ อายุ เลขบัตร ต้นทาง ปลายทาง) จะถูกส่งกลับไปยังฟอร์ม Transport โดยอัตโนมัติ ลดการกรอกข้อมูลซ้ำ", { noIndent: true }),

  h2("3.4 โมดูล First Aid"),
  p("โมดูล First Aid ถูกพัฒนาขึ้นเพื่อแก้ปัญหาการจัดการข้อมูลผู้ป่วยในงานอีเวนต์ขนาดใหญ่ที่มีหลายจุดให้บริการ เช่น งานเทศกาล คอนเสิร์ต งานวิ่งมาราธอน หรืองานกีฬา ซึ่งเดิมต้องใช้กระดาษบันทึกและรวบรวมสถิติด้วยมือหลังจบงาน"),
  p("ระบบสามารถสร้าง Event แล้วกำหนดจุดให้บริการ (Station) ได้หลายจุด แต่ละจุดบันทึกข้อมูลเข้าระบบแยกตาม 4 หมวด ได้แก่:"),
  p("\u2022 Registry: จำนวนผู้ป่วย ข้อมูลพื้นฐาน (ชื่อ อายุ อาการ) ระดับความรุนแรง", { noIndent: true }),
  p("\u2022 Med: ยาที่จ่าย จำนวน ชื่อผู้ป่วยที่ได้รับยา", { noIndent: true }),
  p("\u2022 Trauma: ประเภทการบาดเจ็บ ตำแหน่งบาดเจ็บ กลไกการบาดเจ็บ", { noIndent: true }),
  p("\u2022 Transfer: การส่งต่อผู้ป่วยไปโรงพยาบาล สาเหตุการส่งต่อ โรงพยาบาลปลายทาง", { noIndent: true }),
  p("First Aid Dashboard จะรวมข้อมูลจากทุกจุดให้บริการแสดงในหน้าเดียวแบบ Real-time ทำให้ผู้บัญชาการเหตุการณ์เห็นจำนวนผู้ป่วยทั้งหมด สถิติยาที่ใช้ ประเภทบาดเจ็บ และการส่งต่อ โดยไม่ต้องรอรวบรวมกระดาษจากแต่ละจุด"),

  h2("3.5 โมดูล Location Tracking"),
  p("โมดูล Location ใช้ GPS จากมือถือของทีมกู้ชีพบันทึกพิกัดจุดเกิดเหตุ จุดรับผู้ป่วย และปลายทาง รองรับการบันทึกพิกัดปัจจุบันอัตโนมัติ ค้นหาสถานที่ด้วยชื่อ ปักหมุดบนแผนที่ และสร้างลิงก์ Google Maps สำหรับแชร์ให้หน่วยอื่นหรือโรงพยาบาลปลายทาง ข้อมูลพิกัดบันทึกร่วมกับเคส Transport ทำให้ย้อนดูเส้นทางได้ภายหลัง และผู้บริหารเห็นตำแหน่งทีมกู้ชีพผ่าน Monitor Dashboard"),

  h2("3.6 โมดูล Monitor Dashboard"),
  p("Monitor Dashboard เป็นหน้าจอส่วนกลางสำหรับผู้บริหารและแพทย์ที่ปรึกษา แสดงข้อมูลจากทุกโมดูลรวมในที่เดียว ได้แก่ Transport Cases ทุกเคส (ข้อมูลผู้ป่วย สถานะ เส้นทาง), Digital Consent ทุกฉบับทุก version และ First Aid Events (สถิติผู้ป่วย ยา บาดเจ็บ) ข้อมูลอัปเดตอัตโนมัติทุก 3 นาที แพทย์ที่ปรึกษาสามารถดูรายละเอียดเคสและ consult ได้ทันทีผ่านการแชร์ลิงก์ โดยเห็นข้อมูลจริงที่ทีมกู้ชีพบันทึก"),

  h2("3.7 ระบบรักษาความปลอดภัยข้อมูล"),
  p("ข้อมูลผู้ป่วยเป็นข้อมูลที่มีความอ่อนไหวสูงและอยู่ภายใต้การคุ้มครองของ PDPA ระบบจึงให้ความสำคัญกับการรักษาความปลอดภัยเป็นอย่างยิ่ง โดยใช้มาตรการดังนี้:"),
  p("\u2022 Row Level Security (RLS): ใช้ RLS ของ Supabase ควบคุมสิทธิ์การเข้าถึงข้อมูลในระดับแถว ผู้ใช้แต่ละคนเข้าถึงได้เฉพาะข้อมูลของหน่วยปฏิบัติการตนเอง", { noIndent: true }),
  p("\u2022 No DELETE Policy: ตาราง transport_consents ไม่มี DELETE policy เด็ดขาด เพื่อป้องกันการลบหลักฐานทางกฎหมาย แม้ Admin ก็ไม่สามารถลบ consent ออกจากฐานข้อมูลได้", { noIndent: true }),
  p("\u2022 Authentication: การเข้าสู่ระบบใช้ email/password ผ่าน Supabase Auth รองรับการกำหนดบทบาทผู้ใช้ (Admin/User)", { noIndent: true }),
  p("\u2022 HTTPS: การสื่อสารระหว่าง client และ server เข้ารหัสด้วย SSL/TLS ตลอดเวลา", { noIndent: true }),
];

// ============ Chapter 4 ============
const ch4 = [
  new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: "บทที่ 4 ผลการดำเนินงาน", bold: true, size: szH1, font })] }),

  h2("4.1 ผลการทดสอบใช้งานจริง"),
  p("ระบบ PT-Medical System ถูกนำไปทดสอบใช้งานจริงใน 2 หน่วยปฏิบัติการแพทย์ภาคเอกชน ตลอดระยะดำเนินงานระหว่างเดือนมีนาคม\u2013ธันวาคม 2569 (รวม 10 เดือน) โดย บจก.ทรัพย์วิไล เมดิคอล (ALS นครสวรรค์) ใช้ระบบครอบคลุมทั้ง Protocol Refer (ลำเลียง/ส่งต่อ) Protocol First Aid (ปฐมพยาบาล) และ Protocol EMS (ตอบสนองเหตุฉุกเฉิน) ส่วน The Good Ambulance (BLS กรุงเทพมหานคร) ใช้เป็นหลักในงานลำเลียง/ส่งต่อและตอบสนองเหตุฉุกเฉินในเขตกรุงเทพฯ ผลการใช้งานในตารางที่ 1 เป็นกรอบรายงาน โดยตัวเลขสุดท้ายจะบันทึกเมื่อสิ้นสุดระยะดำเนินงาน (ธันวาคม 2569)"),

  // Table 1
  new Paragraph({ spacing: { before: 200, after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ตารางที่ 1 ผลการทดสอบใช้งานจริง", bold: true, size: sz, font })] }),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [3000, 2013, 2013, 2000],
    rows: [
      new TableRow({ children: [
        makeCell("ตัวชี้วัด", { header: true, width: 3000 }),
        makeCell("บจก.ทรัพย์วิไล", { header: true, center: true, width: 2013 }),
        makeCell("The Good Ambulance", { header: true, center: true, width: 2013 }),
        makeCell("รวม", { header: true, center: true, width: 2000 }),
      ]}),
      new TableRow({ children: [
        makeCell("Transport/Referral Cases", { width: 3000 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2000 }),
      ]}),
      new TableRow({ children: [
        makeCell("Digital Consent", { width: 3000 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2000 }),
      ]}),
      new TableRow({ children: [
        makeCell("First Aid / Emergency Events", { width: 3000 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2000 }),
      ]}),
      new TableRow({ children: [
        makeCell("First Aid Patients", { width: 3000 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2013 }),
        makeCell("[___]", { center: true, width: 2000 }),
      ]}),
    ]
  }),

  p("ตัวเลขในตารางที่ 1 จะรวบรวมและสรุปเมื่อสิ้นสุดระยะดำเนินงานในเดือนธันวาคม 2569 โดยคาดว่า บจก.ทรัพย์วิไล เมดิคอล (ALS นครสวรรค์) จะมีปริมาณเคสลำเลียง/ส่งต่อ (Transport/Referral) สูงกว่า เนื่องจากเป็นหน่วยปฏิบัติการแพทย์ระดับสูงที่มีภารกิจหลักในการลำเลียง/ส่งต่อผู้ป่วยระหว่างสถานพยาบาลในเขตจังหวัดนครสวรรค์และจังหวัดใกล้เคียง ในขณะที่ The Good Ambulance (BLS กรุงเทพฯ) จะมีสัดส่วน Transport/Referral ควบคู่กับ First Aid/Emergency Events ที่สูง เนื่องจากเป็นหน่วยปฏิบัติการในเขตกรุงเทพมหานครซึ่งมีทั้งความต้องการส่งต่อผู้ป่วยและงานปฐมพยาบาลเหตุการณ์ขนาดใหญ่ (อีเวนต์ คอนเสิร์ต เทศกาล ฯลฯ) การเก็บข้อมูลตลอด 10 เดือนจะช่วยสะท้อนความหลากหลายของภารกิจและช่วงเวลาที่แตกต่างกัน เช่น ฤดูกาลท่องเที่ยว เทศกาล หรือช่วงอุบัติเหตุรุนแรง"),

  h2("4.2 การลดการใช้กระดาษ"),
  p("จากการใช้งานระบบ สามารถลดการใช้กระดาษได้อย่างมีนัยสำคัญ โดยเดิมแต่ละเคส Transport ต้องใช้กระดาษอย่างน้อย 2 แผ่น (ใบบันทึกข้อมูลผู้ป่วย 1 แผ่น และใบยินยอมรับบริการ 1 แผ่น) สำหรับงาน First Aid แต่ละจุดให้บริการใช้กระดาษ 1\u20132 แผ่นต่อวันในการบันทึกรายชื่อผู้ป่วยและยาที่จ่าย การเปรียบเทียบสรุปได้ดังตารางที่ 2"),

  new Paragraph({ spacing: { before: 200, after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ตารางที่ 2 การเปรียบเทียบระบบเดิม (กระดาษ) กับ PT-Medical System", bold: true, size: sz, font })] }),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [3500, 2763, 2763],
    rows: [
      new TableRow({ children: [
        makeCell("รายการ", { header: true, width: 3500 }),
        makeCell("ระบบเดิม (กระดาษ)", { header: true, center: true, width: 2763 }),
        makeCell("PT-Medical System", { header: true, center: true, width: 2763 }),
      ]}),
      new TableRow({ children: [
        makeCell("Transport Record", { width: 3500 }),
        makeCell("1 แผ่น/เคส", { center: true, width: 2763 }),
        makeCell("ดิจิทัล (พิมพ์ได้)", { center: true, width: 2763 }),
      ]}),
      new TableRow({ children: [
        makeCell("Consent Form", { width: 3500 }),
        makeCell("1 แผ่น/เคส", { center: true, width: 2763 }),
        makeCell("ดิจิทัล + audit trail", { center: true, width: 2763 }),
      ]}),
      new TableRow({ children: [
        makeCell("First Aid บันทึกประจำจุด", { width: 3500 }),
        makeCell("1\u20132 แผ่น/จุด/วัน", { center: true, width: 2763 }),
        makeCell("ดิจิทัล Real-time", { center: true, width: 2763 }),
      ]}),
      new TableRow({ children: [
        makeCell("การรวบรวมสถิติ", { width: 3500 }),
        makeCell("หลายชั่วโมงหลังจบงาน", { center: true, width: 2763 }),
        makeCell("ทันทีผ่าน Dashboard", { center: true, width: 2763 }),
      ]}),
      new TableRow({ children: [
        makeCell("รวม [___] เคส (มีนาคม\u2013ธันวาคม 2569)", { width: 3500 }),
        makeCell("[___] แผ่น", { center: true, width: 2763 }),
        makeCell("0 แผ่น", { center: true, width: 2763 }),
      ]}),
    ]
  }),

  p("ตลอดระยะดำเนินงาน 10 เดือน (มีนาคม\u2013ธันวาคม 2569) คาดว่าระบบจะช่วยลดการใช้กระดาษได้หลายร้อยแผ่นต่อหน่วยปฏิบัติการ โดยจำนวนจริงจะสรุปเมื่อสิ้นสุดระยะดำเนินงาน และเมื่อขยายผลต่อเนื่องเป็นรายปี คาดว่าจะช่วยลดการใช้กระดาษได้หลายพันแผ่นต่อปีสำหรับแต่ละหน่วย"),

  h2("4.3 ประสิทธิภาพของ Real-time Dashboard"),
  p("Monitor Dashboard เป็นจุดเปลี่ยนสำคัญในการทำงานของผู้บริหารและแพทย์ที่ปรึกษา เดิมเมื่อทีมกู้ชีพออกไปรับผู้ป่วย ผู้บริหารและแพทย์ที่ปรึกษาไม่มีทางทราบรายละเอียดของเคสจนกว่าทีมจะกลับมาส่งกระดาษ หรือต้องโทรสอบถาม ซึ่งได้ข้อมูลไม่ครบถ้วน หลังจากใช้ Monitor Dashboard แพทย์ที่ปรึกษาสามารถเปิดดูข้อมูลเคสได้ทันทีที่ทีมกู้ชีพบันทึก รวมถึงดูข้อมูลผู้ป่วย สัญญาณชีพ การรักษาเบื้องต้น และตำแหน่ง GPS ของทีม"),
  p("สำหรับงาน First Aid ในเหตุการณ์ขนาดใหญ่ Dashboard แสดงจำนวนผู้ป่วย ยาที่ใช้ และประเภทบาดเจ็บจากทุกจุดรวมในหน้าเดียว ลดเวลาการจัดทำสถิติจากหลายชั่วโมง (รวบรวมกระดาษจากทุกจุด \u2192 กรอกข้อมูลลงคอมพิวเตอร์ \u2192 ทำสรุป) เป็นทันทีที่ข้อมูลถูกบันทึก ผู้บัญชาการเหตุการณ์สามารถตัดสินใจจัดสรรทรัพยากรได้ทันทีโดยไม่ต้องรอ"),

  h2("4.4 ต้นทุนการดำเนินการ"),
  p("จุดเด่นสำคัญที่สุดของ PT-Medical System คือต้นทุนการดำเนินการเป็นศูนย์อย่างแท้จริง ไม่มีค่าใช้จ่ายใด ๆ ที่เป็นภาระต่อหน่วยปฏิบัติการ ดังแสดงในตารางที่ 3"),
  new Paragraph({ spacing: { before: 200, after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ตารางที่ 3 ต้นทุนการดำเนินการ PT-Medical System", bold: true, size: sz, font })] }),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [4513, 4513],
    rows: [
      new TableRow({ children: [
        makeCell("รายการ", { header: true, width: 4513 }),
        makeCell("ต้นทุน", { header: true, center: true, width: 4513 }),
      ]}),
      new TableRow({ children: [ makeCell("Hosting (GitHub Pages)", { width: 4513 }), makeCell("ฟรี (ไม่จำกัดแบนด์วิดท์)", { center: true, width: 4513 }) ]}),
      new TableRow({ children: [ makeCell("Database (Supabase Free Tier)", { width: 4513 }), makeCell("ฟรี (500 MB storage)", { center: true, width: 4513 }) ]}),
      new TableRow({ children: [ makeCell("Domain (github.io)", { width: 4513 }), makeCell("ฟรี (พร้อม HTTPS)", { center: true, width: 4513 }) ]}),
      new TableRow({ children: [ makeCell("SSL Certificate", { width: 4513 }), makeCell("ฟรี (GitHub Pages จัดให้)", { center: true, width: 4513 }) ]}),
      new TableRow({ children: [ makeCell("อุปกรณ์", { width: 4513 }), makeCell("ใช้มือถือที่มีอยู่แล้ว", { center: true, width: 4513 }) ]}),
      new TableRow({ children: [ makeCell("ค่า license/ค่าบำรุงรักษา", { width: 4513 }), makeCell("ไม่มี", { center: true, width: 4513 }) ]}),
      new TableRow({ children: [ makeCell("รวมต้นทุนต่อเดือน", { header: true, width: 4513 }), makeCell("0 บาท", { header: true, center: true, width: 4513 }) ]}),
    ]
  }),

  p("เมื่อเปรียบเทียบกับระบบ Telemedicine ที่มีต้นทุนหลักแสนถึงหลักล้านบาท PT-Medical System จึงเป็นทางเลือกที่เหมาะสมที่สุดสำหรับหน่วยปฏิบัติการที่มีงบประมาณจำกัด และด้วยต้นทุนที่เป็นศูนย์ ทำให้ไม่มีอุปสรรคด้านงบประมาณในการขยายผลไปยังหน่วยอื่น ๆ"),
];

// ============ Chapter 5 ============
const ch5 = [
  new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: "บทที่ 5 สรุปผลและข้อเสนอแนะ", bold: true, size: szH1, font })] }),

  h2("5.1 สรุปผล"),
  p("PT-Medical System เป็นนวัตกรรมที่ถูกพัฒนาขึ้นเพื่อแก้ปัญหาช่องว่างระหว่างระบบ Telemedicine ที่มีราคาสูงกับระบบกระดาษที่ขาดประสิทธิภาพ โดยเฉพาะสำหรับทีมกู้ชีพและหน่วยปฏิบัติการแพทย์ที่มีงบประมาณจำกัด ด้วยต้นทุนการดำเนินการ 0 บาทต่อเดือน ระบบสามารถใช้งานได้ทันทีบนมือถือที่ทีมกู้ชีพมีอยู่แล้ว ผ่าน Web Browser โดยไม่ต้องติดตั้งแอปพลิเคชันเพิ่มเติม"),
  p("ระบบมีคุณสมบัติสำคัญดังนี้:"),
  p("\u2022 บันทึกข้อมูลเคส Transport ได้ครบถ้วน ครอบคลุมข้อมูลผู้ป่วย สัญญาณชีพ การรักษา เส้นทาง พร้อมพิมพ์ใบส่งตัวจากมือถือ", { noIndent: true }),
  p("\u2022 Digital Consent ที่มี audit trail ครบถ้วน ถูกต้องตามกฎหมาย รองรับ 4 ภาษา (ไทย/อังกฤษ/จีน/เมียนมาร์) และ PDPA ไม่มีการลบข้อมูลออกจากฐานข้อมูล", { noIndent: true }),
  p("\u2022 Location Tracking บันทึกพิกัด GPS จุดเกิดเหตุ จุดรับ และปลายทาง รองรับค้นหาสถานที่ ปักหมุด และแชร์ตำแหน่ง", { noIndent: true }),
  p("\u2022 Monitor Dashboard ให้ผู้บริหารและแพทย์ที่ปรึกษาเห็นข้อมูลเคสแบบ Real-time สามารถ consult ได้ทันทีโดยเห็นข้อมูลจริง ไม่ใช่แค่ฟังคำบอกเล่า", { noIndent: true }),
  p("\u2022 First Aid Dashboard รวมข้อมูลทุกจุดให้บริการในที่เดียว ลดเวลาจัดทำสถิติจากหลายชั่วโมงเป็นทันที", { noIndent: true }),
  p("\u2022 ลดการใช้กระดาษเฉลี่ย 2 แผ่นต่อเคส คาดว่าลดได้หลายร้อยแผ่นตลอดระยะดำเนินงาน 10 เดือน (ตัวเลขรวมจะสรุปเมื่อสิ้นสุดระยะดำเนินงาน ธันวาคม 2569)", { noIndent: true }),
  p("จากการดำเนินงานในหน่วยปฏิบัติการแพทย์ภาคเอกชน 2 แห่ง ได้แก่ บจก.ทรัพย์วิไล เมดิคอล (ALS นครสวรรค์) และ The Good Ambulance (BLS กรุงเทพมหานคร) ตลอดระยะมีนาคม\u2013ธันวาคม 2569 (10 เดือน) ระบบสามารถรองรับภารกิจผสมทั้งการลำเลียง/ส่งต่อ การออกหน่วยปฐมพยาบาล และการตอบสนองเหตุฉุกเฉินได้จริงในสภาพการปฏิบัติงานของหน่วยเอกชน โดยตัวเลขสรุปจำนวนเคสลำเลียง/ส่งต่อ First Aid Events และผู้ป่วย First Aid จะรายงานเมื่อสิ้นสุดระยะดำเนินงาน"),

  h2("5.2 ข้อจำกัด"),
  p("จากการทดสอบใช้งาน พบข้อจำกัดของระบบดังต่อไปนี้:"),
  p("1) ระบบต้องการสัญญาณอินเทอร์เน็ตในการใช้งาน แม้จะมี offline capability บางส่วน เช่น การกรอกข้อมูลเบื้องต้น แต่การบันทึกข้อมูลลงฐานข้อมูลและการอัปเดต Dashboard ต้องใช้อินเทอร์เน็ต ในพื้นที่ที่สัญญาณไม่เสถียร เช่น พื้นที่ห่างไกล อุโมงค์ หรือชั้นใต้ดิน อาจไม่สามารถใช้งานได้เต็มประสิทธิภาพ", { noIndent: true }),
  p("2) ระยะดำเนินงาน 10 เดือน (มีนาคม\u2013ธันวาคม 2569) ยังไม่เพียงพอสำหรับการประเมินผลระยะยาวเกิน 1 ปี โดยเฉพาะในด้านความเสถียรของระบบตลอดฤดูกาล การรับมือกับข้อมูลสะสมจำนวนมาก และพฤติกรรมการใช้งานของผู้ใช้เมื่อคุ้นเคยกับระบบเต็มรูปแบบ", { noIndent: true }),
  p("3) จำนวนหน่วยปฏิบัติการที่ทดสอบมีเพียง 2 หน่วย (ALS นครสวรรค์ + BLS กรุงเทพฯ) ซึ่งเป็นหน่วยภาคเอกชนทั้งคู่ ควรขยายการทดสอบไปยังหน่วยปฏิบัติการที่หลากหลายมากขึ้น รวมถึงหน่วยของมูลนิธิและองค์กรปกครองส่วนท้องถิ่น เพื่อเพิ่มความน่าเชื่อถือของผลการศึกษาและรองรับบริบทพื้นที่ที่หลากหลาย", { noIndent: true }),
  p("4) การยอมรับและการใช้งาน Digital Consent ของทีมกู้ชีพอาจมีอัตราต่ำในช่วงแรก เนื่องจากทีมยังไม่คุ้นเคยกับระบบใหม่ จำเป็นต้องมีการอบรมและสร้างความเชื่อมั่นเพิ่มเติมว่า consent ดิจิทัลมีผลทางกฎหมายเทียบเท่ากระดาษ (อัตราการใช้งานจริงจะสรุปเมื่อสิ้นสุดระยะดำเนินงาน)", { noIndent: true }),

  h2("5.3 ข้อเสนอแนะ"),
  p("จากผลการดำเนินงานและข้อจำกัดที่พบ ผู้ศึกษามีข้อเสนอแนะดังนี้:"),
  p("1) ขยายการทดสอบไปยังหน่วยปฏิบัติการแพทย์อื่น ๆ ที่มีบริบทหลากหลาย เช่น หน่วยของมูลนิธิ หน่วยของ อปท. และหน่วยในต่างจังหวัด เพื่อเก็บข้อมูลที่ครอบคลุมและเพิ่มความน่าเชื่อถือ", { noIndent: true }),
  p("2) พัฒนา offline mode ให้สมบูรณ์ยิ่งขึ้น โดยใช้ Service Worker และ IndexedDB เก็บข้อมูลในเครื่องก่อน แล้ว sync ขึ้น server เมื่อมีสัญญาณอินเทอร์เน็ต เพื่อรองรับการใช้งานในพื้นที่ที่สัญญาณไม่เสถียร", { noIndent: true }),
  p("3) ระบบนี้ออกแบบเป็นเครื่องมือภายในของหน่วยเอกชนและปัจจุบันไม่ได้เชื่อมต่อกับระบบ ITEMS 4.0 ของ สพฉ. ข้อเสนอแนะคือควรพัฒนา API เพื่อส่งออกข้อมูลตามโครงสร้างมาตรฐาน เผื่อในอนาคตเมื่อ สพฉ. เปิดแนวทางให้หน่วยเอกชนส่งข้อมูลเข้าระบบกลางได้ จะสามารถส่งข้อมูลเคสได้โดยอัตโนมัติ ลดภาระการกรอกข้อมูลซ้ำ", { noIndent: true }),
  p("4) จัดอบรมทีมกู้ชีพเกี่ยวกับการใช้ Digital Consent ให้มากขึ้น เพื่อเพิ่มอัตราการใช้งานและสร้างความเชื่อมั่นว่า consent ดิจิทัลมีผลทางกฎหมายเทียบเท่ากระดาษ", { noIndent: true }),
  p("5) พัฒนาระบบ Milestone-based GPS Tracking โดยแยกเป็น section ต่างหากจาก codebase หลัก (เช่น gps.html, gps.js) เพื่อไม่กระทบโมดูลที่ใช้ร่วมกันระหว่างหน่วยปฏิบัติการ หน่วยใดต้องการใช้ก็เปิด section GPS ได้ หน่วยใดไม่ใช้ก็ไม่ได้รับผลกระทบ ระบบจะบันทึกพิกัด GPS อัตโนมัติที่จุดสำคัญของเคส (เปิดเคส, รับผู้ป่วย, ถึงโรงพยาบาล, ปิดเคส) โดยใช้ Foreground Geolocation API ของ browser ไม่ต้องติดตั้งแอปเพิ่ม ทำงานได้ทั้ง Android/iOS", { noIndent: true }),
  p("6) เนื่องจากต้นทุนเป็นศูนย์ ระบบสามารถขยายผลไปยังหน่วยปฏิบัติการทั่วประเทศได้โดยไม่มีอุปสรรคด้านงบประมาณ หากได้รับการสนับสนุนจาก สพฉ. ในการเผยแพร่และแนะนำระบบ จะสามารถช่วยยกระดับการจัดการข้อมูลของทีมกู้ชีพทั่วประเทศได้อย่างรวดเร็ว", { noIndent: true }),
];

// ============ References ============
const refs = [
  new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text: "เอกสารอ้างอิง", bold: true, size: szH1, font })] }),
  p("พระราชบัญญัติการแพทย์ฉุกเฉิน พ.ศ. 2551. ราชกิจจานุเบกษา เล่ม 125 ตอนที่ 44 ก.", { noIndent: true }),
  p("พระราชบัญญัติว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544 และที่แก้ไขเพิ่มเติม.", { noIndent: true }),
  p("พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA). ราชกิจจานุเบกษา เล่ม 136 ตอนที่ 69 ก.", { noIndent: true }),
  p("คณะกรรมการการแพทย์ฉุกเฉิน. (2564). ประกาศ กพฉ. เรื่อง หลักเกณฑ์และเงื่อนไขเกี่ยวกับการปฏิบัติหน้าที่ และการกำกับดูแลหน่วยปฏิบัติการแพทย์. ราชกิจจานุเบกษา เล่ม 138 ตอนพิเศษ 291 ง, 26 พฤศจิกายน 2564.", { noIndent: true }),
  p("สถาบันการแพทย์ฉุกเฉินแห่งชาติ. (2567). คู่มือแนวทางปฏิบัติตามประกาศคณะกรรมการการแพทย์ฉุกเฉิน เรื่อง หลักเกณฑ์และเงื่อนไขเกี่ยวกับการปฏิบัติหน้าที่และการกำกับดูแลหน่วยปฏิบัติการแพทย์ พ.ศ. 2564 (ฉบับปรับปรุง ครั้งที่ 1 พ.ศ. 2567). พิมพ์ครั้งที่ 2 พฤศจิกายน 2567.", { noIndent: true }),
  p("คณะกรรมการการแพทย์ฉุกเฉิน. (2567). ประกาศ กพฉ. เรื่อง หลักเกณฑ์และเงื่อนไขเกี่ยวกับการปฏิบัติหน้าที่ และการกำกับดูแลการปฏิบัติงานของผู้ปฏิบัติการ พ.ศ. 2567. ราชกิจจานุเบกษา เล่ม 141 ตอนพิเศษ 337 ง, 9 ธันวาคม 2567.", { noIndent: true }),
  p("คณะกรรมการการแพทย์ฉุกเฉิน. (2566). ประกาศ กพฉ. เรื่อง ประเภท ระดับ อำนาจหน้าที่ ขอบเขต ความรับผิดชอบ หรือข้อจำกัดของผู้ปฏิบัติการในการปฏิบัติการฉุกเฉินตามคำสั่งการแพทย์หรือการอำนวยการ พ.ศ. 2566. ราชกิจจานุเบกษา เล่ม 140 ตอนพิเศษ 165 ง, 10 กรกฎาคม 2566.", { noIndent: true }),
  p("คณะกรรมการการแพทย์ฉุกเฉิน. (2565). ประกาศ กพฉ. เรื่อง หลักเกณฑ์และเงื่อนไขเกี่ยวกับการปฏิบัติหน้าที่และการกำกับดูแลหน่วยปฏิบัติการอำนวยการ พ.ศ. 2565.", { noIndent: true }),
  p("คณะกรรมการการแพทย์ฉุกเฉิน. (2565). ประกาศ กพฉ. เรื่อง เกณฑ์มาตรฐานคุณวุฒิฉุกเฉินการแพทย์ (มคฉ.1) พ.ศ. 2565.", { noIndent: true }),
  p("คณะกรรมการการแพทย์ฉุกเฉิน. (2563). ข้อบังคับ กพฉ. ว่าด้วยการกำหนดผู้ปฏิบัติการ การรับรององค์กรและหลักสูตรการศึกษาหรือฝึกอบรมผู้ปฏิบัติการ และการให้ประกาศนียบัตรหรือเครื่องหมายวิทยฐานะ พ.ศ. 2563 และที่แก้ไขเพิ่มเติม.", { noIndent: true }),
  p("สถาบันการแพทย์ฉุกเฉินแห่งชาติ. (2566). แผนหลักการแพทย์ฉุกเฉินแห่งชาติ ฉบับที่ 4 (พ.ศ. 2566\u20132570).", { noIndent: true }),
  p("สถาบันการแพทย์ฉุกเฉินแห่งชาติ. (2569). แผนวิจัยและนวัตกรรมระบบการแพทย์ฉุกเฉิน ประจำปีงบประมาณ 2569.", { noIndent: true }),
  p("Merchant, R. M., et al. (2020). Part 1: Executive Summary: 2020 American Heart Association Guidelines for CPR and Emergency Cardiovascular Care. Circulation, 142(Suppl 2), S337\u2013S357.", { noIndent: true }),
  p("Perman, S. M., et al. (2025). Part 1: Executive Summary: 2025 American Heart Association Guidelines for CPR and Emergency Cardiovascular Care. Circulation.", { noIndent: true }),
  p("National Association of Emergency Medical Technicians. (2023). PHTLS: Prehospital Trauma Life Support (10th ed.). Jones & Bartlett Learning.", { noIndent: true }),
  p("National Association of Emergency Medical Technicians. (2024). AMLS: Advanced Medical Life Support (4th ed.). Jones & Bartlett Learning.", { noIndent: true }),
  p("World Health Organization. (2019). WHO guideline: recommendations on digital interventions for health system strengthening. Geneva: WHO.", { noIndent: true }),
  p("Supabase Documentation. Available at: https://supabase.com/docs", { noIndent: true }),
  p("MDN Web Docs. Progressive Web Apps (PWAs). Available at: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps", { noIndent: true }),
];

// ============ BUILD DOCUMENT ============
const doc = new Document({
  language: { value: "th-TH" },
  styles: {
    default: { document: { run: { font, size: sz } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: szH1, bold: true, font },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
      },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: szH2, bold: true, font },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 }
      },
    ]
  },
  sections: [
    // Cover page (no page number)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: coverChildren,
    },
    // TOC + Content
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], font, size: 28 })]
          })]
        })
      },
      children: [
        ...tocChildren,
        new Paragraph({ children: [new PageBreak()] }),
        ...ch1,
        ...ch2,
        ...ch3,
        ...ch4,
        ...ch5,
        ...refs,
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("F:/@Coding/pt-medical-system/docs/innovation-full.docx", buffer);
  console.log("innovation-full.docx created successfully (" + Math.round(buffer.length/1024) + " KB)");
});
