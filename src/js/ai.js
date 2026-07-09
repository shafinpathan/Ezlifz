import { state } from './state.js';
import { todayStr, getLast7Days, showToast } from './utils.js';
import { getSubjectStats } from './attendance.js';

export function computeScores() {
  const today = todayStr();
  const s = state.settings;
  const todayMeals = state.meals.filter(m => m.date === today);
  const todayMetric = state.metrics.filter(m => m.date === today).pop();
  const totCal = todayMeals.reduce((a, m) => a + m.cal, 0);
  const totPro = todayMeals.reduce((a, m) => a + m.pro, 0);
  const sleep = todayMetric ? +todayMetric.sleep || 0 : 0;
  const energy = todayMetric ? +todayMetric.energy || 0 : 0;
  const days7 = getLast7Days();
  const workoutsWeek = days7.filter(d => state.workouts.some(w => w.date === d && w.completed)).length;

  let recovery = 50;
  if (sleep >= 8) recovery += 25;
  else if (sleep >= 7) recovery += 15;
  else if (sleep >= 6) recovery += 5;
  else if (sleep > 0) recovery -= 10;
  if (energy >= 8) recovery += 15;
  else if (energy >= 6) recovery += 8;
  if (workoutsWeek <= 4) recovery += 10;
  recovery = Math.min(100, Math.max(0, recovery));

  let muscle = 30;
  const proRatio = totPro / (s.proGoal || 160);
  if (proRatio >= 1) muscle += 25; else muscle += Math.round(proRatio * 25);
  const calRatio = totCal / (s.calGoal || 2500);
  if (calRatio >= 1 && calRatio <= 1.15) muscle += 25; else if (calRatio >= 0.85) muscle += 15;
  if (workoutsWeek >= 4) muscle += 20; else muscle += Math.round((workoutsWeek / 4) * 20);
  muscle = Math.min(100, Math.max(0, muscle));

  let consistency = 0;
  days7.forEach(d => {
    if (state.meals.some(m => m.date === d)) consistency += 5;
    if (state.workouts.some(w => w.date === d)) consistency += 8;
    if (state.metrics.some(m => m.date === d)) consistency += 1;
  });
  consistency = Math.min(100, consistency);

  return { recovery, muscle, consistency };
}

export function generateFeedback() {
  const today = todayStr();
  const s = state.settings;
  const todayMeals = state.meals.filter(m => m.date === today);
  const todayMetric = state.metrics.filter(m => m.date === today).pop();
  const totCal = todayMeals.reduce((a, m) => a + m.cal, 0);
  const totPro = todayMeals.reduce((a, m) => a + m.pro, 0);
  const sleep = todayMetric ? +todayMetric.sleep || 0 : 0;
  const water = todayMetric ? +todayMetric.water || 0 : 0;
  const energy = todayMetric ? +todayMetric.energy || 0 : 0;
  const days7 = getLast7Days();
  const workoutsWeek = days7.filter(d => state.workouts.some(w => w.date === d && w.completed)).length;
  const msgs = [];

  if (totPro === 0) msgs.push({ icon: '!', text: 'No protein logged today.', detail: 'Start tracking your meals to hit your protein target.' });
  else if (totPro < s.proGoal * 0.6) msgs.push({ icon: '!', text: `Protein intake critically low — ${totPro}g logged.`, detail: `You need ${s.proGoal - totPro}g more to hit your ${s.proGoal}g goal. Add chicken, eggs, or whey.` });
  else if (totPro < s.proGoal * 0.85) msgs.push({ icon: '!', text: `Protein intake below target (${totPro}g / ${s.proGoal}g).`, detail: `${s.proGoal - totPro}g remaining. Consider a post-workout shake.` });
  else msgs.push({ icon: '✓', text: `Protein on track! ${totPro}g logged today.`, detail: 'Great job hitting your protein target — muscle synthesis is optimized.' });

  if (totCal === 0) msgs.push({ icon: '▤', text: 'No calories logged today.', detail: 'Log your meals to track your calorie surplus for muscle gain.' });
  else if (totCal < s.calGoal * 0.75) msgs.push({ icon: '↯', text: `Calorie intake insufficient for muscle gain (${totCal} / ${s.calGoal} kcal).`, detail: 'Eat more! A calorie deficit will hinder muscle growth. Aim for a slight surplus.' });
  else if (totCal > s.calGoal * 1.2) msgs.push({ icon: '↑', text: `Calorie surplus may be too high (${totCal} kcal).`, detail: 'Large surpluses lead to fat gain. Keep within 200–300 kcal above goal.' });
  else msgs.push({ icon: '✓', text: `Calorie target on track — ${totCal} kcal consumed.`, detail: 'Well balanced. Keep this consistency for steady lean gains.' });

  if (sleep === 0) msgs.push({ icon: '◑', text: 'Sleep data not logged.', detail: 'Log your sleep in Body Metrics for accurate recovery scoring.' });
  else if (sleep < 6) msgs.push({ icon: '!', text: `Recovery impaired — only ${sleep}h sleep last night.`, detail: 'Aim for 7–9 hours. Sleep is when muscle is built. Reduce caffeine in evenings.' });
  else if (sleep < 7) msgs.push({ icon: '!', text: `Sleep slightly low at ${sleep}h.`, detail: 'Try to get an extra 30–60 minutes. Consistent 7+ hours maximizes GH release.' });
  else msgs.push({ icon: '✓', text: `Good sleep — ${sleep}h logged.`, detail: 'Quality rest is fuelling optimal recovery and muscle protein synthesis.' });

  if (workoutsWeek === 0) msgs.push({ icon: '◆', text: 'No workouts completed this week.', detail: 'Start with 3-4 sessions per week for muscle gain stimulus.' });
  else if (workoutsWeek >= 4) msgs.push({ icon: '◉', text: `Strong workout consistency — ${workoutsWeek}/7 days active.`, detail: 'Excellent frequency. Ensure 1–2 rest days for recovery.' });
  else msgs.push({ icon: '▤', text: `${workoutsWeek} workouts this week.`, detail: 'Target 4 sessions for optimal muscle stimulus and recovery balance.' });

  const wGoal = s.waterGoal || 3;
  if (water > 0 && water < wGoal * 0.83) msgs.push({ icon: '●', text: `Hydration low — ${water}L consumed.`, detail: `Target ${wGoal}L daily. Dehydration reduces strength and recovery by up to 15%.` });
  else if (water >= wGoal) msgs.push({ icon: '✓', text: `Hydration excellent — ${water}L today.`, detail: 'Optimal hydration supports nutrient transport and performance.' });

  if (energy > 0 && energy < 5) msgs.push({ icon: '!', text: `Energy levels low today (${energy}/10).`, detail: 'Low energy may indicate under-eating, poor sleep, or overtraining. Consider a deload.' });
  else if (energy >= 8) msgs.push({ icon: '↯', text: `Energy high today (${energy}/10).`, detail: 'Great time to push intensity in your next session.' });

  return msgs;
}

export function generateOverallInsights() {
  const today = todayStr();
  const days7 = getLast7Days();
  const s = state.settings;
  const cards = [];
  const scores = computeScores();

  const todayMeals = state.meals.filter(m => m.date === today);
  const totPro = Math.round(todayMeals.reduce((a, m) => a + (+m.pro || 0), 0));
  const totCal = Math.round(todayMeals.reduce((a, m) => a + (+m.cal || 0), 0));
  const workoutsWeek = days7.filter(d => state.workouts.some(w => w.date === d && w.completed)).length;
  const proPct = s.proGoal ? Math.round((totPro / s.proGoal) * 100) : 0;

  cards.push({
    area: 'Fitness', tone: scores.muscle >= 70 ? 'good' : scores.muscle >= 40 ? 'warn' : 'bad',
    headline: `Muscle-gain score ${scores.muscle}/100`,
    detail: totPro > 0 ? `${totPro}g protein today (${proPct}% of goal) · ${workoutsWeek} workout${workoutsWeek !== 1 ? 's' : ''} this week.` : `No meals logged yet today · ${workoutsWeek} workout${workoutsWeek !== 1 ? 's' : ''} this week.`,
    tab: 'nutrition'
  });

  const subs = state.attendance.subjects;
  if (subs.length) {
    let atRisk = 0, totalPct = 0, counted = 0;
    subs.forEach(sub => {
      const st = getSubjectStats(sub.id);
      if (st.total > 0) { counted++; totalPct += st.pct; if (st.pct < (sub.requiredAttendance || 75)) atRisk++; }
    });
    const avgPct = counted ? Math.round(totalPct / counted) : 0;
    cards.push({
      area: 'Attendance', tone: atRisk > 0 ? 'bad' : avgPct >= 85 ? 'good' : 'warn',
      headline: counted ? `Average attendance ${avgPct}%` : 'No lectures logged yet',
      detail: atRisk > 0 ? `${atRisk} subject${atRisk > 1 ? 's' : ''} below the required minimum — attend upcoming classes.` : counted ? 'All subjects are above their required minimum. Keep it up.' : 'Add subjects and log lectures to track risk.',
      tab: 'attendance'
    });
  } else {
    cards.push({ area: 'Attendance', tone: 'idle', headline: 'Not set up yet', detail: 'Add your subjects to start tracking attendance risk.', tab: 'attendance' });
  }

  const tasks = state.todo.tasks;
  const pending = tasks.filter(t => !t.completed).length;
  const overdue = tasks.filter(t => !t.completed && t.deadline && t.deadline < today).length;
  const dueToday = tasks.filter(t => !t.completed && (t.status === 'today' || t.deadline === today)).length;
  const level = Math.floor((state.todo.totalXp || 0) / 100) + 1;
  cards.push({
    area: 'Tasks', tone: overdue > 0 ? 'bad' : pending === 0 && tasks.length ? 'good' : 'warn',
    headline: overdue > 0 ? `${overdue} task${overdue > 1 ? 's' : ''} overdue` : `${pending} task${pending !== 1 ? 's' : ''} pending`,
    detail: tasks.length ? `${dueToday} due today · Productivity level ${level}.` : 'No tasks yet — add one to start earning XP.',
    tab: 'todo'
  });

  const items = state.wardrobe.items;
  if (items.length) {
    const recentLogs = state.wardrobe.logs.slice(-7).map(l => l.outfitId);
    const repeats = {};
    recentLogs.forEach(id => repeats[id] = (repeats[id] || 0) + 1);
    const maxRepeat = Math.max(0, ...Object.values(repeats));
    const neverWorn = items.filter(i => (i.wearCount || 0) === 0).length;
    cards.push({
      area: 'Wardrobe', tone: maxRepeat >= 3 ? 'warn' : 'good',
      headline: `${items.length} item${items.length !== 1 ? 's' : ''} · ${state.wardrobe.outfits.length} outfit${state.wardrobe.outfits.length !== 1 ? 's' : ''}`,
      detail: maxRepeat >= 3 ? 'You’ve repeated the same outfit a lot this week — try mixing it up.' : neverWorn > 0 ? `${neverWorn} item${neverWorn > 1 ? 's have' : ' has'} never been worn — give them a spin.` : 'Good rotation across your wardrobe.',
      tab: 'wardrobe'
    });
  } else {
    cards.push({ area: 'Wardrobe', tone: 'idle', headline: 'Empty closet', detail: 'Add clothing items to track wear and build outfits.', tab: 'wardrobe' });
  }

  const skinLogs = state.skincare.logs;
  const routineSize = state.skincare.morningRoutine.length + state.skincare.eveningRoutine.length;
  if (routineSize > 0 || skinLogs.length) {
    const streak = state.skincare.streak || 0;
    const loggedToday = skinLogs.some(l => l.date === today);
    cards.push({
      area: 'Skincare', tone: streak >= 3 ? 'good' : loggedToday ? 'warn' : 'bad',
      headline: streak > 0 ? `${streak}-day routine streak` : 'Streak reset',
      detail: loggedToday ? 'Today’s routine is logged. Consistency builds results.' : 'Log today’s routine to keep your streak alive.',
      tab: 'skincare'
    });
  } else {
    cards.push({ area: 'Skincare', tone: 'idle', headline: 'Not set up yet', detail: 'Build a morning and evening routine to begin tracking.', tab: 'skincare' });
  }

  return cards;
}

let _switchTab = null;
export function setAIDeps(deps) {
  if (deps.switchTab) _switchTab = deps.switchTab;
}

export function renderOverallInsights() {
  const el = document.getElementById('overallInsightsList');
  if (!el) return;
  const cards = generateOverallInsights();
  el.innerHTML = cards.map(c => `
    <button class="overall-item tone-${c.tone}" data-goto="${c.tab}">
      <div class="oi-head"><span class="oi-area">${c.area}</span><span class="oi-dot"></span></div>
      <div class="oi-headline">${c.headline}</div>
      <div class="oi-detail">${c.detail}</div>
    </button>`).join('');
  el.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => _switchTab?.(b.dataset.goto)));
}

export function renderWeeklyInsights() {
  const container = document.getElementById('aiWeeklyInsights');
  const days7 = getLast7Days();
  const s = state.settings;
  const calAvg = (() => { const vals = days7.map(d => state.meals.filter(m => m.date === d).reduce((a, m) => a + m.cal, 0)).filter(v => v > 0); return vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0; })();
  const proAvg = (() => { const vals = days7.map(d => state.meals.filter(m => m.date === d).reduce((a, m) => a + m.pro, 0)).filter(v => v > 0); return vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0; })();
  const workoutsWeek = days7.filter(d => state.workouts.some(w => w.date === d && w.completed)).length;
  const weightVals = days7.map(d => { const m = state.metrics.filter(m => m.date === d && m.weight).pop(); return m ? +m.weight : null; }).filter(v => v !== null);
  let weightInsight = 'Log body weight in Metrics for trend analysis.';
  if (weightVals.length >= 2) {
    const delta = weightVals[weightVals.length - 1] - weightVals[0];
    if (delta > 0.3) weightInsight = `Weight trending up +${delta.toFixed(1)}kg this week — lean bulk on track!`;
    else if (delta < -0.3) weightInsight = `Weight dropped ${Math.abs(delta).toFixed(1)}kg — ensure adequate calorie surplus.`;
    else weightInsight = `Weight stable this week (±${Math.abs(delta).toFixed(1)}kg) — consider adjusting calories.`;
  }
  const insights = [
    calAvg > 0 ? `Weekly average calories: <strong>${calAvg} kcal/day</strong> (${calAvg >= s.calGoal ? 'on target ✓' : Math.round((calAvg / s.calGoal) * 100) + '% of goal'})` : 'Start logging meals for calorie insight.',
    proAvg > 0 ? `Weekly average protein: <strong>${proAvg}g/day</strong> (${proAvg >= s.proGoal ? 'hitting target ✓' : proAvg + '/' + s.proGoal + 'g'})` : 'Track protein daily for muscle gain optimization.',
    `Weekly workout sessions: <strong>${workoutsWeek}/7</strong> ${workoutsWeek >= 4 ? '— solid consistency' : '— push for 4+ sessions'}`,
    weightInsight,
    state.streak >= 3 ? `You're on a <strong>${state.streak}-day streak</strong> — keep the momentum going!` : 'Build your streak by logging daily for best results.'
  ];
  container.innerHTML = insights.map(i => `<div class="insight-item">${i}</div>`).join('');
}

export function renderAIFeedback() {
  const scores = computeScores();
  document.getElementById('aiRecovery').textContent = scores.recovery;
  document.getElementById('aiMuscle').textContent = scores.muscle;
  document.getElementById('aiConsistency').textContent = scores.consistency;

  const sbR = document.getElementById('sbRecovery');
  const sbM = document.getElementById('sbMuscle');
  const sbC = document.getElementById('sbConsistency');
  if (sbR) { sbR.style.width = scores.recovery + '%'; document.getElementById('svRecovery').textContent = scores.recovery + '/100'; }
  if (sbM) { sbM.style.width = scores.muscle + '%'; document.getElementById('svMuscle').textContent = scores.muscle + '/100'; }
  if (sbC) { sbC.style.width = scores.consistency + '%'; document.getElementById('svConsistency').textContent = scores.consistency + '/100'; }

  const feedback = generateFeedback();
  const list = document.getElementById('aiFeedbackList');
  list.innerHTML = feedback.map(f => `
    <div class="feedback-item">
      <span class="feedback-icon">${f.icon}</span>
      <div><div class="feedback-text">${f.text}</div><div class="feedback-detail">${f.detail}</div></div>
    </div>`).join('');

  renderWeeklyInsights();
  renderOverallInsights();
}

export function initAITab() {
  const r1 = document.getElementById('refreshAI');
  if (r1) r1.addEventListener('click', renderAIFeedback);
  const r2 = document.getElementById('refreshOverall');
  if (r2) r2.addEventListener('click', renderOverallInsights);
}
