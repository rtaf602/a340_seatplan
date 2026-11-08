/**
 * Galley และห้องน้ำในแท็บ "ผังที่นั่ง" วางแบบเดียวกับหน้าเว็บ
 *
 * วิธีใช้: ใน Apps Script กด + > Script เพิ่มไฟล์ชื่อ Setup วางโค้ดนี้ > บันทึก
 *   - ผังยังไม่มี Galley  : เลือกฟังก์ชัน setupGalleyMap  > Run
 *   - ผังมี Galley แบบเก่า : เลือกฟังก์ชัน redrawGalleyMap > Run (ลบแถว Galley เดิมแล้ววาดใหม่)
 * ไม่ต้อง Deploy ทำเสร็จแล้วลบไฟล์ Setup นี้ทิ้งได้
 *
 * - ก่อนแก้จะสำรองแท็บ "ผังที่นั่ง" ไว้เป็นแท็บซ่อน "ผังที่นั่ง (สำรองก่อนเพิ่ม Galley)"
 * - แทรก/ลบเฉพาะแถว Galley ระหว่างโซน ไม่แตะช่องที่นั่ง/Monitor (สูตรในแท็บอื่นเลื่อนตามให้เอง)
 * - ช่องสภาพ/หมายเหตุเป็นสูตรดึงจากแท็บ "Galley และห้องน้ำ" แก้ได้ที่แท็บนั้นหรือหน้าเว็บ
 * - รูปแบบตามหน้าเว็บ: Galley ข้างทางเดิน (G1L G1R G2L G2R G2AL G2AR G6 G7) มีชื่อแนวตั้งด้านข้าง
 *   อุปกรณ์เรียงลงเป็นแถวเดียว, G1A และ G2A ชื่ออยู่ด้านล่าง, G1 G2 G5 ชื่ออยู่ด้านบน
 */
const GM_MAP = 'ผังที่นั่ง';
const GM_EQ = 'Galley และห้องน้ำ';
const GM_BACKUP = 'ผังที่นั่ง (สำรองก่อนเพิ่ม Galley)';
const GM_PROT = 'Galley/ห้องน้ำ: แก้ที่แท็บ "Galley และห้องน้ำ" หรือหน้าเว็บ';
const GM_C = { GAL: '#1ebdd2', LAV: '#dde7fb', EMPTY: '#e7ecf1', DOOR: '#e1e6eb', WHITE: '#ffffff', INK: '#10202b',
  MUTED: '#5b6b78', LINE: '#8fa3b5', CABIN: '#c9ecfa', YEL: '#ffff00', RED: '#ff0000' };
const GM_EQ_TXT = ['ใช้งานได้บางส่วน', 'ใช้งานไม่ได้'];
const GM_BTN = { OVEN: 'Oven', CM: 'Coffee Maker', BOILER: 'Boiler', ESP: 'Espresso', HOTCUP: 'Hot Cup', CHILLER: 'Chiller', MW: 'Micro Wave', STORE: 'Storage' };
/* ตารางของแต่ละ Galley ตรงกับหน้าเว็บ ('' = ช่องว่าง, TYPE-n*k = กว้าง k ช่อง) */
const GM_SUBS = {
  G1L: [['STORE-1']], G1R: [['STORE-1']], G1: [['STORE-1', 'CHILLER-1']],
  G1A: [['BOILER-1', 'CM-1', 'CM-2'], ['ESP-1', 'OVEN-1', 'OVEN-2']],
  G2L: [['CHILLER-1'], ['STORE-1']], G2: [['CHILLER-1*3'], ['OVEN-1', 'OVEN-2', 'STORE-1']], G2R: [['CHILLER-1'], ['STORE-1']],
  G2AL: [['STORE-1']], G2AR: [['STORE-1']],
  G2A: [['CHILLER-1*3', 'BOILER-1*3'], ['ESP-1*2', 'CM-1*2', 'CM-2*2'], ['OVEN-1*2', 'OVEN-2*2', 'MW-1*2'], ['HOTCUP-1*2', 'HOTCUP-2*2', 'HOTCUP-3*2']],
  G5: [['STORE-1']], G6: [['CHILLER-1'], ['STORE-1']],
  G7: [['BOILER-1'], ['CM-1'], ['CM-2'], ['CM-3'], ['OVEN-1'], ['OVEN-2'], ['OVEN-3'], ['OVEN-4'], ['OVEN-5'], ['OVEN-6'], ['HOTCUP-1'], ['HOTCUP-2'], ['HOTCUP-3']]
};
/* ชื่อด้านข้าง (side: L = ชื่ออยู่ซ้าย, R = ชื่ออยู่ขวา) / ชื่อด้านล่าง (foot) */
const GM_SIDE = { G1L: 'L', G2L: 'L', G2AL: 'L', G6: 'L', G1R: 'R', G2R: 'R', G2AR: 'R', G7: 'R' };
const GM_FOOT = { G1A: true, G2A: true };

/* แถบ Galley แต่ละช่วง: [ชื่อ, รายการบล็อก] แถบที่ไม่มี keep ถูกแทรกเป็นแถวใหม่ */
const GM_BANDS = {
  ECO1: [{ c: 3, span: 4, stack: [{ lav: 'L73' }] }, { c: 8, span: 8, stack: [{ g: 'G5' }] }, { c: 17, span: 4, stack: [{ lav: 'L74' }] }],
  ECO2: [{ c: 3, span: 4, stack: [{ g: 'G6' }] }, { c: 17, span: 4, stack: [{ g: 'G7' }] }],
  PE: [{ c: 3, span: 4, stack: [{ lav: 'L53' }] }, { c: 8, span: 4, stack: [{ lav: 'L61' }] }, { c: 12, span: 4, stack: [{ lav: 'L62' }] }, { c: 17, span: 4, stack: [{ lav: 'L54' }] }],
  BUS1: [{ c: 3, span: 4, stack: [{ g: 'G2L' }] }, { c: 9, span: 6, stack: [{ g: 'G2' }] }, { c: 17, span: 4, stack: [{ g: 'G2R' }] }],
  BUS2: [{ c: 3, span: 4, stack: [{ g: 'G2AL' }, { lav: 'L35' }] }, { c: 9, span: 6, stack: [{ g: 'G2A' }] }, { c: 17, span: 4, stack: [{ g: 'G2AR' }, { lav: 'L36' }] }],
  MC2: [{ c: 9, span: 6, stack: [{ g: 'G1A' }] }, { c: 19, span: 2, stack: [{ lav: 'L16' }] }],
  MC1: [{ c: 3, span: 2, stack: [{ g: 'G1L' }] }, { c: 8, span: 8, stack: [{ g: 'G1' }] }, { c: 19, span: 2, stack: [{ g: 'G1R' }] }]
};

/* ความสูง (แถว) ที่บล็อกต้องการเอง: อุปกรณ์ 1 ชิ้น = ชื่อ/สภาพ/หมายเหตุ 3 แถว */
function gmNeed_(x) {
  if (x.lav) return 3;
  const rows = GM_SUBS[x.g];
  return GM_SIDE[x.g] ? rows.length * 3 : 1 + rows.length * 3;
}
function gmBandH_(entries) {
  return Math.max.apply(null, entries.map(function (e) {
    return e.stack.reduce(function (a, x, i) { return a + (i ? 1 : 0) + gmNeed_(x); }, 0);
  }));
}

function setupGalleyMap() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(GM_MAP);
  if (!ss.getSheetByName(GM_EQ)) throw new Error('ยังไม่มีแท็บ "' + GM_EQ + '" ให้เปิดหน้าเว็บหนึ่งครั้งก่อน (Apps Script จะสร้างให้)');
  if (gmFind_(sh, 'GALLEY G2A')) throw new Error('ผังที่นั่งมี Galley อยู่แล้ว ถ้าจะวาดใหม่ให้ Run redrawGalleyMap');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);   // กัน SAVE จากหน้าเว็บระหว่างแทรกแถว
  try {
    gmBackup_(ss, sh);
    gmDraw_(sh);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/** ลบ Galley/ห้องน้ำที่วาดไว้ในผังแล้ววาดใหม่ตามรูปแบบปัจจุบัน */
function redrawGalleyMap() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(GM_MAP);
  if (!gmFind_(sh, 'GALLEY G2A')) throw new Error('ผังที่นั่งยังไม่มี Galley ให้ Run setupGalleyMap');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    gmBackup_(ss, sh);
    gmRemove_(sh);
    gmDraw_(sh);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function gmFind_(sh, text) {
  const f = sh.createTextFinder(text).matchEntireCell(true).findNext();
  return f ? f.getRow() : 0;
}
function gmBackup_(ss, sh) {
  const old = ss.getSheetByName(GM_BACKUP);
  if (old) ss.deleteSheet(old);
  const bk = sh.copyTo(ss); bk.setName(GM_BACKUP); bk.hideSheet();
}

/** ลบแถว Galley ที่แทรกไว้ (หาจากข้อความเริ่มแถบ) และล้างบล็อกข้างห้อง CC */
function gmRemove_(sh) {
  const colB = function () { return sh.getRange(1, 2, sh.getLastRow(), 1).getDisplayValues().map(function (r) { return String(r[0]).trim(); }); };
  const zoneRow = function (b, title) { const i = b.indexOf(title); if (i < 0) throw new Error('ไม่พบแถว "' + title + '"'); return i + 1; };
  // แถบที่แทรกเองอยู่ระหว่างเครื่องหมายเริ่มกับแถวถัดไปของผังเดิม: ลบจากล่างขึ้นบน
  let b = colB();
  // ECONOMY: จาก LAV L73 ถึงก่อนแถวว่างท้ายผังเดิม = ทุกแถวหลัง NOTE แถว 57 + 1 แถวเว้น
  const r57 = zoneRow(b, '57'), ecoStart = r57 + 4, ecoEnd = gmLastGalleyRow_(sh, ecoStart);
  if (ecoEnd >= ecoStart) sh.deleteRows(ecoStart, ecoEnd - ecoStart + 2);
  // PREMIUM ECONOMY: จาก LAV L53 ถึงก่อนแถว Monitor ของแถว 36
  b = colB();
  const r36 = zoneRow(b, '36'), peStart = gmFind_(sh, 'LAV L53 (ห้องน้ำ)');
  if (peStart && peStart < r36 - 3) sh.deleteRows(peStart, (r36 - 3) - peStart);
  // BUSINESS: จาก GALLEY G2L ถึงก่อนแถว Monitor ของแถว 11
  b = colB();
  const r11 = zoneRow(b, '11'), busStart = gmFind_(sh, 'GALLEY G2L');
  if (busStart && busStart < r11 - 1) sh.deleteRows(busStart, (r11 - 1) - busStart);
  // MISSION COMMANDER: บล็อก G1A / LAV L16 ข้างห้อง CC (แถวเดิม) + แถวที่เพิ่มก่อนเส้นแบ่งโซน + DOOR 1 / G1L G1 G1R
  b = colB();
  const rFirst = zoneRow(b, 'First Class (8 Seats)'), rCC = gmFind_(sh, 'CC');
  const keepTop = rCC - 1, keepEnd = rFirst - 2;
  const clr = sh.getRange(keepTop, 8, keepEnd - keepTop + 1, 13);
  clr.breakApart(); clr.clearContent(); clr.clearFormat(); clr.clearDataValidations(); clr.setBackground(GM_C.CABIN);
  sh.deleteRows(rFirst - 2, 1);
  const mcStart = gmFind_(sh, '◀ DOOR 1L'), rCC2 = gmFind_(sh, 'CC');
  if (mcStart && mcStart < rCC2 - 2) sh.deleteRows(mcStart, (rCC2 - 2) - mcStart);
  // ป้องกันและกฎสีที่สคริปต์นี้เคยใส่
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { if (p.getDescription() === GM_PROT) p.remove(); });
  sh.setConditionalFormatRules(sh.getConditionalFormatRules().filter(function (r) {
    const bc = r.getBooleanCondition(); if (!bc) return true;
    const v = bc.getCriteriaValues(); return !(v && v.length && GM_EQ_TXT.indexOf(String(v[0])) >= 0);
  }));
}
/* แถวสุดท้ายที่มีข้อความในคอลัมน์ C-T นับจาก from (ส่วนท้ายผังมีแต่ Galley) */
function gmLastGalleyRow_(sh, from) {
  const last = sh.getLastRow();
  if (last < from) return from - 1;
  const rg = sh.getRange(from, 3, last - from + 1, 18), v = rg.getDisplayValues(), f = rg.getFormulas();
  for (let i = v.length - 1; i >= 0; i--) if (v[i].some(function (x, j) { return String(x).trim() !== '' || f[i][j] !== ''; })) return from + i;
  return from - 1;
}

function gmDraw_(sh) {
  const colB = sh.getRange(1, 2, sh.getLastRow(), 1).getDisplayValues().map(function (r) { return String(r[0]).trim(); });
  const rowOf = function (t) { const i = colB.indexOf(t); if (i < 0) throw new Error('ไม่พบแถว "' + t + '" ในคอลัมน์ B'); return i + 1; };
  const rMC = rowOf('Mission Commander (1 Seat)'), rFirst = rowOf('First Class (8 Seats)');
  const r11 = rowOf('11'), r36 = rowOf('36'), r57 = rowOf('57');
  const rCC = gmFind_(sh, 'CC');
  const B = GM_BANDS, H = {}; Object.keys(B).forEach(function (k) { H[k] = gmBandH_(B[k]); });
  const d = gmDrawer_(sh);
  // ทำจากล่างขึ้นบน ตำแหน่งแถวข้างบนจึงไม่เลื่อน
  // ECONOMY: หลังแถว 57 (เว้น 1 แถว) : LAV L73 · G5 · LAV L74 / DOOR 4 / G6 · G7
  let at = d.insert(r57 + 4, H.ECO1 + 1 + 2 + H.ECO2 + 1);
  at = d.band(at, B.ECO1, H.ECO1); at = d.door(at, '4'); d.band(at, B.ECO2, H.ECO2);
  // PREMIUM ECONOMY: ก่อน Monitor หน้าแถว 36 : LAV L53 · L61 · L62 · L54 / DOOR 3
  at = d.insert(r36 - 3, H.PE + 1 + 2);
  at = d.band(at, B.PE, H.PE); d.door(at, '3');
  // BUSINESS: ก่อนแถว 11 : G2L · G2 · G2R / DOOR 2 / G2AL+LAV L35 · G2A · G2AR+LAV L36
  at = d.insert(r11 - 1, H.BUS1 + 1 + 2 + H.BUS2 + 1);
  at = d.band(at, B.BUS1, H.BUS1); at = d.door(at, '2'); d.band(at, B.BUS2, H.BUS2);
  // MISSION COMMANDER: G1A และ LAV L16 ข้างห้อง CC (ห้อง CC แคบ B-G, ป้ายสองบรรทัดใน E-F)
  d.insert(rFirst - 1, 1);
  const label = gmFind_(sh, 'Commander Center');
  if (label) {
    sh.getRange(label, 5, 1, 5).breakApart();
    sh.getRange(label, 5, 1, 2).merge().setWrap(true).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    const fr = rCC - 2;   // แถวขอบบนของกรอบห้อง
    sh.getRange(fr, 8, 1, 3).setBorder(false, null, null, false, null, null);
    sh.getRange(fr + 5, 8, 1, 3).setBorder(null, null, false, null, null, null);
    sh.getRange(fr, 7, 6, 1).setBorder(null, null, null, true, null, null, '#556475', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }
  d.band(rCC - 1, B.MC2, H.MC2, true);
  // MISSION COMMANDER: ก่อนห้อง CC : DOOR 1 / G1L · G1 · G1R
  at = d.insert(rMC + 1, 2 + H.MC1 + 1);
  at = d.door(at, '1'); d.band(at, B.MC1, H.MC1);

  // สีช่องสภาพ Galley/ห้องน้ำ (ใช้งานได้บางส่วน = เหลือง, ใช้งานไม่ได้ = แดง)
  const area = sh.getRange(1, 3, sh.getMaxRows(), 18);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(GM_EQ_TXT[0]).setBackground(GM_C.YEL).setRanges([area]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(GM_EQ_TXT[1]).setBackground(GM_C.RED).setFontColor('#ffffff').setRanges([area]).build()
  ].concat(sh.getConditionalFormatRules()));

  // คำอธิบายในแถววิธีใช้ (ใส่ครั้งเดียว)
  const how = gmFind_(sh, 'วิธีใช้');
  if (how) {
    const cell = sh.getRange(how, 4), txt = String(cell.getValue()), add = ' · Galley และห้องน้ำในผังนี้ดึงค่าจากแท็บ "' + GM_EQ + '" แก้สภาพได้ที่แท็บนั้นหรือหน้าเว็บ';
    if (txt.indexOf(add.trim()) < 0) cell.setValue(txt + add);
  }
}

function gmDrawer_(sh) {
  const look = function (id, k) { return '=IFERROR(VLOOKUP("' + id + '",\'' + GM_EQ + '\'!$A$2:$E,' + k + ',FALSE)' + (k === 5 ? '&""' : '') + ',"' + (k === 5 ? '' : '-') + '")'; };
  let rowH = {};
  const setH = function (r, h) { rowH[r] = Math.max(rowH[r] || 0, h); };
  /* keep = วาดข้างห้อง CC ในแถวเดิม: ไม่ลดความสูงแถวที่นั่ง */
  const flushH = function (keep) { Object.keys(rowH).forEach(function (r) { sh.setRowHeight(+r, keep ? Math.max(rowH[r], sh.getRowHeight(+r)) : rowH[r]); }); rowH = {}; };
  const put = function (r, c, v, o) {
    o = o || {};
    const rg = sh.getRange(r, c, o.rows || 1, o.span || 2);
    if ((o.span || 2) > 1 || (o.rows || 1) > 1) rg.merge();
    if (o.formula) rg.setFormula(v); else if (v !== null && v !== undefined) rg.setValue(v);
    rg.setBackground(o.bg || GM_C.WHITE).setFontSize(o.size || 8).setFontWeight(o.bold ? 'bold' : 'normal')
      .setFontColor(o.color || GM_C.INK).setHorizontalAlignment(o.h || 'center').setVerticalAlignment(o.v || 'middle').setWrap(!!o.wrap);
    if (o.rot) rg.setTextRotation(o.rot);
    if (o.border !== false) rg.setBorder(true, true, true, true, null, null, GM_C.LINE, SpreadsheetApp.BorderStyle.SOLID);
    return rg;
  };
  /* อุปกรณ์ 1 ชิ้น สูง h แถว: ชื่อ / สภาพ / หมายเหตุ (หมายเหตุกินแถวที่เหลือ) */
  const unit = function (r0, c0, span, h, id, name, fill) {
    put(r0, c0, name, { span: span, bold: true, bg: fill || GM_C.GAL, wrap: true });
    put(r0 + 1, c0, look(id, 4), { span: span, formula: true, size: 7 });
    put(r0 + 2, c0, look(id, 5), { span: span, rows: h - 2, formula: true, size: 7, wrap: true, h: 'left', v: 'top' });
    setH(r0, 20); setH(r0 + 1, 18); if (h === 3) setH(r0 + 2, 26);
  };
  const names = function (sk) {
    const cnt = {};
    GM_SUBS[sk].forEach(function (rw) { rw.forEach(function (x) { if (x) { const t = x.split('-')[0]; cnt[t] = (cnt[t] || 0) + 1; } }); });
    return function (base) { const t = base.split('-')[0], n = base.split('-')[1]; return GM_BTN[t] + (cnt[t] > 1 ? ' ' + n : ''); };
  };
  /* Galley กลาง: ตาราง + ชื่อด้านบน (หรือด้านล่างถ้า foot) */
  const centre = function (r0, c0, span, sk) {
    const rows = GM_SUBS[sk], nm = names(sk);
    const w = function (code) { const m = /\*(\d+)$/.exec(code); return m ? +m[1] : 1; };
    const k = Math.max.apply(null, rows.map(function (rw) { return rw.reduce(function (a, x) { return a + w(x); }, 0); }));
    const u = Math.max(1, Math.floor(span / k));
    const foot = !!GM_FOOT[sk];
    let r = foot ? r0 : r0 + 1;
    rows.forEach(function (rw) {
      let c = c0;
      rw.forEach(function (x) {
        const ww = w(x) * u;
        if (!x) { put(r, c, null, { span: ww, rows: 3, bg: GM_C.EMPTY }); c += ww; return; }
        const base = x.replace(/\*\d+$/, '');
        unit(r, c, ww, 3, sk + '-' + base, nm(base));
        c += ww;
      });
      r += 3;
    });
    const lr = foot ? r : r0;
    put(lr, c0, 'GALLEY ' + sk, { span: span, bold: true, bg: GM_C.GAL }); setH(lr, 20);
  };
  /* Galley ข้างทางเดิน: ชื่อแนวตั้ง 1 คอลัมน์ + อุปกรณ์เรียงลง แบ่งความสูง h เท่า ๆ กัน */
  const side = function (r0, c0, span, h, sk) {
    const items = GM_SUBS[sk].map(function (rw) { return rw[0].replace(/\*\d+$/, ''); }), nm = names(sk);
    const left = GM_SIDE[sk] === 'L';
    const lc = left ? c0 : c0 + span - 1, uc = left ? c0 + 1 : c0, us = span - 1;
    put(r0, lc, 'GALLEY ' + sk, { span: 1, rows: h, bold: true, bg: GM_C.GAL, rot: left ? 90 : -90 });
    const each = Math.floor(h / items.length);
    let r = r0;
    items.forEach(function (base, i) {
      const hh = i === items.length - 1 ? h - each * (items.length - 1) : each;
      unit(r, uc, us, hh, sk + '-' + base, nm(base));
      r += hh;
    });
  };
  const lav = function (r0, c0, span, h, n) { unit(r0, c0, span, h, 'LAV-' + n, 'LAV ' + n + (span >= 4 ? ' (ห้องน้ำ)' : ''), GM_C.LAV); };
  return {
    /** แทรก n แถวก่อนแถว at ให้เป็นพื้นห้องโดยสาร คืนแถวแรกที่ว่าง */
    insert: function (at, n) {
      sh.insertRowsBefore(at, n);
      const rg = sh.getRange(at, 1, n, 20);
      rg.breakApart(); rg.clearFormat(); rg.clearDataValidations();
      sh.getRange(at, 2, n, 19).setBackground(GM_C.CABIN);
      sh.setRowHeights(at, n, 6);
      return at;
    },
    /** แถบบล็อกสูง h แถว: Galley ข้างทางเดินยืดเต็มความสูง; LAV ที่ซ้อนใต้ Galley อยู่ล่างสุด คืนแถวถัดไปหลังเว้น 1 แถว */
    band: function (r0, entries, h, keep) {
      entries.forEach(function (e) {
        let r = r0;
        const fixed = e.stack.reduce(function (a, x, i) { return a + (i ? 1 : 0) + (x.lav || !GM_SIDE[x.g] ? gmNeed_(x) : 0); }, 0);
        e.stack.forEach(function (x, i) {
          if (i) { setH(r, 6); r++; }
          let need = gmNeed_(x);
          if (x.g && GM_SIDE[x.g]) need = h - fixed;   // ยืดให้เต็มแถบ
          else if (x.lav && e.stack.length === 1) need = h;   // LAV เดี่ยวสูงเท่าแถบ
          if (x.g && GM_SIDE[x.g]) side(r, e.c, e.span, need, x.g);
          else if (x.g) centre(r, e.c, e.span, x.g);
          else lav(r, e.c, e.span, need, x.lav);
          r += need;
        });
      });
      const prot = function (rg) { rg.protect().setWarningOnly(true).setDescription(GM_PROT); };
      if (!keep) prot(sh.getRange(r0, 3, h, 18));
      else entries.forEach(function (e) { prot(sh.getRange(r0, e.c, h, e.span)); });
      flushH(keep);
      return r0 + h + 1;
    },
    door: function (r, n) {
      put(r, 3, '◀ DOOR ' + n + 'L', { span: 4, bold: true, color: GM_C.MUTED, bg: GM_C.DOOR, border: false });
      const mid = sh.getRange(r, 7, 1, 10);
      mid.setBackground(GM_C.DOOR).setBorder(true, null, true, null, null, null, GM_C.MUTED, SpreadsheetApp.BorderStyle.DASHED);
      put(r, 17, 'DOOR ' + n + 'R ▶', { span: 4, bold: true, color: GM_C.MUTED, bg: GM_C.DOOR, border: false });
      sh.setRowHeight(r, 20);
      return r + 2;
    }
  };
}
