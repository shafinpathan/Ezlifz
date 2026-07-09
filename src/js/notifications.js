import { state } from './state.js';
import { todayStr, esc } from './utils.js';

const notifQueue = [];
let notifActive = false;

export function pushNotif(type, title, msg, duration = 4500) {
  notifQueue.push({ type, title, msg, duration });
  if (!notifActive) drainNotifQueue();
}

function drainNotifQueue() {
  if (!notifQueue.length) { notifActive = false; return; }
  notifActive = true;
  const { type, title, msg, duration } = notifQueue.shift();
  showNotif(type, title, msg, duration);
  setTimeout(drainNotifQueue, duration + 600);
}

function showNotif(type, title, msg, duration = 4500) {
  const tray = document.getElementById('notifTray');
  const card = document.createElement('div');
  card.className = `notif-card notif-${type}`;
  const icons = { warning: '!', danger: '!', success: '✓', info: 'i' };
  card.innerHTML = `
    <span class="notif-icon">${icons[type] || 'i'}</span>
    <div class="notif-body">
      <div class="notif-title">${esc(title)}</div>
      <div class="notif-msg">${esc(msg)}</div>
    </div>
    <button class="notif-close">✕</button>`;
  tray.appendChild(card);
  card.querySelector('.notif-close').addEventListener('click', () => dismissNotif(card));
  setTimeout(() => dismissNotif(card), duration);
}

function dismissNotif(card) {
  if (!card.parentNode) return;
  card.classList.add('exiting');
  setTimeout(() => card.remove(), 350);
}

/* getSubjectStats injected from attendance.js via main.js to avoid circular deps */
let _getSubjectStats = null;
export function setNotifDeps(deps) {
  if (deps.getSubjectStats) _getSubjectStats = deps.getSubjectStats;
}

export function runStartupNotifications() {
  let critCount = 0, warnCount = 0;
  if (_getSubjectStats) {
    state.attendance.subjects.forEach(sub => {
      const st = _getSubjectStats(sub.id);
      const req = sub.requiredAttendance || 75;
      if (st.total < 3) return;
      if (st.pct < req) critCount++;
      else if (st.pct < 85) warnCount++;
    });
  }
  if (critCount > 0) setTimeout(() => pushNotif('danger', 'Attendance Alert', `${critCount} subject${critCount > 1 ? 's' : ''} below minimum attendance`), 1800);
  if (warnCount > 0) setTimeout(() => pushNotif('warning', 'Attendance Check', `${warnCount} subject${warnCount > 1 ? 's' : ''} approaching minimum`), 3400);

  const overdue = state.todo.tasks.filter(t => !t.completed && t.deadline && t.deadline < todayStr()).length;
  if (overdue > 0) setTimeout(() => pushNotif('warning', 'Overdue Tasks', `${overdue} task${overdue > 1 ? 's are' : ' is'} past deadline`), 5000);
}
