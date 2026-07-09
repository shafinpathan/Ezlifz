import { state, autoSave } from './state.js';
import { uid, todayStr, formatDate, formatTime, showToast, esc } from './utils.js';
import { renderDashboard, updateStreak } from './dashboard.js';

let todayWorkoutExercises = [];
let workoutTimerInterval = null;
let workoutTimerSeconds = 0;
let restTimerInterval = null;
let restTimerSeconds = 0;

const DEFAULT_WORKOUT_PRESETS = [
  { key: 'Monday — Push',      type: 'Push',   subtitle: 'Chest + Shoulders + Triceps', isRest: false, groups: [
    { name: 'CHEST',     exercises: [{ name: 'Barbell Bench Press', scheme: '4 × 6–8' }, { name: 'Incline Dumbbell Press', scheme: '4 × 8–10' }, { name: 'Chest Butterfly Machine', scheme: '3 × 12–15' }, { name: 'Push Ups', scheme: '3 × failure' }] },
    { name: 'SHOULDERS', exercises: [{ name: 'Dumbbell Shoulder Press', scheme: '4 × 8–10' }, { name: 'Dumbbell Lateral Raise', scheme: '4 × 12–15' }, { name: 'Rear Delt Dumbbell Fly', scheme: '3 × 15' }] },
    { name: 'TRICEPS',   exercises: [{ name: 'Rope Pushdown', scheme: '4 × 12–15' }, { name: 'Overhead DB Extension', scheme: '3 × 10–12' }] }
  ]},
  { key: 'Tuesday — Pull',     type: 'Pull',   subtitle: 'Back + Biceps', isRest: false, groups: [
    { name: 'BACK',    exercises: [{ name: 'Deadlift', scheme: '4 × 5–6' }, { name: 'Lat Pulldown', scheme: '4 × 10–12' }, { name: 'Barbell Row', scheme: '4 × 8–10' }, { name: 'One Arm Dumbbell Row', scheme: '3 × 10–12' }, { name: 'Dumbbell Shrugs', scheme: '3 × 15' }] },
    { name: 'BICEPS',  exercises: [{ name: 'Barbell Curl', scheme: '4 × 10' }, { name: 'Hammer Curl', scheme: '3 × 12' }, { name: 'Incline Dumbbell Curl', scheme: '3 × 12' }] }
  ]},
  { key: 'Wednesday — Legs + Abs', type: 'Legs', subtitle: 'Legs + Abs', isRest: false, groups: [
    { name: 'LEGS', exercises: [{ name: 'Barbell Squat', scheme: '4 × 6–8' }, { name: 'Leg Press', scheme: '4 × 12' }, { name: 'Bulgarian Split Squat', scheme: '3 × 10 each' }, { name: 'Romanian Deadlift', scheme: '4 × 10' }, { name: 'Leg Curl', scheme: '4 × 12' }, { name: 'Standing Calf Raise', scheme: '5 × 15–20' }] },
    { name: 'ABS',  exercises: [{ name: 'Hanging Leg Raise', scheme: '4 × 15' }, { name: 'Cable Crunch', scheme: '4 × 15' }, { name: 'Russian Twist', scheme: '3 × 20' }, { name: 'Plank', scheme: '3 × 1 min' }] }
  ]},
  { key: 'Thursday — Upper',   type: 'Upper',  subtitle: 'Full Upper Body', isRest: false, groups: [
    { name: 'UPPER BODY', exercises: [{ name: 'Incline Barbell Press', scheme: '4 × 8' }, { name: 'Lat Pulldown', scheme: '4 × 10' }, { name: 'Flat Dumbbell Press', scheme: '3 × 10' }, { name: 'Barbell Row', scheme: '3 × 8' }, { name: 'Dumbbell Shoulder Press', scheme: '3 × 10' }, { name: 'Dumbbell Lateral Raise', scheme: '3 × 15' }, { name: 'Rope Pushdown', scheme: '3 × 12' }, { name: 'Barbell Curl', scheme: '3 × 12' }] }
  ]},
  { key: 'Friday — Lower + Run', type: 'Lower', subtitle: 'Lower Body + 5 km Run', isRest: false, groups: [
    { name: 'LEGS',    exercises: [{ name: 'Front Squat', scheme: '4 × 8' }, { name: 'Leg Press', scheme: '4 × 12' }, { name: 'Romanian Deadlift', scheme: '4 × 10' }, { name: 'Leg Curl', scheme: '4 × 12' }, { name: 'Walking Lunges', scheme: '3 × 20 steps' }, { name: 'Standing Calf Raise', scheme: '4 × 20' }] },
    { name: '5 KM RUN', exercises: [{ name: 'Outdoor Run', scheme: '28–35 min' }, { name: 'Warm Up Walk', scheme: '5 min' }, { name: 'Cool Down Walk', scheme: '5 min' }] }
  ]},
  { key: 'Saturday — Arms + Abs', type: 'Arms', subtitle: 'Biceps + Triceps + Forearms + Abs', isRest: false, groups: [
    { name: 'BICEPS',   exercises: [{ name: 'Barbell Curl', scheme: '4 × 10' }, { name: 'Hammer Curl', scheme: '4 × 12' }, { name: 'Concentration Curl', scheme: '3 × 12' }] },
    { name: 'TRICEPS',  exercises: [{ name: 'Rope Pushdown', scheme: '4 × 12' }, { name: 'Bench Dips', scheme: '3 × failure' }, { name: 'Overhead DB Extension', scheme: '3 × 12' }] },
    { name: 'FOREARMS', exercises: [{ name: 'Wrist Curl', scheme: '3 × 15' }, { name: 'Reverse Wrist Curl', scheme: '3 × 15' }] },
    { name: 'ABS',      exercises: [{ name: 'Decline Crunch', scheme: '4 × 15' }, { name: 'Leg Raise', scheme: '4 × 15' }, { name: 'Bicycle Crunch', scheme: '3 × 25' }, { name: 'Plank', scheme: '3 × 1 min' }] }
  ]},
  { key: 'Sunday — Rest', type: 'Cardio', subtitle: 'Active Recovery Day', isRest: true, groups: [] }
];

let _wdayManageMode = false;
let _activeWdayIdx = 0;
let _wdayPresets = null;

function _getPresets() {
  if (!_wdayPresets) {
    _wdayPresets = state.customWorkoutPresets
      ? JSON.parse(JSON.stringify(state.customWorkoutPresets))
      : JSON.parse(JSON.stringify(DEFAULT_WORKOUT_PRESETS));
  }
  return _wdayPresets;
}

function _savePresets() {
  state.customWorkoutPresets = JSON.parse(JSON.stringify(_wdayPresets));
  autoSave();
}

export function resetWorkoutPresets() { _wdayPresets = null; }

export function initWorkout() {
  loadTodayWorkout();
  renderExerciseList();
  renderWorkoutHistory();
  document.getElementById('addExBtn').addEventListener('click', addExercise);
  document.getElementById('completeWorkoutBtn').addEventListener('click', completeWorkout);
  document.getElementById('timerStartBtn').addEventListener('click', startWorkoutTimer);
  document.getElementById('timerStopBtn').addEventListener('click', stopWorkoutTimer);
  document.getElementById('rest60').addEventListener('click', () => startRestTimer(60));
  document.getElementById('rest90').addEventListener('click', () => startRestTimer(90));
  document.getElementById('rest120').addEventListener('click', () => startRestTimer(120));
  document.getElementById('restStop').addEventListener('click', stopRestTimer);
  document.getElementById('workoutSearch').addEventListener('input', e => renderExerciseList(e.target.value.toLowerCase()));
}

export function initWorkoutPresets() {
  const presets = _getPresets();
  const todayDayNames = ['Sunday — Rest', 'Monday — Push', 'Tuesday — Pull', 'Wednesday — Legs + Abs', 'Thursday — Upper', 'Friday — Lower + Run', 'Saturday — Arms + Abs'];
  const todayKey = todayDayNames[new Date().getDay()];
  const todayIdx = presets.findIndex(p => p.key === todayKey);
  if (todayIdx >= 0) _activeWdayIdx = todayIdx;

  document.getElementById('manageWdayBtn')?.addEventListener('click', _toggleWdayManage);
  document.getElementById('addWdayBtn')?.addEventListener('click', _addWday);
  document.getElementById('saveNewWdayExBtn')?.addEventListener('click', _saveNewWdayEx);
  document.getElementById('cancelAddWdayExBtn')?.addEventListener('click', () => {
    document.getElementById('addWdayExArea').style.display = 'none';
  });

  _renderWdayTabs();
}

function _toggleWdayManage() {
  _wdayManageMode = !_wdayManageMode;
  document.getElementById('manageWdayBtn').textContent = _wdayManageMode ? 'Done' : 'Manage';
  document.getElementById('addWdayExArea').style.display = 'none';
  _renderWdayTabs();
}

function _addWday() {
  const key = prompt('Day name (e.g. "Monday — Push"):');
  if (!key || !key.trim()) return;
  const type = prompt('Workout type (e.g. Push, Pull, Legs, Arms, Cardio):') || 'Custom';
  _getPresets().push({ key: key.trim(), type: type.trim(), subtitle: type.trim(), isRest: false, groups: [] });
  _activeWdayIdx = _getPresets().length - 1;
  _savePresets();
  _renderWdayTabs();
  showToast(`Day "${key.trim()}" added`);
}

function _renderWdayTabs() {
  const presets = _getPresets();
  const tabs = document.getElementById('wdayTabs');
  tabs.innerHTML = presets.map((p, i) => `
    <div class="preset-tab-wrap" style="display:inline-flex;align-items:center;gap:0">
      <button class="wday-btn${i === _activeWdayIdx ? ' active' : ''}" data-idx="${i}">${esc(p.key)}</button>
      ${_wdayManageMode ? `<button class="wday-del-btn" data-idx="${i}" style="background:var(--accent-red);border:none;color:#fff;border-radius:0 8px 8px 0;padding:.32rem .55rem;cursor:pointer;font-size:.8rem;line-height:1;margin-left:1px">✕</button>` : ''}
    </div>`).join('');

  tabs.querySelectorAll('.wday-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeWdayIdx = +btn.dataset.idx;
      document.getElementById('addWdayExArea').style.display = 'none';
      _renderWdayTabs();
    });
  });
  tabs.querySelectorAll('.wday-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      const p = _getPresets();
      if (p.length <= 1) { showToast('Cannot delete the last day'); return; }
      if (!confirm(`Delete day "${p[idx].key}"?`)) return;
      p.splice(idx, 1);
      _activeWdayIdx = Math.max(0, _activeWdayIdx - (idx <= _activeWdayIdx ? 1 : 0));
      _savePresets();
      _renderWdayTabs();
      showToast('Day deleted');
    });
  });

  _renderWdayPreview();
  document.getElementById('manageWdayBtn').textContent = _wdayManageMode ? 'Done' : 'Manage';
}

function _renderWdayPreview() {
  const day = _getPresets()[_activeWdayIdx];
  const area = document.getElementById('wdayPreviewArea');

  if (day.isRest) {
    area.innerHTML = `<div class="wday-rest-info"><strong>Active Rest Day</strong><br>Focus on: Walking · Stretching · Mobility work · Recovery<br>No lifting today — let your muscles rebuild and grow.</div>`;
    if (_wdayManageMode) {
      const restNote = document.createElement('div');
      restNote.style.cssText = 'font-size:.78rem;color:var(--text-muted);margin-top:.5rem';
      restNote.textContent = 'This is a rest day. To add exercises, remove it and add a normal day.';
      area.appendChild(restNote);
    }
    return;
  }

  const groupsHtml = day.groups.map((g, gi) => `
    <div class="wday-muscle-group">
      <div class="wday-group-name">${esc(g.name)}</div>
      ${g.exercises.map((e, ei) => `
        <div class="wday-exercise-row">
          <span class="wday-ex-name">${esc(e.name)}</span>
          <span class="wday-ex-scheme">${esc(e.scheme)}</span>
          ${_wdayManageMode ? `<button class="wday-del-ex-btn btn-icon" data-gi="${gi}" data-ei="${ei}" style="margin-left:auto;font-size:.75rem;color:var(--danger)">✕</button>` : ''}
        </div>`).join('')}
    </div>`).join('');

  const loadRow = !_wdayManageMode ? `
    <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-top:.85rem">
      <button class="wday-load-btn" id="loadPresetWorkoutBtn">Load All Exercises</button>
      <span style="font-size:.78rem;color:var(--text-muted)">Loads all exercises into today's session</span>
    </div>` : '';

  const addExBtn = _wdayManageMode ? `
    <div style="margin-top:.85rem">
      <button class="btn-sm btn-outline" id="showAddWdayExBtn" style="font-size:.78rem">+ Add Exercise</button>
    </div>` : '';

  area.innerHTML = `<div class="wday-preview">${groupsHtml || '<div style="color:var(--text-muted);font-size:.84rem;padding:.5rem 0">No exercises yet. Add some in Manage mode.</div>'}</div>${loadRow}${addExBtn}`;

  area.querySelectorAll('.wday-del-ex-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const gi = +btn.dataset.gi, ei = +btn.dataset.ei;
      const day = _getPresets()[_activeWdayIdx];
      day.groups[gi].exercises.splice(ei, 1);
      if (day.groups[gi].exercises.length === 0) day.groups.splice(gi, 1);
      _savePresets();
      _renderWdayPreview();
      showToast('Exercise removed');
    });
  });

  document.getElementById('loadPresetWorkoutBtn')?.addEventListener('click', () => _loadWorkoutPreset(_activeWdayIdx));

  document.getElementById('showAddWdayExBtn')?.addEventListener('click', () => {
    const area = document.getElementById('addWdayExArea');
    area.style.display = 'block';
    document.getElementById('addWdayExToDay').textContent = day.key;
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function _saveNewWdayEx() {
  const name   = document.getElementById('newWdayExName').value.trim();
  const group  = (document.getElementById('newWdayExGroup').value.trim() || 'GENERAL').toUpperCase();
  const scheme = document.getElementById('newWdayExScheme').value.trim() || '3 × 10';
  if (!name) { showToast('Enter exercise name'); return; }
  const day = _getPresets()[_activeWdayIdx];
  let g = day.groups.find(g => g.name === group);
  if (!g) { g = { name: group, exercises: [] }; day.groups.push(g); }
  g.exercises.push({ name, scheme });
  _savePresets();
  ['newWdayExName', 'newWdayExGroup', 'newWdayExScheme'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('addWdayExArea').style.display = 'none';
  _renderWdayPreview();
  showToast(`${name} added to ${group}`);
}

function loadTodayWorkout() {
  const today = todayStr();
  const w = state.workouts.find(w => w.date === today && !w.completed);
  if (w) {
    todayWorkoutExercises = w.exercises || [];
    document.getElementById('workoutDayType').value = w.type || 'Push';
    document.getElementById('workoutName').value = w.name || '';
  }
}

function addExercise() {
  const name = document.getElementById('exName').value.trim();
  const sets = +document.getElementById('exSets').value;
  const reps = +document.getElementById('exReps').value;
  const weight = +document.getElementById('exWeight').value;
  const notes = document.getElementById('exNotes').value.trim();
  if (!name || !sets || !reps) { showToast('Enter exercise name, sets and reps'); return; }
  todayWorkoutExercises.push({ id: uid(), name, sets, reps, weight: weight || 0, notes });
  saveTodayWorkout();
  renderExerciseList();
  updateVolumeBadge();
  ['exName', 'exSets', 'exReps', 'exWeight', 'exNotes'].forEach(id => document.getElementById(id).value = '');
  showToast(`${name} added!`);
}

function removeExercise(id) {
  todayWorkoutExercises = todayWorkoutExercises.filter(e => e.id !== id);
  saveTodayWorkout();
  renderExerciseList();
  updateVolumeBadge();
}

export function renderExerciseList(filter = '') {
  const list = document.getElementById('exerciseList');
  const exs = filter ? todayWorkoutExercises.filter(e => e.name.toLowerCase().includes(filter)) : todayWorkoutExercises;
  if (exs.length === 0) { list.innerHTML = `<div class="empty-state">No exercises yet. Add your first set above!</div>`; return; }
  list.innerHTML = exs.map(e => `
    <div class="exercise-item">
      <div class="ex-info">
        <span class="ex-name">${esc(e.name)}</span>
        <span class="ex-detail">${e.sets} sets × ${e.reps} reps${e.weight ? ' @ ' + e.weight + ' kg' : ''}</span>
        ${e.notes ? `<span class="ex-notes-text">${e.notes}</span>` : ''}
      </div>
      <button class="btn-icon" data-id="${e.id}">✕</button>
    </div>`).join('');
  list.querySelectorAll('.btn-icon').forEach(btn => btn.addEventListener('click', () => removeExercise(btn.dataset.id)));
  updateVolumeBadge();
}

function updateVolumeBadge() {
  const vol = todayWorkoutExercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);
  document.getElementById('volumeBadge').textContent = 'Volume: ' + Math.round(vol) + ' kg';
}

function saveTodayWorkout(completed = false) {
  const today = todayStr();
  const type = document.getElementById('workoutDayType').value;
  const name = document.getElementById('workoutName').value.trim() || type + ' Day';
  const vol = todayWorkoutExercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);
  const existing = state.workouts.find(w => w.date === today && !w.completed);
  if (existing) {
    existing.exercises = [...todayWorkoutExercises];
    existing.type = type; existing.name = name; existing.volume = Math.round(vol);
    if (completed) { existing.completed = true; existing.duration = workoutTimerSeconds; }
  } else if (todayWorkoutExercises.length > 0) {
    state.workouts.push({ id: uid(), date: today, type, name, exercises: [...todayWorkoutExercises], volume: Math.round(vol), completed, duration: completed ? workoutTimerSeconds : 0 });
  }
  autoSave();
}

function completeWorkout() {
  if (todayWorkoutExercises.length === 0) { showToast('Add at least one exercise first'); return; }
  saveTodayWorkout(true);
  stopWorkoutTimer();
  renderWorkoutHistory();
  updateStreak();
  renderDashboard();
  todayWorkoutExercises = [];
  renderExerciseList();
  showToast('✓ Workout completed!');
}

export function renderWorkoutHistory() {
  const container = document.getElementById('workoutHistory');
  const history = [...state.workouts].reverse().slice(0, 20);
  if (history.length === 0) { container.innerHTML = `<div class="empty-state">No history yet</div>`; return; }
  container.innerHTML = history.map(w => `
    <div class="history-item">
      <span class="history-date">${formatDate(w.date)}</span>
      <div>
        <div class="history-name">${esc(w.name)}</div>
        <div class="history-type">${esc(w.type)} · ${w.exercises ? w.exercises.length : 0} exercises${w.completed ? '' : ' (incomplete)'}</div>
      </div>
      <span class="history-vol">${w.volume || 0} kg</span>
    </div>`).join('');
}

function startWorkoutTimer() {
  if (workoutTimerInterval) return;
  workoutTimerInterval = setInterval(() => {
    workoutTimerSeconds++;
    document.getElementById('workoutTimer').textContent = formatTime(workoutTimerSeconds);
  }, 1000);
}

function stopWorkoutTimer() {
  clearInterval(workoutTimerInterval);
  workoutTimerInterval = null;
}

function startRestTimer(secs) {
  clearInterval(restTimerInterval);
  restTimerSeconds = secs;
  document.getElementById('restTimerDisplay').textContent = formatTime(restTimerSeconds);
  restTimerInterval = setInterval(() => {
    restTimerSeconds--;
    document.getElementById('restTimerDisplay').textContent = formatTime(Math.max(0, restTimerSeconds));
    if (restTimerSeconds <= 0) {
      clearInterval(restTimerInterval); restTimerInterval = null;
      showToast('Rest complete! Start next set.');
      document.getElementById('restTimerDisplay').textContent = '00:00';
    }
  }, 1000);
}

function stopRestTimer() {
  clearInterval(restTimerInterval); restTimerInterval = null; restTimerSeconds = 0;
  document.getElementById('restTimerDisplay').textContent = '00:00';
}

function _loadWorkoutPreset(idx) {
  const day = _getPresets()[idx];
  if (!day || day.isRest) { showToast('Rest day — no exercises to load'); return; }
  document.getElementById('workoutDayType').value = day.type;
  document.getElementById('workoutName').value = day.key;
  let added = 0;
  day.groups.forEach(g => {
    g.exercises.forEach(e => {
      const match = e.scheme.match(/^(\d+)\s*[×x]\s*([\d–\-]+)/);
      if (match) {
        const sets = +match[1];
        const reps = +match[2].split(/[–\-]/)[0];
        if (!todayWorkoutExercises.find(ex => ex.name === e.name)) { todayWorkoutExercises.push({ id: uid(), name: e.name, sets, reps, weight: 0, notes: e.scheme }); added++; }
      } else if (e.scheme.includes('min') || e.scheme.includes('failure') || e.scheme.includes('steps') || e.scheme.includes('each')) {
        if (!todayWorkoutExercises.find(ex => ex.name === e.name)) { todayWorkoutExercises.push({ id: uid(), name: e.name, sets: 3, reps: 1, weight: 0, notes: e.scheme }); added++; }
      }
    });
  });
  saveTodayWorkout();
  renderExerciseList();
  updateVolumeBadge();
  showToast(`✓ Loaded ${added} exercises for ${day.key}`);
  document.getElementById('exerciseList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
