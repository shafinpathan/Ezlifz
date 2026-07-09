import { state, autoSave } from './state.js';
import { uid, todayStr, formatDate, showToast } from './utils.js';
import { renderDashboard, updateStreak } from './dashboard.js';

export function initMetrics() {
  document.getElementById('saveMetricsBtn').addEventListener('click', saveMetrics);
  renderMetricsLog();
  renderMetricsAverages();
  loadTodayMetrics();
}

function loadTodayMetrics() {
  const today = todayStr();
  const m = state.metrics.filter(m => m.date === today).pop();
  if (!m) return;
  if (m.weight) document.getElementById('mWeight').value = m.weight;
  if (m.waist) document.getElementById('mWaist').value = m.waist;
  if (m.sleep) document.getElementById('mSleep').value = m.sleep;
  if (m.water) document.getElementById('mWater').value = m.water;
  if (m.energy) document.getElementById('mEnergy').value = m.energy;
  if (m.mood) document.getElementById('mMood').value = m.mood;
}

function saveMetrics() {
  const today = todayStr();
  const weight = +document.getElementById('mWeight').value || 0;
  const waist = +document.getElementById('mWaist').value || 0;
  const sleep = +document.getElementById('mSleep').value || 0;
  const water = +document.getElementById('mWater').value || 0;
  const energy = +document.getElementById('mEnergy').value || 0;
  const mood = +document.getElementById('mMood').value || 0;
  if (!weight && !sleep && !water && !energy) { showToast('Enter at least one metric'); return; }
  state.metrics = state.metrics.filter(m => m.date !== today);
  state.metrics.push({ id: uid(), date: today, weight, waist, sleep, water, energy, mood });
  autoSave();
  renderMetricsLog();
  renderMetricsAverages();
  updateStreak();
  renderDashboard();
  showToast('Metrics saved!');
}

export function renderMetricsLog() {
  const container = document.getElementById('metricsLog');
  const entries = [...state.metrics].reverse().slice(0, 30);
  if (entries.length === 0) { container.innerHTML = `<div class="empty-state">No entries yet</div>`; return; }
  container.innerHTML = `
    <div class="metrics-log-item metrics-log-header">
      <span>Date</span><span>Weight</span><span class="col-waist">Waist</span>
      <span>Sleep</span><span>Water</span><span class="col-energy">Energy</span><span class="col-mood">Mood</span>
    </div>
    ${entries.map(m => `
    <div class="metrics-log-item">
      <span class="col-date">${formatDate(m.date)}</span>
      <span>${m.weight || '—'} kg</span>
      <span class="col-waist">${m.waist || '—'} cm</span>
      <span>${m.sleep || '—'} h</span>
      <span>${m.water || '—'} L</span>
      <span class="col-energy">${m.energy || '—'}/10</span>
      <span class="col-mood">${m.mood || '—'}/10</span>
    </div>`).join('')}`;
}

export function renderMetricsAverages() {
  const container = document.getElementById('metricsAverages');
  const days7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days7.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }
  const week = state.metrics.filter(m => days7.includes(m.date));
  if (week.length === 0) { container.innerHTML = `<div class="empty-state">Log metrics to see averages</div>`; return; }
  const avg = key => { const vals = week.map(m => +m[key]).filter(v => v > 0); return vals.length ? (vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : '—'; };
  const data = [
    ['Avg Weight', avg('weight') + ' kg'], ['Avg Waist', avg('waist') + ' cm'],
    ['Avg Sleep', avg('sleep') + ' hrs'], ['Avg Water', avg('water') + ' L'],
    ['Avg Energy', avg('energy') + '/10'], ['Avg Mood', avg('mood') + '/10']
  ];
  container.innerHTML = data.map(([label, val]) =>
    `<div class="avg-item"><span>${label}</span><strong>${val}</strong></div>`
  ).join('');
}
