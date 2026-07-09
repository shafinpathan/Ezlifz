import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { state, autoSave } from './state.js';
import { uid, todayStr, formatDate, prettyDate, showToast } from './utils.js';

// ── Module-level state ──────────────────────
let swCurrentView = 'overview';
let swActiveFilter = 'all';
let swSearchQuery = '';
let swCurrentFriendId = null;
let swEditingFriendId = null;
let swCurrentExpFriendId = null;
let swSettleFriendId = null;
let swCurrentReceiptId = null;
let swExpAttachmentB64 = null;
const swCharts = {};

// ── Balance calculation ─────────────────────
function computeShare(expense) {
  if (expense.splitType === 'equal') return expense.amount / 2;
  if (expense.splitType === 'exact') return expense.splitValue || 0;
  if (expense.splitType === 'percentage') return (expense.amount * (expense.splitValue || 50)) / 100;
  return expense.amount / 2;
}

export function getFriendBalance(friendId) {
  const sw = state.splitwise;
  let balance = 0;
  for (const e of sw.expenses.filter(e => e.friendId === friendId)) {
    const share = computeShare(e);
    if (e.paidBy === 'me') balance += share;
    else balance -= share;
  }
  for (const s of sw.settlements.filter(s => s.friendId === friendId)) {
    if (s.paidBy === 'friend') balance -= s.amount;
    else balance += s.amount;
  }
  return Math.round(balance * 100) / 100;
}

// Balance BEFORE a given settlement (= what that settlement was resolving)
function getBalanceBeforeSettlement(friendId, settlementId) {
  const sw = state.splitwise;
  let bal = 0;
  for (const e of sw.expenses.filter(e => e.friendId === friendId)) {
    const share = computeShare(e);
    if (e.paidBy === 'me') bal += share;
    else bal -= share;
  }
  for (const s of sw.settlements.filter(s => s.friendId === friendId && s.id !== settlementId)) {
    if (s.paidBy === 'friend') bal -= s.amount;
    else bal += s.amount;
  }
  return Math.round(bal * 100) / 100;
}

function getLastTransactionDate(friendId) {
  const sw = state.splitwise;
  const dates = [
    ...sw.expenses.filter(e => e.friendId === friendId).map(e => e.date),
    ...sw.settlements.filter(s => s.friendId === friendId).map(s => s.date)
  ];
  return dates.length ? dates.sort().slice(-1)[0] : null;
}

// ── Receipt numbering ───────────────────────
function generateReceiptNumber(date) {
  const d = date.replace(/-/g, '');
  const sameDay = state.splitwise.settlements.filter(s => s.date === date);
  return `EZ-${d}-${String(sameDay.length + 1).padStart(3, '0')}`;
}

// ── Image compression ───────────────────────
function compressImage(file, maxPx = 600) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxPx || h > maxPx) {
          const r = Math.min(maxPx / w, maxPx / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── HTML escaping ───────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function modeTag(mode) {
  const cls = { cash: 'sw-badge-cash', upi: 'sw-badge-upi', bank: 'sw-badge-bank', card: 'sw-badge-card', other: 'sw-badge-other' };
  const lbl = { cash: 'Cash', upi: 'UPI', bank: 'Bank', card: 'Card', other: 'Other' };
  return `<span class="sw-badge ${cls[mode] || 'sw-badge-other'}">${lbl[mode] || esc(mode)}</span>`;
}

function friendColor(name) {
  const colors = ['#32d74b','#0a84ff','#ff9f0a','#bf5af2','#ff3b30','#ffd60a'];
  return colors[(name.charCodeAt(0) || 0) % colors.length];
}

function initials(name) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

// ── Modal helpers ───────────────────────────
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── Sub-tab switching ───────────────────────
function switchSwTab(tab) {
  swCurrentView = tab;
  document.querySelectorAll('.sw-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.swTab === tab));
  document.querySelectorAll('.sw-view').forEach(v => v.classList.add('hidden'));
  const view = document.getElementById('swView-' + tab);
  if (view) view.classList.remove('hidden');
  if (tab === 'statistics') renderSwStats();
  if (tab === 'history')    renderSwHistory();
  if (tab === 'qr-settings') loadSwSettings();
}

// ── Init ────────────────────────────────────
export function initSplitwise() {
  // Sub-tabs
  document.querySelectorAll('.sw-tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchSwTab(btn.dataset.swTab))
  );

  // Add Friend
  document.getElementById('swAddFriendBtn').addEventListener('click', () => openAddFriendModal());

  // Friend modal
  document.getElementById('swSaveFriendBtn').addEventListener('click', saveFriend);
  document.getElementById('swCancelFriendBtn').addEventListener('click', () => closeModal('swAddFriendModal'));

  // Expense modal
  document.getElementById('swSaveExpenseBtn').addEventListener('click', saveExpense);
  document.getElementById('swCancelExpenseBtn').addEventListener('click', () => closeModal('swAddExpenseModal'));
  document.getElementById('swExpSplitType').addEventListener('change', updateSplitValueLabel);
  document.getElementById('swExpAttachBtn').addEventListener('click', () => document.getElementById('swExpAttachment').click());
  document.getElementById('swExpAttachment').addEventListener('change', handleExpAttachment);

  // Settle modal
  document.getElementById('swSaveSettleBtn').addEventListener('click', saveSettlement);
  document.getElementById('swCancelSettleBtn').addEventListener('click', () => closeModal('swSettleModal'));

  // Receipt modal
  document.getElementById('swReceiptPrintBtn').addEventListener('click', printCurrentReceipt);
  document.getElementById('swReceiptDownloadBtn').addEventListener('click', downloadCurrentReceiptPDF);
  document.getElementById('swReceiptDownloadJpgBtn').addEventListener('click', downloadCurrentReceiptJPG);
  document.getElementById('swReceiptCloseBtn').addEventListener('click', () => closeModal('swReceiptModal'));

  // Overview search + filter
  document.getElementById('swSearch').addEventListener('input', e => {
    swSearchQuery = e.target.value.toLowerCase();
    renderFriendsList();
  });
  document.querySelectorAll('.sw-filter-pill').forEach(pill =>
    pill.addEventListener('click', () => {
      document.querySelectorAll('.sw-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      swActiveFilter = pill.dataset.filter;
      renderFriendsList();
    })
  );

  // History filters
  document.getElementById('swHistorySearch').addEventListener('input', renderSwHistory);
  document.getElementById('swHistoryPeriod').addEventListener('change', renderSwHistory);
  document.getElementById('swHistoryType').addEventListener('change', renderSwHistory);

  // QR Settings
  document.getElementById('swSaveSettingsBtn').addEventListener('click', saveSwSettings);
  initImageUpload('swQrFileInput', 'swQrPreview', 'swQrUploadHint', 'swQrDropzone', 'swQrReplaceBtn', 'swQrDeleteBtn', 'qrImage');
  initImageUpload('swSigFileInput', 'swSigPreview', 'swSigUploadHint', 'swSigDropzone', 'swSigReplaceBtn', 'swSigDeleteBtn', 'signatureImage');

  // Export / Import
  document.getElementById('swExportJsonBtn').addEventListener('click', exportSwJSON);
  document.getElementById('swExportCsvBtn').addEventListener('click', exportSwCSV);
  document.getElementById('swImportJsonBtn').addEventListener('click', () => document.getElementById('swImportFileInput').click());
  document.getElementById('swImportFileInput').addEventListener('change', importSwJSON);

  // Backdrop dismiss for all SW modals
  ['swAddFriendModal','swAddExpenseModal','swSettleModal','swFriendDetailModal','swReceiptModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
  });
}

// ── Main render ─────────────────────────────
export function renderSplitwise() {
  renderSwKpis();
  renderFriendsList();
}

function renderSwKpis() {
  const sw = state.splitwise;
  let totalIOwe = 0, totalOwed = 0;
  sw.friends.forEach(f => {
    const bal = getFriendBalance(f.id);
    if (bal > 0) totalOwed += bal;
    else totalIOwe += Math.abs(bal);
  });
  const net = totalOwed - totalIOwe;
  document.getElementById('swKpiIOwe').textContent  = '₹' + totalIOwe.toFixed(0);
  document.getElementById('swKpiOwed').textContent  = '₹' + totalOwed.toFixed(0);
  const netEl = document.getElementById('swKpiNet');
  netEl.textContent = (net >= 0 ? '+' : '') + '₹' + Math.abs(net).toFixed(0);
  netEl.style.color = net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  document.getElementById('swKpiFriends').textContent     = sw.friends.length;
  document.getElementById('swKpiExpenses').textContent    = sw.expenses.length;
  document.getElementById('swKpiSettlements').textContent = sw.settlements.length;
}

// ── Friends list ─────────────────────────────
function renderFriendsList() {
  const sw = state.splitwise;
  let friends = [...sw.friends];

  if (swSearchQuery) {
    friends = friends.filter(f => f.name.toLowerCase().includes(swSearchQuery) ||
      (f.phone || '').includes(swSearchQuery));
  }

  friends = friends.filter(f => {
    if (swActiveFilter === 'all') return true;
    const bal = getFriendBalance(f.id);
    if (swActiveFilter === 'owes-me') return bal > 0.005;
    if (swActiveFilter === 'i-owe')   return bal < -0.005;
    if (swActiveFilter === 'settled') return Math.abs(bal) <= 0.005;
    return true;
  });

  const container = document.getElementById('swFriendsList');

  if (!friends.length) {
    const empty = sw.friends.length === 0
      ? 'No friends added yet.<br>Click <strong>+ Add Friend</strong> to get started!'
      : 'No friends match the current filter.';
    container.innerHTML = `<div class="sw-empty"><div class="sw-empty-icon">💸</div><div class="sw-empty-text">${empty}</div></div>`;
    return;
  }

  container.innerHTML = `<div class="sw-friend-grid">${friends.map(friendCardHTML).join('')}</div>`;

  container.querySelectorAll('.sw-friend-card').forEach(card =>
    card.addEventListener('click', () => openFriendDetail(card.dataset.friendId))
  );
}

function friendCardHTML(f) {
  const bal   = getFriendBalance(f.id);
  const cls   = bal > 0.005 ? 'positive' : bal < -0.005 ? 'negative' : 'zero';
  const lbl   = bal > 0.005 ? 'owes you' : bal < -0.005 ? 'you owe' : 'all settled';
  const clr   = friendColor(f.name);
  const last  = getLastTransactionDate(f.id);

  return `<div class="sw-friend-card" data-friend-id="${f.id}">
    <div class="sw-friend-avatar" style="background:${clr}22;color:${clr}">${initials(f.name)}</div>
    <div class="sw-friend-name">${esc(f.name)}</div>
    ${f.phone ? `<div class="sw-friend-phone">📞 ${esc(f.phone)}</div>` : ''}
    <div class="sw-friend-balance ${cls}">₹${Math.abs(bal).toFixed(2)}</div>
    <div class="sw-friend-balance-label">${lbl}</div>
    ${last ? `<div class="sw-friend-last">Last: ${formatDate(last)}</div>` : ''}
  </div>`;
}

// ── Friend detail ────────────────────────────
function openFriendDetail(friendId) {
  swCurrentFriendId = friendId;
  renderFriendDetail(friendId);
  openModal('swFriendDetailModal');
}

function renderFriendDetail(friendId) {
  const sw     = state.splitwise;
  const friend = sw.friends.find(f => f.id === friendId);
  if (!friend) return;

  const bal       = getFriendBalance(friendId);
  const balCls    = bal > 0.005 ? 'positive' : bal < -0.005 ? 'negative' : 'zero';
  const clr       = friendColor(friend.name);
  const exps      = sw.expenses.filter(e => e.friendId === friendId);
  const setts     = sw.settlements.filter(s => s.friendId === friendId);
  const paidByMe  = exps.filter(e => e.paidBy === 'me').reduce((s, e) => s + e.amount, 0);
  const paidByF   = exps.filter(e => e.paidBy === 'friend').reduce((s, e) => s + e.amount, 0);
  const lastSett  = [...setts].sort((a, b) => b.date.localeCompare(a.date))[0];

  const txns = [
    ...exps.map(e  => ({ ...e,  _type: 'expense'    })),
    ...setts.map(s => ({ ...s,  _type: 'settlement' }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  const content = document.getElementById('swFriendDetailContent');
  content.innerHTML = `
    <div class="sw-detail-header">
      <div class="sw-detail-avatar" style="background:${clr}22;color:${clr}">${initials(friend.name)}</div>
      <div class="sw-detail-info">
        <div class="sw-detail-name">${esc(friend.name)}</div>
        ${friend.phone ? `<div class="sw-detail-phone">📞 ${esc(friend.phone)}</div>` : ''}
        ${friend.notes ? `<div class="sw-detail-phone">📝 ${esc(friend.notes)}</div>` : ''}
      </div>
      <div class="sw-friend-balance ${balCls}" style="font-size:1.6rem;margin-left:auto;text-align:right">
        ${bal > 0.005 ? '+' : bal < -0.005 ? '-' : ''}₹${Math.abs(bal).toFixed(2)}
      </div>
    </div>

    <div class="sw-detail-kpis">
      <div class="sw-detail-kpi">
        <div class="sw-detail-kpi-val" style="color:var(--accent-blue)">₹${paidByMe.toFixed(0)}</div>
        <div class="sw-detail-kpi-label">Paid by Me</div>
      </div>
      <div class="sw-detail-kpi">
        <div class="sw-detail-kpi-val" style="color:var(--accent-orange)">₹${paidByF.toFixed(0)}</div>
        <div class="sw-detail-kpi-label">Paid by Friend</div>
      </div>
      <div class="sw-detail-kpi">
        <div class="sw-detail-kpi-val" style="color:var(--text-secondary);font-size:.9rem">${lastSett ? prettyDate(lastSett.date) : '—'}</div>
        <div class="sw-detail-kpi-label">Last Settlement</div>
      </div>
    </div>

    <div class="sw-detail-actions">
      <button class="btn-primary" style="padding:.5rem 1rem;font-size:.82rem" data-action="expense">+ Expense</button>
      <button class="btn-sm btn-outline" data-action="settle">✓ Settle Up</button>
      <button class="btn-sm btn-outline" data-action="edit">✏ Edit</button>
      <button class="btn-sm btn-outline" style="color:var(--danger);margin-left:auto" data-action="delete">Delete</button>
    </div>

    <div style="font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);font-weight:600;margin-bottom:.75rem">
      Transaction History (${txns.length})
    </div>

    ${txns.length === 0
      ? '<div class="sw-empty" style="padding:2rem"><div class="sw-empty-text">No transactions yet. Add an expense or settle up.</div></div>'
      : txns.map(t => txnHTML(t, friend)).join('')}
  `;

  // Action buttons
  content.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.action;
      if (a === 'expense') { closeModal('swFriendDetailModal'); openAddExpenseModal(friendId); }
      if (a === 'settle')  { closeModal('swFriendDetailModal'); openSettleModal(friendId); }
      if (a === 'edit')    { openAddFriendModal(friendId); }
      if (a === 'delete')  { deleteFriend(friendId); }
    });
  });

  // Delete transaction buttons
  content.querySelectorAll('.sw-tx-del').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTxn(btn.dataset.type, btn.dataset.id, friendId);
    })
  );

  // Receipt view buttons
  content.querySelectorAll('.sw-tx-receipt').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openReceiptModal(btn.dataset.sid);
    })
  );
}

function txnHTML(t, friend) {
  if (t._type === 'expense') {
    const share = computeShare(t);
    const pos   = t.paidBy === 'me';
    const mePaid = t.paidBy === 'me'
      ? `You paid ₹${t.amount.toFixed(2)}`
      : `${esc(friend.name)} paid ₹${t.amount.toFixed(2)}`;
    const splitLbl = t.splitType === 'equal' ? '50/50'
      : t.splitType === 'percentage' ? `${t.splitValue}%`
      : `Exact ₹${(t.splitValue || 0).toFixed(2)}`;
    return `<div class="sw-history-item">
      <div class="sw-history-icon expense">💳</div>
      <div class="sw-history-body">
        <div class="sw-history-title">${esc(t.title)}</div>
        <div class="sw-history-meta">${prettyDate(t.date)} · ${mePaid} · ${splitLbl}</div>
        ${t.notes ? `<div class="sw-history-meta" style="color:var(--text-dim)">${esc(t.notes)}</div>` : ''}
        ${t.attachment ? `<div style="margin-top:.4rem"><img src="${t.attachment}" alt="bill" style="width:44px;height:44px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--border)" onclick="window.open(this.src,'_blank')" /></div>` : ''}
      </div>
      <div class="sw-history-amount ${pos ? 'positive' : 'negative'}">${pos ? '+' : '-'}₹${share.toFixed(2)}</div>
      <button class="sw-tx-del btn-outline-sm" data-type="expense" data-id="${t.id}" style="padding:.28rem .5rem;color:var(--text-dim);flex-shrink:0">✕</button>
    </div>`;
  } else {
    const pos = t.paidBy === 'friend';
    const who = t.paidBy === 'friend' ? `${esc(friend.name)} paid you` : `You paid ${esc(friend.name)}`;
    return `<div class="sw-history-item">
      <div class="sw-history-icon settlement">✓</div>
      <div class="sw-history-body">
        <div class="sw-history-title">Settlement ${modeTag(t.paymentMode)}</div>
        <div class="sw-history-meta">${prettyDate(t.date)} · ${who}</div>
        <div class="sw-history-meta" style="color:var(--text-dim);font-size:.7rem"># ${t.receiptNumber || '—'}</div>
        ${t.remarks ? `<div class="sw-history-meta" style="color:var(--text-dim)">${esc(t.remarks)}</div>` : ''}
      </div>
      <div class="sw-history-amount ${pos ? 'negative' : 'positive'}">${pos ? '-' : '+'}₹${t.amount.toFixed(2)}</div>
      <button class="sw-tx-receipt btn-outline-sm" data-sid="${t.id}" style="padding:.28rem .5rem;flex-shrink:0" title="View receipt">🧾</button>
      <button class="sw-tx-del btn-outline-sm" data-type="settlement" data-id="${t.id}" style="padding:.28rem .5rem;color:var(--text-dim);flex-shrink:0">✕</button>
    </div>`;
  }
}

// ── Add / Edit Friend ────────────────────────
function openAddFriendModal(friendId = null) {
  swEditingFriendId = friendId;
  const f = friendId ? state.splitwise.friends.find(f => f.id === friendId) : null;
  document.getElementById('swFriendModalTitle').textContent = f ? 'Edit Friend' : 'Add Friend';
  document.getElementById('swSaveFriendBtn').textContent    = f ? 'Save Changes' : 'Add Friend';
  document.getElementById('swFriendName').value  = f?.name  || '';
  document.getElementById('swFriendPhone').value = f?.phone || '';
  document.getElementById('swFriendNotes').value = f?.notes || '';
  openModal('swAddFriendModal');
  setTimeout(() => document.getElementById('swFriendName').focus(), 80);
}

function saveFriend() {
  const name = document.getElementById('swFriendName').value.trim();
  if (!name) { showToast('Name is required'); return; }

  const sw = state.splitwise;
  if (swEditingFriendId) {
    const f = sw.friends.find(f => f.id === swEditingFriendId);
    if (f) { f.name = name; f.phone = document.getElementById('swFriendPhone').value.trim(); f.notes = document.getElementById('swFriendNotes').value.trim(); }
    showToast('Friend updated');
  } else {
    sw.friends.push({ id: uid(), name, phone: document.getElementById('swFriendPhone').value.trim(), notes: document.getElementById('swFriendNotes').value.trim(), createdAt: new Date().toISOString() });
    showToast('Friend added!');
  }

  autoSave();
  closeModal('swAddFriendModal');
  renderSplitwise();

  // Refresh detail modal if open and editing same friend
  if (swEditingFriendId && swCurrentFriendId === swEditingFriendId) renderFriendDetail(swEditingFriendId);
}

function deleteFriend(friendId) {
  const f = state.splitwise.friends.find(f => f.id === friendId);
  if (!confirm(`Delete "${f?.name}" and all their transactions? This cannot be undone.`)) return;
  state.splitwise.friends      = state.splitwise.friends.filter(x => x.id !== friendId);
  state.splitwise.expenses     = state.splitwise.expenses.filter(x => x.friendId !== friendId);
  state.splitwise.settlements  = state.splitwise.settlements.filter(x => x.friendId !== friendId);
  autoSave();
  closeModal('swFriendDetailModal');
  renderSplitwise();
  showToast('Friend deleted');
}

// ── Add Expense ──────────────────────────────
export function openAddExpenseModal(friendId = null) {
  swCurrentExpFriendId = friendId;
  swExpAttachmentB64 = null;

  const sel = document.getElementById('swExpFriend');
  sel.innerHTML = state.splitwise.friends.map(f =>
    `<option value="${f.id}" ${f.id === friendId ? 'selected' : ''}>${esc(f.name)}</option>`
  ).join('');

  if (!state.splitwise.friends.length) {
    showToast('Add a friend first before adding an expense');
    openAddFriendModal();
    return;
  }

  document.getElementById('swExpTitle').value       = '';
  document.getElementById('swExpAmount').value      = '';
  document.getElementById('swExpPaidBy').value      = 'me';
  document.getElementById('swExpSplitType').value   = 'equal';
  document.getElementById('swExpSplitValue').value  = '';
  document.getElementById('swExpDate').value        = todayStr();
  document.getElementById('swExpNotes').value       = '';
  document.getElementById('swExpAttachmentName').textContent = 'No file selected';
  document.getElementById('swExpAttachment').value  = '';
  delete document.getElementById('swExpAttachment').dataset.b64;
  updateSplitValueLabel();
  openModal('swAddExpenseModal');
  setTimeout(() => document.getElementById('swExpTitle').focus(), 80);
}

function updateSplitValueLabel() {
  const type = document.getElementById('swExpSplitType').value;
  const wrap  = document.getElementById('swExpSplitValueWrap');
  const label = document.getElementById('swExpSplitValueLabel');
  if (type === 'equal') {
    wrap.style.display = 'none';
  } else {
    wrap.style.display = '';
    label.textContent = type === 'percentage' ? "Other's Share (%)" : "Other's Share (₹)";
  }
}

async function handleExpAttachment(e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('swExpAttachmentName').textContent = file.name;
  if (file.type.startsWith('image/')) {
    swExpAttachmentB64 = await compressImage(file, 400);
  } else {
    const reader = new FileReader();
    reader.onload = ev => { swExpAttachmentB64 = ev.target.result; };
    reader.readAsDataURL(file);
  }
}

function saveExpense() {
  const title    = document.getElementById('swExpTitle').value.trim();
  const amount   = parseFloat(document.getElementById('swExpAmount').value);
  const friendId = document.getElementById('swExpFriend').value;

  if (!title)             { showToast('Expense title required'); return; }
  if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }
  if (!friendId)          { showToast('Select a friend'); return; }

  const splitType = document.getElementById('swExpSplitType').value;
  const splitVal  = splitType === 'equal' ? amount / 2 : parseFloat(document.getElementById('swExpSplitValue').value) || 0;

  const expense = {
    id: uid(), friendId, title, amount,
    paidBy:     document.getElementById('swExpPaidBy').value,
    splitType,
    splitValue: splitVal,
    date:       document.getElementById('swExpDate').value || todayStr(),
    notes:      document.getElementById('swExpNotes').value.trim(),
    attachment: swExpAttachmentB64 || null,
    createdAt:  new Date().toISOString()
  };

  state.splitwise.expenses.push(expense);
  autoSave();
  closeModal('swAddExpenseModal');
  renderSplitwise();
  showToast('Expense added!');

  if (swCurrentFriendId === friendId) openFriendDetail(friendId);
}

// ── Settle Up ───────────────────────────────
function openSettleModal(friendId) {
  swSettleFriendId = friendId;
  const friend = state.splitwise.friends.find(f => f.id === friendId);
  const bal    = getFriendBalance(friendId);

  document.getElementById('swSettleTitle').textContent = `Settle Up — ${friend?.name || ''}`;

  let info;
  if (Math.abs(bal) < 0.005)  info = '✓ Already fully settled up!';
  else if (bal > 0)            info = `${esc(friend?.name)} owes you ₹${bal.toFixed(2)}`;
  else                         info = `You owe ${esc(friend?.name)} ₹${Math.abs(bal).toFixed(2)}`;
  document.getElementById('swSettleBalanceInfo').textContent = info;

  document.getElementById('swSettleAmount').value   = Math.abs(bal).toFixed(2);
  document.getElementById('swSettlePaidBy').value   = bal > 0 ? 'friend' : 'me';
  document.getElementById('swSettleMode').value     = 'cash';
  document.getElementById('swSettleDate').value     = todayStr();
  document.getElementById('swSettleRemarks').value  = '';
  openModal('swSettleModal');
}

function saveSettlement() {
  const amount = parseFloat(document.getElementById('swSettleAmount').value);
  if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }

  const date          = document.getElementById('swSettleDate').value || todayStr();
  const receiptNumber = generateReceiptNumber(date);

  const settlement = {
    id: uid(),
    friendId:    swSettleFriendId,
    amount,
    paidBy:      document.getElementById('swSettlePaidBy').value,
    paymentMode: document.getElementById('swSettleMode').value,
    remarks:     document.getElementById('swSettleRemarks').value.trim(),
    date,
    receiptNumber,
    createdAt: new Date().toISOString()
  };

  state.splitwise.settlements.push(settlement);
  autoSave();
  closeModal('swSettleModal');
  renderSplitwise();
  showToast(`Settlement recorded! Receipt: ${receiptNumber}`);

  setTimeout(() => openReceiptModal(settlement.id), 400);
}

function deleteTxn(type, id, friendId) {
  if (!confirm('Delete this transaction?')) return;
  if (type === 'expense')    state.splitwise.expenses    = state.splitwise.expenses.filter(x => x.id !== id);
  if (type === 'settlement') state.splitwise.settlements = state.splitwise.settlements.filter(x => x.id !== id);
  autoSave();
  renderSplitwise();
  // Refresh detail if open
  if (swCurrentFriendId === friendId) renderFriendDetail(friendId);
  showToast('Deleted');
}

// ── Receipt ──────────────────────────────────
function openReceiptModal(settlementId) {
  swCurrentReceiptId = settlementId;
  document.getElementById('swReceiptContent').innerHTML = buildReceiptHTML(settlementId);
  openModal('swReceiptModal');
}

function buildReceiptHTML(settlementId) {
  const sw     = state.splitwise;
  const s      = sw.settlements.find(x => x.id === settlementId);
  if (!s) return '<p style="color:var(--text-muted)">Receipt not found.</p>';
  const friend = sw.friends.find(f => f.id === s.friendId);
  const qs     = sw.qrSettings;
  const paidBy     = s.paidBy === 'me' ? (qs.name || 'Me') : (friend?.name || 'Friend');
  const receivedBy = s.paidBy === 'me' ? (friend?.name || 'Friend') : (qs.name || 'Me');
  const remBal     = getFriendBalance(s.friendId);
  const remStr     = Math.abs(remBal) < 0.005 ? '₹0.00 (Fully Settled)' : (remBal > 0 ? `${esc(friend?.name)} owes ₹${remBal.toFixed(2)}` : `You owe ₹${Math.abs(remBal).toFixed(2)}`);

  // Expense breakdown rows
  const exps = sw.expenses.filter(e => e.friendId === s.friendId).sort((a, b) => a.date.localeCompare(b.date));
  const breakdownRows = exps.map(e => {
    const share = computeShare(e);
    const pos   = e.paidBy === 'me'; // positive = friend owes me
    const who   = e.paidBy === 'me' ? `You paid ₹${e.amount.toFixed(2)}` : `${esc(friend?.name || 'Friend')} paid ₹${e.amount.toFixed(2)}`;
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;padding:.28rem 0;border-bottom:1px solid #f4f4f4;font-size:.76rem">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.title)}</div>
        <div style="color:#888;font-size:.68rem;margin-top:.1rem">${formatDate(e.date)} · ${who}</div>
      </div>
      <div style="font-weight:700;flex-shrink:0;color:${pos ? '#1a8a38' : '#c0392b'}">${pos ? '+' : '-'}₹${share.toFixed(2)}</div>
    </div>`;
  }).join('');

  const balBeforeSettle = getBalanceBeforeSettlement(s.friendId, settlementId);

  return `<div class="sw-receipt" id="swReceiptPrintArea">
    <div class="sw-receipt-header">
      ${qs.name    ? `<div style="font-size:.9rem;font-weight:700;margin-bottom:.15rem">${esc(qs.name)}</div>` : ''}
      ${qs.phone   ? `<div style="font-size:.7rem;color:#777">${esc(qs.phone)}</div>` : ''}
      ${qs.address ? `<div style="font-size:.7rem;color:#777">${esc(qs.address)}</div>` : ''}
      <div class="sw-receipt-title" style="margin-top:.5rem">MONEY RECEIPT</div>
      <div class="sw-receipt-subtitle">EZLIFZ PERSONAL FINANCE</div>
    </div>

    <div class="sw-receipt-row"><span class="sw-receipt-label">Receipt No.</span><span class="sw-receipt-value">${esc(s.receiptNumber)}</span></div>
    <div class="sw-receipt-row"><span class="sw-receipt-label">Date</span><span class="sw-receipt-value">${prettyDate(s.date)}</span></div>
    <div class="sw-receipt-row"><span class="sw-receipt-label">Paid By</span><span class="sw-receipt-value">${esc(paidBy)}</span></div>
    <div class="sw-receipt-row"><span class="sw-receipt-label">Received By</span><span class="sw-receipt-value">${esc(receivedBy)}</span></div>
    ${s.remarks ? `<div class="sw-receipt-row"><span class="sw-receipt-label">Remarks</span><span class="sw-receipt-value">${esc(s.remarks)}</span></div>` : ''}
    <div class="sw-receipt-row"><span class="sw-receipt-label">Rem. Balance</span><span class="sw-receipt-value">${remStr}</span></div>

    ${exps.length ? `
    <div style="margin:.75rem 0 .4rem">
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;padding-bottom:.3rem;border-bottom:1px solid #ddd;margin-bottom:.2rem">Amount Breakdown</div>
      ${breakdownRows}
      <div style="display:flex;justify-content:space-between;padding:.32rem 0;font-size:.78rem;font-weight:700;border-top:1px dashed #ccc;margin-top:.2rem">
        <span style="color:#555">Outstanding Total</span>
        <span>${balBeforeSettle > 0 ? esc(friend?.name) + ' owed' : 'You owed'} ₹${Math.abs(balBeforeSettle).toFixed(2)}</span>
      </div>
    </div>` : ''}

    <div class="sw-receipt-total"><span>AMOUNT TO PAY</span><span>₹${s.amount.toFixed(2)}</span></div>

    <div class="sw-receipt-footer">
      ${qs.qrImage        ? `<div class="sw-receipt-qr"><img src="${qs.qrImage}" alt="QR" /></div>` : ''}
      ${qs.upi            ? `<div style="margin:.35rem 0">UPI: ${esc(qs.upi)}</div>` : ''}
      ${qs.signatureImage ? `<div style="margin:.5rem 0"><img src="${qs.signatureImage}" style="max-height:38px;object-fit:contain" alt="Sig" /></div>` : ''}
      <div style="font-weight:600">${esc(qs.footer || 'Thank you!')}</div>
      <div style="font-size:.62rem;margin-top:.3rem;color:#aaa">Generated by Ezlifz · ${new Date().toLocaleString('en-IN')}</div>
    </div>
  </div>`;
}

function printCurrentReceipt() {
  const area = document.getElementById('swReceiptPrintArea');
  if (!area) return;
  const win = window.open('', '_blank', 'width=520,height=800');
  win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Courier New',Courier,monospace; background:#fff; color:#1c1c1e; padding:20px; }
    .sw-receipt { max-width:380px; margin:0 auto; font-size:.82rem; }
    .sw-receipt-header { text-align:center; border-bottom:2px dashed #ccc; padding-bottom:1rem; margin-bottom:1rem; }
    .sw-receipt-title { font-size:1.1rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
    .sw-receipt-subtitle { font-size:.68rem; color:#888; text-transform:uppercase; letter-spacing:.08em; }
    .sw-receipt-row { display:flex; justify-content:space-between; gap:.75rem; padding:.3rem 0; border-bottom:1px solid #f0f0f0; }
    .sw-receipt-label { color:#777; flex-shrink:0; }
    .sw-receipt-value { font-weight:600; text-align:right; }
    .sw-receipt-total { margin-top:1rem; padding-top:.85rem; border-top:2px dashed #ccc; display:flex; justify-content:space-between; font-size:1rem; font-weight:700; }
    .sw-receipt-footer { text-align:center; margin-top:1rem; padding-top:.85rem; border-top:1px solid #eee; font-size:.7rem; color:#888; line-height:1.6; }
    .sw-receipt-qr img { max-width:110px; max-height:110px; object-fit:contain; display:block; margin:.5rem auto; }
    @media print { body { padding:0; } }
  </style></head><body>${area.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 350);
}

function downloadCurrentReceiptPDF() {
  const sw     = state.splitwise;
  const s      = sw.settlements.find(x => x.id === swCurrentReceiptId);
  if (!s) return;
  const friend = sw.friends.find(f => f.id === s.friendId);
  const qs     = sw.qrSettings;

  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const W   = doc.internal.pageSize.getWidth();

  // Header
  let y = 10;
  if (qs.name) {
    doc.setFont('courier', 'bold'); doc.setFontSize(11);
    doc.text(qs.name, W / 2, y, { align: 'center' }); y += 5;
    if (qs.phone) { doc.setFont('courier', 'normal'); doc.setFontSize(7); doc.text(qs.phone, W / 2, y, { align: 'center' }); y += 4; }
    if (qs.address) { doc.setFontSize(7); doc.text(qs.address, W / 2, y, { align: 'center' }); y += 4; }
    y += 1;
  }
  doc.setFont('courier', 'bold'); doc.setFontSize(14);
  doc.text('MONEY RECEIPT', W / 2, y, { align: 'center' }); y += 5;
  doc.setFont('courier', 'normal'); doc.setFontSize(7.5);
  doc.text('EZLIFZ PERSONAL FINANCE', W / 2, y, { align: 'center' }); y += 5;

  doc.setLineWidth(0.3); doc.setLineDash([2, 2]);
  doc.line(5, y, W - 5, y); doc.setLineDash([]); y += 4;

  // Meta rows
  const paidBy     = s.paidBy === 'me' ? (qs.name || 'Me') : (friend?.name || 'Friend');
  const receivedBy = s.paidBy === 'me' ? (friend?.name || 'Friend') : (qs.name || 'Me');
  const remBal     = getFriendBalance(s.friendId);
  const remStr     = Math.abs(remBal) < 0.005 ? 'Rs.0 (Fully Settled)' : `Rs.${Math.abs(remBal).toFixed(2)}`;

  const metaRows = [
    ['Receipt No.', s.receiptNumber],
    ['Date',        prettyDate(s.date)],
    ['Paid By',     paidBy],
    ['Received By', receivedBy],
  ];
  if (s.remarks) metaRows.push(['Remarks', s.remarks]);
  metaRows.push(['Rem. Balance', remStr]);

  doc.autoTable({
    body: metaRows, startY: y,
    theme: 'plain',
    styles:       { font: 'courier', fontSize: 8.5, cellPadding: 1.6 },
    columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold', textColor: [100,100,100] } },
    margin: { left: 5, right: 5 }
  });
  y = doc.lastAutoTable.finalY + 4;

  // Amount breakdown
  const exps = sw.expenses.filter(e => e.friendId === s.friendId).sort((a, b) => a.date.localeCompare(b.date));
  if (exps.length) {
    doc.setFont('courier', 'bold'); doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('AMOUNT BREAKDOWN', 5, y); y += 1;
    doc.setLineWidth(0.2); doc.line(5, y, W - 5, y); y += 3;
    doc.setTextColor(0, 0, 0);

    const breakdownRows = exps.map(e => {
      const share = computeShare(e);
      const pos   = e.paidBy === 'me';
      const who   = e.paidBy === 'me' ? `You paid Rs.${e.amount.toFixed(2)}` : `Friend paid Rs.${e.amount.toFixed(2)}`;
      return [
        `${e.title}\n${formatDate(e.date)} · ${who}`,
        `${pos ? '+' : '-'}Rs.${share.toFixed(2)}`
      ];
    });

    const balBefore = getBalanceBeforeSettlement(s.friendId, s.id);
    const totalRow  = [
      { content: 'Outstanding Total', styles: { fontStyle: 'bold' } },
      { content: `Rs.${Math.abs(balBefore).toFixed(2)}`, styles: { fontStyle: 'bold' } }
    ];

    doc.autoTable({
      body: [...breakdownRows, totalRow], startY: y,
      theme: 'plain',
      styles:       { font: 'courier', fontSize: 8, cellPadding: 1.4 },
      columnStyles: { 0: { cellWidth: W - 32 - 10 }, 1: { cellWidth: 32, halign: 'right' } },
      margin: { left: 5, right: 5 },
      didDrawPage: () => {}
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  // AMOUNT TO PAY
  doc.setLineWidth(0.3); doc.setLineDash([2, 2]);
  doc.line(5, y, W - 5, y); doc.setLineDash([]); y += 5;
  doc.setFont('courier', 'bold'); doc.setFontSize(12);
  doc.text('AMOUNT TO PAY:', 5, y);
  doc.text(`Rs.${s.amount.toFixed(2)}`, W - 5, y, { align: 'right' });
  y += 10;

  // QR + footer
  if (qs.qrImage) {
    try {
      const sz = 30, qx = (W - sz) / 2;
      doc.addImage(qs.qrImage, 'JPEG', qx, y, sz, sz); y += sz + 4;
    } catch (_) { /* skip */ }
  }
  if (qs.upi) {
    doc.setFont('courier', 'normal'); doc.setFontSize(7.5);
    doc.text(`UPI: ${qs.upi}`, W / 2, y, { align: 'center' }); y += 5;
  }
  if (qs.signatureImage) {
    try {
      const sw2 = 32, sh = 14, sx = (W - sw2) / 2;
      doc.addImage(qs.signatureImage, 'JPEG', sx, y, sw2, sh); y += sh + 3;
    } catch (_) { /* skip */ }
  }
  doc.setFont('courier', 'normal'); doc.setFontSize(8);
  doc.text(qs.footer || 'Thank you!', W / 2, y, { align: 'center' }); y += 5;
  doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
  doc.text(`Generated by Ezlifz · ${new Date().toLocaleString('en-IN')}`, W / 2, y, { align: 'center' });

  doc.save(`Receipt-${s.receiptNumber}.pdf`);
  showToast('Receipt PDF downloaded');
}

async function downloadCurrentReceiptJPG() {
  const area = document.getElementById('swReceiptPrintArea');
  if (!area) return;
  showToast('Generating image…');
  try {
    const canvas = await html2canvas(area, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      removeContainer: true
    });
    const url = canvas.toDataURL('image/jpeg', 0.95);
    const a   = Object.assign(document.createElement('a'), { href: url, download: `Receipt-${swCurrentReceiptId || 'EZ'}.jpg` });
    a.click();
    showToast('Receipt image downloaded');
  } catch (err) {
    console.error(err);
    showToast('Could not generate image');
  }
}

// ── History view ─────────────────────────────
function renderSwHistory() {
  const sw       = state.splitwise;
  const query    = document.getElementById('swHistorySearch').value.toLowerCase();
  const period   = document.getElementById('swHistoryPeriod').value;
  const typeFilter = document.getElementById('swHistoryType').value;
  const container = document.getElementById('swHistoryList');

  const now   = new Date();
  const today = todayStr();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lmEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  function inPeriod(d) {
    if (period === 'all') return true;
    if (period === 'today') return d === today;
    if (period === 'month') return d >= mStart;
    if (period === 'lastmonth') return d >= lmStart && d <= lmEnd;
    return true;
  }

  let items = [];
  if (typeFilter !== 'settlement') {
    sw.expenses.forEach(e => {
      const f = sw.friends.find(x => x.id === e.friendId);
      if (inPeriod(e.date) && (!query || e.title.toLowerCase().includes(query) || (f?.name.toLowerCase().includes(query)))) {
        items.push({ ...e, _type: 'expense', _friend: f });
      }
    });
  }
  if (typeFilter !== 'expense') {
    sw.settlements.forEach(s => {
      const f = sw.friends.find(x => x.id === s.friendId);
      if (inPeriod(s.date) && (!query || (f?.name.toLowerCase().includes(query)) || (s.receiptNumber || '').toLowerCase().includes(query) || (s.remarks || '').toLowerCase().includes(query))) {
        items.push({ ...s, _type: 'settlement', _friend: f });
      }
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  if (!items.length) {
    container.innerHTML = '<div class="sw-empty"><div class="sw-empty-icon">📋</div><div class="sw-empty-text">No transactions found for the selected filters.</div></div>';
    return;
  }

  container.innerHTML = items.map(t => {
    if (t._type === 'expense') {
      const share = computeShare(t);
      const pos   = t.paidBy === 'me';
      return `<div class="sw-history-item">
        <div class="sw-history-icon expense">💳</div>
        <div class="sw-history-body">
          <div class="sw-history-title">${esc(t.title)}</div>
          <div class="sw-history-meta">${esc(t._friend?.name || '?')} · ${prettyDate(t.date)}</div>
        </div>
        <div class="sw-history-amount ${pos ? 'positive' : 'negative'}">${pos ? '+' : '-'}₹${share.toFixed(2)}</div>
      </div>`;
    } else {
      const pos = t.paidBy === 'friend';
      return `<div class="sw-history-item">
        <div class="sw-history-icon settlement">✓</div>
        <div class="sw-history-body">
          <div class="sw-history-title">Settlement ${modeTag(t.paymentMode)}</div>
          <div class="sw-history-meta">${esc(t._friend?.name || '?')} · ${prettyDate(t.date)}</div>
          <div class="sw-history-meta" style="font-size:.7rem;color:var(--text-dim)"># ${esc(t.receiptNumber || '')}</div>
        </div>
        <div class="sw-history-amount ${pos ? 'negative' : 'positive'}">${pos ? '-' : '+'}₹${t.amount.toFixed(2)}</div>
        <button class="sw-tx-receipt-h btn-outline-sm" data-sid="${t.id}" style="padding:.28rem .5rem;flex-shrink:0">🧾</button>
      </div>`;
    }
  }).join('');

  container.querySelectorAll('.sw-tx-receipt-h').forEach(btn =>
    btn.addEventListener('click', () => openReceiptModal(btn.dataset.sid))
  );
}

// ── Statistics ───────────────────────────────
function renderSwStats() {
  const sw = state.splitwise;

  // Monthly expenses — last 6 months
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), key: d.toISOString().slice(0, 7) });
  }
  buildBarChart('swChartMonthly',
    months.map(m => m.label),
    months.map(m => sw.expenses.filter(e => e.date.startsWith(m.key)).reduce((s, e) => s + e.amount, 0)),
    'rgba(10,132,255,0.7)'
  );

  // Money flow: lent vs borrowed vs settled
  const lent     = sw.expenses.filter(e => e.paidBy === 'me').reduce((s, e) => s + computeShare(e), 0);
  const borrowed = sw.expenses.filter(e => e.paidBy === 'friend').reduce((s, e) => s + computeShare(e), 0);
  const settled  = sw.settlements.reduce((s, x) => s + x.amount, 0);
  buildBarChart('swChartFlow',
    ['Money Lent', 'Money Borrowed', 'Settled'],
    [lent, borrowed, settled],
    ['rgba(50,215,75,0.75)', 'rgba(255,59,48,0.75)', 'rgba(10,132,255,0.75)'],
    true
  );

  // Payment modes doughnut
  const modeCounts = {};
  sw.settlements.forEach(s => { modeCounts[s.paymentMode] = (modeCounts[s.paymentMode] || 0) + 1; });
  const modeColors = { cash: '#ffd60a', upi: '#0a84ff', bank: '#32d74b', card: '#bf5af2', other: '#ff9f0a' };
  buildDoughnutChart('swChartModes',
    Object.keys(modeCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
    Object.values(modeCounts),
    Object.keys(modeCounts).map(k => modeColors[k] || '#888')
  );

  // Balance by friend bar
  buildBarChart('swChartFriends',
    sw.friends.map(f => f.name.split(' ')[0]),
    sw.friends.map(f => Math.abs(getFriendBalance(f.id))),
    sw.friends.map(f => getFriendBalance(f.id) >= 0 ? 'rgba(50,215,75,0.75)' : 'rgba(255,59,48,0.75)'),
    true
  );
}

function buildBarChart(canvasId, labels, data, color, multiColor = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (swCharts[canvasId]) { swCharts[canvasId].destroy(); delete swCharts[canvasId]; }
  swCharts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: multiColor && Array.isArray(color) ? color : color,
        borderColor: 'transparent',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } } }
      }
    }
  });
}

function buildDoughnutChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (swCharts[canvasId]) { swCharts[canvasId].destroy(); delete swCharts[canvasId]; }
  if (!data.length) {
    canvas.parentElement.querySelector('.card-title').insertAdjacentHTML('afterend', '<div class="sw-empty" style="padding:1.5rem"><div class="sw-empty-text">No settlement data yet</div></div>');
    return;
  }
  swCharts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.6)', font: { size: 10 }, padding: 12, boxWidth: 12 } } }
    }
  });
}

// ── QR Settings ──────────────────────────────
function loadSwSettings() {
  const qs = state.splitwise.qrSettings;
  document.getElementById('swQrName').value    = qs.name    || '';
  document.getElementById('swQrUpi').value     = qs.upi     || '';
  document.getElementById('swQrPhone').value   = qs.phone   || '';
  document.getElementById('swQrAddress').value = qs.address || '';
  document.getElementById('swQrFooter').value  = qs.footer  || '';
  setImgPreview('swQrPreview', 'swQrUploadHint', qs.qrImage);
  setImgPreview('swSigPreview', 'swSigUploadHint', qs.signatureImage);
}

function setImgPreview(previewId, hintId, src) {
  const preview = document.getElementById(previewId);
  const hint    = document.getElementById(hintId);
  if (src) { preview.src = src; preview.style.display = 'block'; hint.style.display = 'none'; }
  else     { preview.style.display = 'none'; hint.style.display = 'block'; }
}

function initImageUpload(inputId, previewId, hintId, dropzoneId, replaceId, deleteId, stateKey) {
  const input    = document.getElementById(inputId);
  const dropzone = document.getElementById(dropzoneId);

  async function handleFile(file) {
    if (!file.type.startsWith('image/')) { showToast('Please upload PNG, JPG or WEBP'); return; }
    const b64 = await compressImage(file, 500);
    state.splitwise.qrSettings[stateKey] = b64;
    setImgPreview(previewId, hintId, b64);
    showToast('Image uploaded');
  }

  dropzone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  document.getElementById(replaceId).addEventListener('click', e => { e.stopPropagation(); input.click(); });
  document.getElementById(deleteId).addEventListener('click', e => {
    e.stopPropagation();
    state.splitwise.qrSettings[stateKey] = '';
    setImgPreview(previewId, hintId, '');
    showToast('Image removed');
  });
}

function saveSwSettings() {
  const qs = state.splitwise.qrSettings;
  qs.name    = document.getElementById('swQrName').value.trim();
  qs.upi     = document.getElementById('swQrUpi').value.trim();
  qs.phone   = document.getElementById('swQrPhone').value.trim();
  qs.address = document.getElementById('swQrAddress').value.trim();
  qs.footer  = document.getElementById('swQrFooter').value.trim();
  autoSave();
  showToast('Settings saved ✓');
}

// ── Export / Import ──────────────────────────
function exportSwJSON() {
  const blob = new Blob([JSON.stringify(state.splitwise, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `splitwise-${todayStr()}.json` });
  a.click(); URL.revokeObjectURL(url);
  showToast('JSON exported');
}

function importSwJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported.friends) && !Array.isArray(imported.expenses)) {
        showToast('Invalid Splitwise backup file'); return;
      }
      if (!confirm('This will replace all Splitwise data. Continue?')) return;
      if (imported.friends)     state.splitwise.friends     = imported.friends;
      if (imported.expenses)    state.splitwise.expenses    = imported.expenses;
      if (imported.settlements) state.splitwise.settlements = imported.settlements;
      if (imported.qrSettings)  state.splitwise.qrSettings  = { ...state.splitwise.qrSettings, ...imported.qrSettings };
      autoSave();
      renderSplitwise();
      showToast('Data imported successfully!');
    } catch (_) { showToast('Invalid JSON file'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function exportSwCSV() {
  const sw = state.splitwise;
  let csv = 'Type,Date,Friend,Title/Remarks,Amount (₹),Paid By,Split Type,Share (₹),Payment Mode,Receipt No.\n';
  sw.expenses.forEach(e => {
    const f = sw.friends.find(x => x.id === e.friendId);
    csv += `Expense,${e.date},"${(f?.name || '').replace(/"/g,'')}","${e.title.replace(/"/g,'')}",${e.amount},${e.paidBy},${e.splitType},${computeShare(e).toFixed(2)},,\n`;
  });
  sw.settlements.forEach(s => {
    const f = sw.friends.find(x => x.id === s.friendId);
    csv += `Settlement,${s.date},"${(f?.name || '').replace(/"/g,'')}","${(s.remarks || '').replace(/"/g,'')}",${s.amount},${s.paidBy},,,${s.paymentMode},${s.receiptNumber}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `splitwise-${todayStr()}.csv` });
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV exported');
}
