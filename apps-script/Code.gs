/**
 * Seat Plan 340 (For Admin) — Apps Script
 *
 * ทำ 2 อย่าง:
 *  1) เป็น API ให้หน้าเว็บ (GitHub Pages) อ่าน/บันทึกสภาพที่นั่งลงแท็บ "ผังที่นั่ง"
 *     สภาพ Galley และห้องน้ำลงแท็บ "Galley และห้องน้ำ"
 *     และบันทึกประวัติลงแท็บ "ประวัติการแก้ไข" ทุกครั้งที่กด SAVE บนเว็บ
 *  2) บันทึกประวัติอัตโนมัติเมื่อมีคนแก้ไขช่องในชีทโดยตรง (onEdit)
 *
 * ใครเข้าได้และทำอะไรได้ ตัดสินโดยระบบ Login กลางของ ฝูง.602 (repo eadmin) ทุกคำขอ ดูหัวข้อ "Login กลาง" ด้านล่าง
 * ไม่มีรหัสเปิดใช้งาน (WRITE_PIN) และรหัส Admin (ADMIN_PIN) แล้ว
 *
 * แท็บ "Galley และห้องน้ำ" ถูกสร้างเองครั้งแรกที่หน้าเว็บโหลดข้อมูล พร้อมค่าเริ่มต้น
 * (บันทึกประวัติในชื่อ EQ_SEED_BY) ถ้ามีแท็บนี้อยู่แล้วจะไม่เขียนทับ
 *
 * วิธีติดตั้ง: ดู README.md ใน repo
 */

// ---------- ตั้งค่า ----------
const MAP_SHEET = 'ผังที่นั่ง';
const LOG_SHEET = 'ประวัติการแก้ไข';
const FIRST_MAP_ROW = 17;      // แถวแรกของผังที่นั่ง
const INSPECTOR_CELL = 'D3';   // ช่องชื่อผู้ตรวจในชีท

// ---------- Login กลาง ----------
// LOGIN_URL: ที่อยู่ระบบหลังบ้านของระบบ Login (ค่าเดียวกับ backendUrl ในไฟล์ eadmin/docs/assets/config.js)
//            กรอกในหน้า Apps Script แล้ว Run setup ครั้งเดียว ระบบจำไว้เอง (ช่องนี้ว่างไว้ได้ในโค้ดบน GitHub)
// WEB_CODE:  รหัสเว็บนี้ในรายชื่อเว็บของหน้า Admin (ต้องตรงกับ webCode ในไฟล์ config.js)
const LOGIN = { LOGIN_URL: '', WEB_CODE: 'WEB2', CHECK_SEC: 60 };

const SEAT_TXT = ['ปกติ', 'ขัดข้อง-ใช้ได้', 'ใช้ไม่ได้'];
const MON_TXT = ['จอปกติ', 'จอเสื่อม', 'จอเสีย'];
const SIDE_TH = { L: 'ซ้าย', C: 'กลาง', R: 'ขวา' };

// ---------- Galley และห้องน้ำ ----------
const EQ_SHEET = 'Galley และห้องน้ำ';
const EQ_TXT = ['ใช้งานได้', 'ใช้งานได้บางส่วน', 'ใช้งานไม่ได้'];
const EQ_SEED_BY = 'ร.อ.ธัญชนิต จินตภากร';
// ค่าเริ่มต้นตอนสร้างแท็บ (รายการอื่น = ใช้งานได้): สภาพตามไฟล์ STATUS SEAT PLAN A340 (17 OCT 2026)
const EQ_SEED = {
  'G2A-ESP-1': [1, 'Filter ตัน หรือ o-ring เสื่อม'],
  'G7-CM-1': [2, 'INOP'],
  'LAV-L53': [1, 'ก็อกน้ำไหลไม่หยุด (The Water Faucet drips)'],
  'LAV-L73': [1, 'อ่างล้างมือตัน']
};
// [ID, ชื่อที่ใช้บนหน้าเว็บและในประวัติ, ตำแหน่ง] ตรงกับรายการบนหน้าเว็บ
const EQ_ITEMS = [
  ["G1L-STORE-1", "FWD GALLEY · G1L · Storage", "FWD GALLEY · G1L"],
  ["G1-STORE-1", "FWD GALLEY · G1 · Storage", "FWD GALLEY · G1"],
  ["G1-CHILLER-1", "FWD GALLEY · G1 · Chiller", "FWD GALLEY · G1"],
  ["G1R-STORE-1", "FWD GALLEY · G1R · Storage", "FWD GALLEY · G1R"],
  ["LAV-L16", "LAV L16", "ห้องน้ำ · FIRST CLASS"],
  ["G1A-BOILER-1", "FWD GALLEY · G1A · Boiler", "FWD GALLEY · G1A"],
  ["G1A-CM-1", "FWD GALLEY · G1A · Coffee Maker 1", "FWD GALLEY · G1A"],
  ["G1A-CM-2", "FWD GALLEY · G1A · Coffee Maker 2", "FWD GALLEY · G1A"],
  ["G1A-ESP-1", "FWD GALLEY · G1A · Espresso Machine", "FWD GALLEY · G1A"],
  ["G1A-OVEN-1", "FWD GALLEY · G1A · Oven 1", "FWD GALLEY · G1A"],
  ["G1A-OVEN-2", "FWD GALLEY · G1A · Oven 2", "FWD GALLEY · G1A"],
  ["G2L-CHILLER-1", "MID GALLEY · G2L · Chiller", "MID GALLEY · G2L"],
  ["G2L-STORE-1", "MID GALLEY · G2L · Storage", "MID GALLEY · G2L"],
  ["G2-CHILLER-1", "MID GALLEY · G2 · Chiller", "MID GALLEY · G2"],
  ["G2-OVEN-1", "MID GALLEY · G2 · Oven 1", "MID GALLEY · G2"],
  ["G2-OVEN-2", "MID GALLEY · G2 · Oven 2", "MID GALLEY · G2"],
  ["G2-STORE-1", "MID GALLEY · G2 · Storage", "MID GALLEY · G2"],
  ["G2R-CHILLER-1", "MID GALLEY · G2R · Chiller", "MID GALLEY · G2R"],
  ["G2R-STORE-1", "MID GALLEY · G2R · Storage", "MID GALLEY · G2R"],
  ["G2AL-STORE-1", "MID GALLEY · G2AL · Storage", "MID GALLEY · G2AL"],
  ["LAV-L35", "LAV L35", "ห้องน้ำ · BUSINESS CLASS"],
  ["G2A-CHILLER-1", "MID GALLEY · G2A · Chiller", "MID GALLEY · G2A"],
  ["G2A-BOILER-1", "MID GALLEY · G2A · Boiler", "MID GALLEY · G2A"],
  ["G2A-ESP-1", "MID GALLEY · G2A · Espresso Machine", "MID GALLEY · G2A"],
  ["G2A-CM-1", "MID GALLEY · G2A · Coffee Maker 1", "MID GALLEY · G2A"],
  ["G2A-CM-2", "MID GALLEY · G2A · Coffee Maker 2", "MID GALLEY · G2A"],
  ["G2A-OVEN-1", "MID GALLEY · G2A · Oven 1", "MID GALLEY · G2A"],
  ["G2A-OVEN-2", "MID GALLEY · G2A · Oven 2", "MID GALLEY · G2A"],
  ["G2A-MW-1", "MID GALLEY · G2A · Microwave", "MID GALLEY · G2A"],
  ["G2A-HOTCUP-1", "MID GALLEY · G2A · Hot Cup 1", "MID GALLEY · G2A"],
  ["G2A-HOTCUP-2", "MID GALLEY · G2A · Hot Cup 2", "MID GALLEY · G2A"],
  ["G2A-HOTCUP-3", "MID GALLEY · G2A · Hot Cup 3", "MID GALLEY · G2A"],
  ["G2AR-STORE-1", "MID GALLEY · G2AR · Storage", "MID GALLEY · G2AR"],
  ["LAV-L36", "LAV L36", "ห้องน้ำ · BUSINESS CLASS"],
  ["LAV-L53", "LAV L53", "ห้องน้ำ · PREMIUM ECONOMY"],
  ["LAV-L61", "LAV L61", "ห้องน้ำ · PREMIUM ECONOMY"],
  ["LAV-L62", "LAV L62", "ห้องน้ำ · PREMIUM ECONOMY"],
  ["LAV-L54", "LAV L54", "ห้องน้ำ · PREMIUM ECONOMY"],
  ["LAV-L73", "LAV L73", "ห้องน้ำ · ECONOMY"],
  ["G5-STORE-1", "AFT GALLEY · G5 · Storage", "AFT GALLEY · G5"],
  ["LAV-L74", "LAV L74", "ห้องน้ำ · ECONOMY"],
  ["G6-CHILLER-1", "AFT GALLEY · G6 · Chiller", "AFT GALLEY · G6"],
  ["G6-STORE-1", "AFT GALLEY · G6 · Storage", "AFT GALLEY · G6"],
  ["G7-BOILER-1", "AFT GALLEY · G7 · Boiler", "AFT GALLEY · G7"],
  ["G7-CM-1", "AFT GALLEY · G7 · Coffee Maker 1", "AFT GALLEY · G7"],
  ["G7-CM-2", "AFT GALLEY · G7 · Coffee Maker 2", "AFT GALLEY · G7"],
  ["G7-CM-3", "AFT GALLEY · G7 · Coffee Maker 3", "AFT GALLEY · G7"],
  ["G7-OVEN-1", "AFT GALLEY · G7 · Oven 1", "AFT GALLEY · G7"],
  ["G7-OVEN-2", "AFT GALLEY · G7 · Oven 2", "AFT GALLEY · G7"],
  ["G7-OVEN-3", "AFT GALLEY · G7 · Oven 3", "AFT GALLEY · G7"],
  ["G7-OVEN-4", "AFT GALLEY · G7 · Oven 4", "AFT GALLEY · G7"],
  ["G7-OVEN-5", "AFT GALLEY · G7 · Oven 5", "AFT GALLEY · G7"],
  ["G7-OVEN-6", "AFT GALLEY · G7 · Oven 6", "AFT GALLEY · G7"],
  ["G7-HOTCUP-1", "AFT GALLEY · G7 · Hot Cup 1", "AFT GALLEY · G7"],
  ["G7-HOTCUP-2", "AFT GALLEY · G7 · Hot Cup 2", "AFT GALLEY · G7"],
  ["G7-HOTCUP-3", "AFT GALLEY · G7 · Hot Cup 3", "AFT GALLEY · G7"]
];

// ---------- Web API ----------
// Every request needs a login (Login กลาง): nothing is read or written without one
function doGet(e) {
  return json_({ ok: true, app: 'a340_seatplan' });
}

// Editor and Admin only: these write the sheet, or give a file out (EXPORT TO EXCEL reads the whole history)
const EDIT = { save: 1, reset: 1, history: 1, exported: 1 };
// these ask the login system afresh, not from the copy kept for LOGIN.CHECK_SEC
const FRESH = { save: 1, reset: 1, history: 1, exported: 1 };
const EXPORTS = ['EXPORT TO PDF ALL PAGES', 'EXPORT PDF SUMMARY 4 PAGES', 'EXPORT TO EXCEL'];

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  try {
    const act = String(body.action || '');
    if (['load', 'history', 'save', 'reset', 'exported'].indexOf(act) < 0) return json_({ ok: false, error: 'unknown_action' });
    const who = auth_(body.pass, !!FRESH[act]);
    if (EDIT[act] && !who.edit) return json_({ ok: false, error: 'forbidden', message: 'บัญชีนี้มีสิทธิ์ดูอย่างเดียว (Viewer)' });
    if (act === 'load') return json_(Object.assign(loadData_(who), { me: { name: who.name, role: who.role } }));
    if (act === 'history') return json_(historyData_());
    if (act === 'save') return json_(saveData_(body, who));
    if (act === 'reset') return json_(resetData_(body, who));
    if (act === 'exported') return json_(exported_(body, who));
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.code, message: err.message });
    return json_({ ok: false, error: 'server', message: String(err) });
  }
}

/** EXPORT TO PDF / EXCEL on the page: one line in the history, with the name of the account */
function exported_(body, who) {
  const kind = String(body.kind || '');
  if (EXPORTS.indexOf(kind) < 0) return { ok: false, error: 'bad_request' };
  const ss = SpreadsheetApp.getActive();
  appendLog_(ss, [[new Date(), 'หน้าเว็บ', who.name, 'EXPORT', kind, '', String(body.filename || '').slice(0, 120)]]);
  return { ok: true };
}

/* ---------- Login กลาง (ระบบ Login ฝูง.602) ----------
   The page gets a pass for this web from the login system (App.enterWeb) and sends it with every request; this script
   sends it on to the login system (op web.check) with the code of this web, and gets back the person and the Role in
   this web: Admin / Editor write, Viewer looks only, Admin also clears all data. No access, the web closed, the hour
   over, the password changed, the account taken by another device: refused, every time. The pass is good for that
   question about this web only. An answer is kept for LOGIN.CHECK_SEC for reading only; every write asks afresh.
   Only a mark of the pass is kept here, never the pass itself. */
function err_(code, message) { const e = new Error(message); e.code = code; return e; }
function sha256_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function loginUrl_() { return String(PropertiesService.getScriptProperties().getProperty('LOGIN_URL') || LOGIN.LOGIN_URL || '').trim(); }
// the address of a deployed Apps Script web app, nothing else: the pass is only ever sent there
function loginUrlOk_(url) { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url); }
function auth_(pass, fresh) {
  pass = String(pass || '');
  if (!pass || pass.length > 800) throw err_('auth', 'ให้เข้าสู่ระบบ');
  let w = '';
  try { w = String(JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(pass.split('.')[0])).getDataAsString()).w || ''); } catch (x) { w = ''; }
  if (w && w !== LOGIN.WEB_CODE) throw err_('wrong_web', 'รหัสเว็บในไฟล์ config.js (' + w + ') ไม่ตรงกับ LOGIN.WEB_CODE ใน Apps Script (' + LOGIN.WEB_CODE + ') ให้แก้ให้ตรงกัน');
  const key = sha256_('a340|' + pass).slice(0, 32), cache = CacheService.getScriptCache();
  if (!fresh) { const hit = cache.get('who:' + key); if (hit) return JSON.parse(hit); }
  const url = loginUrl_();
  if (!loginUrlOk_(url)) throw err_('config', 'ยังไม่ได้ตั้งที่อยู่ระบบ Login (LOGIN.LOGIN_URL แล้ว Run setup)');
  let j = null;
  try {
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify({ v: 1, op: 'web.check', pass: pass, web: LOGIN.WEB_CODE }), muteHttpExceptions: true, followRedirects: true });
    j = JSON.parse(res.getContentText());
  } catch (x) { j = null; }
  if (!j || (!j.ok && !j.error)) throw err_('busy', 'ตรวจสิทธิ์กับระบบ Login ไม่ได้ ลองอีกครั้ง');
  if (!j.ok) {
    cache.remove('who:' + key);
    const c = String(j.error.code || '');
    if (c === 'auth' || c === 'expired' || c === 'taken') throw err_('auth', String(j.error.message || 'ให้เข้าสู่ระบบใหม่'));
    if (c === 'no_web' || c === 'web_closed') throw err_(c, String(j.error.message || 'บัญชีนี้ไม่มีสิทธิ์ใช้งานเว็บนี้ ให้ติดต่อ Admin'));
    throw err_('busy', String(j.error.message || 'ระบบ Login ขัดข้อง ลองอีกครั้ง'));
  }
  const u = j.user || {}, role = String(j.role || '');
  // the recorder: column "ชื่อ-สกุล" of the account's row in LOGIN DATABASE (Username as fallback)
  const who = { key: key, name: String(u.name || u.username || '').trim().slice(0, 60), role: role, edit: role === 'Admin' || role === 'Editor', admin: role === 'Admin' };
  const left = Math.floor((Number(j.expiresAt) - Date.now()) / 1000);
  if (left > 1) cache.put('who:' + key, JSON.stringify(who), Math.min(LOGIN.CHECK_SEC, left));
  return who;
}

/** รันครั้งเดียวหลังวางโค้ด: จำที่อยู่ระบบ Login และตรวจว่าติดต่อได้ (Google จะขอสิทธิ์เชื่อมต่อบริการภายนอก) */
function setup() {
  const p = PropertiesService.getScriptProperties();
  const url = String(LOGIN.LOGIN_URL || '').trim();
  if (url) {
    if (!loginUrlOk_(url)) throw new Error('LOGIN.LOGIN_URL ต้องเป็นที่อยู่ Web app ของระบบ Login (ขึ้นต้น https://script.google.com/macros/s/ ลงท้าย /exec)');
    p.setProperty('LOGIN_URL', url);
  }
  if (!loginUrl_()) throw new Error('ยังไม่ได้กรอก LOGIN.LOGIN_URL (ที่อยู่ระบบหลังบ้านของระบบ Login) กรอกแล้ว Run setup อีกครั้ง');
  let ok = false;
  try { ok = JSON.parse(UrlFetchApp.fetch(loginUrl_(), { muteHttpExceptions: true, followRedirects: true }).getContentText()).service === 'eadmin602'; } catch (x) { ok = false; }
  if (!ok) throw new Error('ติดต่อระบบ Login ที่ ' + loginUrl_() + ' ไม่ได้ ตรวจ LOGIN.LOGIN_URL แล้ว Run setup อีกครั้ง');
  Logger.log('ระบบ Login ตอบแล้ว · รหัสเว็บนี้ ' + LOGIN.WEB_CODE + ' (ต้องตรงกับรายชื่อเว็บในหน้า Admin)');
  Logger.log('ตั้งค่าเสร็จแล้ว');
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

function loadData_(who) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(MAP_SHEET);
  const m = buildMap_(sh);
  const byLabel = {};
  Object.keys(m.items).forEach(function (id) { byLabel[m.items[id].label] = id; });

  // ผู้แก้ไข/เวลาล่าสุดของแต่ละที่นั่ง จากแท็บประวัติ
  const lastBy = {}, lastByLabel = {};
  const log = ss.getSheetByName(LOG_SHEET);
  const n = log.getLastRow();
  if (n > 1) {
    const rows = log.getRange(2, 1, n - 1, 4).getValues();
    rows.forEach(function (row) {
      const at = row[0] instanceof Date ? row[0].toISOString() : '';
      const who = (row[2] && row[2] !== '-') ? String(row[2]) : String(row[1] || '');
      lastByLabel[String(row[3])] = { by: who, at: at };
      const id = byLabel[String(row[3])];
      if (id) lastBy[id] = { by: who, at: at };
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
  const eq = eqMap_(ss);
  Object.keys(eq.items).forEach(function (id) {
    const it = eq.items[id], lb = lastByLabel[it.label] || {};
    seats[id] = { s: it.s, m: 0, note: it.note, by: lb.by || '', at: lb.at || '' };
  });
  const ls = PropertiesService.getScriptProperties().getProperty('lastSave');
  return { ok: true, seats: seats, lastSave: ls ? JSON.parse(ls) : null, pinRequired: false, resetEnabled: !!(who && who.admin), equip: true };
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

/**
 * SAVE จากหน้าเว็บ
 * แต่ละรายการ: { id, s, m, note, fields: ['s','m','note'] ที่แก้จริง, base: {s, m, note} ค่าตอนเริ่มแก้ }
 * - เขียนเฉพาะช่องใน fields ช่องที่ไม่ได้แก้จะไม่ถูกแตะ (กันทับค่าที่คนอื่นเพิ่งบันทึก)
 * - ถ้าค่าในชีทตอนนี้ไม่ตรงกับ base และไม่ตรงกับค่าใหม่ = มีคนแก้ช่องเดียวกันไปก่อน
 *   จะไม่บันทึกช่องนั้น แต่ส่งกลับใน conflicts ให้หน้าเว็บถามผู้ใช้
 * - รายการที่ไม่มี fields (หน้าเว็บรุ่นเก่า) จะเขียนทั้ง 3 ช่องแบบเดิม
 */
function saveData_(body, who) {
  const by = who.name;                      // the account confirmed by the login system, never a name the page sends
  if (!by) return { ok: false, error: 'no_name' };
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 500) : [];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(MAP_SHEET);
    const m = buildMap_(sh);
    const eq = eqMap_(ss, true);
    const now = new Date();
    const logRows = [];
    const conflicts = [];
    const current = {};
    let saved = 0;
    let logCache = null;

    // ผู้แก้ล่าสุดของช่องนี้ จากแท็บประวัติ (อ่านเฉพาะเมื่อมีการชน)
    const lastEdit = function (label, fieldTh) {
      if (!logCache) {
        const log = ss.getSheetByName(LOG_SHEET);
        const n = log.getLastRow();
        logCache = n > 1 ? log.getRange(2, 1, n - 1, 5).getValues() : [];
      }
      for (let i = logCache.length - 1; i >= 0; i--) {
        const r = logCache[i];
        if (String(r[3]) === label && String(r[4]) === fieldTh) {
          return { by: (r[2] && r[2] !== '-') ? String(r[2]) : String(r[1] || ''), at: r[0] instanceof Date ? r[0].toISOString() : '' };
        }
      }
      return { by: '', at: '' };
    };

    changes.forEach(function (ch) {
      const id = String(ch.id);
      const fields = Array.isArray(ch.fields) ? ch.fields : ['s', 'm', 'note'];
      const base = ch.base && typeof ch.base === 'object' ? ch.base : null;
      let label, cur, spec;
      if (m.items[id]) {
        const it = m.items[id];
        label = it.label;
        const at_ = function (p) { return { get: function () { return m.cell(p[0], p[1]); }, set: function (v) { sh.getRange(p[0], p[1]).setValue(v); } }; };
        cur = {
          s: it.seat ? Math.max(0, SEAT_TXT.indexOf(m.cell(it.seat[0], it.seat[1]))) : 0,
          m: it.mon ? Math.max(0, MON_TXT.indexOf(m.cell(it.mon[0], it.mon[1]))) : 0,
          note: m.cell(it.note[0], it.note[1])
        };
        spec = {
          s: it.seat ? { cell: at_(it.seat), th: 'สภาพที่นั่ง', val: clamp_(ch.s), txt: function (x) { return SEAT_TXT[x]; } } : null,
          m: it.mon ? { cell: at_(it.mon), th: 'สภาพ Monitor', val: clamp_(ch.m), txt: function (x) { return MON_TXT[x]; } } : null,
          note: { cell: at_(it.note), th: 'หมายเหตุ', val: String(ch.note || '').trim().slice(0, 500), txt: function (x) { return x; } }
        };
      } else if (eq.items[id]) {
        const it = eq.items[id];
        label = it.label;
        const at_ = function (col) { return { get: function () { return String(eq.sheet.getRange(it.row, col).getDisplayValue()).trim(); }, set: function (v) { eq.sheet.getRange(it.row, col).setValue(v); } }; };
        cur = { s: it.s, m: 0, note: it.note };
        spec = {
          s: { cell: at_(4), th: 'สภาพ', val: clamp_(ch.s), txt: function (x) { return EQ_TXT[x]; } },
          m: null,
          note: { cell: at_(5), th: 'หมายเหตุ', val: String(ch.note || '').trim().slice(0, 500), txt: function (x) { return x; } }
        };
      } else {
        return;
      }
      let touched = false;
      ['s', 'm', 'note'].forEach(function (f) {
        const sp = spec[f];
        if (!sp || fields.indexOf(f) < 0) return;
        if (cur[f] === sp.val) return;
        if (base && f in base) {
          const b = f === 'note' ? String(base[f] || '').trim() : clamp_(base[f]);
          if (cur[f] !== b) {
            const le = lastEdit(label, sp.th);
            conflicts.push({ id: id, label: label, field: f, cur: cur[f], mine: sp.val, by: le.by, at: le.at });
            return;
          }
        }
        const oldV = sp.cell.get();
        const newV = sp.txt(sp.val);
        sp.cell.set(newV);
        logRows.push([now, 'หน้าเว็บ', by, label, sp.th, oldV, newV]);
        cur[f] = sp.val;
        touched = true;
      });
      current[id] = cur;
      if (touched) saved++;
    });
    appendLog_(ss, logRows);
    const props = PropertiesService.getScriptProperties();
    let lastSave;
    if (saved) {
      lastSave = { by: by, at: now.toISOString(), n: saved };
      props.setProperty('lastSave', JSON.stringify(lastSave));
    } else {
      const ls = props.getProperty('lastSave');
      lastSave = ls ? JSON.parse(ls) : null;
    }
    return { ok: true, saved: saved, at: now.toISOString(), lastSave: lastSave, conflicts: conflicts, current: current, equip: true };
  } finally {
    lock.releaseLock();
  }
}

function resetData_(body, who) {
  if (!who.admin) return { ok: false, error: 'forbidden', message: 'ล้างข้อมูลทั้งหมดได้เฉพาะ Admin ของเว็บนี้' };
  const by = who.name || '-';
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
    const eq = eqMap_(ss, true);
    Object.keys(eq.items).forEach(function (id) {
      const it = eq.items[id];
      eq.sheet.getRange(it.row, 4, 1, 2).setValues([[EQ_TXT[0], '']]);
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
  if (sh.getName() === EQ_SHEET) { onEditEq_(e); return; }
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

// ---------- Galley และห้องน้ำ ----------
/** อ่านแท็บ Galley และห้องน้ำ (สร้างพร้อมค่าเริ่มต้นถ้ายังไม่มี) */
function eqMap_(ss, locked) {
  const sheet = ensureEqSheet_(ss, locked);
  const n = sheet.getLastRow();
  const items = {};
  if (n > 1) {
    sheet.getRange(2, 1, n - 1, 5).getDisplayValues().forEach(function (r, i) {
      const id = String(r[0]).trim();
      if (!id) return;
      items[id] = { row: i + 2, label: String(r[1]).trim(), s: Math.max(0, EQ_TXT.indexOf(String(r[3]).trim())), note: String(r[4]).trim() };
    });
  }
  return { sheet: sheet, items: items };
}

function ensureEqSheet_(ss, locked) {
  let sheet = ss.getSheetByName(EQ_SHEET);
  if (sheet) return sheet;
  // save/reset ถือ lock อยู่แล้ว (locked = true) ไม่ต้องขอซ้ำ
  const lock = locked ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(20000);
  try {
    sheet = ss.getSheetByName(EQ_SHEET);   // อาจมีคนสร้างไปแล้วระหว่างรอ
    if (sheet) return sheet;
    const log = ss.getSheetByName(LOG_SHEET);
    sheet = ss.insertSheet(EQ_SHEET, log ? log.getIndex() - 1 : ss.getNumSheets());
    const rows = EQ_ITEMS.map(function (x) {
      const sd = EQ_SEED[x[0]] || [0, ''];
      return [x[0], x[1], x[2], EQ_TXT[sd[0]], sd[1]];
    });
    sheet.getRange(1, 1, 1, 5).setValues([['ID', 'รายการ', 'ตำแหน่ง', 'สภาพ', 'หมายเหตุ']])
      .setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff').setHorizontalAlignment('center');
    sheet.getRange(2, 1, rows.length, 5).setValues(rows).setVerticalAlignment('middle');
    sheet.getRange(2, 4, rows.length, 1).setHorizontalAlignment('center')
      .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(EQ_TXT, true).setAllowInvalid(false).build());
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 1, 130); sheet.setColumnWidths(2, 1, 300); sheet.setColumnWidths(3, 1, 190);
    sheet.setColumnWidths(4, 1, 140); sheet.setColumnWidths(5, 1, 360);
    sheet.getRange(2, 1, rows.length, 1).setFontColor('#6b7a88');
    const rng = sheet.getRange(2, 4, rows.length, 1);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(EQ_TXT[0]).setBackground('#d5efdd').setRanges([rng]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(EQ_TXT[1]).setBackground('#fdf0c4').setRanges([rng]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(EQ_TXT[2]).setBackground('#fbdad7').setRanges([rng]).build()
    ]);
    // ประวัติค่าเริ่มต้น: ทุกรายการหนึ่งบรรทัด และหมายเหตุอีกบรรทัดถ้ามี
    const now = new Date();
    const logRows = [];
    rows.forEach(function (r) {
      logRows.push([now, 'ค่าเริ่มต้น', EQ_SEED_BY, r[1], 'สภาพ', '', r[3]]);
      if (r[4]) logRows.push([now, 'ค่าเริ่มต้น', EQ_SEED_BY, r[1], 'หมายเหตุ', '', r[4]]);
    });
    appendLog_(ss, logRows);
    SpreadsheetApp.flush();
    return sheet;
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** แก้แท็บ Galley และห้องน้ำในชีทโดยตรง: บันทึกประวัติเฉพาะคอลัมน์สภาพ/หมายเหตุ */
function onEditEq_(e) {
  const sh = e.range.getSheet();
  const r0 = e.range.getRow(), c0 = e.range.getColumn();
  const nr = e.range.getNumRows(), nc = e.range.getNumColumns();
  const values = e.range.getDisplayValues();
  const single = nr === 1 && nc === 1;
  const map = e.source.getSheetByName(MAP_SHEET);
  const inspector = map ? map.getRange(INSPECTOR_CELL).getDisplayValue() : '';
  let email = '';
  try { email = (e.user && e.user.getEmail()) || Session.getActiveUser().getEmail(); } catch (err) {}
  const now = new Date();
  const rows = [];
  for (let i = 0; i < nr; i++) {
    const r = r0 + i;
    if (r < 2) continue;
    const label = String(sh.getRange(r, 2).getDisplayValue()).trim();
    if (!label) continue;
    for (let j = 0; j < nc; j++) {
      const c = c0 + j;
      if (c !== 4 && c !== 5) continue;
      const oldV = single ? (e.oldValue === undefined ? '' : e.oldValue) : '(แก้หลายช่องพร้อมกัน)';
      const newV = single ? (e.value === undefined ? values[0][0] : e.value) : values[i][j];
      rows.push([now, email || '-', inspector || '-', label, c === 4 ? 'สภาพ' : 'หมายเหตุ', oldV, newV]);
    }
  }
  appendLog_(e.source, rows);
}
