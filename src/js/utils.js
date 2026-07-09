/* ── Pure utilities — no module imports ────────────────── */

export function localDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function todayStr() { return localDateStr(new Date()); }

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* Escape user-controlled strings before inserting into innerHTML.
   Prevents stored XSS via task titles, names, notes, etc. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function prettyDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(localDateStr(new Date(Date.now() - i * 86400000)));
  return days;
}

export function getLastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(localDateStr(new Date(Date.now() - i * 86400000)));
  return days;
}

export function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

export function setBar(id, val, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min((val / max) * 100, 100) + '%';
}

export function setBarPct(id, val, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min((val / (max || 1)) * 100, 100) + '%';
}

export function setScoreBar(barId, val, valId) {
  const bar = document.getElementById(barId);
  const valEl = document.getElementById(valId);
  if (bar) bar.style.width = val + '%';
  if (valEl) valEl.textContent = val + '/100';
}

export function setTextSafe(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

export function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
