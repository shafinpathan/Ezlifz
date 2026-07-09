import { state, autoSave } from './state.js';
import { uid, todayStr, closeModal, showToast, esc } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { renderAttendance, openAddSubjectModal, openLogLectureModal } from './attendance.js';
import { renderTodo, openAddTaskModal, completeTask } from './todo.js';
import { renderWardrobe } from './wardrobe.js';
import { renderAIFeedback, setAIDeps } from './ai.js';
import { renderProgressCharts } from './progress.js';
import { renderSplitwise, openAddExpenseModal } from './splitwise.js';
import { renderNotes, createNewNote } from './notes.js';

export function initNav() {
  setAIDeps({ switchTab });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
  document.querySelectorAll('.bn-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
}

export function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(i => i.classList.remove('active'));

  const section = document.getElementById('tab-' + tab);
  if (section) section.classList.remove('hidden');

  document.querySelectorAll(`[data-tab="${tab}"]`).forEach(el => el.classList.add('active'));

  const moreTabIds = ['wardrobe','progress','ai','metrics','settings','notes'];
  if (moreTabIds.includes(tab)) {
    const moreBtn = document.getElementById('bnMoreBtn');
    if (moreBtn) moreBtn.classList.add('active');
  }
  closeModal('moreSheet');

  if (tab === 'progress')   { setTimeout(renderProgressCharts, 100); }
  if (tab === 'ai')         { renderAIFeedback(); }
  if (tab === 'dashboard')  { renderDashboard(); }
  if (tab === 'attendance') { renderAttendance(); }
  if (tab === 'todo')       { renderTodo(); }
  if (tab === 'wardrobe')   { renderWardrobe(); }
  if (tab === 'splitwise')  { renderSplitwise(); }
  if (tab === 'notes')      { renderNotes(); }
}

export function initFab() {
  document.getElementById('fabBtn').addEventListener('click', () => {
    const activeTab = document.querySelector('.nav-item.active, .bn-item.active');
    const tab = activeTab ? activeTab.dataset.tab : 'dashboard';

    if (tab === 'nutrition') { document.getElementById('addFoodCard').scrollIntoView({ behavior: 'smooth' }); }
    else if (tab === 'workout') { document.getElementById('exName').focus(); }
    else if (tab === 'attendance') { openLogLectureModal(); }
    else if (tab === 'todo') { openAddTaskModal(null); }
    else if (tab === 'metrics') { document.getElementById('mWeight').focus(); }
    else if (tab === 'splitwise') { openAddExpenseModal(null); }
    else if (tab === 'notes') { createNewNote(); }
    else {
      document.getElementById('cmdPalette').classList.remove('hidden');
      document.getElementById('cmdInput').focus();
      renderCmdResults('');
    }
  });
}

export function initMoreSheet() {
  const sheet = document.getElementById('moreSheet');
  const btn   = document.getElementById('bnMoreBtn');
  if (!sheet || !btn) return;

  btn.addEventListener('click', () => sheet.classList.remove('hidden'));
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.classList.add('hidden'); });

  sheet.querySelectorAll('.more-sheet-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
}

const CMD_ACTIONS = [
  { icon: '◈', label: 'Go to Dashboard',        tab: 'dashboard' },
  { icon: '▤', label: 'Go to Attendance',        tab: 'attendance' },
  { icon: '✦', label: 'Go to Tasks',             tab: 'todo' },
  { icon: '◉', label: 'Go to Nutrition',         tab: 'nutrition' },
  { icon: '◐', label: 'Go to Workout',           tab: 'workout' },
  { icon: '◑', label: 'Go to Progress',          tab: 'progress' },
  { icon: '◆', label: 'Go to AI Insight',        tab: 'ai' },
  { icon: '◎', label: 'Go to Body Metrics',      tab: 'metrics' },
  { icon: '◇', label: 'Go to Settings',          tab: 'settings' },
  { icon: '⇄', label: 'Go to Splitwise',          tab: 'splitwise' },
  { icon: '▣', label: 'Go to Notes',             tab: 'notes' },
  { icon: '+', label: 'New Note',                action: () => { document.getElementById('cmdPalette').classList.add('hidden'); switchTab('notes'); setTimeout(createNewNote, 200); }},
  { icon: '+', label: 'Add Subject',             action: () => { document.getElementById('cmdPalette').classList.add('hidden'); switchTab('attendance'); setTimeout(openAddSubjectModal, 200); }},
  { icon: '✦', label: 'Add Task',                action: () => { document.getElementById('cmdPalette').classList.add('hidden'); switchTab('todo'); setTimeout(() => openAddTaskModal(null), 200); }},
  { icon: '▤', label: 'Log Lecture (Present)',   action: () => { document.getElementById('cmdPalette').classList.add('hidden'); switchTab('attendance'); setTimeout(openLogLectureModal, 200); }},
];

export function initCommandPalette() {
  const overlay = document.getElementById('cmdPalette');
  const input   = document.getElementById('cmdInput');

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      overlay.classList.remove('hidden');
      input.value = '';
      input.focus();
      renderCmdResults('');
    }
    if (e.key === 'Escape') overlay.classList.add('hidden');
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  input.addEventListener('input', () => renderCmdResults(input.value.toLowerCase()));

  input.addEventListener('keydown', e => {
    const items = document.querySelectorAll('.cmd-item');
    const active = document.querySelector('.cmd-item.active');
    let idx = [...items].indexOf(active);
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); idx = Math.max(idx - 1, 0); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      items.forEach(i => i.classList.remove('active'));
      if (items[idx]) { items[idx].classList.add('active'); items[idx].scrollIntoView({ block: 'nearest' }); }
    }
    if (e.key === 'Enter' && active) active.click();
  });
}

function renderCmdResults(query) {
  const container = document.getElementById('cmdResults');

  const subjectActions = state.attendance.subjects.map(s => ({
    icon: '▤', label: `Log lecture — ${s.name}`,
    action: () => {
      document.getElementById('cmdPalette').classList.add('hidden');
      state.attendance.logs.push({ id: uid(), date: todayStr(), subjectId: s.id, status: 'present', lectureType: 'theory', notes: '' });
      autoSave();
      renderAttendance();
      showToast(`✓ Present logged for ${s.name}`);
    }
  }));

  const taskActions = state.todo.tasks.filter(t => !t.completed).slice(0, 5).map(t => ({
    icon: '✦', label: `Complete: ${t.title}`,
    action: () => {
      document.getElementById('cmdPalette').classList.add('hidden');
      completeTask(t.id);
    }
  }));

  const allActions = [...CMD_ACTIONS, ...subjectActions, ...taskActions];
  const filtered = query ? allActions.filter(a => a.label.toLowerCase().includes(query)) : allActions;

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-dim);font-size:.85rem">No results for "${esc(query)}"</div>`;
    return;
  }

  container.innerHTML = (query ? '' : '<div class="cmd-section">Navigation & Actions</div>') +
    filtered.map((a, i) => `
      <div class="cmd-item${i === 0 ? ' active' : ''}" data-idx="${i}">
        <span class="cmd-icon">${a.icon}</span>
        <span class="cmd-label">${esc(a.label)}</span>
        ${a.tab ? `<span class="cmd-hint">↵</span>` : ''}
      </div>`).join('');

  container.querySelectorAll('.cmd-item').forEach((el, idx) => {
    el.addEventListener('mouseenter', () => {
      container.querySelectorAll('.cmd-item').forEach(i => i.classList.remove('active'));
      el.classList.add('active');
    });
    el.addEventListener('click', () => {
      const a = filtered[idx];
      if (a.tab) { switchTab(a.tab); document.getElementById('cmdPalette').classList.add('hidden'); }
      else if (a.action) a.action();
    });
  });
}
