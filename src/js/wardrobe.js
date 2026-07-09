import { state, autoSave } from './state.js';
import { uid, todayStr, formatDate, showToast, closeModal, esc } from './utils.js';
import { storeImage, loadImage, getCachedImage, removeImage, preloadImages, compressFile, compressDataUrl, clearAllImages } from './imageStore.js';

export { clearAllImages as clearWardrobeImages };

export const CATEGORY_LABELS = {
  tshirt: 'T-Shirt', shirt: 'Shirt', hoodie: 'Hoodie', jacket: 'Jacket',
  jeans: 'Jeans', trousers: 'Trousers', joggers: 'Joggers', shorts: 'Shorts',
  shoes: 'Shoes', accessories: 'Accessories', watch: 'Watch', perfume: 'Perfume'
};

const CATEGORY_ICONS = {
  tshirt: 'TS', shirt: 'SH', hoodie: 'HD', jacket: 'JK',
  jeans: 'JN', trousers: 'TR', joggers: 'JG', shorts: 'SR',
  shoes: 'SO', accessories: 'AC', watch: 'WT', perfume: 'PF'
};

let editingClothingId = null;
let editingOutfitId   = null;

// Image picker state
let _pendingImg        = null;  // base64 data URL during modal editing
let _pendingImgChanged = false;

// Camera state
let _stream      = null;
let _facingMode  = 'environment';
let _captured    = null;

// ── init ─────────────────────────────────────────────────────────────────────

export function initWardrobe() {
  document.querySelectorAll('.wardrobe-tab[data-wtab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wardrobe-tab[data-wtab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('#tab-wardrobe .wardrobe-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById('wtab-' + tab.dataset.wtab).classList.remove('hidden');
      if (tab.dataset.wtab === 'outfits')   renderOutfits();
      if (tab.dataset.wtab === 'log')       renderOutfitLog();
      if (tab.dataset.wtab === 'analytics') renderWardrobeAnalytics();
    });
  });

  document.getElementById('addClothingBtn').addEventListener('click', () => openClothingModal(null));
  document.getElementById('saveClothingBtn').addEventListener('click', saveClothingItem);
  document.getElementById('cancelClothingBtn').addEventListener('click', () => {
    _stopCamera();
    closeModal('addClothingModal');
  });

  document.getElementById('buildOutfitBtn').addEventListener('click', () => openBuildOutfitModal(null));
  document.getElementById('saveOutfitBtn').addEventListener('click', saveOutfit);
  document.getElementById('cancelOutfitBtn').addEventListener('click', () => closeModal('buildOutfitModal'));

  document.getElementById('logOutfitBtn').addEventListener('click', openLogOutfitModal);
  document.getElementById('saveOutfitLogBtn').addEventListener('click', saveOutfitLog);
  document.getElementById('cancelOutfitLogBtn').addEventListener('click', () => closeModal('logOutfitModal'));

  document.getElementById('wardrobeFilterCat').addEventListener('change', renderClothingGrid);

  // ── Image picker ──
  document.getElementById('wardrobeUploadBtn')?.addEventListener('click', () => document.getElementById('wardrobeFileInput').click());
  document.getElementById('wardrobeFileInput')?.addEventListener('change', _onFileChosen);
  document.getElementById('wardrobeCameraBtn')?.addEventListener('click', _openCamera);
  document.getElementById('wardrobeRemoveImgBtn')?.addEventListener('click', _clearPendingImage);

  // ── Camera modal ──
  document.getElementById('cameraCaptureBtn')?.addEventListener('click', _captureFrame);
  document.getElementById('cameraRetakeBtn')?.addEventListener('click', _retake);
  document.getElementById('cameraUseBtn')?.addEventListener('click', _useCapture);
  document.getElementById('cameraCancelBtn')?.addEventListener('click', () => { _stopCamera(); closeModal('cameraModal'); });
  document.getElementById('cameraSwitchBtn')?.addEventListener('click', _switchCamera);

  renderWardrobe();
}

export function renderWardrobe() { renderClothingGrid(); }

// ── Image picker helpers ──────────────────────────────────────────────────────

async function _onFileChosen(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const compressed = await compressFile(file);
  _pendingImg        = compressed;
  _pendingImgChanged = true;
  _updateImgPreview(compressed);
  e.target.value = '';
}

function _clearPendingImage() {
  _pendingImg        = null;
  _pendingImgChanged = true;
  _updateImgPreview(null);
}

function _updateImgPreview(src) {
  const img  = document.getElementById('wardrobeImgPreviewImg');
  const ph   = document.getElementById('wardrobeImgPlaceholder');
  if (!img) return;
  if (src) {
    img.src = src;
    img.style.display = 'block';
    if (ph) ph.style.display = 'none';
  } else {
    img.style.display = 'none';
    img.src = '';
    if (ph) ph.style.display = '';
  }
}

// ── Camera ───────────────────────────────────────────────────────────────────

async function _openCamera() {
  _captured = null;
  const modal = document.getElementById('cameraModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  _resetCameraUI();
  await _startStream();
}

async function _startStream() {
  try {
    if (_stream) _stream.getTracks().forEach(t => t.stop());
    _stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: _facingMode }, audio: false });
    const video = document.getElementById('cameraPreview');
    if (video) { video.srcObject = _stream; video.style.display = 'block'; }
    document.getElementById('capturedPreview').style.display = 'none';
    document.getElementById('cameraCaptureBtn').classList.remove('hidden');
    document.getElementById('cameraRetakeBtn').classList.add('hidden');
    document.getElementById('cameraUseBtn').classList.add('hidden');
  } catch (err) {
    showToast('Camera unavailable: ' + (err.name === 'NotAllowedError' ? 'Permission denied' : err.message));
    _stopCamera();
    closeModal('cameraModal');
  }
}

function _captureFrame() {
  const video  = document.getElementById('cameraPreview');
  const canvas = document.getElementById('cameraCanvas');
  if (!video || !canvas) return;
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  _captured = canvas.toDataURL('image/jpeg', 0.9);

  const preview = document.getElementById('capturedPreview');
  preview.src = _captured;
  preview.style.display = 'block';
  video.style.display = 'none';

  document.getElementById('cameraCaptureBtn').classList.add('hidden');
  document.getElementById('cameraRetakeBtn').classList.remove('hidden');
  document.getElementById('cameraUseBtn').classList.remove('hidden');

  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
}

function _retake() {
  _captured = null;
  _startStream();
}

async function _useCapture() {
  if (!_captured) return;
  const compressed = await compressDataUrl(_captured);
  _pendingImg        = compressed;
  _pendingImgChanged = true;
  _updateImgPreview(compressed);
  _stopCamera();
  closeModal('cameraModal');
}

function _stopCamera() {
  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
}

async function _switchCamera() {
  _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
  await _startStream();
}

function _resetCameraUI() {
  const video   = document.getElementById('cameraPreview');
  const preview = document.getElementById('capturedPreview');
  if (video)   { video.style.display = 'block'; video.srcObject = null; }
  if (preview) { preview.style.display = 'none'; preview.src = ''; }
  document.getElementById('cameraCaptureBtn')?.classList.remove('hidden');
  document.getElementById('cameraRetakeBtn')?.classList.add('hidden');
  document.getElementById('cameraUseBtn')?.classList.add('hidden');
}

// ── clothing CRUD ─────────────────────────────────────────────────────────────

function openClothingModal(itemId = null) {
  editingClothingId  = itemId;
  _pendingImg        = null;
  _pendingImgChanged = false;
  const isEdit = !!itemId;
  const modal  = document.getElementById('addClothingModal');
  modal.querySelector('.modal-title').textContent = isEdit ? 'Edit Clothing Item' : 'Add Clothing Item';
  document.getElementById('saveClothingBtn').textContent = isEdit ? 'Save Changes' : 'Add Item';

  if (isEdit) {
    const item = state.wardrobe.items.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('clothingName').value     = item.name;
    document.getElementById('clothingCategory').value = item.category;
    document.getElementById('clothingBrand').value    = item.brand    || '';
    document.getElementById('clothingColor').value    = item.color    || '';
    document.getElementById('clothingFit').value      = item.fit      || 'regular';
    document.getElementById('clothingSeason').value   = item.season   || 'all';
    document.getElementById('clothingTags').value     = (item.tags || []).join(', ');

    // Show existing image
    const cachedSrc = item.imageId ? getCachedImage(item.imageId) : null;
    const imgSrc    = cachedSrc || item.image || null;
    if (imgSrc && !cachedSrc && item.imageId) {
      loadImage(item.imageId).then(src => { _pendingImg = src; _updateImgPreview(src); });
    }
    _pendingImg = imgSrc;
    _updateImgPreview(imgSrc);
  } else {
    ['clothingName','clothingBrand','clothingColor','clothingTags'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('clothingCategory').value = 'tshirt';
    document.getElementById('clothingFit').value      = 'regular';
    document.getElementById('clothingSeason').value   = 'all';
    _updateImgPreview(null);
  }
  modal.classList.remove('hidden');
}

async function saveClothingItem() {
  const name = document.getElementById('clothingName').value.trim();
  if (!name) { showToast('Enter item name'); return; }

  const itemId = editingClothingId || uid();

  const fields = {
    name,
    category: document.getElementById('clothingCategory').value,
    brand:    document.getElementById('clothingBrand').value.trim(),
    color:    document.getElementById('clothingColor').value.trim(),
    fit:      document.getElementById('clothingFit').value,
    season:   document.getElementById('clothingSeason').value,
    tags:     document.getElementById('clothingTags').value.split(',').map(t => t.trim()).filter(Boolean),
  };

  if (_pendingImgChanged) {
    if (_pendingImg) {
      await storeImage(itemId, _pendingImg);
      fields.imageId = itemId;
      fields.image   = '';
    } else {
      await removeImage(itemId);
      fields.imageId = null;
      fields.image   = '';
    }
  }

  if (editingClothingId) {
    const item = state.wardrobe.items.find(i => i.id === editingClothingId);
    if (item) Object.assign(item, fields);
    showToast(`${name} updated`);
  } else {
    state.wardrobe.items.push({ id: itemId, ...fields, favorite: false, wearCount: 0, lastWorn: null, purchaseDate: todayStr(), notes: '' });
    showToast(`${name} added to wardrobe`);
  }

  editingClothingId  = null;
  _pendingImg        = null;
  _pendingImgChanged = false;
  autoSave();
  closeModal('addClothingModal');
  renderClothingGrid();
}

export async function renderClothingGrid() {
  const grid   = document.getElementById('clothingGrid');
  const filter = document.getElementById('wardrobeFilterCat').value;
  let items    = state.wardrobe.items;
  if (filter) items = items.filter(i => i.category === filter);

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">No clothing items yet. Add your first item to start building your wardrobe.</div>`;
    return;
  }

  // Pre-load all IndexedDB images into cache
  const idsToLoad = items.filter(i => i.imageId).map(i => i.imageId);
  if (idsToLoad.length) await preloadImages(idsToLoad);

  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });
  const cats = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

  grid.innerHTML = cats.map(([cat, catItems]) => `
    <div class="wardrobe-cat-section">
      <div class="wardrobe-cat-header">
        <div class="wardrobe-cat-info">
          <div class="wardrobe-cat-title">${CATEGORY_LABELS[cat] || cat}</div>
          <div class="wardrobe-cat-count">${catItems.length} item${catItems.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="wardrobe-cat-thumb" data-cat="${cat}" title="Toggle ${CATEGORY_LABELS[cat] || cat}" aria-expanded="true">
          <span class="wardrobe-cat-thumb-label">${CATEGORY_ICONS[cat] || cat.charAt(0).toUpperCase()}</span>
        </button>
      </div>
      <div class="wardrobe-cat-items" id="wcat-${cat}">
        ${catItems.map(item => {
          const imgSrc = (item.imageId ? getCachedImage(item.imageId) : null) || item.image || null;
          const meta   = [item.brand, item.color].filter(Boolean).join(' · ');
          const extras = [item.season !== 'all' ? item.season : '', item.fit !== 'regular' ? item.fit : '', ...(item.tags || [])].filter(Boolean);
          return `
          <div class="clothing-row" data-id="${item.id}">
            <div class="clothing-row-thumb">
              ${imgSrc
                ? `<img src="${esc(imgSrc)}" alt="${esc(item.name)}" loading="lazy" />`
                : `<span>${CATEGORY_ICONS[item.category] || esc(item.name.charAt(0).toUpperCase())}</span>`}
            </div>
            <div class="clothing-row-body">
              <div class="clothing-row-name">${esc(item.name)}${item.favorite ? '<span class="clothing-fav-mark">♥</span>' : ''}</div>
              ${meta  ? `<div class="clothing-row-meta">${esc(meta)}</div>` : ''}
              ${extras.length ? `<div class="clothing-row-tags">${extras.map(t => `<span class="task-tag">${esc(t)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="clothing-row-right">
              <span class="clothing-wear-count">${item.wearCount || 0}×</span>
              <div class="clothing-row-actions">
                <button class="btn-fav ${item.favorite ? 'active' : ''}" data-fav="${item.id}" title="${item.favorite ? 'Unfavorite' : 'Favorite'}">&#9825;</button>
                <button class="card-edit-btn" data-editc="${item.id}">Edit</button>
                <button class="attend-btn-delete" data-del="${item.id}">✕</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.wardrobe-cat-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const itemsEl   = document.getElementById('wcat-' + thumb.dataset.cat);
      const collapsed = itemsEl.classList.toggle('wcat-collapsed');
      thumb.setAttribute('aria-expanded', !collapsed);
      thumb.classList.toggle('thumb-collapsed', collapsed);
    });
  });

  grid.querySelectorAll('[data-fav]').forEach(btn => btn.addEventListener('click', () => {
    const item = state.wardrobe.items.find(i => i.id === btn.dataset.fav);
    if (item) { item.favorite = !item.favorite; autoSave(); renderClothingGrid(); }
  }));
  grid.querySelectorAll('[data-editc]').forEach(btn => btn.addEventListener('click', () => openClothingModal(btn.dataset.editc)));
  grid.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this item?')) return;
    const id = btn.dataset.del;
    await removeImage(id);
    state.wardrobe.items  = state.wardrobe.items.filter(i => i.id !== id);
    state.wardrobe.outfits.forEach(o => o.itemIds = (o.itemIds || []).filter(oid => oid !== id));
    autoSave();
    renderClothingGrid();
    showToast('Item removed');
  }));
}

// ── outfits ───────────────────────────────────────────────────────────────────

function openBuildOutfitModal(outfitId = null) {
  editingOutfitId = outfitId;
  const isEdit = !!outfitId;
  const modal  = document.getElementById('buildOutfitModal');
  modal.querySelector('.modal-title').textContent  = isEdit ? 'Edit Outfit' : 'Build Outfit';
  document.getElementById('saveOutfitBtn').textContent = isEdit ? 'Save Changes' : 'Save Outfit';

  const outfit = isEdit ? state.wardrobe.outfits.find(o => o.id === outfitId) : null;
  document.getElementById('outfitName').value     = outfit ? outfit.name     : '';
  document.getElementById('outfitOccasion').value = outfit ? outfit.occasion : '';

  const selector = document.getElementById('outfitItemSelector');
  if (!state.wardrobe.items.length) {
    selector.innerHTML = `<div class="empty-state-sm" style="grid-column:1/-1">Add clothing items first</div>`;
  } else {
    const selected = outfit ? outfit.itemIds : [];
    selector.innerHTML = state.wardrobe.items.map(item => `
      <label class="outfit-item-pick">
        <input type="checkbox" value="${item.id}" ${selected.includes(item.id) ? 'checked' : ''} />
        <span class="oip-icon">${CATEGORY_ICONS[item.category] || ''}</span>
        <span class="oip-name">${esc(item.name)}</span>
      </label>`).join('');
  }
  modal.classList.remove('hidden');
}

function saveOutfit() {
  const name = document.getElementById('outfitName').value.trim();
  if (!name) { showToast('Enter an outfit name'); return; }
  const checked = [...document.querySelectorAll('#outfitItemSelector input:checked')].map(c => c.value);
  if (!checked.length) { showToast('Select at least one item'); return; }
  const occasion = document.getElementById('outfitOccasion').value.trim() || 'casual';

  if (editingOutfitId) {
    const outfit = state.wardrobe.outfits.find(o => o.id === editingOutfitId);
    if (outfit) Object.assign(outfit, { name, occasion, itemIds: checked });
    showToast(`Outfit "${name}" updated`);
  } else {
    state.wardrobe.outfits.push({ id: uid(), name, occasion, itemIds: checked, rating: 0, createdAt: new Date().toISOString() });
    showToast(`Outfit "${name}" saved`);
  }

  editingOutfitId = null;
  autoSave();
  closeModal('buildOutfitModal');
  renderOutfits();
}

export function renderOutfits() {
  const grid = document.getElementById('outfitsGrid');
  if (!state.wardrobe.outfits.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No outfits saved yet. Build your first outfit combination.</div>`;
    return;
  }
  const itemMap = {};
  state.wardrobe.items.forEach(i => itemMap[i.id] = i);

  grid.innerHTML = state.wardrobe.outfits.map(outfit => {
    const items = outfit.itemIds.map(id => itemMap[id]).filter(Boolean);
    return `
      <div class="outfit-card" data-id="${outfit.id}">
        <div class="outfit-card-header">
          <div class="outfit-name">${esc(outfit.name)}</div>
          <span class="task-tag">${esc(outfit.occasion)}</span>
        </div>
        <div class="outfit-items-row">${items.map(i => `<span class="outfit-item-chip">${esc(i.name)}</span>`).join('')}</div>
        <div class="outfit-card-footer">
          <button class="card-edit-btn" data-wear="${outfit.id}">Wear today</button>
          <span style="display:flex;gap:.35rem;margin-left:auto">
            <button class="card-edit-btn" data-edit="${outfit.id}">Edit</button>
            <button class="attend-btn-delete" data-del="${outfit.id}">✕</button>
          </span>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openBuildOutfitModal(btn.dataset.edit)));
  grid.querySelectorAll('[data-wear]').forEach(btn => btn.addEventListener('click', () => {
    const outfit = state.wardrobe.outfits.find(o => o.id === btn.dataset.wear);
    if (!outfit) return;
    state.wardrobe.logs.push({ id: uid(), date: todayStr(), outfitId: outfit.id, notes: '' });
    outfit.itemIds.forEach(itemId => {
      const item = state.wardrobe.items.find(i => i.id === itemId);
      if (item) { item.wearCount = (item.wearCount || 0) + 1; item.lastWorn = todayStr(); }
    });
    autoSave();
    showToast(`"${outfit.name}" logged for today`);
  }));
  grid.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('Delete this outfit?')) return;
    state.wardrobe.outfits = state.wardrobe.outfits.filter(o => o.id !== btn.dataset.del);
    autoSave(); renderOutfits(); showToast('Outfit deleted');
  }));
}

function openLogOutfitModal() {
  document.getElementById('outfitLogDate').value  = todayStr();
  document.getElementById('outfitLogNotes').value = '';
  const sel = document.getElementById('outfitLogSelect');
  sel.innerHTML = '<option value="">Select saved outfit...</option>' +
    state.wardrobe.outfits.map(o => `<option value="${o.id}">${esc(o.name)} (${esc(o.occasion)})</option>`).join('');
  document.getElementById('logOutfitModal').classList.remove('hidden');
}

function saveOutfitLog() {
  const outfitId = document.getElementById('outfitLogSelect').value;
  if (!outfitId) { showToast('Select an outfit'); return; }
  const date  = document.getElementById('outfitLogDate').value  || todayStr();
  const notes = document.getElementById('outfitLogNotes').value.trim();
  state.wardrobe.logs.push({ id: uid(), date, outfitId, notes });
  const outfit = state.wardrobe.outfits.find(o => o.id === outfitId);
  if (outfit) {
    outfit.itemIds.forEach(itemId => {
      const item = state.wardrobe.items.find(i => i.id === itemId);
      if (item) { item.wearCount = (item.wearCount || 0) + 1; item.lastWorn = date; }
    });
  }
  autoSave();
  closeModal('logOutfitModal');
  renderOutfitLog();
  showToast('Outfit logged');
}

export function renderOutfitLog() {
  const el = document.getElementById('outfitLogList');
  if (!state.wardrobe.logs.length) { el.innerHTML = `<div class="empty-state">No outfits logged yet</div>`; return; }
  const outfitMap = {};
  state.wardrobe.outfits.forEach(o => outfitMap[o.id] = o);
  const logs = [...state.wardrobe.logs].reverse().slice(0, 30);
  el.innerHTML = logs.map(l => {
    const outfit = outfitMap[l.outfitId];
    return `
      <div class="attend-log-row" style="grid-template-columns:80px 1fr auto">
        <span class="log-date">${formatDate(l.date)}</span>
        <span class="log-subject">${outfit ? outfit.name : 'Unknown'}${l.notes ? ' — ' + l.notes : ''}</span>
        <button class="btn-icon" data-lid="${l.id}" title="Delete" style="width:26px;height:26px;font-size:.7rem">✕</button>
      </div>`;
  }).join('');
  el.querySelectorAll('[data-lid]').forEach(btn => btn.addEventListener('click', () => {
    state.wardrobe.logs = state.wardrobe.logs.filter(l => l.id !== btn.dataset.lid);
    autoSave(); renderOutfitLog(); showToast('Log entry removed');
  }));
}

export function renderWardrobeAnalytics() {
  const items  = state.wardrobe.items;
  const sorted = [...items].sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0));
  const most   = sorted.slice(0, 5).filter(i => (i.wearCount || 0) > 0);
  const least  = [...sorted].reverse().slice(0, 5);

  document.getElementById('mostWornList').innerHTML = most.length
    ? most.map(i => `<div class="ws-row"><span>${esc(i.name)}</span><strong>${i.wearCount}×</strong></div>`).join('')
    : `<div class="empty-state-sm">No wear data yet</div>`;

  document.getElementById('leastWornList').innerHTML = least.length
    ? least.map(i => `<div class="ws-row"><span>${esc(i.name)}</span><strong>${i.wearCount || 0}×</strong></div>`).join('')
    : `<div class="empty-state-sm">No data yet</div>`;

  const catCounts = {};
  items.forEach(i => catCounts[i.category] = (catCounts[i.category] || 0) + 1);
  document.getElementById('categoryBreakdown').innerHTML = Object.entries(catCounts).sort((a,b) => b[1]-a[1]).length
    ? Object.entries(catCounts).sort((a,b) => b[1]-a[1]).map(([cat, n]) => `<div class="ws-row"><span>${CATEGORY_LABELS[cat]||cat}</span><strong>${n}</strong></div>`).join('')
    : `<div class="empty-state-sm">No items yet</div>`;

  const outfitCounts = {};
  state.wardrobe.logs.forEach(l => outfitCounts[l.outfitId] = (outfitCounts[l.outfitId] || 0) + 1);
  const outfitMap = {};
  state.wardrobe.outfits.forEach(o => outfitMap[o.id] = o);
  document.getElementById('outfitFrequency').innerHTML = Object.entries(outfitCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).length
    ? Object.entries(outfitCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,n]) => `<div class="ws-row"><span>${outfitMap[id]?.name||'Unknown'}</span><strong>${n}×</strong></div>`).join('')
    : `<div class="empty-state-sm">Log outfits to see trends</div>`;
}
