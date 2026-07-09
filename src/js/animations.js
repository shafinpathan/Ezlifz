export function initAnimations() {
  initRipples();
  initCardGlow();
  initScrollReveal();
  patchTimerAnimations();

  document.querySelectorAll('.nav-item,.bn-item').forEach(item => {
    item.addEventListener('click', () => setTimeout(reAttachDynamicAnimations, 120));
  });

  const mo = new MutationObserver(() => {
    clearTimeout(mo._t);
    mo._t = setTimeout(reAttachDynamicAnimations, 130);
  });
  const mainContent = document.getElementById('mainContent');
  if (mainContent) mo.observe(mainContent, { childList: true, subtree: true });
}

function addRipple(el) {
  el.addEventListener('pointerdown', function(e) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top  - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-wave';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

function initRipples() {
  document.querySelectorAll(
    '.btn-primary,.btn-sm,.btn-outline,.btn-outline-sm,.quick-add-chip,.preset-time-btn,.wday-btn,.period-btn,.nav-item,.bn-item'
  ).forEach(addRipple);
}

function initCardGlow() {
  document.querySelectorAll('.glass-card,.kpi-card,.ring-card').forEach(card => {
    if (card.dataset.glowed) return;
    card.dataset.glowed = '1';
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%');
    });
  });
}

function initScrollReveal() {
  const REVEAL = '.meal-section,.exercise-item,.history-item,.metrics-log-item,.strength-row,.avg-item,.ws-row,.feedback-item,.insight-item';
  const items = document.querySelectorAll(REVEAL);
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

  items.forEach(el => {
    if (!el.classList.contains('reveal-item')) el.classList.add('reveal-item');
    if (!el.classList.contains('visible')) io.observe(el);
  });
}

function patchTimerAnimations() {
  const startBtn = document.getElementById('timerStartBtn');
  const stopBtn  = document.getElementById('timerStopBtn');
  const display  = document.getElementById('workoutTimer');
  if (!startBtn || !display) return;
  startBtn.addEventListener('click', () => display.classList.add('running'), true);
  stopBtn.addEventListener('click',  () => display.classList.remove('running'), true);
}

function reAttachDynamicAnimations() {
  document.querySelectorAll(
    '.btn-primary,.btn-sm,.btn-outline,.btn-outline-sm,.preset-add-btn,.wday-load-btn,.preset-time-btn,.wday-btn,.period-btn'
  ).forEach(el => {
    if (!el.dataset.rippled) { addRipple(el); el.dataset.rippled = '1'; }
  });
  document.querySelectorAll('.glass-card,.kpi-card,.ring-card').forEach(card => {
    if (!card.dataset.glowed) {
      card.dataset.glowed = '1';
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%');
      });
    }
  });
  const REVEAL = '.meal-section,.exercise-item,.history-item,.metrics-log-item,.strength-row,.avg-item,.ws-row,.feedback-item,.insight-item';
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.05 });
  document.querySelectorAll(REVEAL).forEach(el => {
    if (!el.classList.contains('reveal-item')) {
      el.classList.add('reveal-item');
      io.observe(el);
    }
  });
}

export function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], raf;
  const COUNT = 38;
  const COLORS = ['rgba(50,215,75,VAL)','rgba(10,132,255,VAL)','rgba(255,45,85,VAL)','rgba(191,90,242,VAL)'];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkParticle() {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    return { x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.4, dx: (Math.random() - 0.5) * 0.35, dy: (Math.random() - 0.5) * 0.25 - 0.1, a: Math.random() * 0.45 + 0.08, color: c };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace('VAL', p.a.toFixed(2));
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < -4) p.x = W + 4;
      if (p.x > W + 4) p.x = -4;
      if (p.y < -4) p.y = H + 4;
      if (p.y > H + 4) p.y = -4;
    });
    raf = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < COUNT; i++) particles.push(mkParticle());
  draw();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else draw();
  });
}
