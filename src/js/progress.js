import Chart from 'chart.js/auto';
import { state } from './state.js';
import { formatDate, getLastNDays, esc } from './utils.js';

let chartPeriod = 7;
const charts = {};

/* Chart colors follow the active theme (ticks were invisible in light mode) */
function chartDefaults() {
  const light = document.body.classList.contains('light-theme');
  const tick = light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';
  const grid = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)';
  return {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 900, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(28,28,30,0.92)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1,
        titleColor: '#ffffff', bodyColor: 'rgba(255,255,255,0.60)', padding: 12, cornerRadius: 12,
        titleFont: { family: "'Inter', sans-serif", weight: '600', size: 12 },
        bodyFont: { family: "'Inter', sans-serif", size: 12 }
      }
    },
    scales: {
      x: { grid: { color: grid, drawBorder: false }, border: { display: false }, ticks: { color: tick, font: { family: "'Inter', sans-serif", size: 11 } } },
      y: { grid: { color: grid, drawBorder: false }, border: { display: false }, ticks: { color: tick, font: { family: "'Inter', sans-serif", size: 11 } } }
    }
  };
}

export function initProgress() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartPeriod = +btn.dataset.period;
      renderProgressCharts();
    });
  });
}

export function renderProgressCharts() {
  const days = getLastNDays(chartPeriod);
  const labels = days.map(d => formatDate(d));
  const weightData = days.map(d => { const m = state.metrics.filter(m => m.date === d && m.weight).pop(); return m ? +m.weight : null; });
  const calData = days.map(d => { const meals = state.meals.filter(m => m.date === d); return meals.reduce((a, m) => a + m.cal, 0) || null; });
  const proData = days.map(d => { const meals = state.meals.filter(m => m.date === d); return meals.reduce((a, m) => a + m.pro, 0) || null; });
  const volData = days.map(d => { const w = state.workouts.filter(w => w.date === d).pop(); return w ? w.volume : null; });
  buildChart('chartWeight', labels, weightData, '#39e08a', 'line');
  buildChart('chartCalories', labels, calData, '#4f9cf9', 'line');
  buildChart('chartProtein', labels, proData, '#f97316', 'bar');
  buildChart('chartVolume', labels, volData, '#a78bfa', 'bar');
  renderStrengthProgression();
}

function buildChart(canvasId, labels, data, color, type) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  const filled = data.map((v, i) => {
    if (v !== null) return v;
    if (type === 'line') { const before = data.slice(0, i).reverse().find(d => d !== null); return before || 0; }
    return 0;
  });
  const appleColors = { '#39e08a': '#32d74b', '#4f9cf9': '#0a84ff', '#f97316': '#ff9f0a', '#a78bfa': '#bf5af2' };
  const c = appleColors[color] || color;
  charts[canvasId] = new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [{
        data: filled, borderColor: c,
        backgroundColor: type === 'line' ? (ctx => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height); g.addColorStop(0, c + '33'); g.addColorStop(1, c + '04'); return g; }) : c + 'aa',
        fill: type === 'line', tension: 0.45, pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: c, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        borderWidth: 2.5, borderRadius: type === 'bar' ? 8 : 0, borderSkipped: false
      }]
    },
    options: chartDefaults()
  });
}

function renderStrengthProgression() {
  const container = document.getElementById('strengthProgression');
  const map = {};
  state.workouts.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(e => {
      if (!e.weight) return;
      if (!map[e.name]) map[e.name] = [];
      map[e.name].push({ date: w.date, weight: e.weight, sets: e.sets, reps: e.reps });
    });
  });
  const keys = Object.keys(map);
  if (keys.length === 0) { container.innerHTML = `<div class="empty-state">Log workouts with weights to see strength trends</div>`; return; }
  container.innerHTML = keys.map(name => {
    const entries = map[name].sort((a, b) => a.date.localeCompare(b.date));
    const first = entries[0], last = entries[entries.length - 1];
    const delta = last.weight - first.weight;
    const cls = delta > 0 ? 'up' : 'same';
    return `
      <div class="strength-row">
        <div>
          <div class="strength-name">${esc(name)}</div>
          <div class="strength-detail">Best: ${last.weight}kg × ${last.sets}×${last.reps} (${entries.length} sessions)</div>
        </div>
        <div class="strength-change ${cls}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg</div>
      </div>`;
  }).join('');
}
