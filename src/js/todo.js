import { state, autoSave } from './state.js';
import { uid, todayStr, formatDate, showToast, setTextSafe, closeModal, esc } from './utils.js';
import { pushNotif } from './notifications.js';

let editingTaskId = null;
const _expandedCols = new Set(); // persist expand state across re-renders

export function initTodo() {
  document.getElementById('openAddTaskBtn').addEventListener('click', () => openAddTaskModal(null));
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
  document.getElementById('cancelTaskBtn').addEventListener('click', () => closeModal('addTaskModal'));
  document.getElementById('todoSearch').addEventListener('input', () => renderTodo());
  document.getElementById('todoFilterPriority').addEventListener('change', () => renderTodo());

  document.querySelectorAll('.task-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      document.getElementById('kanbanBoard').classList.toggle('hidden', view !== 'kanban');
      document.getElementById('taskListView').classList.toggle('hidden', view !== 'list');
    });
  });

  document.querySelectorAll('.kanban-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openAddTaskModal(null);
      document.getElementById('taskStatus').value = btn.dataset.status;
    });
  });

  document.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const dragging = document.querySelector('.task-card.dragging');
      if (!dragging) return;
      moveTask(dragging.dataset.id, col.dataset.status);
    });
  });

  renderTodo();
}

export function openAddTaskModal(taskId = null) {
  editingTaskId = taskId;
  const isEdit = !!taskId;
  document.getElementById('taskModalTitle').textContent = isEdit ? 'Edit Task' : 'Add Task';

  if (isEdit) {
    const task = state.todo.tasks.find(t => t.id === taskId);
    if (!task) return;
    document.getElementById('taskTitle').value       = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskPriority').value    = task.priority;
    document.getElementById('taskStatus').value      = task.status === 'completed' ? 'backlog' : task.status;
    document.getElementById('taskTags').value        = (task.tags || []).join(', ');
    document.getElementById('taskDeadline').value    = task.deadline || '';
  } else {
    ['taskTitle','taskDescription','taskTags','taskDeadline'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskStatus').value   = 'today';
  }

  document.getElementById('addTaskModal').classList.remove('hidden');
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { showToast('Enter a task title'); return; }

  const priority = document.getElementById('taskPriority').value;
  const task = {
    id: editingTaskId || uid(),
    title,
    description: document.getElementById('taskDescription').value.trim(),
    priority,
    status: document.getElementById('taskStatus').value,
    tags: document.getElementById('taskTags').value.split(',').map(t => t.trim()).filter(Boolean),
    deadline: document.getElementById('taskDeadline').value,
    completed: false,
    createdAt: new Date().toISOString(),
    xp: priority === 'high' ? 30 : priority === 'medium' ? 20 : 10
  };
  task.completed = task.status === 'completed';

  if (editingTaskId) {
    const idx = state.todo.tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) { task.createdAt = state.todo.tasks[idx].createdAt; state.todo.tasks[idx] = task; }
  } else {
    state.todo.tasks.push(task);
  }

  autoSave();
  closeModal('addTaskModal');
  renderTodo();
  showToast(editingTaskId ? 'Task updated' : `Task added (+${task.xp} XP)`);
  editingTaskId = null;
}

export function completeTask(id) {
  const task = state.todo.tasks.find(t => t.id === id);
  if (!task || task.completed) return;
  task.completed = true;
  task.status = 'completed';
  state.todo.totalXp = (state.todo.totalXp || 0) + (task.xp || 20);
  autoSave();
  renderTodo();
  showToast(`Done. +${task.xp || 20} XP`);
  pushNotif('success', 'Task Complete', `"${task.title}" — +${task.xp} XP earned`);
}

function deleteTask(id) {
  state.todo.tasks = state.todo.tasks.filter(t => t.id !== id);
  autoSave();
  renderTodo();
  showToast('Task deleted');
}

export function moveTask(id, status) {
  const task = state.todo.tasks.find(t => t.id === id);
  if (task) { task.status = status; task.completed = status === 'completed'; }
  autoSave();
  renderTodo();
}

export function renderTodo() {
  // Sync kanban column headers from user-defined names
  (state.custom?.taskColumns || []).forEach(col => {
    const wrap   = document.getElementById('col-' + col.id)?.closest('.kanban-col-wrap');
    const titleEl = wrap?.querySelector('.kcol-title');
    const dotEl   = wrap?.querySelector('.kcol-dot');
    if (titleEl) titleEl.textContent = col.name;
    if (dotEl && col.color) dotEl.style.background = col.color;
  });

  const statuses = ['backlog', 'today', 'in-progress', 'completed'];
  let tasks = state.todo.tasks;

  const searchVal = (document.getElementById('todoSearch')?.value || '').toLowerCase();
  const priorityVal = document.getElementById('todoFilterPriority')?.value || '';

  if (searchVal) tasks = tasks.filter(t => t.title.toLowerCase().includes(searchVal) || (t.tags || []).some(tag => tag.toLowerCase().includes(searchVal)));
  if (priorityVal) tasks = tasks.filter(t => t.priority === priorityVal);

  const today = todayStr();

  statuses.forEach(status => {
    const col = document.getElementById('col-' + status);
    if (!col) return;
    const colTasks = tasks.filter(t => t.status === status);
    col.dataset.status = status;

    if (!colTasks.length) {
      col.innerHTML = `<div class="empty-state-sm" style="font-size:.78rem;padding:1.25rem 0;text-align:center">No tasks here</div>`;
      return;
    }

    const renderCard = task => {
      const isOverdue = task.deadline && task.deadline < today && !task.completed;
      const tagsHtml = (task.tags || []).map(t => `<span class="task-tag">${esc(t)}</span>`).join('');
      const deadlineHtml = task.deadline
        ? `<span class="task-deadline${isOverdue ? ' overdue' : ''}">${isOverdue ? 'Overdue · ' : ''}${formatDate(task.deadline)}</span>`
        : '';
      const moveOptions = statuses.filter(s => s !== status)
        .map(s => `<button class="task-btn" data-move="${s}" data-id="${task.id}">${s === 'today' ? 'Today' : s === 'in-progress' ? '▶ Start' : s === 'completed' ? '✓ Done' : '↩ Backlog'}</button>`)
        .join('');
      return `
        <div class="task-card priority-${task.priority}${task.completed ? ' completed-card' : ''}" data-id="${task.id}" draggable="true">
          <div class="task-card-title">${esc(task.title)}</div>
          ${task.description ? `<div class="task-card-desc">${esc(task.description)}</div>` : ''}
          <div class="task-card-meta">${tagsHtml}${deadlineHtml}</div>
          <div class="task-actions">
            ${!task.completed ? `<button class="task-btn complete" data-complete="${task.id}">✓ Done</button>` : ''}
            <button class="task-btn" data-edit="${task.id}">✎</button>
            ${moveOptions}
            <button class="task-btn" data-delete="${task.id}" style="margin-left:auto;color:var(--danger);border-color:rgba(255,59,48,0.25)">✕</button>
          </div>
        </div>`;
    };

    const [first, ...extras] = colTasks;
    const extraId = `col-extra-${status}`;
    const isExpanded = _expandedCols.has(status);

    col.innerHTML = renderCard(first) + (extras.length ? `
      <div class="col-expand-group">
        <div class="col-extra-tasks${isExpanded ? ' is-open' : ''}"
             id="${extraId}"
             style="${isExpanded ? 'max-height:none' : ''}"
             aria-hidden="${!isExpanded}">
          ${extras.map(renderCard).join('')}
        </div>
        <button class="col-expand-btn${isExpanded ? ' is-open' : ''}"
                data-target="${extraId}"
                data-count="${extras.length}"
                data-status="${status}"
                aria-expanded="${isExpanded}"
                aria-controls="${extraId}">
          <span class="col-expand-chevron${isExpanded ? ' up' : ''}">▾</span>
          ${isExpanded ? 'Show Less' : `Show ${extras.length} more`}
        </button>
      </div>
    ` : '');

    col.querySelectorAll('[data-complete]').forEach(btn => btn.addEventListener('click', () => completeTask(btn.dataset.complete)));
    col.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteTask(btn.dataset.delete)));
    col.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openAddTaskModal(btn.dataset.edit)));
    col.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => moveTask(btn.dataset.id, btn.dataset.move)));

    col.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', () => card.classList.add('dragging'));
      card.addEventListener('dragend',   () => card.classList.remove('dragging'));
    });

    col.querySelectorAll('.col-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const extra = document.getElementById(btn.dataset.target);
        const colStatus = btn.dataset.status;
        const count = btn.dataset.count;
        const open = extra.classList.contains('is-open');
        const chevron = btn.querySelector('.col-expand-chevron');

        if (open) {
          _expandedCols.delete(colStatus);
          extra.style.maxHeight = extra.scrollHeight + 'px';
          extra.offsetHeight; // force reflow
          requestAnimationFrame(() => { extra.style.maxHeight = '0'; });
          extra.classList.remove('is-open');
          extra.setAttribute('aria-hidden', 'true');
          btn.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          if (chevron) chevron.classList.remove('up');
          btn.innerHTML = `<span class="col-expand-chevron">▾</span> Show ${count} more`;
        } else {
          _expandedCols.add(colStatus);
          extra.classList.add('is-open');
          extra.removeAttribute('aria-hidden');
          extra.style.maxHeight = extra.scrollHeight + 'px';
          extra.addEventListener('transitionend', () => {
            if (extra.classList.contains('is-open')) extra.style.maxHeight = 'none';
          }, { once: true });
          btn.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          btn.innerHTML = `<span class="col-expand-chevron up">▾</span> Show Less`;
        }
      });
    });
  });

  setTextSafe('countBacklog',    tasks.filter(t => t.status === 'backlog').length);
  setTextSafe('countToday',      tasks.filter(t => t.status === 'today').length);
  setTextSafe('countInProgress', tasks.filter(t => t.status === 'in-progress').length);
  setTextSafe('countCompleted',  tasks.filter(t => t.status === 'completed').length);

  const all = state.todo.tasks;
  setTextSafe('tssTotal', all.length);
  setTextSafe('tssToday', all.filter(t => t.status === 'today').length);
  setTextSafe('tssInProgress', all.filter(t => t.status === 'in-progress').length);
  setTextSafe('tssDone', all.filter(t => t.completed).length);
  setTextSafe('tssOverdue', all.filter(t => t.deadline && t.deadline < today && !t.completed).length);

  const pending = tasks.filter(t => !t.completed).length;
  const pendingEl = document.getElementById('todoPendingCount');
  if (pendingEl) pendingEl.textContent = `${pending} pending task${pending !== 1 ? 's' : ''}`;

  renderTaskListView(tasks, today);
  renderXpBar();
}

function renderTaskListView(tasks, today) {
  const container = document.getElementById('taskListContainer');
  if (!container) return;

  const sections = [
    { key: 'today',     title: 'Today',       filterFn: t => !t.completed && (t.status === 'today' || t.deadline === today) },
    { key: 'upcoming',  title: 'Upcoming',    filterFn: t => !t.completed && t.deadline && t.deadline > today },
    { key: 'other',     title: 'Other',       filterFn: t => !t.completed && t.status !== 'today' && t.status !== 'completed' && !(t.deadline === today) && !(t.deadline && t.deadline > today) },
    { key: 'completed', title: '✓ Completed', filterFn: t => t.completed }
  ];

  container.innerHTML = sections.map(sec => {
    const items = tasks.filter(sec.filterFn);
    if (!items.length) return '';
    return `
      <div class="task-list-section">
        <div class="task-list-section-title">${sec.title} <span class="kcol-count">${items.length}</span></div>
        ${items.map(t => {
          const isOverdue = t.deadline && t.deadline < today && !t.completed;
          return `
          <div class="task-list-row priority-${t.priority}${t.completed ? ' completed-card' : ''}" data-id="${t.id}">
            <span class="priority-dot priority-dot-${t.priority}"></span>
            <div class="task-list-info">
              <div class="task-list-title">${esc(t.title)}</div>
              <div class="task-list-meta">${(t.tags || []).map(tag => `<span class="task-tag">${esc(tag)}</span>`).join('')}</div>
            </div>
            ${t.deadline ? `<span class="task-deadline${isOverdue ? ' overdue' : ''}">${formatDate(t.deadline)}</span>` : ''}
            <div class="task-actions" style="margin-top:0">
              ${!t.completed ? `<button class="task-btn complete" data-complete="${t.id}">✓</button>` : ''}
              <button class="task-btn" data-edit="${t.id}">✎</button>
              <button class="task-btn" data-delete="${t.id}" style="color:var(--danger);border-color:rgba(255,59,48,0.25)">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }).join('') || `<div class="empty-state">No tasks match your filters</div>`;

  container.querySelectorAll('[data-complete]').forEach(btn => btn.addEventListener('click', () => completeTask(btn.dataset.complete)));
  container.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteTask(btn.dataset.delete)));
  container.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openAddTaskModal(btn.dataset.edit)));
}

function renderXpBar() {
  const xp = state.todo.totalXp || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpInLvl = xp % 100;
  const levelEl = document.getElementById('todoLevelBadge');
  const barEl   = document.getElementById('todoXpBar');
  const xpEl    = document.getElementById('todoXpLabel');
  const nextEl  = document.getElementById('todoXpNext');
  if (levelEl) levelEl.textContent = `Lvl ${level}`;
  if (barEl)   barEl.style.width   = xpInLvl + '%';
  if (xpEl)    xpEl.textContent    = `${xp} XP total`;
  if (nextEl)  nextEl.textContent  = `${100 - xpInLvl} XP to Lvl ${level + 1}`;
}
