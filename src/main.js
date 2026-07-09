import { loadData, saveData, storageAvailable, state } from './js/state.js';
import { applyTheme, initSettings, initExportImport } from './js/settings.js';
import { initNav, initFab, initMoreSheet, initCommandPalette } from './js/nav.js';
import { initNutrition, initMealPresets, initEditFoodModal } from './js/nutrition.js';
import { initWorkout, initWorkoutPresets } from './js/workout.js';
import { initProgress } from './js/progress.js';
import { initMetrics } from './js/metrics.js';
import { initAttendance, getSubjectStats } from './js/attendance.js';
import { initTodo } from './js/todo.js';
import { initAITab } from './js/ai.js';
import { initWardrobe } from './js/wardrobe.js';
import { initSplitwise } from './js/splitwise.js';
import { initNotes } from './js/notes.js';
import { showToast } from './js/utils.js';
import { initAnimations, initParticles } from './js/animations.js';
import { renderDashboard, updateStreak } from './js/dashboard.js';
import { setNotifDeps, pushNotif, runStartupNotifications } from './js/notifications.js';

function init() {
  loadData();

  // Wire dependency injections
  setNotifDeps({ getSubjectStats });

  // Apply saved theme (loadData must run first)
  applyTheme(state.settings.theme || 'dark');

  initNav();
  initNutrition();
  initMealPresets();
  initWorkout();
  initWorkoutPresets();
  initProgress();
  initMetrics();
  initSettings();
  initEditFoodModal();
  initExportImport();

  initAttendance();
  initTodo();
  initAITab();
  initCommandPalette();
  initFab();
  initWardrobe();
  initSplitwise();
  initNotes();
  initMoreSheet();

  renderDashboard();
  updateStreak();

  document.getElementById('dashDate').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  window.addEventListener('beforeunload', saveData);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveData(); });

  if (!storageAvailable()) {
    setTimeout(() => pushNotif('warning', 'Storage Blocked', 'This environment blocks local storage. Open the file directly in your browser so your data persists.'), 800);
  }

  setTimeout(runStartupNotifications, 1200);

  console.log('Ezlifz — Life OS loaded');
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  initParticles();
  initAnimations();
  initPWA();
});

function initPWA() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Detect when a new SW is waiting (update available)
    const onUpdateFound = () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          _showUpdateBanner(newWorker);
        }
      });
    };

    if (reg.waiting && navigator.serviceWorker.controller) {
      _showUpdateBanner(reg.waiting);
    }
    reg.addEventListener('updatefound', onUpdateFound);

    // Reload when a new SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }).catch(() => {});

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window._deferredInstall = e;
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.style.display = 'flex';
  });

  window.addEventListener('appinstalled', () => {
    window._deferredInstall = null;
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.style.display = 'none';
    showToast('Ezlifz installed successfully');
  });

  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      if (window._deferredInstall) {
        window._deferredInstall.prompt();
        window._deferredInstall.userChoice.then(() => { window._deferredInstall = null; });
      } else {
        showToast('App already installed or not supported in this browser');
      }
    });
  }
}

function _showUpdateBanner(worker) {
  const banner = document.getElementById('updateBanner');
  if (!banner) return;
  banner.classList.remove('hidden');

  document.getElementById('updateNowBtn')?.addEventListener('click', () => {
    worker.postMessage('SKIP_WAITING');
    banner.classList.add('hidden');
  }, { once: true });

  document.getElementById('updateLaterBtn')?.addEventListener('click', () => {
    banner.classList.add('hidden');
  }, { once: true });
}
