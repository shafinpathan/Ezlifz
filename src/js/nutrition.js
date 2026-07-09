import { state, autoSave } from './state.js';
import { uid, todayStr, showToast, setBarPct, esc } from './utils.js';
import { renderDashboard, updateStreak } from './dashboard.js';

/* ── Quick-add food data ───────────────────── */
const QUICK_ADD_FOODS = [
  { name: 'Egg (1 whole)', qty: '1 egg', cal: 70, pro: 6, carb: 0, fat: 5 },
  { name: 'Chicken Breast', qty: '100g', cal: 165, pro: 31, carb: 0, fat: 3.6 },
  { name: 'White Rice', qty: '100g', cal: 130, pro: 2.7, carb: 28, fat: 0.3 },
  { name: 'Paneer', qty: '100g', cal: 265, pro: 18, carb: 3, fat: 20 },
  { name: 'Banana', qty: '1 med', cal: 89, pro: 1.1, carb: 23, fat: 0.3 },
  { name: 'Oats', qty: '50g', cal: 190, pro: 6.5, carb: 32, fat: 3.5 },
  { name: 'Peanut Butter', qty: '2 tbsp', cal: 188, pro: 8, carb: 6, fat: 16 },
  { name: 'Soya Chunks', qty: '50g dry', cal: 175, pro: 25, carb: 13, fat: 0.5 },
  { name: 'Milk (full fat)', qty: '250ml', cal: 150, pro: 8, carb: 12, fat: 8 },
  { name: 'Whey Protein', qty: '1 scoop', cal: 120, pro: 24, carb: 3, fat: 1.5 },
];

/* ── Meal plan preset data ────────────────── */
const MEAL_PLAN_PRESETS = [
  { time: '6:00 AM', label: 'Wake Up', mealType: 'Snacks', options: [{ label: 'Option 1', foods: '1 banana · 5 almonds · 2 walnuts', cal: 220, pro: 5, carb: 27, fat: 10 }, { label: 'Option 2', foods: '2 dates · 5 almonds · 1 apple', cal: 240, pro: 4, carb: 35, fat: 8 }, { label: 'Option 3', foods: 'Banana · Peanut handful', cal: 260, pro: 8, carb: 28, fat: 12 }] },
  { time: '6:30 AM', label: 'Pre Workout', mealType: 'Snacks', options: [{ label: 'Option 1', foods: '2 bananas · 2 tbsp peanut butter', cal: 390, pro: 10, carb: 48, fat: 16 }, { label: 'Option 2', foods: '60g oats · 250ml milk · Honey', cal: 420, pro: 15, carb: 58, fat: 10 }, { label: 'Option 3', foods: 'Peanut butter sandwich · 1 banana', cal: 450, pro: 14, carb: 55, fat: 18 }] },
  { time: '8:30 AM', label: 'Post Workout', mealType: 'Post-Workout', options: [{ label: 'Option 1', foods: '1 scoop whey · 4 eggs · 2 bananas · 5g creatine', cal: 600, pro: 45, carb: 50, fat: 22 }, { label: 'Option 2', foods: '1 scoop whey · 4 eggs · 2 potatoes', cal: 580, pro: 44, carb: 45, fat: 20 }, { label: 'Option 3', foods: '1 scoop whey · PB sandwich · 4 eggs', cal: 650, pro: 48, carb: 42, fat: 30 }] },
  { time: '10:30 AM', label: 'Breakfast', mealType: 'Breakfast', options: [{ label: 'Option 1', foods: '4 egg omelette · 4 bread slices · Peanut butter', cal: 620, pro: 34, carb: 45, fat: 32 }, { label: 'Option 2', foods: '100g paneer bhurji · 3 paratha · Curd', cal: 700, pro: 30, carb: 60, fat: 35 }, { label: 'Option 3', foods: '50g soya chunks · Poha · Banana', cal: 580, pro: 32, carb: 72, fat: 10 }] },
  { time: '1:30 PM', label: 'Lunch', mealType: 'Lunch', options: [{ label: 'Option 1', foods: '200g chicken · Rice · 3 roti · Dal', cal: 850, pro: 60, carb: 85, fat: 20 }, { label: 'Option 2', foods: '150g paneer · Rice · 4 roti', cal: 900, pro: 38, carb: 95, fat: 40 }, { label: 'Option 3', foods: '75g soya chunks · Rice · 3 roti · Dal', cal: 820, pro: 42, carb: 100, fat: 12 }] },
  { time: '4:30 PM', label: 'Evening', mealType: 'Snacks', options: [{ label: 'Option 1 (Shake)', foods: '250ml milk · 2 bananas · 60g oats · PB', cal: 700, pro: 22, carb: 95, fat: 22 }, { label: 'Option 2', foods: 'PB sandwich · Banana · Peanuts', cal: 620, pro: 20, carb: 55, fat: 30 }, { label: 'Option 3', foods: 'Boiled potatoes · Black chana · Banana', cal: 550, pro: 18, carb: 90, fat: 6 }] },
  { time: '7:30 PM', label: 'Dinner', mealType: 'Dinner', options: [{ label: 'Option 1', foods: '250g chicken curry · 3 roti · Vegetables', cal: 780, pro: 65, carb: 50, fat: 30 }, { label: 'Option 2', foods: '100g paneer bhurji · Rice · Salad', cal: 650, pro: 28, carb: 65, fat: 25 }, { label: 'Option 3', foods: '50g soya chunks · 4 roti · Dal', cal: 700, pro: 35, carb: 90, fat: 10 }] },
  { time: '10:30 PM', label: 'Before Sleep', mealType: 'Snacks', options: [{ label: 'Option 1', foods: '2 boiled eggs · PB sandwich', cal: 350, pro: 18, carb: 22, fat: 20 }, { label: 'Option 2', foods: 'Banana · Roasted peanuts', cal: 320, pro: 10, carb: 30, fat: 18 }, { label: 'Option 3', foods: 'Curd · Almonds', cal: 280, pro: 12, carb: 15, fat: 16 }] },
];

let activeMealPresets = null;
let activePresetTimeIdx = 0;
let presetManageMode = false;
let editingFoodId = null;

export function resetMealPresets() { activeMealPresets = null; }

function getMealPresets() {
  if (!activeMealPresets) {
    activeMealPresets = state.customMealPresets
      ? JSON.parse(JSON.stringify(state.customMealPresets))
      : JSON.parse(JSON.stringify(MEAL_PLAN_PRESETS));
  }
  return activeMealPresets;
}

function saveMealPresets() {
  state.customMealPresets = JSON.parse(JSON.stringify(activeMealPresets));
  autoSave();
}

/* ── Init ─────────────────────────────────── */
export function initNutrition() {
  renderQuickAdd();
  renderMealSections();
  updateNutritionSummary();
  document.getElementById('addFoodBtn').addEventListener('click', addFood);
  document.getElementById('nutritionSearch').addEventListener('input', e => renderMealSections(e.target.value.toLowerCase()));
}

export function initMealPresets() {
  renderPresetTabs();
  document.getElementById('addPresetTimeBtn').addEventListener('click', addPresetTab);
  document.getElementById('managePresetsBtn').addEventListener('click', toggleManageMode);
  document.getElementById('saveNewPresetOptionBtn').addEventListener('click', saveNewPresetOption);
  document.getElementById('cancelAddPresetBtn').addEventListener('click', () => { document.getElementById('addPresetOptionArea').style.display = 'none'; });
}

export function initEditFoodModal() {
  document.getElementById('editFoodSave').addEventListener('click', () => {
    const m = state.meals.find(m => m.id === editingFoodId);
    if (!m) return;
    m.name = document.getElementById('editFoodName').value.trim();
    m.qty = document.getElementById('editFoodQty').value.trim();
    m.cal = +document.getElementById('editFoodCal').value;
    m.pro = +document.getElementById('editFoodPro').value;
    m.carb = +document.getElementById('editFoodCarb').value;
    m.fat = +document.getElementById('editFoodFat').value;
    autoSave();
    document.getElementById('editFoodModal').classList.add('hidden');
    renderMealSections();
    updateNutritionSummary();
    renderDashboard();
    showToast('Food updated');
  });
  document.getElementById('editFoodCancel').addEventListener('click', () => { document.getElementById('editFoodModal').classList.add('hidden'); });
  document.getElementById('editFoodModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('editFoodModal').classList.add('hidden'); });
}

function renderQuickAdd() {
  const grid = document.getElementById('quickAddGrid');
  grid.innerHTML = QUICK_ADD_FOODS.map(f =>
    `<button class="quick-add-chip" data-food="${esc(JSON.stringify(f))}">${esc(f.name)}</button>`
  ).join('');
  grid.querySelectorAll('.quick-add-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = JSON.parse(btn.dataset.food);
      const mealType = document.getElementById('mealType').value || 'Snacks';
      addMealEntry({ ...f, mealType });
      showToast(`Added ${f.name} to ${mealType}`);
    });
  });
}

function addFood() {
  const name = document.getElementById('foodName').value.trim();
  const qty = document.getElementById('foodQty').value.trim();
  const cal = +document.getElementById('foodCal').value;
  const pro = +document.getElementById('foodPro').value;
  const carb = +document.getElementById('foodCarb').value;
  const fat = +document.getElementById('foodFat').value;
  const mealType = document.getElementById('mealType').value.trim() || 'Snacks';
  if (!name || !cal) { showToast('Please enter food name and calories'); return; }
  addMealEntry({ name, qty, cal, pro, carb, fat, mealType });
  ['foodName', 'foodQty', 'foodCal', 'foodPro', 'foodCarb', 'foodFat'].forEach(id => document.getElementById(id).value = '');
  showToast(`${name} added to ${mealType}!`);
}

export function addMealEntry(f) {
  const entry = {
    id: uid(), date: todayStr(), mealType: f.mealType, name: f.name, qty: f.qty || '',
    cal: +f.cal || 0, pro: +f.pro || 0, carb: +f.carb || 0, fat: +f.fat || 0,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };
  state.meals.push(entry);
  autoSave();
  renderMealSections();
  updateNutritionSummary();
  updateStreak();
  renderDashboard();
}

export function renderMealSections(filter = '') {
  const today = todayStr();
  const container = document.getElementById('mealSections');
  container.innerHTML = '';
  const todayMeals = state.meals.filter(m => m.date === today);
  const filtered = filter ? todayMeals.filter(m => m.name.toLowerCase().includes(filter)) : todayMeals;
  const standardOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Post-Workout'];
  const customTypes = [...new Set(filtered.map(m => m.mealType))].filter(t => !standardOrder.includes(t));
  const allTypes = [...standardOrder, ...customTypes];

  allTypes.forEach(mtype => {
    const items = filtered.filter(m => m.mealType === mtype);
    if (!filter && items.length === 0) return;
    const mCal = items.reduce((a, m) => a + m.cal, 0);
    const mPro = items.reduce((a, m) => a + m.pro, 0);
    const mCarb = items.reduce((a, m) => a + m.carb, 0);
    const mFat = items.reduce((a, m) => a + m.fat, 0);
    const section = document.createElement('div');
    section.className = 'meal-section';
    section.innerHTML = `
      <div class="meal-header">
        <span class="meal-name">${mtype}</span>
        <span class="meal-total">${mCal} kcal · P:${mPro}g C:${mCarb}g F:${mFat}g</span>
      </div>
      <div class="meal-body">
        ${items.length === 0
          ? `<div class="empty-state-sm" style="padding:.75rem 1rem;text-align:left">No ${mtype} entries</div>`
          : items.map(m => `
            <div class="food-item" data-id="${m.id}">
              <div class="food-info">
                <span class="food-name-text">${esc(m.name)}</span>
                <span class="food-qty-text">${m.qty ? m.qty + ' · ' : ''}${m.time}</span>
              </div>
              <div class="food-macros">
                <span><span class="macro-label">kcal</span>${m.cal}</span>
                <span><span class="macro-label">P</span>${m.pro}g</span>
                <span><span class="macro-label">C</span>${m.carb}g</span>
                <span><span class="macro-label">F</span>${m.fat}g</span>
              </div>
              <div class="food-actions">
                <button class="btn-icon edit" data-id="${m.id}" title="Edit">✎</button>
                <button class="btn-icon" data-id="${m.id}" title="Delete">✕</button>
              </div>
            </div>`).join('')}
      </div>`;
    container.appendChild(section);
  });

  container.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      if (e.currentTarget.classList.contains('edit')) openEditFood(id);
      else deleteFood(id);
    });
  });
}

function deleteFood(id) {
  state.meals = state.meals.filter(m => m.id !== id);
  autoSave();
  renderMealSections();
  updateNutritionSummary();
  renderDashboard();
  showToast('Food entry removed');
}

export function updateNutritionSummary() {
  const today = todayStr();
  const s = state.settings;
  const todayMeals = state.meals.filter(m => m.date === today);
  const totCal = todayMeals.reduce((a, m) => a + m.cal, 0);
  const totPro = todayMeals.reduce((a, m) => a + m.pro, 0);
  const totCarb = todayMeals.reduce((a, m) => a + m.carb, 0);
  const totFat = todayMeals.reduce((a, m) => a + m.fat, 0);
  document.getElementById('nsCalories').textContent = totCal;
  document.getElementById('nsProtein').textContent = totPro + 'g';
  document.getElementById('nsCarbs').textContent = totCarb + 'g';
  document.getElementById('nsFat').textContent = totFat + 'g';
  setBarPct('nsCalBar', totCal, s.calGoal);
  setBarPct('nsProBar', totPro, s.proGoal);
  setBarPct('nsCarbBar', totCarb, s.carbGoal);
  setBarPct('nsFatBar', totFat, s.fatGoal);
}

function openEditFood(id) {
  const food = state.meals.find(m => m.id === id);
  if (!food) return;
  editingFoodId = id;
  document.getElementById('editFoodName').value = food.name;
  document.getElementById('editFoodQty').value = food.qty;
  document.getElementById('editFoodCal').value = food.cal;
  document.getElementById('editFoodPro').value = food.pro;
  document.getElementById('editFoodCarb').value = food.carb;
  document.getElementById('editFoodFat').value = food.fat;
  document.getElementById('editFoodModal').classList.remove('hidden');
}

/* ── Preset tabs ──────────────────────────── */
function renderPresetTabs() {
  const presets = getMealPresets();
  const tabs = document.getElementById('presetTimeTabs');
  tabs.innerHTML = presets.map((p, i) =>
    `<div class="preset-tab-wrap" style="display:inline-flex;align-items:center;gap:0">
      <button class="preset-time-btn${i === activePresetTimeIdx ? ' active' : ''}" data-idx="${i}">${esc(p.time)} — ${esc(p.label)}</button>
      ${presetManageMode ? `<button class="preset-del-tab" data-idx="${i}" title="Delete this tab" style="background:var(--accent-red);border:none;color:#fff;border-radius:0 8px 8px 0;padding:.32rem .55rem;cursor:pointer;font-size:.8rem;line-height:1;margin-left:1px">✕</button>` : ''}
    </div>`
  ).join('');
  tabs.querySelectorAll('.preset-time-btn').forEach(btn => {
    btn.addEventListener('click', () => { activePresetTimeIdx = +btn.dataset.idx; renderPresetTabs(); renderPresetOptions(); });
  });
  tabs.querySelectorAll('.preset-del-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      if (getMealPresets().length <= 1) { showToast('Cannot delete the last preset tab'); return; }
      if (!confirm(`Delete preset tab "${getMealPresets()[idx].label}"?`)) return;
      getMealPresets().splice(idx, 1);
      activePresetTimeIdx = Math.max(0, activePresetTimeIdx - (idx <= activePresetTimeIdx ? 1 : 0));
      saveMealPresets();
      renderPresetTabs();
      renderPresetOptions();
      showToast('Preset tab deleted');
    });
  });
  renderPresetOptions();
  document.getElementById('managePresetsBtn').textContent = presetManageMode ? 'Done' : 'Manage';
  document.getElementById('addPresetOptionArea').style.display = 'none';
}

function toggleManageMode() { presetManageMode = !presetManageMode; renderPresetTabs(); }

function addPresetTab() {
  const label = prompt('Tab name (e.g. "6:00 AM", "Pre-Workout"):');
  if (!label || !label.trim()) return;
  const time = prompt('Time label (e.g. "6:00 AM"):') || '';
  const mealType = prompt('Meal type (e.g. Breakfast, Snacks):') || 'Snacks';
  getMealPresets().push({ time: time.trim() || label.trim(), label: label.trim(), mealType, options: [] });
  activePresetTimeIdx = getMealPresets().length - 1;
  saveMealPresets();
  renderPresetTabs();
  renderPresetOptions();
  showToast(`Tab "${label.trim()}" added`);
}

function renderPresetOptions() {
  const presets = getMealPresets();
  const p = presets[activePresetTimeIdx];
  const row = document.getElementById('presetOptionsRow');
  document.getElementById('addPresetToTab').textContent = `${p.time} — ${p.label}`;

  if (p.options.length === 0) {
    row.innerHTML = `<div style="color:var(--text-muted);font-size:.84rem;padding:.75rem 0">No options yet.${presetManageMode ? ' Click "+ Add Option" below to add one.' : ''}</div>`;
  } else {
    row.innerHTML = p.options.map((opt, i) => `
      <div class="preset-option-card" style="position:relative">
        ${presetManageMode ? `<button class="preset-del-opt" data-idx="${i}" title="Delete option" style="position:absolute;top:.6rem;right:.6rem;background:var(--accent-red);border:none;color:#fff;border-radius:6px;padding:.2rem .5rem;cursor:pointer;font-size:.72rem">✕</button>` : ''}
        <div class="preset-option-label">${esc(opt.label)}</div>
        <div class="preset-foods-list">${opt.foods.split('·').map(f => `<span>• ${esc(f.trim())}</span>`).join('')}</div>
        <div class="preset-macros">
          <span class="preset-macro-pill kcal">${opt.cal} kcal</span>
          <span class="preset-macro-pill pro">P ${opt.pro}g</span>
          <span class="preset-macro-pill carbs">C ${opt.carb}g</span>
          <span class="preset-macro-pill fat">F ${opt.fat}g</span>
        </div>
        <button class="preset-add-btn" data-idx="${i}">+ Log This Meal</button>
      </div>`).join('');
  }

  if (presetManageMode) {
    const addBtn = document.createElement('div');
    addBtn.className = 'preset-option-card';
    addBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:100px;cursor:pointer;border:2px dashed var(--border-light);background:var(--surface-soft)';
    addBtn.innerHTML = `<span style="color:var(--text-muted);font-size:.9rem">＋ Add Option</span>`;
    addBtn.addEventListener('click', () => {
      document.getElementById('addPresetOptionArea').style.display = 'block';
      document.getElementById('addPresetOptionArea').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    row.appendChild(addBtn);
  }

  row.querySelectorAll('.preset-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const opt = p.options[+btn.dataset.idx];
      addMealEntry({ name: `${p.label} — ${opt.label}`, qty: opt.foods, cal: opt.cal, pro: opt.pro, carb: opt.carb, fat: opt.fat, mealType: p.mealType });
      btn.textContent = '✓ Logged!';
      btn.style.background = 'var(--accent-green)';
      setTimeout(() => { btn.textContent = '+ Log This Meal'; btn.style.background = ''; }, 1800);
      showToast(`${p.label} ${opt.label} logged!`);
    });
  });

  row.querySelectorAll('.preset-del-opt').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      if (!confirm(`Delete option "${p.options[idx].label}"?`)) return;
      p.options.splice(idx, 1);
      saveMealPresets();
      renderPresetOptions();
      showToast('Option deleted');
    });
  });
}

function saveNewPresetOption() {
  const label = document.getElementById('newPresetLabel').value.trim();
  const foods = document.getElementById('newPresetFoods').value.trim();
  const cal = +document.getElementById('newPresetCal').value;
  const pro = +document.getElementById('newPresetPro').value;
  const carb = +document.getElementById('newPresetCarb').value;
  const fat = +document.getElementById('newPresetFat').value;
  if (!label || !foods || !cal) { showToast('Enter label, foods, and calories'); return; }
  const p = getMealPresets()[activePresetTimeIdx];
  p.options.push({ label, foods, cal, pro: pro || 0, carb: carb || 0, fat: fat || 0 });
  saveMealPresets();
  ['newPresetLabel', 'newPresetFoods', 'newPresetCal', 'newPresetPro', 'newPresetCarb', 'newPresetFat'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('addPresetOptionArea').style.display = 'none';
  renderPresetOptions();
  showToast(`Option "${label}" added!`);
}
