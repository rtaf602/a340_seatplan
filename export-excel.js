/* STATUS SEAT PLAN A340 — EXPORT TO EXCEL
 * buildSeatWorkbook(ExcelJS, data) returns an ExcelJS workbook with 4 sheets:
 *   ผังที่นั่ง | รวมข้อขัดข้องคงค้าง | ทุกที่นั่ง และ Monitor | ประวัติการแก้ไข
 * data = {
 *   state:   { id: {s:0|1|2, m:0|1|2, note:'', by:'', at:ISO} }   id = 'CC', '12E', 'MON-31-L' ...
 *   lastSave:{ by, at:ISO } | null,
 *   inspector: '',
 *   history: [[atISO|text, email, inspector, label, field, oldValue, newValue], ...] | null
 * }
 * Layout matches the "ผังที่นั่ง" tab of the Google Sheet (two columns per seat).
 */
(function (root) {
  var S = ['ปกติ', 'ขัดข้อง-ใช้ได้', 'ใช้ไม่ได้'];
  var M = ['จอปกติ', 'จอเสื่อม', 'จอเสีย'];
  var C = { GREEN: 'FF00FF00', MGREEN: 'FF8ED873', YEL: 'FFFFFF00', RED: 'FFFF0000', CABIN: 'FFCAEDFB', ROWNO: 'FF6D9EEB',
    ZONEH: 'FFC1E4F5', TAG: 'FF45B0E1', WHITE: 'FFFFFFFF', BLUE: 'FF00B0F0', GREY: 'FFF2F2F2', MUTED: 'FF566575' };
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
    ws.getCell('B4').value = 'บันทึกสภาพที่นั่งและ Monitor · Export จากหน้าเว็บ ' + thText(new Date()) + ' · เวลาทั้งหมดเป็นเวลาประเทศไทย (TH-LT)';
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
    ws.getCell('C13').value = 'เลือกสภาพจาก dropdown ใต้ตัวอักษรที่นั่งและในช่อง Monitor · พิมพ์รายละเอียดในช่อง NOTE · สีและตารางสรุปเปลี่ยนเอง';
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
    function lay(spec) { var out = []; spec.forEach(function (b) { b[1].split('').forEach(function (lt, i) { out.push([lt, b[0] + 2 * i + b[2]]); }); }); return out; }
    var z0, n;

    z0 = r; zoneHeader('Mission Commander (1 Seat)', 'ZONE MC'); var room0 = r - 1;
    seatRow('MC', null, [['CC', LEFT]], true, 'Commander Center'); cabin(z0 + 1, r);
    var med = { style: 'medium', color: { argb: C.MUTED } };
    for (var rr = room0; rr < r; rr++) for (c = 2; c <= 10; c++) {
      var b = Object.assign({}, ws.getCell(rr, c).border || {});
      if (c === 2) b.left = med; if (c === 10) b.right = med; if (rr === room0) b.top = med; if (rr === r - 1) b.bottom = med;
      ws.getCell(rr, c).border = b;
    }
    r++;
    z0 = r; zoneHeader('First Class (8 Seats)', 'ZONE A');
    [1, 2].forEach(function (n) { seatRow('A', n, lay([[LEFT, 'A', 0], [MID, 'EF', 2], [RIGHT, 'K', 2]]), true); });
    cabin(z0 + 1, r); r++;
    z0 = r; zoneHeader('Business Class Area (30 Seats)', 'ZONE B');
    [11, 12, 14, 15, 16].forEach(function (n) { seatRow('B', n, lay([[LEFT, 'AB', 0], [MID, 'EF', 2], [RIGHT, 'JK', 0]]), true); });
    cabin(z0 + 1, r); r++;
    z0 = r; zoneHeader('Premium Economy Class Area (77 Seats)', 'ZONE C');
    for (n = 31; n <= 41; n++) {
      if (n === 31 || n === 36) ovhRow('C', n);
      seatRow('C', n, lay([[LEFT, 'AB', 0], [MID, 'DEF', 1], [RIGHT, 'JK', 0]]), false);
    }
    cabin(z0 + 1, r); r++;
    z0 = r; zoneHeader('Economy Class Area (49 Seats)', 'ZONE D');
    ovhRow('D', 51);
    [51, 52, 53].forEach(function (n) { seatRow('D', n, lay([[LEFT, 'AB', 0], [MID, 'DEFG', 0], [RIGHT, 'JK', 0]]), false); });
    [54, 55, 56].forEach(function (n) { seatRow('D', n, lay([[LEFT, 'AB', 0], [MID, 'DEF', 1], [RIGHT, 'JK', 0]]), false); });
    seatRow('D', 57, lay([[LEFT, 'AB', 0], [RIGHT, 'JK', 0]]), false);
    cabin(z0 + 1, r);
    var LAST = r;

    var area = 'C15:T' + LAST;
    ws.addConditionalFormatting({ ref: area, rules: [
      { type: 'cellIs', operator: 'equal', priority: 3, formulae: ['"' + S[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
      { type: 'cellIs', operator: 'equal', priority: 4, formulae: ['"' + M[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
      { type: 'cellIs', operator: 'equal', priority: 5, formulae: ['"' + S[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
      { type: 'cellIs', operator: 'equal', priority: 6, formulae: ['"' + M[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } }
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

    /* list sheets */
    var HDR = ['ที่นั่ง / จุด', 'ประเภท', 'โซน', 'สภาพที่นั่ง', 'สภาพ Monitor', 'หมายเหตุ', 'ผู้บันทึกล่าสุด', 'วัน/เวลาล่าสุด (TH-LT)'];
    var WID = [30, 10, 20, 16, 14, 44, 24, 20];
    function statusCF(s, end) {
      if (end < 2) return;
      s.addConditionalFormatting({ ref: 'D2:E' + end, rules: [
        { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"' + S[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
        { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"' + M[1] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.YEL } } } },
        { type: 'cellIs', operator: 'equal', priority: 3, formulae: ['"' + S[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } },
        { type: 'cellIs', operator: 'equal', priority: 4, formulae: ['"' + M[2] + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.RED } }, font: { color: { argb: 'FFFFFFFF' } } } }
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
        var vals = [it.label, it.seat ? 'ที่นั่ง' : 'Monitor', ZN[it.zone]];
        if (live) {
          vals.push(it.seat ? { formula: q + it.seat, result: S[d.s | 0] } : '-');
          vals.push(it.mon ? { formula: q + it.mon, result: M[d.m | 0] } : '-');
          vals.push({ formula: 'IF(' + q + it.note + '="",""' + ',' + q + it.note + ')', result: d.note || '' });
        } else {
          vals.push(it.seat ? S[d.s | 0] : '-', it.mon ? M[d.m | 0] : '-', d.note || '');
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
    var bad = order.filter(function (id) { var d = state[id] || {}; return (d.s | 0) || (d.m | 0) || d.note; });
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
