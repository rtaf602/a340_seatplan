/**
 * ใช้ครั้งเดียว: วาด Galley และห้องน้ำลงในแท็บ "ผังที่นั่ง" ตามตำแหน่งในห้องโดยสาร (แบบเดียวกับหน้าเว็บ)
 *
 * วิธีใช้: ใน Apps Script กด + > Script เพิ่มไฟล์ชื่อ Setup วางโค้ดนี้ > บันทึก
 *         เลือกฟังก์ชัน setupGalleyMap ที่แถบด้านบน > Run (ไม่ต้อง Deploy)
 * ทำเสร็จแล้วลบไฟล์ Setup นี้ทิ้งได้
 *
 * - ก่อนแก้จะสำรองแท็บ "ผังที่นั่ง" ไว้เป็นแท็บซ่อนชื่อ "ผังที่นั่ง (สำรองก่อนเพิ่ม Galley)"
 * - แทรกแถวใหม่ระหว่างโซน ไม่แตะช่องที่นั่ง/Monitor เดิม (สูตรในแท็บอื่นเลื่อนตามให้เอง)
 * - ช่องสภาพ/หมายเหตุของ Galley และห้องน้ำในผังเป็นสูตรดึงจากแท็บ "Galley และห้องน้ำ"
 *   แก้สภาพได้ที่หน้าเว็บ หรือที่แท็บ "Galley และห้องน้ำ" (แก้ในผังจะขึ้นคำเตือน)
 * - รันซ้ำไม่ได้: ถ้าในผังมี Galley อยู่แล้วจะหยุดทันที
 */
const GM_MAP = 'ผังที่นั่ง';
const GM_EQ = 'Galley และห้องน้ำ';
const GM_BACKUP = 'ผังที่นั่ง (สำรองก่อนเพิ่ม Galley)';
const GM_C = { GAL: '#1ebdd2', LAV: '#dde7fb', EMPTY: '#e7ecf1', DOOR: '#e1e6eb', WHITE: '#ffffff', INK: '#10202b',
  MUTED: '#5b6b78', LINE: '#8fa3b5', CABIN: '#c9ecfa', YEL: '#ffff00', RED: '#ff0000' };
const GM_BTN = { OVEN: 'Oven', CM: 'Coffee Maker', BOILER: 'Boiler', ESP: 'Espresso', HOTCUP: 'Hot Cup', CHILLER: 'Chiller', MW: 'Micro Wave', STORE: 'Storage' };
/* ตารางของแต่ละ sub-galley เหมือนหน้าเว็บ ('' = ช่องว่าง, TYPE-n*k = กว้าง k ช่อง); G7 พับเป็น 2 คอลัมน์ให้พอดีความกว้าง */
const GM_SUBS = {
  G1L: [['STORE-1']], G1R: [['STORE-1']], G1: [['STORE-1', 'CHILLER-1']],
  G1A: [['BOILER-1', 'CM-1', 'CM-2'], ['ESP-1', 'OVEN-1', 'OVEN-2']],
  G2L: [['CHILLER-1'], ['STORE-1']], G2: [['CHILLER-1*3'], ['OVEN-1', 'OVEN-2', 'STORE-1']], G2R: [['CHILLER-1'], ['STORE-1']],
  G2AL: [['STORE-1']], G2AR: [['STORE-1']],
  G2A: [['CHILLER-1', '', 'BOILER-1'], ['ESP-1', 'CM-1', 'CM-2'], ['OVEN-1', 'OVEN-2', 'MW-1'], ['HOTCUP-1', 'HOTCUP-2', 'HOTCUP-3']],
  G5: [['STORE-1']], G6: [['CHILLER-1'], ['STORE-1']],
  G7: [['BOILER-1*2'], ['CM-1', 'CM-2'], ['CM-3', ''], ['OVEN-1', 'OVEN-2'], ['OVEN-3', 'OVEN-4'], ['OVEN-5', 'OVEN-6'], ['HOTCUP-1', 'HOTCUP-2'], ['HOTCUP-3', '']]
};

function setupGalleyMap() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(GM_MAP);
  if (!ss.getSheetByName(GM_EQ)) throw new Error('ยังไม่มีแท็บ "' + GM_EQ + '" ให้เปิดหน้าเว็บหนึ่งครั้งก่อน (Apps Script จะสร้างให้)');
  if (sh.createTextFinder('GALLEY G1A').matchEntireCell(true).findNext()) throw new Error('ผังที่นั่งมี Galley อยู่แล้ว ไม่ต้องรันซ้ำ');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);   // กัน SAVE จากหน้าเว็บระหว่างแทรกแถว
  try {
    const old = ss.getSheetByName(GM_BACKUP);
    if (old) ss.deleteSheet(old);
    const bk = sh.copyTo(ss); bk.setName(GM_BACKUP); bk.hideSheet();

    const colB = sh.getRange(1, 2, sh.getLastRow(), 1).getDisplayValues().map(function (r) { return String(r[0]).trim(); });
    const rowOf = function (t) { const i = colB.indexOf(t); if (i < 0) throw new Error('ไม่พบแถว "' + t + '" ในคอลัมน์ B'); return i + 1; };
    const rMC = rowOf('Mission Commander (1 Seat)'), rFirst = rowOf('First Class (8 Seats)');
    const r11 = rowOf('11'), r36 = rowOf('36'), r57 = rowOf('57');
    const rCC = sh.createTextFinder('CC').matchEntireCell(true).findNext().getRow();

    const d = gmDrawer_(sh);
    // ทำจากล่างขึ้นบน ตำแหน่งแถวข้างบนจึงไม่เลื่อน
    // ECONOMY: หลังแถว 57 (เว้น 1 แถว) : LAV L73 · G5 · LAV L74 / DOOR 4 / G6 · G7
    let at = d.insert(r57 + 4, 33);
    at = d.band(at, [{ c: 3, span: 4, stack: [{ lav: 'L73' }] }, { c: 8, span: 8, stack: [{ g: 'G5' }] }, { c: 17, span: 4, stack: [{ lav: 'L74' }] }]);
    at = d.door(at, '4');
    d.band(at, [{ c: 3, span: 4, stack: [{ g: 'G6' }] }, { c: 17, span: 4, stack: [{ g: 'G7' }] }]);
    // PREMIUM ECONOMY: ก่อน Monitor หน้าแถว 36 : LAV L53 · L61 · L62 · L54 / DOOR 3
    at = d.insert(r36 - 3, 6);
    at = d.band(at, [{ c: 3, span: 4, stack: [{ lav: 'L53' }] }, { c: 8, span: 4, stack: [{ lav: 'L61' }] }, { c: 12, span: 4, stack: [{ lav: 'L62' }] }, { c: 17, span: 4, stack: [{ lav: 'L54' }] }]);
    d.door(at, '3');
    // BUSINESS: ก่อนแถว 11 : G2L · G2 · G2R / DOOR 2 / G2AL+LAV L35 · G2A · G2AR+LAV L36
    at = d.insert(r11 - 1, 24);
    at = d.band(at, [{ c: 3, span: 4, stack: [{ g: 'G2L' }] }, { c: 9, span: 6, stack: [{ g: 'G2' }] }, { c: 17, span: 4, stack: [{ g: 'G2R' }] }]);
    at = d.door(at, '2');
    d.band(at, [{ c: 3, span: 4, stack: [{ g: 'G2AL' }, { lav: 'L35' }] }, { c: 9, span: 6, stack: [{ g: 'G2A' }] }, { c: 17, span: 4, stack: [{ g: 'G2AR' }, { lav: 'L36' }] }]);
    // MISSION COMMANDER: G1A และ LAV L16 ข้างห้อง CC (เพิ่ม 1 แถวก่อนเส้นแบ่งโซน)
    d.insert(rFirst - 1, 1);
    // ห้อง CC แคบลงเหลือ B-G (ป้าย Commander Center ขึ้น 2 บรรทัดใน E-F) ให้ G1A อยู่กึ่งกลางตรงกับ G1 (I-N)
    const label = sh.createTextFinder('Commander Center').matchEntireCell(true).findNext();
    if (label) {
      const lr = label.getRow();
      sh.getRange(lr, 5, 1, 5).breakApart();
      sh.getRange(lr, 5, 1, 2).merge().setWrap(true).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
      const fr = rCC - 2;   // แถวขอบบนของกรอบห้อง
      sh.getRange(fr, 8, 1, 3).setBorder(false, null, null, false, null, null);
      sh.getRange(fr + 5, 8, 1, 3).setBorder(null, null, false, null, null, null);
      sh.getRange(fr, 7, 6, 1).setBorder(null, null, null, true, null, null, '#556475', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
    d.band(rCC - 1, [{ c: 9, span: 6, stack: [{ g: 'G1A' }] }, { c: 19, span: 2, stack: [{ lav: 'L16' }] }], true);
    // MISSION COMMANDER: ก่อนห้อง CC : DOOR 1 / G1L · G1 · G1R
    at = d.insert(rMC + 1, 7);
    at = d.door(at, '1');
    d.band(at, [{ c: 3, span: 2, stack: [{ g: 'G1L' }] }, { c: 8, span: 8, stack: [{ g: 'G1' }] }, { c: 19, span: 2, stack: [{ g: 'G1R' }] }]);

    // สีช่องสภาพ Galley/ห้องน้ำ (ใช้งานได้บางส่วน = เหลือง, ใช้งานไม่ได้ = แดง)
    const area = sh.getRange(1, 3, sh.getMaxRows(), 18);
    const rules = sh.getConditionalFormatRules();
    sh.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ใช้งานได้บางส่วน').setBackground(GM_C.YEL).setRanges([area]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ใช้งานไม่ได้').setBackground(GM_C.RED).setFontColor('#ffffff').setRanges([area]).build()
    ].concat(rules));

    // คำอธิบายในแถววิธีใช้
    const how = sh.createTextFinder('วิธีใช้').matchEntireCell(true).findNext();
    if (how) {
      const cell = sh.getRange(how.getRow(), 4);
      cell.setValue(String(cell.getValue()) + ' · Galley และห้องน้ำในผังนี้ดึงค่าจากแท็บ "' + GM_EQ + '" แก้สภาพได้ที่แท็บนั้นหรือหน้าเว็บ');
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function gmDrawer_(sh) {
  const col = function (c) { return String.fromCharCode(64 + c); };
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
    if (o.border !== false) rg.setBorder(true, true, true, true, null, null, GM_C.LINE, SpreadsheetApp.BorderStyle.SOLID);
    return rg;
  };
  const unit = function (r0, c0, span, id, name, fill) {
    put(r0, c0, name, { span: span, bold: true, bg: fill || GM_C.GAL });
    put(r0 + 1, c0, look(id, 4), { span: span, formula: true, size: 7 });
    put(r0 + 2, c0, look(id, 5), { span: span, formula: true, size: 7, wrap: true, h: 'left', v: 'top' });
    setH(r0, 20); setH(r0 + 1, 18); setH(r0 + 2, 26);
  };
  const galley = function (r0, c0, span, sk) {
    const rows = GM_SUBS[sk];
    const w = function (code) { const m = /\*(\d+)$/.exec(code); return m ? +m[1] : 1; };
    const k = Math.max.apply(null, rows.map(function (rw) { return rw.reduce(function (a, x) { return a + w(x); }, 0); }));
    const u = Math.max(1, Math.floor(span / k));
    const cnt = {};
    rows.forEach(function (rw) { rw.forEach(function (x) { if (x) { const t = x.split('-')[0]; cnt[t] = (cnt[t] || 0) + 1; } }); });
    put(r0, c0, 'GALLEY ' + sk, { span: span, bold: true, bg: GM_C.GAL }); setH(r0, 20);
    let r = r0 + 1;
    rows.forEach(function (rw) {
      let c = c0;
      rw.forEach(function (x) {
        const ww = w(x) * u;
        if (!x) { put(r, c, null, { span: ww, rows: 3, bg: GM_C.EMPTY }); c += ww; return; }
        const base = x.replace(/\*\d+$/, ''), t = base.split('-')[0], n = base.split('-')[1];
        unit(r, c, ww, sk + '-' + base, GM_BTN[t] + (cnt[t] > 1 ? ' ' + n : ''));
        c += ww;
      });
      r += 3;
    });
    return r - r0;
  };
  const lav = function (r0, c0, span, n) { unit(r0, c0, span, 'LAV-' + n, 'LAV ' + n + (span >= 4 ? ' (ห้องน้ำ)' : ''), GM_C.LAV); return 3; };
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
    /** แถบบล็อก: entries = [{c, span, stack:[{g}|{lav}]}] คืนแถวถัดไปหลังเว้น 1 แถว; keep = วาดในแถวเดิม */
    band: function (r0, entries, keep) {
      let h = 0;
      entries.forEach(function (e) {
        let r = r0;
        e.stack.forEach(function (x, i) {
          if (i) { setH(r, 6); r++; }
          r += x.g ? galley(r, e.c, e.span, x.g) : lav(r, e.c, e.span, x.lav);
        });
        h = Math.max(h, r - r0);
      });
      if (!keep) sh.getRange(r0, 3, h, 18).protect().setWarningOnly(true).setDescription('Galley/ห้องน้ำ: แก้ที่แท็บ "' + GM_EQ + '" หรือหน้าเว็บ');
      else entries.forEach(function (e) { sh.getRange(r0, e.c, h, e.span).protect().setWarningOnly(true).setDescription('Galley/ห้องน้ำ: แก้ที่แท็บ "' + GM_EQ + '" หรือหน้าเว็บ'); });
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
