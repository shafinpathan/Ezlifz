import { state, autoSave } from './state.js';
import { todayStr, localDateStr, formatDate, setBar, setBarPct, setScoreBar, getLast7Days, esc } from './utils.js';
import { computeScores } from './ai.js';
import { getSubjectStats } from './attendance.js';

export function updateStreak() {
  const today = todayStr();
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  const hasActivityToday = state.meals.some(m => m.date === today) ||
    state.workouts.some(w => w.date === today) ||
    state.metrics.some(m => m.date === today);

  if (hasActivityToday) {
    if (state.streakLastDate === yesterday) state.streak = (state.streak || 0) + 1;
    else if (state.streakLastDate !== today) state.streak = 1;
    state.streakLastDate = today;
  } else if (state.streakLastDate && state.streakLastDate < yesterday) {
    state.streak = 0;
  }

  document.getElementById('streakCount').textContent = state.streak || 0;
  autoSave();
}

function _isLight() { return document.body.classList.contains('light-theme'); }

export function drawRing(canvasId, value, max, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, r = (W / 2) - 11;
  const pct = Math.min(value / (max || 1), 1);
  const appleColors = { '#39e08a': '#32d74b', '#4f9cf9': '#0a84ff', '#f97316': '#ff9f0a', '#a78bfa': '#bf5af2' };
  const c = appleColors[color] || color;
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = _isLight() ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 9;
  ctx.stroke();
  if (pct > 0) {
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
    ctx.strokeStyle = c;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = _isLight() ? 'rgba(28,28,30,0.90)' : 'rgba(255,255,255,0.90)';
  ctx.font = `700 ${W < 100 ? 13 : 14}px 'Inter', -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(pct * 100) + '%', cx, cy);
}

export function drawScoreRing(canvasId, value, max, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, r = (W / 2) - 7;
  const pct = Math.min(value / (max || 1), 1);
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = _isLight() ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function renderDashboard() {
  const today = todayStr();
  const s = state.settings;
  const hour = new Date().getHours();
  const greetWord = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
  const firstName = (state.settings.userName || '').trim().split(/\s+/)[0] || '';
  document.getElementById('dashGreeting').textContent = firstName ? `${greetWord}, ${firstName}` : greetWord;
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('goalBadge').textContent = 'Goal: ' + s.goal;
  document.getElementById('dashCalGoal').textContent = s.calGoal;
  document.getElementById('dashProteinGoal').textContent = s.proGoal;
  document.getElementById('dashGoalWeight').textContent = s.goalWeight;

  const todayMeals = state.meals.filter(m => m.date === today);
  const totCal = todayMeals.reduce((a, m) => a + (+m.cal || 0), 0);
  const totPro = todayMeals.reduce((a, m) => a + (+m.pro || 0), 0);
  const totCarb = todayMeals.reduce((a, m) => a + (+m.carb || 0), 0);
  const totFat = todayMeals.reduce((a, m) => a + (+m.fat || 0), 0);

  document.getElementById('dashCalIn').textContent = totCal;
  document.getElementById('dashProtein').textContent = totPro + 'g';
  setBar('dashCalBar', totCal, s.calGoal);
  setBar('dashProteinBar', totPro, s.proGoal);

  const todayMetric = state.metrics.filter(m => m.date === today).pop();
  const water = todayMetric ? (+todayMetric.water || 0) : 0;
  const waterGoal = s.waterGoal || 3;
  document.getElementById('dashWater').textContent = water.toFixed(1) + 'L';
  document.getElementById('dashWaterGoal').textContent = waterGoal;
  setBar('dashWaterBar', water, waterGoal);

  const lastMetric = [...state.metrics].reverse().find(m => m.weight);
  const currW = lastMetric ? lastMetric.weight : s.currWeight;
  document.getElementById('dashWeight').textContent = currW ? currW + ' kg' : '—';
  if (currW && s.goalWeight) setBar('dashWeightBar', Math.min((currW / s.goalWeight) * 100, 100), 100);

  drawRing('ringCalories', totCal, s.calGoal, '#39e08a');
  drawRing('ringProtein', totPro, s.proGoal, '#4f9cf9');
  drawRing('ringCarbs', totCarb, s.carbGoal, '#f97316');
  drawRing('ringFat', totFat, s.fatGoal, '#a78bfa');

  renderWeeklySummary();

  const scores = computeScores();
  setScoreBar('sbRecovery', scores.recovery, 'svRecovery');
  setScoreBar('sbMuscle', scores.muscle, 'svMuscle');
  setScoreBar('sbConsistency', scores.consistency, 'svConsistency');

  const todayWorkout = state.workouts.filter(w => w.date === today).pop();
  const wEl = document.getElementById('dashWorkoutStatus');
  if (todayWorkout) {
    wEl.innerHTML = `
      <div class="ws-row"><span>Type</span><strong>${esc(todayWorkout.type)}</strong></div>
      <div class="ws-row"><span>Exercises</span><strong>${todayWorkout.exercises ? todayWorkout.exercises.length : 0}</strong></div>
      <div class="ws-row"><span>Volume</span><strong>${todayWorkout.volume || 0} kg</strong></div>
      <div class="ws-row"><span>Status</span><strong style="color:var(--accent-green)">${todayWorkout.completed ? '✓ Done' : 'In Progress'}</strong></div>`;
  } else {
    wEl.innerHTML = `<div class="empty-state-sm">No workout logged today</div>`;
  }

  setMicro('mCalories', `${totCal}`, totCal, s.calGoal, 'mCalBar');
  setMicro('mProtein', `${totPro}g`, totPro, s.proGoal, 'mProBar');
  setMicro('dmWater', `${water.toFixed(1)}L`, water, waterGoal, 'dmWaterBar');
  const sleep = todayMetric ? (+todayMetric.sleep || 0) : 0;
  setMicro('dmSleep', sleep ? `${sleep}h` : '—', sleep, 8, 'dmSleepBar');
  const energy = todayMetric ? (+todayMetric.energy || 0) : 0;
  setMicro('dmEnergy', energy ? `${energy}/10` : '—', energy, 10, 'dmEnergyBar');
  document.getElementById('mWorkout').textContent = todayWorkout ? (todayWorkout.completed ? '✓ Done' : 'Active') : 'Rest';
  setBarPct('mWorkoutBar', todayWorkout ? (todayWorkout.completed ? 1 : 0.5) : 0, 1);

  const pendingTasks = state.todo.tasks.filter(t => !t.completed);
  document.getElementById('mTasks').textContent = pendingTasks.length;
  setBarPct('mTaskBar', state.todo.tasks.length - pendingTasks.length, state.todo.tasks.length || 1);

  let attendPctTotal = 0, attendCount = 0;
  state.attendance.subjects.forEach(sub => {
    const st = getSubjectStats(sub.id);
    if (st.total > 0) { attendPctTotal += st.pct; attendCount++; }
  });
  const avgAttend = attendCount ? Math.round(attendPctTotal / attendCount) : null;
  document.getElementById('mAttend').textContent = avgAttend !== null ? avgAttend + '%' : '—';
  setBarPct('mAttendBar', avgAttend || 0, 100);
  document.getElementById('heroAttend').textContent = avgAttend !== null ? avgAttend + '%' : '—';

  document.getElementById('heroStreak').textContent = state.streak || 0;
  document.getElementById('heroTasksDone').textContent = state.todo.tasks.filter(t => t.completed).length;

  const overallScore = Math.round((scores.recovery + scores.muscle + scores.consistency) / 3);
  document.getElementById('dashOverallScore').textContent = overallScore;
  drawScoreRing('dashScoreRing', overallScore, 100, '#32d74b');

  let totalItems = 0, doneItems = 0;
  const todayTasks = state.todo.tasks.filter(t => t.status === 'today' || t.deadline === today);
  totalItems += todayTasks.length; doneItems += todayTasks.filter(t => t.completed).length;
  totalItems += 1; if (todayWorkout && todayWorkout.completed) doneItems += 1;
  const skinLog = state.skincare.logs.find(l => l.date === today);
  if (state.skincare.morningRoutine.length) { totalItems += 1; if (skinLog && skinLog.morningDone && skinLog.morningDone.length === state.skincare.morningRoutine.length) doneItems += 1; }
  if (state.skincare.eveningRoutine.length) { totalItems += 1; if (skinLog && skinLog.eveningDone && skinLog.eveningDone.length === state.skincare.eveningRoutine.length) doneItems += 1; }
  totalItems += 1; if (todayMeals.length > 0) doneItems += 1;
  const dayPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  document.getElementById('dayCompletionPct').innerHTML = `${dayPct}%<br><span>Today</span>`;
  drawScoreRing('ringDayCompletion', dayPct, 100, '#0a84ff');

  renderDashTodayTasks(todayTasks);
  renderDashInsights(scores, avgAttend);
}

function setMicro(valId, text, val, max, barId) {
  const el = document.getElementById(valId);
  if (el) el.textContent = text;
  setBarPct(barId, val, max);
}

function renderDashTodayTasks(todayTasks) {
  const el = document.getElementById('dashTodayTasks');
  if (!el) return;
  const pending = todayTasks.filter(t => !t.completed).slice(0, 4);
  if (!pending.length) { el.innerHTML = `<div class="empty-state-sm">No tasks for today</div>`; return; }
  el.innerHTML = pending.map(t => `
    <div class="dash-task-row">
      <span class="dash-task-dot priority-dot-${t.priority}"></span>
      <span class="dash-task-title">${esc(t.title)}</span>
      ${t.deadline ? `<span class="dash-task-deadline">${formatDate(t.deadline)}</span>` : ''}
    </div>`).join('');
}

function renderDashInsights(scores, avgAttend) {
  const el = document.getElementById('dashAiInsights');
  if (!el) return;
  const insights = [];
  if (scores.recovery < 50) insights.push({ icon: '!', text: 'Low recovery — your sleep/energy levels are below ideal. Consider an earlier night.' });
  if (scores.consistency < 40) insights.push({ icon: '↓', text: 'Consistency dipped this week. Try logging meals and workouts daily.' });
  if (avgAttend !== null && avgAttend < 75) insights.push({ icon: '▤', text: `Average attendance is ${avgAttend}% — below the safe threshold.` });
  const skinStreak = state.skincare.streak || 0;
  if (state.skincare.morningRoutine.length || state.skincare.eveningRoutine.length) {
    if (skinStreak === 0) insights.push({ icon: '❖', text: 'Skincare streak reset — log today\'s routine to restart it.' });
    else insights.push({ icon: '❖', text: `Skincare streak: ${skinStreak} day${skinStreak !== 1 ? 's' : ''}` });
  }
  const recentOutfits = state.wardrobe.logs.slice(-5).map(l => l.outfitId);
  if (recentOutfits.length >= 3) {
    const counts = {};
    recentOutfits.forEach(id => counts[id] = (counts[id] || 0) + 1);
    if (Math.max(...Object.values(counts)) >= 3) insights.push({ icon: '▣', text: 'You\'ve repeated the same outfit often lately — try mixing it up!' });
  }
  const days7 = getLast7Days();
  const workoutTypes = days7.map(d => state.workouts.find(w => w.date === d)?.type).filter(Boolean);
  if (workoutTypes.length >= 3 && new Set(workoutTypes).size === 1) insights.push({ icon: '◐', text: `You've done ${esc([...new Set(workoutTypes)][0])} workouts repeatedly — consider varying your split.` });
  const last3WaterDays = days7.slice(-3).map(d => state.metrics.find(m => m.date === d)?.water || 0);
  if (last3WaterDays.length === 3 && last3WaterDays.every(w => w < (state.settings.waterGoal || 3) * 0.6)) insights.push({ icon: '●', text: 'Hydration has been low for 3 days — aim to increase water intake.' });
  if (!insights.length) insights.push({ icon: '✓', text: 'Everything looks on track. Keep up the consistency!' });
  el.innerHTML = insights.slice(0, 5).map(i => `
    <div class="insight-row">
      <span class="insight-icon">${i.icon}</span>
      <span class="insight-text">${i.text}</span>
    </div>`).join('');
}

function renderWeeklySummary() {
  const days = getLast7Days();
  let calSum = 0, calDays = 0, proSum = 0, proDays = 0, workoutsThisWeek = 0, startW = null, endW = null;
  days.forEach(d => {
    const dayMeals = state.meals.filter(m => m.date === d);
    const dayCal = dayMeals.reduce((a, m) => a + (+m.cal || 0), 0);
    const dayPro = dayMeals.reduce((a, m) => a + (+m.pro || 0), 0);
    if (dayCal > 0) { calSum += dayCal; calDays++; }
    if (dayPro > 0) { proSum += dayPro; proDays++; }
    if (state.workouts.some(w => w.date === d && w.completed)) workoutsThisWeek++;
    const dm = state.metrics.filter(m => m.date === d && m.weight).pop();
    if (dm) { if (!startW) startW = +dm.weight; endW = +dm.weight; }
  });
  document.getElementById('wsWorkouts').textContent = workoutsThisWeek + '/7';
  document.getElementById('wsAvgCal').textContent = calDays ? Math.round(calSum / calDays) + ' kcal' : '—';
  document.getElementById('wsAvgPro').textContent = proDays ? Math.round(proSum / proDays) + 'g' : '—';
  if (startW && endW) {
    const delta = (endW - startW).toFixed(1);
    document.getElementById('wsWeightDelta').textContent = (delta >= 0 ? '+' : '') + delta + ' kg';
  } else {
    document.getElementById('wsWeightDelta').textContent = '—';
  }
}
