/* STATUS SEAT PLAN A340 — EXPORT TO EXCEL
 * buildSeatWorkbook(ExcelJS, data) returns an ExcelJS workbook with 5 sheets:
 *   ผังที่นั่ง | Galley และห้องน้ำ | รวมข้อขัดข้องคงค้าง | ทุกที่นั่ง และ Monitor | ประวัติการแก้ไข
 * data = {
 *   state:   { id: {s:0|1|2, m:0|1|2, note:'', by:'', at:ISO} }   id = 'CC', '12E', 'MON-31-L' ...
 *   lastSave:{ by, at:ISO } | null,
 *   inspector: '',
 *   history: [[atISO|text, email, inspector, label, field, oldValue, newValue], ...] | null,
 *   equip:   { items: [{id, kind:'eq'|'lav', label, group, type, zone}], galleys: [{name, types:[name]}], lavZones: [zone name],
 *              subs: {G1: {rows:[['STORE-1','CHILLER-1']]}, ...} (table layout per sub-galley), btn: {OVEN:'Oven', ...} (short names) }
 *            Galley equipment and lavatories (status in state[id].s, 3 levels as E below)
 * }
 * Layout matches the "ผังที่นั่ง" tab of the Google Sheet (two columns per seat).
 */
(function (root) {
  var S = ['ปกติ', 'ขัดข้อง-ใช้ได้', 'ใช้ไม่ได้'];
  var M = ['จอปกติ', 'จอเสื่อม', 'จอเสีย'];
  var E = ['ใช้งานได้', 'ใช้งานได้บางส่วน', 'ใช้งานไม่ได้'];
  var C = { GREEN: 'FF00FF00', MGREEN: 'FF8ED873', YEL: 'FFFFFF00', RED: 'FFFF0000', CABIN: 'FFCAEDFB', ROWNO: 'FF6D9EEB',
    ZONEH: 'FFC1E4F5', TAG: 'FF45B0E1', WHITE: 'FFFFFFFF', BLUE: 'FF00B0F0', GREY: 'FFF2F2F2', MUTED: 'FF566575',
    GAL: 'FF1EBDD2', LAV: 'FFDDE7FB', EMPTY: 'FFE7ECF1', DOOR: 'FFE1E6EB' };
  var ZN = { MC: 'MISSION COMMANDER', A: 'FIRST CLASS', B: 'BUSINESS CLASS', C: 'PREMIUM ECONOMY', D: 'ECONOMY' };
  var SIDE = { L: 'ซ้าย', C: 'กลาง', R: 'ขวา' };
  var FONT = 'Tahoma';
  var CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
  var thin = { style: 'thin', color: { argb: 'FF000000' } };
  var BOX = { top: thin, left: thin, bottom: thin, right: thin };

  function col(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
  function fill(argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; }
  function font(o) { var f = { name: FONT, size: 9, color: { argb: 'FF000000' } }; for (var k in (o || {})) f[k] = o[k]; return f; }

  /* Excel stores dates without a time zone: shift so the cell shows Thailand time (UTC+7) */
  function th(d) { if (!(d instanceof Date)) d = new Date(d); if (isNaN(d)) return null; return new Date(d.getTime() + 7 * 3600e3); }
  function thText(d) { /* 13 OCT26 (15:49 TH-LT) */
    var t = th(d); if (!t) return '-';
    var mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][t.getUTCMonth()];
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(t.getUTCDate()) + ' ' + mon + p(t.getUTCFullYear() % 100) + ' (' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()) + ' TH-LT)';
  }

  function buildSeatWorkbook(ExcelJS, data) {
    data = data || {};
    var state = data.state || {};
    var wb = new ExcelJS.Workbook();
    wb.creator = 'STATUS SEAT PLAN A340';
    wb.calcProperties = { fullCalcOnLoad: true };
    var ws = wb.addWorksheet('ผังที่นั่ง', {
      views: [{ showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    ws.getColumn(1).width = 2; ws.getColumn(2).width = 7;
    for (var c = 3; c <= 20; c++) ws.getColumn(c).width = 6;
    ws.getColumn(7).width = 2.5; ws.getColumn(16).width = 2.5;
    var LEFT = 3, MID = 8, RIGHT = 17;

    function put(r, c, v, o) {
      o = o || {};
      var span = o.span === undefined ? 2 : o.span, rows = o.rows || 1;
      if (span > 1 || rows > 1) ws.mergeCells(r, c, r + rows - 1, c + span - 1);
      var cell = ws.getCell(r, c);
      if (v !== undefined && v !== null) cell.value = v;
      cell.font = o.font || font();
      cell.alignment = o.align || CENTER;
      if (o.fmt) cell.numFmt = o.fmt;
      for (var rr = r; rr < r + rows; rr++) for (var cc = c; cc < c + span; cc++) {
        var x = ws.getCell(rr, cc);
        if (o.fill) x.fill = fill(o.fill);
        if (o.border !== false) x.border = BOX;
      }
      return cell;
    }
    function dv(cell, list) { ws.getCell(cell).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + list.join(',') + '"'] }; }

    /* header */
    ws.mergeCells('B1:T1');
    ws.getCell('B1').value = 'STATUS SEAT PLAN A340';
    ws.getCell('B1').font = font({ size: 18, bold: true }); ws.getCell('B1').alignment = CENTER;
    for (c = 2; c <= 20; c++) ws.getCell(1, c).fill = fill(C.TAG);
    ws.getRow(1).height = 32;
    var ls = data.lastSave || {};
    put(2, 2, 'SAVE ล่าสุด', { font: font({ bold: true }), fill: C.ZONEH });
    put(2, 4, ls.by || '-', { span: 7, fill: C.GREY });
    put(2, 11, 'วัน/เวลาที่ SAVE (TH-LT)', { span: 3, font: font({ size: 8, bold: true }), fill: C.ZONEH });
    put(2, 14, ls.at ? thText(ls.at) : '-', { span: 4, fill: C.GREY });
    put(3, 2, 'ผู้ตรวจ', { font: font({ bold: true }), fill: C.ZONEH });
    put(3, 4, data.inspector || null, { span: 7, fill: C.YEL });
    put(3, 11, 'วัน/เวลาที่ตรวจ', { span: 3, font: font({ size: 8, bold: true }), fill: C.ZONEH });
    put(3, 14, null, { span: 4, fill: C.YEL, fmt: 'dd/mm/yyyy hh:mm' });
    ws.getRow(2).height = 26; ws.getRow(3).height = 26;
    ws.mergeCells('B4:T4');
    ws.getCell('B4').value = 'บันทึกสภาพที่นั่ง, Monitor, Galley และห้องน้ำ · Export จากหน้าเว็บ ' + thText(new Date()) + ' · เวลาทั้งหมดเป็นเวลาประเทศไทย (TH-LT)';
    ws.getCell('B4').font = font({ size: 8, italic: true }); ws.getCell('B4').alignment = CENTER;

    var SUM0 = 5;
    [['ZONE', 2, 3, null], ['ที่นั่งรวม', 5, 2, null], ['ใช้งานได้ปกติ', 7, 2, C.GREEN], ['มีข้อขัดข้อง\nแต่ใช้งานได้', 9, 2, C.YEL],
     ['ใช้งานไม่ได้', 11, 2, C.RED], ['Monitor รวม', 13, 2, C.BLUE], ['Monitor\nใช้งานได้', 15, 2, C.MGREEN],
     ['Monitor\nเสื่อมสภาพ', 17, 2, C.YEL], ['Monitor\nเสีย', 19, 2, C.RED]].forEach(function (h) {
      put(SUM0, h[1], h[0], { span: h[2], font: font({ size: 8, bold: true }), fill: h[3] });
    });
    ws.getRow(SUM0).height = 30;
    ws.getCell('B13').value = 'วิธีใช้'; ws.getCell('B13').font = font({ size: 8, bold: true });
    ws.mergeCells('C13:T13');
    ws.getCell('C13').value = 'เลือกสภาพจาก dropdown ใต้ตัวอักษรที่นั่ง, ในช่อง Monitor และใต้ชื่ออุปกรณ์ Galley / ห้องน้ำ · พิมพ์รายละเอียดในช่อง NOTE · สีและตารางสรุปเปลี่ยนเอง';
    ws.getCell('C13').font = font({ size: 8 }); ws.getCell('C13').alignment = { wrapText: true, vertical: 'middle' };

    var r = 15, cells = {}, order = [], zrows = {};
    function zoneHeader(title, tag) {
      ws.mergeCells(r, 2, r, 16); ws.getCell(r, 2).value = title;
      ws.getCell(r, 2).font = font({ size: 11, bold: true }); ws.getCell(r, 2).alignment = { vertical: 'middle' };
      for (var cc = 2; cc <= 16; cc++) ws.getCell(r, cc).fill = fill(C.ZONEH);
      ws.mergeCells(r, 17, r, 20); ws.getCell(r, 17).value = tag;
      ws.getCell(r, 17).font = font({ size: 10, bold: true }); ws.getCell(r, 17).alignment = CENTER;
      for (cc = 17; cc <= 20; cc++) ws.getCell(r, cc).fill = fill(C.TAG);
      ws.getRow(r).height = 22; r++; ws.getRow(r).height = 6; r++;
    }
    function cabin(r0, r1) {
      for (var rr = r0; rr <= r1; rr++) for (var cc = 2; cc <= 20; cc++) {
        var x = ws.getCell(rr, cc);
        if (!x.fill || !x.fill.fgColor) x.fill = fill(C.CABIN);
      }
    }
    function seatRow(zone, num, seats, mon, label) {
      var r0 = r, mr = null;
      if (mon) {
        seats.forEach(function (s) { put(r, s[1], M[0], { font: font({ size: 7, bold: true }), fill: C.MGREEN }); dv(col(s[1]) + r, M); });
        ws.getRow(r).height = 14; mr = r; r++;
      }
      if (num !== null) put(r, 2, num, { span: 1, font: font({ size: 10, bold: true, color: { argb: 'FFFFFFFF' } }), fill: C.ROWNO });
      seats.forEach(function (s) {
        var lt = s[0], c = s[1], a = col(c);
        put(r, c, lt, { font: font({ size: 11, bold: true }), fill: C.GREEN });
        put(r + 1, c, S[0], { font: font({ size: 7 }), fill: C.WHITE }); dv(a + (r + 1), S);
        put(r + 2, c, null, { font: font({ size: 7 }), fill: C.WHITE, align: { wrapText: true, vertical: 'top', horizontal: 'left' } });
        var ref = a + r + ':' + col(c + 1) + r;
        ws.addConditionalFormatting({ ref: ref, rules: [
          { type: 'expression', priority: 1, formulae: ['$' + a + '$' + (r + 1) + '="' + S[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
          { type: 'expression', priority: 2, formulae: ['$' + a + '$' + (r + 1) + '="' + S[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } }
        ] });
        var id = lt === 'CC' ? 'CC' : String(num) + lt;
        cells[id] = { zone: zone, label: lt === 'CC' ? 'Commander Center' : id, seat: a + (r + 1), mon: mon ? a + mr : null, note: a + (r + 2) };
        order.push(id);
      });
      if (label) {
        var c0 = seats[0][1] + 2; ws.mergeCells(r, c0, r, c0 + 4);
        ws.getCell(r, c0).value = label; ws.getCell(r, c0).font = font({ bold: true }); ws.getCell(r, c0).alignment = { vertical: 'middle' };
      }
      ws.getRow(r).height = 22; ws.getRow(r + 1).height = 14; ws.getRow(r + 2).height = 30;
      ws.getCell(r + 2, 2).value = 'NOTE'; ws.getCell(r + 2, 2).font = font({ size: 6, color: { argb: C.MUTED } });
      ws.getCell(r + 2, 2).alignment = { horizontal: 'right', vertical: 'top' };
      r += 3; ws.getRow(r).height = 5; r++;
      zrows[zone] = [zrows[zone] ? zrows[zone][0] : r0, r - 1];
    }
    function ovhRow(zone, n) {
      var r0 = r;
      [['L', LEFT + 1], ['C', MID + 3], ['R', RIGHT + 1]].forEach(function (p) {
        put(r, p[1], M[0], { font: font({ size: 7, bold: true }), fill: C.MGREEN }); dv(col(p[1]) + r, M);
        put(r + 1, p[1], null, { font: font({ size: 7 }), fill: C.WHITE, align: { wrapText: true, vertical: 'top', horizontal: 'left' } });
        var id = 'MON-' + n + '-' + p[0];
        cells[id] = { zone: zone, label: 'Monitor เพดาน หน้าแถว ' + n + ' (' + SIDE[p[0]] + ')', seat: null, mon: col(p[1]) + r, note: col(p[1]) + (r + 1) };
        order.push(id);
      });
      ws.getCell(r, 2).value = 'Monitor'; ws.getCell(r, 2).font = font({ size: 6, bold: true, color: { argb: C.MUTED } });
      ws.getCell(r, 2).alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getCell(r + 1, 2).value = 'NOTE'; ws.getCell(r + 1, 2).font = font({ size: 6, color: { argb: C.MUTED } });
      ws.getCell(r + 1, 2).alignment = { horizontal: 'right', vertical: 'top' };
      ws.getRow(r).height = 14; ws.getRow(r + 1).height = 24; r += 2; ws.getRow(r).height = 5; r++;
      zrows[zone] = [zrows[zone] ? zrows[zone][0] : r0, r - 1];
    }
    /* Galley / lavatory blocks drawn on the map at their places in the cabin (same layout as the web page).
       Each unit = name (coloured by its status) / status dropdown / NOTE, like a seat. */
    var eqd0 = data.equip || {}, SUBS = eqd0.subs || {}, BTN = eqd0.btn || {}, eqMap = {}, rowH = {};
    var XL_ROWS = { G7: [['BOILER-1*2'], ['CM-1', 'CM-2'], ['CM-3', ''], ['OVEN-1', 'OVEN-2'], ['OVEN-3', 'OVEN-4'], ['OVEN-5', 'OVEN-6'], ['HOTCUP-1', 'HOTCUP-2'], ['HOTCUP-3', '']] };
    function setH(row, h) { rowH[row] = Math.max(rowH[row] || 0, h); }
    function eqCF(nameRef, statRef) {
      ws.addConditionalFormatting({ ref: nameRef, rules: [
        { type: 'expression', priority: 1, formulae: [statRef + '="' + E[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
        { type: 'expression', priority: 2, formulae: [statRef + '="' + E[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } }
      ] });
    }
    function eqUnit(r0, c0, span, id, name, nameFill) {
      var d = state[id] || {}, sa = col(c0) + (r0 + 1), na = col(c0) + (r0 + 2);
      put(r0, c0, name, { span: span, font: font({ size: 8, bold: true }), fill: nameFill || C.GREEN });
      put(r0 + 1, c0, E[d.s | 0], { span: span, font: font({ size: 7 }), fill: C.WHITE, align: { horizontal: 'center', vertical: 'middle', shrinkToFit: true } }); dv(sa, E);
      put(r0 + 2, c0, d.note || null, { span: span, font: font({ size: 7 }), fill: C.WHITE, align: { wrapText: true, vertical: 'top', horizontal: 'left' } });
      eqCF(col(c0) + r0 + ':' + col(c0 + span - 1) + r0, '$' + col(c0) + '$' + (r0 + 1));
      eqMap[id] = { status: sa, note: na };
      setH(r0, 16); setH(r0 + 1, 14); setH(r0 + 2, 22);
    }
    function galleyBlock(r0, c0, span, sk) {
      var rows = XL_ROWS[sk] || (SUBS[sk] && SUBS[sk].rows) || [];
      var sp = function (code) { var m = /\*(\d+)$/.exec(code); return m ? +m[1] : 1; };
      var k = Math.max.apply(null, rows.map(function (rw) { return rw.reduce(function (a, c2) { return a + sp(c2); }, 0); }).concat([1]));
      var unit = Math.max(1, Math.floor(span / k));
      var cnt = {}; rows.forEach(function (rw) { rw.forEach(function (c2) { var t = c2.split('-')[0]; if (c2) cnt[t] = (cnt[t] || 0) + 1; }); });
      put(r0, c0, 'GALLEY ' + sk, { span: span, font: font({ size: 8, bold: true }), fill: C.GAL }); setH(r0, 16);
      var rr2 = r0 + 1;
      rows.forEach(function (rw) {
        var cc2 = c0;
        rw.forEach(function (code) {
          var w = sp(code) * unit;
          if (!code) { put(rr2, cc2, null, { span: w, rows: 3, fill: C.EMPTY }); cc2 += w; return; }
          var base = code.replace(/\*\d+$/, ''), t = base.split('-')[0], n2 = base.split('-')[1];
          eqUnit(rr2, cc2, w, sk + '-' + base, (BTN[t] || t) + (cnt[t] > 1 ? ' ' + n2 : ''));
          cc2 += w;
        });
        rr2 += 3;
      });
      return rr2 - r0;
    }
    function lavBlock(r0, c0, span, n2) { eqUnit(r0, c0, span, 'LAV-' + n2, 'LAV ' + n2 + (span >= 4 ? ' (ห้องน้ำ)' : ''), C.LAV); return 3; }
    function ccBlock(r0, c0) {
      put(r0, c0, 'Commander Center', { font: font({ size: 6, bold: true }), fill: C.WHITE }); setH(r0, 16);
      put(r0 + 1, c0, M[0], { font: font({ size: 7, bold: true }), fill: C.MGREEN }); dv(col(c0) + (r0 + 1), M); setH(r0 + 1, 14);
      put(r0 + 2, c0, 'CC', { font: font({ size: 11, bold: true }), fill: C.GREEN }); setH(r0 + 2, 22);
      put(r0 + 3, c0, S[0], { font: font({ size: 7 }), fill: C.WHITE }); dv(col(c0) + (r0 + 3), S); setH(r0 + 3, 14);
      put(r0 + 4, c0, null, { font: font({ size: 7 }), fill: C.WHITE, align: { wrapText: true, vertical: 'top', horizontal: 'left' } }); setH(r0 + 4, 30);
      var a = col(c0);
      ws.addConditionalFormatting({ ref: a + (r0 + 2) + ':' + col(c0 + 1) + (r0 + 2), rules: [
        { type: 'expression', priority: 1, formulae: ['$' + a + '$' + (r0 + 3) + '="' + S[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
        { type: 'expression', priority: 2, formulae: ['$' + a + '$' + (r0 + 3) + '="' + S[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } }
      ] });
      cells.CC = { zone: 'MC', label: 'Commander Center', seat: a + (r0 + 3), mon: a + (r0 + 1), note: a + (r0 + 4) };
      order.push('CC'); zrows.MC = [r0, r0 + 4];
      return 5;
    }
    /* one band of blocks; entries = [{c, span, stack:[{g}|{lav}|{cc}]}], stacked blocks get a thin gap */
    function blockRow(entries) {
      var r0 = r, h = 0;
      entries.forEach(function (e) {
        var rr2 = r0;
        e.stack.forEach(function (x, i) {
          if (i) { setH(rr2, 5); rr2++; }
          rr2 += x.g ? galleyBlock(rr2, e.c, e.span, x.g) : x.lav ? lavBlock(rr2, e.c, e.span, x.lav) : ccBlock(rr2, e.c);
        });
        h = Math.max(h, rr2 - r0);
      });
      for (var i = 0; i < h; i++) if (rowH[r0 + i]) ws.getRow(r0 + i).height = rowH[r0 + i];
      r = r0 + h; ws.getRow(r).height = 5; r++;
    }
    function doorRow(n2) {
      put(r, 3, '◀ DOOR ' + n2 + 'L', { span: 4, font: font({ size: 8, bold: true, color: { argb: C.MUTED } }), fill: C.DOOR, border: false });
      for (var cc2 = 7; cc2 <= 16; cc2++) { ws.getCell(r, cc2).fill = fill(C.DOOR); ws.getCell(r, cc2).border = { top: { style: 'dashed', color: { argb: C.MUTED } }, bottom: { style: 'dashed', color: { argb: C.MUTED } } }; }
      put(r, 17, 'DOOR ' + n2 + 'R ▶', { span: 4, font: font({ size: 8, bold: true, color: { argb: C.MUTED } }), fill: C.DOOR, border: false });
      ws.getRow(r).height = 16; r++; ws.getRow(r).height = 5; r++;
    }
    function lay(spec) { var out = []; spec.forEach(function (b) { b[1].split('').forEach(function (lt, i) { out.push([lt, b[0] + 2 * i + b[2]]); }); }); return out; }
    var z0, n;

    z0 = r; zoneHeader('Mission Commander (1 Seat)', 'ZONE MC');
    doorRow('1');
    blockRow([{ c: 3, span: 2, stack: [{ g: 'G1L' }] }, { c: 8, span: 8, stack: [{ g: 'G1' }] }, { c: 19, span: 2, stack: [{ g: 'G1R' }] }]);
    blockRow([{ c: 3, span: 2, stack: [{ cc: true }] }, { c: 9, span: 6, stack: [{ g: 'G1A' }] }, { c: 19, span: 2, stack: [{ lav: 'L16' }] }]);
    cabin(z0 + 1, r); r++;
    z0 = r; zoneHeader('First Class (8 Seats)', 'ZONE A');
    [1, 2].forEach(function (n) { seatRow('A', n, lay([[LEFT, 'A', 0], [MID, 'EF', 2], [RIGHT, 'K', 2]]), true); });
    cabin(z0 + 1, r); r++;
    z0 = r; zoneHeader('Business Class Area (30 Seats)', 'ZONE B');
    blockRow([{ c: 3, span: 4, stack: [{ g: 'G2L' }] }, { c: 9, span: 6, stack: [{ g: 'G2' }] }, { c: 17, span: 4, stack: [{ g: 'G2R' }] }]);
    doorRow('2');
    blockRow([{ c: 3, span: 4, stack: [{ g: 'G2AL' }, { lav: 'L35' }] }, { c: 9, span: 6, stack: [{ g: 'G2A' }] }, { c: 17, span: 4, stack: [{ g: 'G2AR' }, { lav: 'L36' }] }]);
    [11, 12, 14, 15, 16].forEach(function (n) { seatRow('B', n, lay([[LEFT, 'AB', 0], [MID, 'EF', 2], [RIGHT, 'JK', 0]]), true); });
    cabin(z0 + 1, r); r++;
    z0 = r; zoneHeader('Premium Economy Class Area (77 Seats)', 'ZONE C');
    for (n = 31; n <= 41; n++) {
      if (n === 31) ovhRow('C', n);
      if (n === 36) {
        blockRow([{ c: 3, span: 4, stack: [{ lav: 'L53' }] }, { c: 8, span: 4, stack: [{ lav: 'L61' }] }, { c: 12, span: 4, stack: [{ lav: 'L62' }] }, { c: 17, span: 4, stack: [{ lav: 'L54' }] }]);
        doorRow('3');
        ovhRow('C', n);
      }
      seatRow('C', n, lay([[LEFT, 'AB', 0], [MID, 'DEF', 1], [RIGHT, 'JK', 0]]), false);
    }
    cabin(z0 + 1, r); r++;
    z0 = r; zoneHeader('Economy Class Area (49 Seats)', 'ZONE D');
    ovhRow('D', 51);
    [51, 52, 53].forEach(function (n) { seatRow('D', n, lay([[LEFT, 'AB', 0], [MID, 'DEFG', 0], [RIGHT, 'JK', 0]]), false); });
    [54, 55, 56].forEach(function (n) { seatRow('D', n, lay([[LEFT, 'AB', 0], [MID, 'DEF', 1], [RIGHT, 'JK', 0]]), false); });
    seatRow('D', 57, lay([[LEFT, 'AB', 0], [RIGHT, 'JK', 0]]), false);
    blockRow([{ c: 3, span: 4, stack: [{ lav: 'L73' }] }, { c: 8, span: 8, stack: [{ g: 'G5' }] }, { c: 17, span: 4, stack: [{ lav: 'L74' }] }]);
    doorRow('4');
    blockRow([{ c: 3, span: 4, stack: [{ g: 'G6' }] }, { c: 17, span: 4, stack: [{ g: 'G7' }] }]);
    cabin(z0 + 1, r);
    var LAST = r;

    var area = 'C15:T' + LAST;
    ws.addConditionalFormatting({ ref: area, rules: [
      { type: 'cellIs', operator: 'equal', priority: 3, formulae: ['"' + S[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
      { type: 'cellIs', operator: 'equal', priority: 4, formulae: ['"' + M[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
      { type: 'cellIs', operator: 'equal', priority: 5, formulae: ['"' + S[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
      { type: 'cellIs', operator: 'equal', priority: 6, formulae: ['"' + M[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
      { type: 'cellIs', operator: 'equal', priority: 7, formulae: ['"' + E[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
      { type: 'cellIs', operator: 'equal', priority: 8, formulae: ['"' + E[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } }
    ] });

    /* summary formulas (with cached results so every viewer shows numbers at once) */
    var tot = { t: 0, s: [0, 0, 0], mt: 0, m: [0, 0, 0] };
    ['MC', 'A', 'B', 'C', 'D'].forEach(function (k, i) {
      var row = SUM0 + 1 + i, rg = '$C$' + zrows[k][0] + ':$T$' + zrows[k][1];
      var cnt = { t: 0, s: [0, 0, 0], mt: 0, m: [0, 0, 0] };
      order.forEach(function (id) { var it = cells[id], d = state[id] || {}; if (it.zone !== k) return;
        if (it.seat) { cnt.t++; cnt.s[d.s | 0]++; } if (it.mon) { cnt.mt++; cnt.m[d.m | 0]++; } });
      put(row, 2, ZN[k], { span: 3, font: font({ size: 8, bold: true }), align: { vertical: 'middle' } });
      put(row, 5, { formula: 'G' + row + '+I' + row + '+K' + row, result: cnt.t });
      S.forEach(function (t, j) { put(row, 7 + 2 * j, { formula: 'COUNTIF(' + rg + ',"' + t + '")', result: cnt.s[j] }, { fill: [C.GREEN, C.YEL, C.RED][j] }); });
      put(row, 13, { formula: 'O' + row + '+Q' + row + '+S' + row, result: cnt.mt }, { fill: C.BLUE });
      M.forEach(function (t, j) { put(row, 15 + 2 * j, { formula: 'COUNTIF(' + rg + ',"' + t + '")', result: cnt.m[j] }, { fill: [C.MGREEN, C.YEL, C.RED][j] }); });
      tot.t += cnt.t; tot.mt += cnt.mt; for (var j = 0; j < 3; j++) { tot.s[j] += cnt.s[j]; tot.m[j] += cnt.m[j]; }
    });
    var rt = SUM0 + 6;
    put(rt, 2, 'รวม', { span: 3, font: font({ size: 8, bold: true }), align: { vertical: 'middle' } });
    [[5, null, tot.t], [7, C.GREEN, tot.s[0]], [9, C.YEL, tot.s[1]], [11, C.RED, tot.s[2]], [13, C.BLUE, tot.mt], [15, C.MGREEN, tot.m[0]], [17, C.YEL, tot.m[1]], [19, C.RED, tot.m[2]]].forEach(function (x) {
      put(rt, x[0], { formula: 'SUM(' + col(x[0]) + (SUM0 + 1) + ':' + col(x[0]) + (SUM0 + 5) + ')', result: x[2] }, { font: font({ bold: true }), fill: x[1] });
    });

    /* current state */
    order.forEach(function (id) {
      var it = cells[id], d = state[id]; if (!d) return;
      if (it.seat) ws.getCell(it.seat).value = S[d.s | 0];
      if (it.mon) ws.getCell(it.mon).value = M[d.m | 0];
      if (d.note) ws.getCell(it.note).value = d.note;
    });

    /* Galley and lavatories: summary tables (COUNTIFS over the list below) + the list with a status dropdown */
    var eqd = data.equip || { items: [], galleys: [], lavZones: [] };
    var eqItems = eqd.items || [];
    var g = wb.addWorksheet('Galley และห้องน้ำ', { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    [30, 18, 18, 18, 40, 22, 20].forEach(function (w, j) { g.getColumn(j + 1).width = w; });
    function gput(r, c, v, o) {
      o = o || {}; var cell = g.getCell(r, c);
      if (v !== undefined && v !== null) cell.value = v;
      cell.font = o.font || font(); cell.alignment = o.align || CENTER; cell.border = BOX;
      if (o.fill) cell.fill = fill(o.fill); if (o.fmt) cell.numFmt = o.fmt;
      return cell;
    }
    g.mergeCells('A1:G1'); g.getCell('A1').value = 'สถานภาพ Galley และห้องน้ำ (LAVATORY) A340';
    g.getCell('A1').font = font({ size: 14, bold: true }); g.getCell('A1').alignment = CENTER; g.getCell('A1').fill = fill(C.TAG); g.getRow(1).height = 28;
    g.mergeCells('A2:G2'); g.getCell('A2').value = 'แก้สภาพ Galley / ห้องน้ำได้ที่แผ่นงาน "ผังที่นั่ง" (dropdown ใต้ชื่ออุปกรณ์) · รายการและตารางสรุปในแผ่นนี้ดึงค่ามาเอง · Export ' + thText(new Date());
    g.getCell('A2').font = font({ size: 8, italic: true }); g.getCell('A2').alignment = CENTER;
    var nGalRows = 0; (eqd.galleys || []).forEach(function (G) { nGalRows += 1 + G.types.length; });
    var GS = 4, GE = GS + nGalRows + 1;                    /* galley table: header GS, rows, total GE */
    var LS = GE + 2, LE = LS + (eqd.lavZones || []).length + 1;  /* lav table */
    var L0 = LE + 2, L1 = L0 + eqItems.length;           /* list header L0, rows L0+1..L1 */
    var rB = '$B$' + (L0 + 1) + ':$B$' + Math.max(L1, L0 + 1), rC = '$C$' + (L0 + 1) + ':$C$' + Math.max(L1, L0 + 1), rD = '$D$' + (L0 + 1) + ':$D$' + Math.max(L1, L0 + 1);
    function q(t) { return '"' + String(t).replace(/"/g, '""') + '"'; }
    function cnt(f) { var c = { t: 0, s: [0, 0, 0] }; eqItems.forEach(function (it) { if (!f(it)) return; var d = state[it.id] || {}; c.t++; c.s[d.s | 0]++; }); return c; }
    function sumHeader(r, first) {
      [first, 'จำนวน', E[0], E[1], E[2]].forEach(function (t, j) { gput(r, j + 1, t, { font: font({ size: 9, bold: true }), fill: [C.ZONEH, C.ZONEH, C.GREEN, C.YEL, C.RED][j] }); });
      g.getRow(r).height = 22;
    }
    function sumRow(r, name, crit, c, o) {
      o = o || {};
      gput(r, 1, name, { font: font({ bold: !!o.bold }), align: { vertical: 'middle', horizontal: 'left', indent: o.indent ? 2 : 0 }, fill: o.fill });
      gput(r, 2, { formula: 'COUNTIFS(' + crit + ')', result: c.t }, { font: font({ bold: !!o.bold }), fill: o.fill });
      E.forEach(function (t, j) { gput(r, 3 + j, { formula: 'COUNTIFS(' + crit + ',' + rD + ',' + q(t) + ')', result: c.s[j] }, { font: font({ bold: !!o.bold }), fill: o.fill }); });
    }
    function totRow(r, rows, c) {
      gput(r, 1, 'รวม', { font: font({ bold: true }), align: { vertical: 'middle', horizontal: 'left' }, fill: C.GREY });
      [c.t, c.s[0], c.s[1], c.s[2]].forEach(function (v, j) {
        var L = col(2 + j); gput(r, 2 + j, { formula: rows.map(function (x) { return L + x; }).join('+') || '0', result: v }, { font: font({ bold: true }), fill: C.GREY });
      });
    }
    sumHeader(GS, 'GALLEY / อุปกรณ์');
    var rr2 = GS + 1, galHeads = [];
    (eqd.galleys || []).forEach(function (G) {
      galHeads.push(rr2);
      sumRow(rr2++, G.name, rB + ',' + q(G.name), cnt(function (it) { return it.kind === 'eq' && it.group === G.name; }), { bold: true, fill: C.CABIN });
      G.types.forEach(function (t) {
        sumRow(rr2++, t, rB + ',' + q(G.name) + ',' + rC + ',' + q(t), cnt(function (it) { return it.kind === 'eq' && it.group === G.name && it.type === t; }), { indent: true });
      });
    });
    totRow(GE, galHeads, cnt(function (it) { return it.kind === 'eq'; }));
    sumHeader(LS, 'ห้องน้ำ (LAVATORY) · ZONE');
    var lavRows = [];
    (eqd.lavZones || []).forEach(function (z, i) {
      var r = LS + 1 + i; lavRows.push(r);
      var ids = eqItems.filter(function (it) { return it.kind === 'lav' && it.group === z; }).map(function (it) { return it.label.replace(/^LAV /, ''); });
      sumRow(r, z + (ids.length ? ' (' + ids.join(', ') + ')' : ''), rB + ',' + q(z) + ',' + rC + ',' + q('LAVATORY'), cnt(function (it) { return it.kind === 'lav' && it.group === z; }));
    });
    totRow(LE, lavRows, cnt(function (it) { return it.kind === 'lav'; }));
    ['รายการ', 'GALLEY / โซน', 'ประเภท', 'สภาพ', 'หมายเหตุ', 'ผู้บันทึกล่าสุด', 'วัน/เวลาล่าสุด (TH-LT)'].forEach(function (t, j) {
      gput(L0, j + 1, t, { font: font({ size: 9, bold: true }), fill: C.ZONEH });
    });
    g.getRow(L0).height = 22;
    var eqCells = {};
    eqItems.forEach(function (it, i) {
      var r = L0 + 1 + i, d = state[it.id] || {};
      var mp = eqMap[it.id], MS = "'ผังที่นั่ง'!";
      var stV = mp ? { formula: MS + mp.status, result: E[d.s | 0] } : E[d.s | 0];
      var ntV = mp ? { formula: 'IF(' + MS + mp.note + '="","",' + MS + mp.note + ')', result: d.note || '' } : (d.note || '');
      [it.label, it.group, it.type, stV, ntV, d.by || '', d.at ? th(d.at) : ''].forEach(function (v, j) {
        gput(r, j + 1, v, { align: { horizontal: (j === 0 || j === 4 || j === 5) ? 'left' : 'center', vertical: 'top', wrapText: j === 4 } });
      });
      g.getCell(r, 7).numFmt = 'dd/mm/yyyy hh:mm';
      if (!mp) g.getCell(r, 4).dataValidation = { type: 'list', allowBlank: false, formulae: ['"' + E.join(',') + '"'] };
      eqCells[it.id] = it;
    });
    if (eqItems.length) {
      g.addConditionalFormatting({ ref: 'D' + (L0 + 1) + ':D' + L1, rules: [
        { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"' + E[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
        { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"' + E[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } }
      ] });
      g.autoFilter = 'A' + L0 + ':G' + L1;
    }

    /* list sheets */
    var HDR = ['ที่นั่ง / จุด', 'ประเภท', 'โซน', 'สภาพที่นั่ง / อุปกรณ์', 'สภาพ Monitor', 'หมายเหตุ', 'ผู้บันทึกล่าสุด', 'วัน/เวลาล่าสุด (TH-LT)'];
    var WID = [30, 10, 20, 16, 14, 44, 24, 20];
    function statusCF(s, end) {
      if (end < 2) return;
      s.addConditionalFormatting({ ref: 'D2:E' + end, rules: [
        { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"' + S[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
        { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"' + M[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
        { type: 'cellIs', operator: 'equal', priority: 3, formulae: ['"' + S[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
        { type: 'cellIs', operator: 'equal', priority: 4, formulae: ['"' + M[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
        { type: 'cellIs', operator: 'equal', priority: 5, formulae: ['"' + E[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
        { type: 'cellIs', operator: 'equal', priority: 6, formulae: ['"' + E[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } }
      ] });
    }
    function header(s, titles, widths) {
      titles.forEach(function (t, j) {
        var c = s.getCell(1, j + 1); c.value = t; c.font = font({ size: 10, bold: true }); c.fill = fill(C.ZONEH); c.border = BOX; c.alignment = CENTER;
        s.getColumn(j + 1).width = widths[j];
      });
      s.views = [{ state: 'frozen', ySplit: 1 }];
    }
    function listSheet(title, ids, live) {
      var s = wb.addWorksheet(title); header(s, HDR, WID);
      var q = "'ผังที่นั่ง'!";
      ids.forEach(function (id, i) {
        var row = 2 + i, it = cells[id], d = state[id] || {};
        var vals;
        if (!it) { it = eqCells[id]; vals = [it.label, it.kind === 'eq' ? 'Galley' : 'ห้องน้ำ', it.group, E[d.s | 0], '-', d.note || ''];
        } else {
        vals = [it.label, it.seat ? 'ที่นั่ง' : 'Monitor', ZN[it.zone]];
        if (live) {
          vals.push(it.seat ? { formula: q + it.seat, result: S[d.s | 0] } : '-');
          vals.push(it.mon ? { formula: q + it.mon, result: M[d.m | 0] } : '-');
          vals.push({ formula: 'IF(' + q + it.note + '="",""' + ',' + q + it.note + ')', result: d.note || '' });
        } else {
          vals.push(it.seat ? S[d.s | 0] : '-', it.mon ? M[d.m | 0] : '-', d.note || '');
        }
        }
        vals.push(d.by || '', d.at ? th(d.at) : '');
        vals.forEach(function (v, j) {
          var c = s.getCell(row, j + 1); c.value = v; c.font = font(); c.border = BOX;
          c.alignment = { horizontal: (j === 0 || j === 5 || j === 6) ? 'left' : 'center', vertical: 'top', wrapText: j === 5 };
        });
        s.getCell(row, 8).numFmt = 'dd/mm/yyyy hh:mm';
      });
      var end = 1 + ids.length; statusCF(s, end);
      if (end >= 2) s.autoFilter = 'A1:H' + end;
      return s;
    }
    var bad = order.concat(eqItems.map(function (it) { return it.id; })).filter(function (id) { var d = state[id] || {}; return (d.s | 0) || (d.m | 0) || d.note; });
    var sBad = listSheet('รวมข้อขัดข้องคงค้าง', bad, false);
    if (!bad.length) { sBad.getCell('A2').value = 'ไม่มีข้อขัดข้องคงค้าง'; sBad.getCell('A2').font = font(); }
    listSheet('ทุกที่นั่ง และ Monitor', order, true);

    /* history: every cell centred (horizontal + vertical) */
    var h = wb.addWorksheet('ประวัติการแก้ไข');
    header(h, ['วัน/เวลา (TH-LT)', 'อีเมลผู้แก้ไข', 'ผู้ตรวจ', 'ที่นั่ง / จุด', 'รายการ', 'ค่าเดิม', 'ค่าใหม่'], [20, 30, 24, 30, 14, 36, 36]);
    var hist = data.history;
    if (!hist) {
      h.mergeCells('A2:G2'); h.getCell('A2').value = 'ไม่สามารถดึงประวัติการแก้ไขได้ ดูในแท็บ "ประวัติการแก้ไข" ของ Google Sheet';
      h.getCell('A2').font = font(); h.getCell('A2').alignment = CENTER;
    } else {
      hist.forEach(function (row, i) {
        row.forEach(function (v, j) {
          var c = h.getCell(2 + i, j + 1);
          if (j === 0) { var t = (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) ? th(v) : null; c.value = t || String(v || ''); if (t) c.numFmt = 'dd/mm/yyyy hh:mm:ss'; }
          else c.value = v === null || v === undefined ? '' : String(v);
          c.font = font(); c.border = BOX; c.alignment = CENTER;
        });
      });
      if (hist.length) h.autoFilter = 'A1:G' + (1 + hist.length);
    }
    return wb;
  }

  root.buildSeatWorkbook = buildSeatWorkbook;
  root.seatThText = thText;
})(typeof window !== 'undefined' ? window : this);
