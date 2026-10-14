/**
 * Seat Plan 340 (For Admin) — Apps Script
 *
 * ทำ 2 อย่าง:
 *  1) เป็น API ให้หน้าเว็บ (GitHub Pages) อ่าน/บันทึกสภาพที่นั่งลงแท็บ "ผังที่นั่ง"
 *     และบันทึกประวัติลงแท็บ "ประวัติการแก้ไข" ทุกครั้งที่กด SAVE บนเว็บ
 *  2) บันทึกประวัติอัตโนมัติเมื่อมีคนแก้ไขช่องในชีทโดยตรง (onEdit)
 *
 * วิธีติดตั้ง: ดู README.md ใน repo
 */

// ---------- ตั้งค่า ----------
const MAP_SHEET = 'ผังที่นั่ง';
const LOG_SHEET = 'ประวัติการแก้ไข';
const FIRST_MAP_ROW = 17;      // แถวแรกของผังที่นั่ง
const INSPECTOR_CELL = 'D3';   // ช่องชื่อผู้ตรวจในชีท
const WRITE_PIN = '';          // รหัสเข้าหน้าเว็บและ SAVE เช่น '6020' (เว้นว่าง = ไม่ต้องใช้รหัส)
const ADMIN_PIN = '';          // รหัสสำหรับปุ่ม "ล้างข้อมูลทั้งหมด" บนเว็บ (เว้นว่าง = ปิดปุ่มนี้)

const SEAT_TXT = ['ปกติ', 'ขัดข้อง-ใช้ได้', 'ใช้ไม่ได้'];
const MON_TXT = ['จอปกติ', 'จอเสื่อม', 'จอเสีย'];
const SIDE_TH = { L: 'ซ้าย', C: 'กลาง', R: 'ขวา' };

// ---------- Web API ----------
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'load';
  try {
    if (action === 'load') {
      if (WRITE_PIN) return json_({ ok: false, error: 'pin' });  // มีรหัส: ต้องโหลดผ่าน POST พร้อมรหัส
      return json_(loadData_());
    }
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server', message: String(err) });
  }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  try {
    if (body.action === 'load') {
      if (WRITE_PIN && String(body.pin || '') !== WRITE_PIN) return json_({ ok: false, error: 'pin' });
      return json_(loadData_());
    }
    if (body.action === 'history') {
      if (WRITE_PIN && String(body.pin || '') !== WRITE_PIN) return json_({ ok: false, error: 'pin' });
      return json_(historyData_());
    }
    if (body.action === 'save') return json_(saveData_(body));
    if (body.action === 'reset') return json_(resetData_(body));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server', message: String(err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** อ่านผังจากชีท แล้วคืนรายการที่นั่ง/Monitor พร้อมตำแหน่งช่อง */
function buildMap_(sh) {
  const last = sh.getLastRow();
  const v = sh.getRange(1, 1, last, 20).getDisplayValues();
  const cell = function (r, c) { return (r >= 1 && r <= last) ? String(v[r - 1][c - 1]).trim() : ''; };
  const items = {};
  for (let r = FIRST_MAP_ROW; r <= last; r++) {
    if (cell(r, 2) === 'Monitor') {
      for (let c = 3; c <= 20; c++) {
        if (MON_TXT.indexOf(cell(r, c)) < 0) continue;
        const side = c <= 6 ? 'L' : (c <= 15 ? 'C' : 'R');
        const rowNo = cell(r + 3, 2);
        const id = 'MON-' + rowNo + '-' + side;
        items[id] = { id: id, label: 'Monitor เพดาน หน้าแถว ' + rowNo + ' (' + SIDE_TH[side] + ')', mon: [r, c], note: [r + 1, c] };
      }
      continue;
    }
    for (let c = 3; c <= 20; c++) {
      const t = cell(r, c);
      if (!/^([A-K]|CC)$/.test(t)) continue;
      const st = cell(r + 1, c);
      if (st !== '' && SEAT_TXT.indexOf(st) < 0) continue;
      const id = t === 'CC' ? 'CC' : cell(r, 2) + t;
      const it = { id: id, label: t === 'CC' ? 'Commander Center' : id, seat: [r + 1, c], note: [r + 2, c] };
      if (MON_TXT.indexOf(cell(r - 1, c)) >= 0) it.mon = [r - 1, c];
      items[id] = it;
    }
  }
  return { items: items, cell: cell };
}

function loadData_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(MAP_SHEET);
  const m = buildMap_(sh);
  const byLabel = {};
  Object.keys(m.items).forEach(function (id) { byLabel[m.items[id].label] = id; });

  // ผู้แก้ไข/เวลาล่าสุดของแต่ละที่นั่ง จากแท็บประวัติ
  const lastBy = {};
  const log = ss.getSheetByName(LOG_SHEET);
  const n = log.getLastRow();
  if (n > 1) {
    const rows = log.getRange(2, 1, n - 1, 4).getValues();
    rows.forEach(function (row) {
      const id = byLabel[String(row[3])];
      if (!id) return;
      const at = row[0] instanceof Date ? row[0].toISOString() : '';
      const who = (row[2] && row[2] !== '-') ? String(row[2]) : String(row[1] || '');
      lastBy[id] = { by: who, at: at };
    });
  }

  const seats = {};
  Object.keys(m.items).forEach(function (id) {
    const it = m.items[id];
    const s = it.seat ? Math.max(0, SEAT_TXT.indexOf(m.cell(it.seat[0], it.seat[1]))) : 0;
    const mo = it.mon ? Math.max(0, MON_TXT.indexOf(m.cell(it.mon[0], it.mon[1]))) : 0;
    const note = m.cell(it.note[0], it.note[1]);
    const lb = lastBy[id] || {};
    seats[id] = { s: s, m: mo, note: note, by: lb.by || '', at: lb.at || '' };
  });
  const ls = PropertiesService.getScriptProperties().getProperty('lastSave');
  return { ok: true, seats: seats, lastSave: ls ? JSON.parse(ls) : null, pinRequired: !!WRITE_PIN, resetEnabled: !!ADMIN_PIN };
}

/** ทุกบรรทัดในแท็บประวัติ (สำหรับ EXPORT TO EXCEL) วันเวลาส่งเป็น ISO */
function historyData_() {
  const log = SpreadsheetApp.getActive().getSheetByName(LOG_SHEET);
  const n = log.getLastRow();
  if (n < 2) return { ok: true, rows: [] };
  const rows = log.getRange(2, 1, n - 1, 7).getValues().map(function (r) {
    return r.map(function (v, j) { return (j === 0 && v instanceof Date) ? v.toISOString() : (v === null ? '' : String(v)); });
  });
  return { ok: true, rows: rows };
}

function saveData_(body) {
  if (WRITE_PIN && String(body.pin || '') !== WRITE_PIN) return { ok: false, error: 'pin' };
  const by = String(body.by || '').trim().slice(0, 60);
  if (!by) return { ok: false, error: 'no_name' };
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 500) : [];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(MAP_SHEET);
    const m = buildMap_(sh);
    const now = new Date();
    const logRows = [];
    let saved = 0;
    changes.forEach(function (ch) {
      const it = m.items[String(ch.id)];
      if (!it) return;
      let touched = false;
      const set = function (pos, field, newV) {
        const oldV = m.cell(pos[0], pos[1]);
        if (oldV === newV) return;
        sh.getRange(pos[0], pos[1]).setValue(newV);
        logRows.push([now, 'หน้าเว็บ', by, it.label, field, oldV, newV]);
        touched = true;
      };
      if (it.seat) set(it.seat, 'สภาพที่นั่ง', SEAT_TXT[clamp_(ch.s)]);
      if (it.mon) set(it.mon, 'สภาพ Monitor', MON_TXT[clamp_(ch.m)]);
      set(it.note, 'หมายเหตุ', String(ch.note || '').trim().slice(0, 500));
      if (touched) saved++;
    });
    appendLog_(ss, logRows);
    const lastSave = { by: by, at: now.toISOString(), n: saved };
    PropertiesService.getScriptProperties().setProperty('lastSave', JSON.stringify(lastSave));
    return { ok: true, saved: saved, at: now.toISOString(), lastSave: lastSave };
  } finally {
    lock.releaseLock();
  }
}

function resetData_(body) {
  if (!ADMIN_PIN) return { ok: false, error: 'reset_disabled' };
  if (String(body.adminPin || '') !== ADMIN_PIN) return { ok: false, error: 'admin_pin' };
  const by = String(body.by || '').trim().slice(0, 60) || '-';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(MAP_SHEET);
    const m = buildMap_(sh);
    Object.keys(m.items).forEach(function (id) {
      const it = m.items[id];
      if (it.seat) sh.getRange(it.seat[0], it.seat[1]).setValue(SEAT_TXT[0]);
      if (it.mon) sh.getRange(it.mon[0], it.mon[1]).setValue(MON_TXT[0]);
      sh.getRange(it.note[0], it.note[1]).setValue('');
    });
    const now = new Date();
    appendLog_(ss, [[now, 'หน้าเว็บ', by, 'ทั้งลำ', 'ล้างข้อมูลเริ่มรอบตรวจใหม่', '', 'ปกติทั้งหมด']]);
    const lastSave = { by: by, at: now.toISOString(), n: 0 };
    PropertiesService.getScriptProperties().setProperty('lastSave', JSON.stringify(lastSave));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function clamp_(x) { x = Number(x) | 0; return x < 0 ? 0 : (x > 2 ? 2 : x); }

function appendLog_(ss, rows) {
  if (!rows.length) return;
  const log = ss.getSheetByName(LOG_SHEET);
  const start = log.getLastRow() + 1;
  log.getRange(start, 1, rows.length, 7).setValues(rows);
  log.getRange(start, 1, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

// ---------- ประวัติเมื่อแก้ไขในชีทโดยตรง ----------
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== MAP_SHEET) return;

  const r0 = e.range.getRow(), c0 = e.range.getColumn();
  const nr = e.range.getNumRows(), nc = e.range.getNumColumns();
  if (r0 + nr - 1 < FIRST_MAP_ROW && !(r0 <= 3 && r0 + nr - 1 >= 3)) return;

  const colB = sh.getRange(1, 2, sh.getMaxRows(), 1).getDisplayValues().map(function (x) { return x[0]; });
  const values = e.range.getDisplayValues();
  const single = nr === 1 && nc === 1;
  const inspector = sh.getRange(INSPECTOR_CELL).getDisplayValue();
  let email = '';
  try { email = (e.user && e.user.getEmail()) || Session.getActiveUser().getEmail(); } catch (err) {}
  const now = new Date();

  const rows = [];
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const info = identify_(sh, colB, r0 + i, c0 + j);
      if (!info) continue;
      const oldV = single ? (e.oldValue === undefined ? '' : e.oldValue) : '(แก้หลายช่องพร้อมกัน)';
      const newV = single ? (e.value === undefined ? values[0][0] : e.value) : values[i][j];
      rows.push([now, email || '-', inspector || '-', info.id, info.field, oldV, newV]);
    }
  }
  appendLog_(e.source, rows);
}

/** หาว่าช่องที่แก้คือที่นั่ง/Monitor ไหน และเป็นช่องอะไร */
function identify_(sh, colB, r, c) {
  const a1 = sh.getRange(r, c).getA1Notation();
  if (r === 3) return { id: 'ส่วนหัว', field: c <= 10 ? 'ผู้ตรวจ' : 'วันที่ตรวจ' };
  if (r < FIRST_MAP_ROW) return null;
  if (c < 3 || c > 20) return { id: a1, field: 'อื่น ๆ' };

  const b = colB[r - 1] || '', bAbove = colB[r - 2] || '';
  if (b === 'Monitor' || (b === 'NOTE' && bAbove === 'Monitor')) {
    const monRow = b === 'Monitor' ? r : r - 1;
    const rowNo = colB[monRow + 2];
    const side = c <= 6 ? 'ซ้าย' : (c <= 15 ? 'กลาง' : 'ขวา');
    return { id: 'Monitor เพดาน หน้าแถว ' + rowNo + ' (' + side + ')', field: b === 'Monitor' ? 'สภาพ Monitor' : 'หมายเหตุ' };
  }
  let L;
  if (b === 'NOTE') {
    L = letterAt_(sh, r - 2, c);
    if (L) return { id: seatLabel_(colB, r - 2, L), field: 'หมายเหตุ' };
  }
  L = letterAt_(sh, r - 1, c);
  if (L) return { id: seatLabel_(colB, r - 1, L), field: 'สภาพที่นั่ง' };
  L = letterAt_(sh, r + 1, c);
  if (L) return { id: seatLabel_(colB, r + 1, L), field: 'สภาพ Monitor' };
  return { id: a1, field: 'อื่น ๆ' };
}

function letterAt_(sh, r, c) {
  if (r < 1) return '';
  const v = String(sh.getRange(r, c).getDisplayValue()).trim();
  return /^([A-K]|CC)$/.test(v) ? v : '';
}

function seatLabel_(colB, letterRow, letter) {
  return letter === 'CC' ? 'Commander Center' : String(colB[letterRow - 1]) + letter;
}
