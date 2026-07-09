import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { state, saveData, autoSave, DEFAULT_SETTINGS } from './state.js';
import { todayStr, prettyDate, cap, showToast } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { updateNutritionSummary, renderMealSections, resetMealPresets } from './nutrition.js';
import { renderExerciseList, renderWorkoutHistory } from './workout.js';
import { renderMetricsLog, renderMetricsAverages } from './metrics.js';
import { CATEGORY_LABELS } from './wardrobe.js';
import { getSubjectStats } from './attendance.js';
import { pushNotif } from './notifications.js';
import { clearAllImages } from './imageStore.js';

export function initSettings() {
  loadSettingsForm();
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('themeToggle').addEventListener('change', e => {
    applyTheme(e.target.checked ? 'dark' : 'light');
  });

  // Module-based reset
  document.getElementById('resetModuleBtn')?.addEventListener('click', _handleModuleReset);
}

export function loadSettingsForm() {
  const s = state.settings;
  const nameEl = document.getElementById('setUserName');
  if (nameEl) nameEl.value = s.userName || '';
  document.getElementById('setCurrWeight').value  = s.currWeight || '';
  document.getElementById('setGoalWeight').value  = s.goalWeight || '';
  document.getElementById('setGoal').value        = s.goal       || 'Muscle Gain';
  document.getElementById('setCalGoal').value     = s.calGoal    || 2500;
  document.getElementById('setProGoal').value     = s.proGoal    || 160;
  document.getElementById('setCarbGoal').value    = s.carbGoal   || 280;
  document.getElementById('setFatGoal').value     = s.fatGoal    || 75;
  document.getElementById('setWaterGoal').value   = s.waterGoal  || 3;
  document.getElementById('themeToggle').checked  = s.theme !== 'light';
}

function saveSettings() {
  state.settings.userName   = (document.getElementById('setUserName')?.value || '').trim();
  state.settings.currWeight = +document.getElementById('setCurrWeight').value || 70;
  state.settings.goalWeight = +document.getElementById('setGoalWeight').value || 75;
  state.settings.goal       =  document.getElementById('setGoal').value;
  state.settings.calGoal    = +document.getElementById('setCalGoal').value    || 2500;
  state.settings.proGoal    = +document.getElementById('setProGoal').value    || 160;
  state.settings.carbGoal   = +document.getElementById('setCarbGoal').value   || 280;
  state.settings.fatGoal    = +document.getElementById('setFatGoal').value    || 75;
  state.settings.waterGoal  = +document.getElementById('setWaterGoal').value  || 3;
  state.settings.theme      =  document.getElementById('themeToggle').checked ? 'dark' : 'light';
  autoSave();
  renderDashboard();
  updateNutritionSummary();
  showToast('Settings saved!');
}

export function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }
  state.settings.theme = theme;
  setTimeout(renderDashboard, 100);
}

// ── Module-based reset ────────────────────────────────────────────────────────

const MODULE_LABELS = {
  dashboard:   'Dashboard',
  attendance:  'Attendance',
  tasks:       'Tasks',
  nutrition:   'Nutrition',
  workout:     'Workout',
  metrics:     'Body Metrics',
  wardrobe:    'Wardrobe',
  splitwise:   'Splitwise',
  notes:       'Notes',
  settings:    'Settings',
  all:         'All Data'
};

function _handleModuleReset() {
  const sel = document.getElementById('resetModuleSelect');
  if (!sel || !sel.value) { showToast('Select a module first'); return; }
  const key   = sel.value;
  const label = MODULE_LABELS[key] || key;
  if (!confirm(`Delete all data from ${label}?\n\nThis action cannot be undone.`)) return;
  _resetModule(key);
}

async function _resetModule(key) {
  switch (key) {
    case 'dashboard':
      state.streak = 0; state.streakLastDate = null;
      break;
    case 'attendance':
      state.attendance = { subjects: [], logs: [] };
      break;
    case 'tasks':
      state.todo = { tasks: [], totalXp: 0 };
      break;
    case 'nutrition':
      state.meals = []; state.customMealPresets = null;
      resetMealPresets(); renderMealSections(); updateNutritionSummary();
      break;
    case 'workout':
      state.workouts = []; state.customWorkoutPresets = null;
      renderExerciseList(); renderWorkoutHistory();
      break;
    case 'metrics':
      state.metrics = [];
      renderMetricsLog(); renderMetricsAverages();
      break;
    case 'wardrobe':
      await clearAllImages();
      state.wardrobe = { items: [], outfits: [], logs: [] };
      break;
    case 'splitwise':
      state.splitwise = { friends: [], expenses: [], settlements: [], qrSettings: { name: '', upi: '', phone: '', address: '', footer: '', qrImage: '', signatureImage: '' } };
      break;
    case 'notes':
      state.notes = { folders: [{ id: 'folder-inbox', name: 'Inbox', color: '#0a84ff', pinned: true }], items: [] };
      break;
    case 'settings':
      state.settings = { ...DEFAULT_SETTINGS };
      loadSettingsForm();
      applyTheme('dark');
      break;
    case 'all':
      await clearAllImages();
      Object.assign(state, {
        settings: { ...DEFAULT_SETTINGS },
        meals: [], workouts: [], metrics: [], customMealPresets: null, customWorkoutPresets: null,
        streak: 0, streakLastDate: null,
        attendance: { subjects: [], logs: [] },
        todo: { tasks: [], totalXp: 0 },
        wardrobe: { items: [], outfits: [], logs: [] },
        skincare: { morningRoutine: [], eveningRoutine: [], products: [], logs: [], streak: 0, streakLastDate: null },
        splitwise: { friends: [], expenses: [], settlements: [], qrSettings: { name: '', upi: '', phone: '', address: '', footer: '', qrImage: '', signatureImage: '' } },
        notes: { folders: [{ id: 'folder-inbox', name: 'Inbox', color: '#0a84ff', pinned: true }], items: [] },
        custom: { taskColumns: DEFAULT_TASK_COLUMNS.map(c => ({ ...c })) }
      });
      resetMealPresets(); renderMealSections(); updateNutritionSummary();
      renderExerciseList(); renderWorkoutHistory();
      renderMetricsLog(); renderMetricsAverages();
      loadSettingsForm(); applyTheme('dark');
      break;
    default:
      showToast('Unknown module'); return;
  }
  saveData();
  renderDashboard();
  document.getElementById('resetModuleSelect').value = '';
  showToast(`${MODULE_LABELS[key] || key} data cleared`);
}

export function initExportImport() {
  const btn = document.getElementById('downloadDataBtn');
  if (btn) btn.addEventListener('click', downloadDataPDF);
}

function downloadDataPDF() {
  const btn = document.getElementById('downloadDataBtn');
  if (btn) btn.classList.add('busy');

  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN = 40;

    const C = {
      ink:   [28, 28, 30],   sub:   [120, 120, 128], blue:  [10, 132, 255],
      green: [40, 190, 90],  orange:[230, 145, 10],   red:   [220, 60, 50],
      band:  [16, 18, 28],   light: [244, 245, 248],  hairline: [225, 226, 232]
    };

    const s = state.settings;
    const today = todayStr();

    doc.setFillColor(...C.band);
    doc.rect(0, 0, PAGE_W, 150, 'F');
    doc.setFillColor(...C.blue);
    doc.rect(0, 150, PAGE_W, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text('Ezlifz', MARGIN, 70);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(180, 185, 195);
    doc.text('Complete Data Export', MARGIN, 92);
    doc.setFontSize(10);
    doc.text('Generated ' + new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }), MARGIN, 112);

    const summary = [
      ['Streak', (state.streak || 0) + ' d'],
      ['Meals', String(state.meals.length)],
      ['Workouts', String(state.workouts.length)],
      ['Tasks', String(state.todo.tasks.length)]
    ];
    let chipX = PAGE_W - MARGIN - summary.length * 86;
    summary.forEach(([label, val]) => {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(val, chipX, 78);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(170, 175, 188);
      doc.text(label.toUpperCase(), chipX, 92);
      chipX += 86;
    });

    let cursorY = 180;

    function sectionHeader(title, accent) {
      if (cursorY > PAGE_H - 90) { doc.addPage(); cursorY = MARGIN + 10; }
      doc.setFillColor(...(accent || C.blue));
      doc.rect(MARGIN, cursorY - 10, 4, 16, 'F');
      doc.setTextColor(...C.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(title, MARGIN + 12, cursorY + 3);
      cursorY += 16;
      doc.setDrawColor(...C.hairline);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, cursorY, PAGE_W - MARGIN, cursorY);
      cursorY += 10;
    }

    function table(head, body, accent) {
      if (!body.length) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(...C.sub);
        doc.text('No entries recorded.', MARGIN + 4, cursorY + 6);
        cursorY += 22;
        return;
      }
      doc.autoTable({
        head: [head], body,
        startY: cursorY,
        margin: { left: MARGIN, right: MARGIN },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: C.ink, lineColor: C.hairline, lineWidth: 0.4, overflow: 'linebreak' },
        headStyles: { fillColor: accent || C.blue, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: C.light },
        theme: 'grid'
      });
      cursorY = doc.lastAutoTable.finalY + 22;
    }

    function keyValueBlock(pairs, accent) {
      table(['Field', 'Value'], pairs.map(([k, v]) => [k, String(v)]), accent);
    }

    sectionHeader('Profile & Goals', C.blue);
    keyValueBlock([
      ['Primary goal', s.goal || '—'], ['Current weight', (s.currWeight ?? '—') + ' kg'],
      ['Goal weight', (s.goalWeight ?? '—') + ' kg'], ['Daily calorie goal', (s.calGoal ?? '—') + ' kcal'],
      ['Protein goal', (s.proGoal ?? '—') + ' g'], ['Carbs goal', (s.carbGoal ?? '—') + ' g'],
      ['Fat goal', (s.fatGoal ?? '—') + ' g'], ['Water goal', (s.waterGoal ?? '—') + ' L'],
      ['Current streak', (state.streak || 0) + ' days'], ['Theme', cap(s.theme || 'dark')]
    ], C.blue);

    sectionHeader('Nutrition Log', C.green);
    const meals = [...state.meals].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    table(
      ['Date', 'Meal', 'Food', 'Qty', 'Cal', 'Pro', 'Carb', 'Fat'],
      meals.map(m => [prettyDate(m.date), cap(m.mealType || ''), m.name || '', m.qty || '', Math.round(m.cal || 0), Math.round(m.pro || 0) + 'g', Math.round(m.carb || 0) + 'g', Math.round(m.fat || 0) + 'g']),
      C.green
    );

    sectionHeader('Workout History', C.orange);
    const workouts = [...state.workouts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const woRows = [];
    workouts.forEach(w => {
      const exNames = (w.exercises || []).map(e => `${e.name} (${e.sets}x${e.reps}${e.weight ? ' @' + e.weight + 'kg' : ''})`).join(', ');
      woRows.push([prettyDate(w.date), w.name || w.type || 'Workout', w.completed ? 'Completed' : 'In progress', (w.volume ? Math.round(w.volume) + ' kg' : '—'), exNames || '—']);
    });
    table(['Date', 'Session', 'Status', 'Volume', 'Exercises'], woRows, C.orange);

    sectionHeader('Body Metrics', C.blue);
    const metrics = [...state.metrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    table(
      ['Date', 'Weight', 'Waist', 'Sleep', 'Water', 'Energy', 'Mood'],
      metrics.map(m => [prettyDate(m.date), m.weight ? m.weight + ' kg' : '—', m.waist ? m.waist + ' cm' : '—', m.sleep ? m.sleep + ' h' : '—', m.water ? m.water + ' L' : '—', m.energy ? m.energy + '/10' : '—', m.mood ? m.mood + '/10' : '—']),
      C.blue
    );

    sectionHeader('Attendance', C.red);
    table(
      ['Subject', 'Professor', 'Required', 'Present', 'Total', 'Attendance %'],
      state.attendance.subjects.map(sub => {
        const st = getSubjectStats(sub.id);
        return [sub.name || '—', sub.professor || '—', (sub.requiredAttendance || 75) + '%', st.present, st.total, st.pct + '%'];
      }),
      C.red
    );
    if (state.attendance.logs.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
      if (cursorY > PAGE_H - 70) { doc.addPage(); cursorY = MARGIN + 10; }
      doc.text('Lecture log', MARGIN + 4, cursorY); cursorY += 12;
      const subMap = {};
      state.attendance.subjects.forEach(x => subMap[x.id] = x.name);
      const logs = [...state.attendance.logs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      table(['Date', 'Subject', 'Status', 'Type', 'Notes'], logs.map(l => [prettyDate(l.date), subMap[l.subjectId] || 'Unknown', cap(l.status || ''), l.lectureType || '—', l.notes || '']), C.red);
    }

    sectionHeader('Tasks', [150, 90, 230]);
    const tasks = [...state.todo.tasks].sort((a, b) => (a.completed - b.completed) || (a.deadline || '').localeCompare(b.deadline || ''));
    table(
      ['Title', 'Priority', 'Status', 'Deadline', 'Tags', 'XP'],
      tasks.map(t => [t.title || '', cap(t.priority || ''), t.completed ? 'Completed' : cap((t.status || '').replace('-', ' ')), t.deadline ? prettyDate(t.deadline) : '—', (t.tags || []).join(', ') || '—', t.xp || 0]),
      [150, 90, 230]
    );
    keyValueBlock([['Total XP earned', state.todo.totalXp || 0], ['Productivity level', Math.floor((state.todo.totalXp || 0) / 100) + 1]], [150, 90, 230]);

    sectionHeader('Wardrobe', [200, 110, 60]);
    table(
      ['Item', 'Category', 'Brand', 'Color', 'Fit', 'Season', 'Worn'],
      state.wardrobe.items.map(i => [i.name || '', CATEGORY_LABELS[i.category] || i.category || '', i.brand || '—', i.color || '—', cap(i.fit || ''), cap(i.season || 'all'), (i.wearCount || 0) + 'x']),
      [200, 110, 60]
    );
    if (state.wardrobe.outfits.length) {
      const itemMap = {}; state.wardrobe.items.forEach(i => itemMap[i.id] = i.name);
      if (cursorY > PAGE_H - 70) { doc.addPage(); cursorY = MARGIN + 10; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
      doc.text('Saved outfits', MARGIN + 4, cursorY); cursorY += 12;
      table(['Outfit', 'Occasion', 'Items'], state.wardrobe.outfits.map(o => [o.name || '', o.occasion || '—', (o.itemIds || []).map(id => itemMap[id]).filter(Boolean).join(', ') || '—']), [200, 110, 60]);
    }

    sectionHeader('Skincare', [60, 180, 170]);
    const routineRows = [];
    state.skincare.morningRoutine.forEach((r, i) => routineRows.push(['Morning', i + 1, r.product || '—', r.type || '—']));
    state.skincare.eveningRoutine.forEach((r, i) => routineRows.push(['Evening', i + 1, r.product || '—', r.type || '—']));
    table(['Routine', 'Step', 'Product', 'Type'], routineRows, [60, 180, 170]);
    if (state.skincare.products.length) {
      if (cursorY > PAGE_H - 70) { doc.addPage(); cursorY = MARGIN + 10; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
      doc.text('Products', MARGIN + 4, cursorY); cursorY += 12;
      table(['Product', 'Brand', 'Type', 'Opened', 'Expiry', 'Rating'], state.skincare.products.map(p => [p.name || '', p.brand || '—', p.type || '—', prettyDate(p.openedDate), prettyDate(p.expiryDate), p.rating ? p.rating + '/5' : '—']), [60, 180, 170]);
    }
    if (state.skincare.logs.length) {
      if (cursorY > PAGE_H - 70) { doc.addPage(); cursorY = MARGIN + 10; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
      doc.text('Daily skin log', MARGIN + 4, cursorY); cursorY += 12;
      const sl = [...state.skincare.logs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      table(['Date', 'Acne', 'Dryness', 'Oiliness', 'Redness', 'Glow', 'Hydration'], sl.map(l => [prettyDate(l.date), l.acne ?? '—', l.dryness ?? '—', l.oiliness ?? '—', l.redness ?? '—', l.glow ?? '—', l.hydration ?? '—']), [60, 180, 170]);
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.sub);
      doc.text('Ezlifz — Life OS', MARGIN, PAGE_H - 20);
      doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 20, { align: 'right' });
    }

    doc.save('Ezlifz_Data_' + today + '.pdf');
    showToast('Your data PDF has been downloaded');
    pushNotif('success', 'Export Complete', 'A full PDF of your Ezlifz data has been saved.');
  } catch (err) {
    console.error('PDF export failed:', err);
    showToast('Could not generate PDF — please try again', 3500);
  } finally {
    if (btn) btn.classList.remove('busy');
  }
}

