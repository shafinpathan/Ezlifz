// ═══════════════════════════════════════════════════════════════
//  notes.js — Clean Samsung-Notes-inspired module
// ═══════════════════════════════════════════════════════════════
import { state, autoSave } from './state.js';
import { uid, showToast } from './utils.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import DOMPurify from 'dompurify';

/* Sanitize rich-text note HTML before it touches the DOM.
   Allows media the editor inserts (img/audio data URIs, checklists)
   but strips scripts and event handlers. */
function _sanitize(html) {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: ['a','b','strong','i','em','u','s','strike','br','p','div','span','font',
      'h1','h2','h3','h4','blockquote','pre','code','ul','ol','li','hr','img','audio'],
    ALLOWED_ATTR: ['href','src','controls','style','class','id','contenteditable','alt','loading','color','face','size'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
  });
}

// ── SVG icon set (stroke-based, inherits currentColor) ────────
const _svg = (paths, vb = '0 0 24 24') =>
  `<svg class="n-icon" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  pin:     _svg('<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1z"/>'),
  star:    _svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  trash:   _svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  folder:  _svg('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
  archive: _svg('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
  copy:    _svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  image:   _svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  mic:     _svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>'),
  grid:    _svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  list:    _svg('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'),
  note:    _svg('<path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),
  restore: _svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  pencil:  _svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>'),
  x:       _svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
};

// ── Constants ─────────────────────────────────────────────────
const NOTE_COLORS = [
  null,
  '#ff453a', '#ff9f0a', '#ffd60a',
  '#30d158', '#64d2ff', '#0a84ff', '#bf5af2'
];
const BG_OPTIONS = [
  { id: 'default', label: 'None',   bg: '' },
  { id: 'yellow',  label: 'Yellow', bg: '#fffde7' },
  { id: 'blue',    label: 'Blue',   bg: '#e3f2fd' },
  { id: 'green',   label: 'Green',  bg: '#e8f5e9' },
  { id: 'pink',    label: 'Pink',   bg: '#fce4ec' },
];
const FILTERS = ['all', 'favorites', 'pinned', 'archived', 'trash'];
const FILTER_LABELS = { all: 'All', favorites: 'Favorites', pinned: 'Pinned', archived: 'Archive', trash: 'Trash' };
const SORT_FNS = {
  updatedAt: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  createdAt: (a, b) => b.createdAt.localeCompare(a.createdAt),
  title:     (a, b) => (a.title || '').localeCompare(b.title || ''),
};

// ── Module state ───────────────────────────────────────────────
let _view     = 'home';
let _viewMode = 'grid';
let _filter   = 'all';
let _folder   = null;
let _sort     = 'updatedAt';
let _search   = '';
let _noteId   = null;
let _drawMode = false;
let _drawTool = 'pen';
let _drawColor   = '#ffffff';
let _drawSize    = 3;
let _drawOpacity = 1;
let _strokes     = [];
let _redoStack   = [];
let _curStroke   = null;
let _isDrawing   = false;
let _mediaRec    = null;
let _audioChunks = [];
let _recSeconds  = 0;
let _recTimer    = null;
let _autoTimer   = null;
let _imgInput    = null;

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
export function initNotes() {
  _migrate();
  _buildHome();
  _buildEditor();
  _renderHome();
}

export function renderNotes() {
  if (_view === 'home') _renderHome();
}

/* Quick-create entry point for the FAB / command palette */
export function createNewNote() {
  _createNote();
}

function _migrate() {
  if (!state.notes.config) state.notes.config = { view: 'grid', sort: 'updatedAt' };
  _viewMode = state.notes.config.view || 'grid';
  _sort     = state.notes.config.sort || 'updatedAt';
  state.notes.items.forEach(n => {
    if (n.isPinned === undefined) n.isPinned   = n.pinned || false;
    if (!n.isFavorite)            n.isFavorite = false;
    if (!n.isArchived)            n.isArchived = false;
    if (!n.isTrashed)             n.isTrashed  = false;
    if (!n.color)                 n.color      = null;
    if (!n.background)            n.background = 'default';
    if (!n.tags)                  n.tags       = [];
    const plainText = (n.content || '').replace(/<[^>]+>/g, ' ');
    if (!n.wordCount)             n.wordCount  = _wc(plainText);
    if (!n.preview)               n.preview    = _preview(plainText);
    if (!n.createdAt)             n.createdAt  = new Date().toISOString();
    if (!n.updatedAt)             n.updatedAt  = new Date().toISOString();
  });
  state.notes.folders.forEach(f => { if (!f.color) f.color = '#0a84ff'; });
}

// ═══════════════════════════════════════════════════════════════
//  HOME DOM
// ═══════════════════════════════════════════════════════════════
function _buildHome() {
  const el = document.getElementById('notesHomeView');
  if (!el) return;
  el.innerHTML = `
    <!-- Standard page header -->
    <div class="page-header" style="margin-bottom:1.25rem">
      <div>
        <h1 class="page-title">Notes</h1>
      </div>
      <div class="header-actions" style="flex-wrap:wrap;gap:.5rem">
        <div class="notes-search-wrap">
          <input class="search-input" type="text" id="notesSearch" placeholder="Search notes…" style="min-width:160px" />
        </div>
        <button class="btn-icon" id="notesViewToggle" title="Toggle view" style="width:34px;height:34px">${ICONS.grid}</button>
        <button class="btn-primary" id="notesNewBtn" style="padding:.5rem 1rem;font-size:.82rem">+ New Note</button>
      </div>
    </div>

    <!-- Folder bar -->
    <div class="notes-folder-bar">
      <div class="notes-folder-scroll" id="notesFolderScroll"></div>
      <button class="btn-icon" id="notesAddFolderBtn" title="New folder" style="width:28px;height:28px;flex-shrink:0">+</button>
    </div>

    <!-- Filter + sort row -->
    <div class="notes-chip-row">
      <div class="notes-chips" id="notesChips">
        ${FILTERS.map(f => `<button class="notes-chip${f==='all'?' active':''}" data-filter="${f}">${FILTER_LABELS[f]}</button>`).join('')}
      </div>
      <select class="notes-sort-select" id="notesSortSelect">
        <option value="updatedAt">Modified</option>
        <option value="createdAt">Created</option>
        <option value="title">A – Z</option>
      </select>
    </div>

    <!-- Notes content -->
    <div id="notesPinnedWrap" class="notes-section hidden">
      <div class="notes-section-label">${ICONS.pin} Pinned</div>
      <div class="notes-grid" id="notesPinnedGrid"></div>
    </div>

    <div id="notesFavWrap" class="notes-section hidden">
      <div class="notes-section-label">${ICONS.star} Favorites</div>
      <div class="notes-grid" id="notesFavGrid"></div>
    </div>

    <div id="notesMainWrap" class="notes-section">
      <div class="notes-section-label" id="notesMainLabel">All Notes</div>
      <div class="notes-grid" id="notesMainGrid"></div>
    </div>

    <div class="notes-empty-state" id="notesEmpty" style="display:none">
      <div class="notes-empty-icon">${ICONS.note}</div>
      <p id="notesEmptyMsg" style="color:var(--text-muted);font-size:.9rem;margin:.5rem 0 0">No notes yet. Tap <b>+ New Note</b> to start.</p>
    </div>
  `;

  el.querySelector('#notesSearch').addEventListener('input', e => { _search = e.target.value; _renderHome(); });
  el.querySelector('#notesViewToggle').addEventListener('click', () => { _viewMode = _viewMode === 'grid' ? 'list' : 'grid'; state.notes.config.view = _viewMode; _renderHome(); });
  el.querySelector('#notesNewBtn').addEventListener('click', _createNote);
  el.querySelector('#notesAddFolderBtn').addEventListener('click', () => _folderModal(null));
  el.querySelector('#notesSortSelect').addEventListener('change', e => { _sort = e.target.value; state.notes.config.sort = _sort; _renderHome(); });
  el.querySelector('#notesChips').addEventListener('click', e => {
    const c = e.target.closest('[data-filter]');
    if (!c) return;
    _filter = c.dataset.filter;
    el.querySelectorAll('.notes-chip').forEach(x => x.classList.toggle('active', x.dataset.filter === _filter));
    _renderHome();
  });
}

// ═══════════════════════════════════════════════════════════════
//  EDITOR DOM
// ═══════════════════════════════════════════════════════════════
function _buildEditor() {
  const el = document.getElementById('notesEditorView');
  if (!el) return;
  el.innerHTML = `
    <!-- Top bar -->
    <div class="notes-ed-topbar" id="notesEdTopbar">
      <button class="notes-back-btn" id="notesBackBtn">← Notes</button>
      <div class="notes-save-pill" id="notesSavePill">
        <span class="notes-save-dot saved" id="notesSaveDot"></span>
        <span class="notes-save-label" id="notesSaveLabel">Saved</span>
      </div>
      <div class="notes-ed-actions">
        <button class="btn-outline-sm notes-mode-btn active" id="notesTextModeBtn">Text</button>
        <button class="btn-outline-sm notes-mode-btn" id="notesDrawModeBtn">${ICONS.pencil} Draw</button>
        <div class="notes-drop-wrap">
          <button class="btn-outline-sm" id="notesExportBtn">Export</button>
          <div class="notes-drop hidden" id="notesExportMenu">
            <button data-export="txt">Plain Text (.txt)</button>
            <button data-export="markdown">Markdown (.md)</button>
            <button data-export="html">HTML (.html)</button>
            <button data-export="pdf">PDF (.pdf)</button>
          </div>
        </div>
        <div class="notes-drop-wrap">
          <button class="btn-icon notes-more-btn" id="notesMoreBtn" style="width:32px;height:32px">⋯</button>
          <div class="notes-drop hidden" id="notesMoreMenu">
            <button data-action="pin">${ICONS.pin} Toggle Pin</button>
            <button data-action="favorite">${ICONS.star} Toggle Favorite</button>
            <button data-action="archive">${ICONS.archive} Archive</button>
            <button data-action="duplicate">${ICONS.copy} Duplicate</button>
            <button data-action="move">${ICONS.folder} Move to Folder</button>
            <button data-action="trash" style="color:var(--danger)">${ICONS.trash} Move to Trash</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Format toolbar -->
    <div class="notes-tb" id="notesFmtTb">
      <div class="notes-tb-grp">
        <button class="notes-tb-btn" data-cmd="bold"          title="Bold Ctrl+B"><b>B</b></button>
        <button class="notes-tb-btn" data-cmd="italic"        title="Italic Ctrl+I"><em>I</em></button>
        <button class="notes-tb-btn" data-cmd="underline"     title="Underline Ctrl+U"><u>U</u></button>
        <button class="notes-tb-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
      </div>
      <div class="notes-tb-div"></div>
      <div class="notes-tb-grp">
        <select class="notes-tb-sel" id="notesFmtSel">
          <option value="">Block</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="blockquote">Quote</option>
          <option value="pre">Code</option>
          <option value="p">Para</option>
        </select>
      </div>
      <div class="notes-tb-div"></div>
      <div class="notes-tb-grp">
        <button class="notes-tb-btn" data-cmd="insertUnorderedList" title="Bullet list">• List</button>
        <button class="notes-tb-btn" data-cmd="insertOrderedList"   title="Numbered list">1. List</button>
        <button class="notes-tb-btn" id="notesChecklistBtn"         title="Checklist">✓ List</button>
      </div>
      <div class="notes-tb-div"></div>
      <div class="notes-tb-grp">
        <button class="notes-tb-btn" data-cmd="justifyLeft"   title="Left">≡←</button>
        <button class="notes-tb-btn" data-cmd="justifyCenter" title="Center">≡≡</button>
        <button class="notes-tb-btn" data-cmd="justifyRight"  title="Right">→≡</button>
      </div>
      <div class="notes-tb-div"></div>
      <div class="notes-tb-grp">
        <label class="notes-clr-pick" title="Text color">A<input type="color" id="notesFgColor" value="#ff453a" /></label>
        <label class="notes-clr-pick notes-hl-pick" title="Highlight">H<input type="color" id="notesHlColor" value="#ffd60a" /></label>
      </div>
      <div class="notes-tb-div"></div>
      <div class="notes-tb-grp">
        <button class="notes-tb-btn" id="notesImgBtn"   title="Insert image">${ICONS.image}</button>
        <button class="notes-tb-btn" id="notesAudioBtn" title="Record audio">${ICONS.mic}</button>
        <button class="notes-tb-btn" data-cmd="insertHorizontalRule" title="Divider">― HR</button>
      </div>
      <div class="notes-tb-div"></div>
      <div class="notes-tb-grp">
        <button class="notes-tb-btn" data-cmd="undo" title="Undo Ctrl+Z">↺</button>
        <button class="notes-tb-btn" data-cmd="redo" title="Redo">↻</button>
      </div>
    </div>

    <!-- Draw toolbar -->
    <div class="notes-tb hidden" id="notesDrawTb">
      <div class="notes-tb-grp">
        <button class="notes-draw-tool active" data-tool="pen">Pen</button>
        <button class="notes-draw-tool" data-tool="marker">Marker</button>
        <button class="notes-draw-tool" data-tool="highlighter">Highlight</button>
        <button class="notes-draw-tool" data-tool="eraser">Eraser</button>
      </div>
      <div class="notes-tb-div"></div>
      <label class="notes-clr-pick" title="Color">●<input type="color" id="notesDrawColor" value="#ffffff" /></label>
      <div style="display:flex;align-items:center;gap:.375rem;flex-shrink:0">
        <span style="font-size:.7rem;color:var(--text-muted)">Size</span>
        <input type="range" id="notesDrawSize" min="1" max="40" value="3" style="width:72px;accent-color:var(--accent-blue)" />
      </div>
      <div style="display:flex;align-items:center;gap:.375rem;flex-shrink:0">
        <span style="font-size:.7rem;color:var(--text-muted)">Opacity</span>
        <input type="range" id="notesDrawOpacity" min="10" max="100" value="100" style="width:72px;accent-color:var(--accent-blue)" />
      </div>
      <div class="notes-tb-div"></div>
      <div class="notes-tb-grp">
        <button class="notes-tb-btn" id="notesDrawUndo">↺ Undo</button>
        <button class="notes-tb-btn" id="notesDrawClear" style="color:var(--danger)">✕ Clear</button>
      </div>
    </div>

    <!-- Editor body -->
    <div class="notes-ed-body" id="notesEdBody">
      <!-- Color accent row -->
      <div class="notes-color-row">
        <div class="notes-clr-group">
          <span style="font-size:.65rem;color:var(--text-dim);margin-right:.25rem">Accent</span>
          ${NOTE_COLORS.map((c, i) => `<button class="notes-clr-dot" data-ci="${i}" style="background:${c || 'transparent'};${!c?'border:2px solid var(--border)':''}" title="${c || 'None'}"></button>`).join('')}
        </div>
        <div class="notes-clr-group">
          <span style="font-size:.65rem;color:var(--text-dim);margin-right:.25rem">BG</span>
          ${BG_OPTIONS.map(b => `<button class="notes-bg-dot" data-bid="${b.id}" style="background:${b.bg||'var(--surface-light)'};${!b.bg?'border:2px solid var(--border)':''}" title="${b.label}"></button>`).join('')}
        </div>
      </div>

      <!-- Title -->
      <input class="notes-title-inp" id="notesTitleInput" type="text" placeholder="Title" maxlength="200" />

      <!-- Rich text area -->
      <div class="notes-content-area" id="notesEditorArea" contenteditable="true"
           spellcheck="true" data-placeholder="Start writing…"></div>

      <!-- Draw canvas (hidden by default) -->
      <div class="notes-canvas-wrap hidden" id="notesDrawWrap">
        <canvas id="notesDrawCanvas"></canvas>
      </div>
    </div>

    <!-- Tags row -->
    <div class="notes-tags-row">
      <span style="font-size:.75rem;color:var(--text-dim)">#</span>
      <div class="notes-tag-pills" id="notesTagPills"></div>
      <input class="notes-tag-inp" id="notesTagInput" type="text" placeholder="Add tag…" />
    </div>

    <!-- Footer -->
    <div class="notes-ed-footer">
      <span id="notesWordCount">0 words</span>
      <span id="notesCharCount">0 chars</span>
      <span id="notesLastSaved" style="margin-left:auto"></span>
    </div>
  `;
  _wireEditor();
}

// ═══════════════════════════════════════════════════════════════
//  HOME RENDERING
// ═══════════════════════════════════════════════════════════════
function _renderHome() {
  _renderFolderBar();
  _renderGrid();
  const toggle = document.getElementById('notesViewToggle');
  if (toggle) toggle.innerHTML = _viewMode === 'grid' ? ICONS.list : ICONS.grid;
  const sortEl = document.getElementById('notesSortSelect');
  if (sortEl) sortEl.value = _sort;
}

function _renderFolderBar() {
  const el = document.getElementById('notesFolderScroll');
  if (!el) return;
  const allCount = state.notes.items.filter(n => !n.isTrashed).length;
  el.innerHTML = `
    <button class="notes-folder-pill${_folder === null ? ' active' : ''}" data-fid="__all">
      ${ICONS.folder} All <span class="notes-folder-cnt">${allCount}</span>
    </button>
    ${state.notes.folders.map(f => {
      const cnt = state.notes.items.filter(n => n.folderId === f.id && !n.isTrashed).length;
      return `<button class="notes-folder-pill${_folder === f.id ? ' active' : ''}" data-fid="${f.id}">
        <span class="notes-folder-dot-sm" style="background:${f.color}"></span>
        ${_esc(f.name)} <span class="notes-folder-cnt">${cnt}</span>
        <span class="notes-folder-pill-del" data-fdel="${f.id}" title="Delete">×</span>
      </button>`;
    }).join('')}
  `;
  el.querySelectorAll('[data-fid]').forEach(btn => {
    btn.addEventListener('click', e => {
      if (e.target.closest('[data-fdel]')) return;
      _folder = btn.dataset.fid === '__all' ? null : btn.dataset.fid;
      _renderHome();
    });
  });
  el.querySelectorAll('[data-fdel]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _deleteFolder(btn.dataset.fdel); });
  });
}

function _renderGrid() {
  const notes = _filtered();
  const pinned = notes.filter(n => n.isPinned && _filter === 'all' && !_search);
  const favs   = notes.filter(n => n.isFavorite && !n.isPinned && _filter !== 'trash' && !_search);
  const rest   = notes.filter(n => !((_filter === 'all' && !_search) && (n.isPinned || n.isFavorite)));

  _renderSection('notesPinnedWrap', 'notesPinnedGrid', pinned);
  _renderSection('notesFavWrap',    'notesFavGrid',    favs);

  const mainGrid  = document.getElementById('notesMainGrid');
  const mainWrap  = document.getElementById('notesMainWrap');
  const mainLabel = document.getElementById('notesMainLabel');
  const emptyEl   = document.getElementById('notesEmpty');

  if (mainGrid) { mainGrid.className = `notes-grid ${_viewMode}`; mainGrid.innerHTML = rest.map(_cardHTML).join(''); _wireCards(mainGrid); }
  if (mainWrap)  mainWrap.classList.toggle('hidden', rest.length === 0 && notes.length > 0);
  if (mainLabel) mainLabel.textContent = _search ? `Search: "${_search}"` : _sectionTitle();
  if (emptyEl)   emptyEl.style.display = notes.length === 0 ? 'flex' : 'none';
}

function _renderSection(wrapId, gridId, notes) {
  const wrap = document.getElementById(wrapId);
  const grid = document.getElementById(gridId);
  if (!wrap || !grid) return;
  if (notes.length === 0) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  grid.className = `notes-grid ${_viewMode}`;
  grid.innerHTML = notes.map(_cardHTML).join('');
  _wireCards(grid);
}

function _wireCards(container) {
  container.querySelectorAll('[data-nid]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.notes-card-actions')) return;
      _openEditor(card.dataset.nid);
    });
  });
  container.querySelectorAll('[data-pin]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); _togglePin(b.dataset.pin); }));
  container.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); _toggleFav(b.dataset.fav); }));
  container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); _trashNote(b.dataset.del); }));
  container.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); _restoreNote(b.dataset.restore); }));
  container.querySelectorAll('[data-perm]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); _permDelete(b.dataset.perm); }));
}

function _cardHTML(n) {
  const date    = _fmtDate(n.updatedAt);
  const accent  = n.color;
  const bgStyle = n.background !== 'default' ? BG_OPTIONS.find(b => b.id === n.background)?.bg || '' : '';
  const tags    = (n.tags || []).slice(0, 3).map(t => `<span class="notes-tag-badge">#${_esc(t)}</span>`).join('');
  const inTrash = n.isTrashed;

  return `
    <div class="notes-card${bgStyle ? ' has-bg' : ''}" data-nid="${n.id}"
      style="${accent ? `border-top:3px solid ${accent};` : ''}${bgStyle ? `--card-bg:${bgStyle};` : ''}">
      <div class="notes-card-top">
        <div class="notes-card-title">${n.title ? _esc(n.title) : '<span class="notes-card-untitled">Untitled</span>'}</div>
        <div class="notes-card-actions">
          ${!inTrash ? `
          <button class="notes-card-icon-btn${n.isPinned?' is-active':''}" data-pin="${n.id}" title="${n.isPinned?'Unpin':'Pin'}">${ICONS.pin}</button>
          <button class="notes-card-icon-btn${n.isFavorite?' is-active':''}" data-fav="${n.id}" title="${n.isFavorite?'Unfavorite':'Favorite'}">${ICONS.star}</button>
          <button class="notes-card-icon-btn notes-card-del-btn" data-del="${n.id}" title="Trash">${ICONS.trash}</button>
          ` : `
          <button class="btn-outline-sm" data-restore="${n.id}" style="font-size:.68rem;padding:.2rem .5rem">Restore</button>
          <button class="notes-card-icon-btn notes-card-del-btn" data-perm="${n.id}" title="Delete forever">${ICONS.x}</button>
          `}
        </div>
      </div>
      ${n.preview ? `<p class="notes-card-preview">${_esc(n.preview)}</p>` : ''}
      ${tags ? `<div class="notes-card-tags">${tags}</div>` : ''}
      <div class="notes-card-footer">
        <span class="notes-card-date">${date}</span>
        ${n.wordCount ? `<span class="notes-card-wc">${n.wordCount}w</span>` : ''}
        ${n.drawing ? `<span class="notes-card-draw-ind">${ICONS.pencil}</span>` : ''}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  EDITOR
// ═══════════════════════════════════════════════════════════════
function _openEditor(noteId) {
  const note = _find(noteId);
  if (!note) return;
  _noteId = noteId;
  _view   = 'editor';
  _drawMode = false;
  _strokes  = note.drawing ? JSON.parse(JSON.stringify(note.drawing.strokes || [])) : [];
  _redoStack = [];

  document.getElementById('notesHomeView').classList.add('hidden');
  document.getElementById('notesEditorView').classList.remove('hidden');

  document.getElementById('notesTitleInput').value = note.title || '';
  document.getElementById('notesEditorArea').innerHTML = _sanitize(note.content);
  _renderTagPills();
  _updateFooter();
  _exitDraw();
  _applyNoteStyle(note);
  window.scrollTo({ top: 0 });
  setTimeout(() => document.getElementById('notesEditorArea')?.focus(), 80);
}

function _closeEditor() {
  _saveNote(false);
  _view = 'home';
  document.getElementById('notesHomeView').classList.remove('hidden');
  document.getElementById('notesEditorView').classList.add('hidden');
  _renderHome();
  window.scrollTo({ top: 0 });
}

function _createNote() {
  const note = {
    id: uid(), folderId: _folder || 'folder-inbox',
    title: '', content: '', tags: [],
    isPinned: false, isFavorite: false, isArchived: false, isTrashed: false,
    color: null, background: 'default', drawing: null,
    preview: '', wordCount: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  state.notes.items.unshift(note);
  autoSave();
  _openEditor(note.id);
  setTimeout(() => document.getElementById('notesTitleInput')?.focus(), 120);
}

function _saveNote(showIndicator = true) {
  if (!_noteId) return;
  const note = _find(_noteId);
  if (!note) return;
  const titleEl   = document.getElementById('notesTitleInput');
  const contentEl = document.getElementById('notesEditorArea');
  if (!titleEl || !contentEl) return;
  note.title     = titleEl.value.trim();
  note.content   = _sanitize(contentEl.innerHTML);
  note.wordCount = _wc(contentEl.innerText || '');
  note.preview   = _preview(contentEl.innerText || '');
  note.updatedAt = new Date().toISOString();
  if (_strokes.length > 0) {
    note.drawing = { strokes: JSON.parse(JSON.stringify(_strokes)) };
  }
  autoSave();
  if (showIndicator) {
    const dot   = document.getElementById('notesSaveDot');
    const label = document.getElementById('notesSaveLabel');
    if (dot && label) {
      dot.className = 'notes-save-dot saving';
      label.textContent = 'Saving…';
      setTimeout(() => {
        dot.className = 'notes-save-dot saved';
        label.textContent = 'Saved';
        const ls = document.getElementById('notesLastSaved');
        if (ls) ls.textContent = 'Saved at ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }, 500);
    }
  }
}

function _schedSave() {
  clearTimeout(_autoTimer);
  const dot = document.getElementById('notesSaveDot');
  if (dot) dot.className = 'notes-save-dot pending';
  _autoTimer = setTimeout(() => _saveNote(), 800);
}

function _updateFooter() {
  const area = document.getElementById('notesEditorArea');
  if (!area) return;
  const text = area.innerText || '';
  const wEl = document.getElementById('notesWordCount');
  const cEl = document.getElementById('notesCharCount');
  if (wEl) wEl.textContent = `${_wc(text)} words`;
  if (cEl) cEl.textContent = `${text.replace(/\s/g,'').length} chars`;
}

function _wireEditor() {
  const el = document.getElementById('notesEditorView');
  if (!el) return;

  el.querySelector('#notesBackBtn').addEventListener('click', _closeEditor);

  el.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      _refreshToolbar();
    });
  });

  // Live active-state on format buttons (bold/italic/lists/align)
  document.addEventListener('selectionchange', () => {
    if (_view === 'editor' && !_drawMode) _refreshToolbar();
  });

  el.querySelector('#notesFmtSel').addEventListener('change', e => {
    const tag = e.target.value; e.target.value = '';
    if (tag) document.execCommand('formatBlock', false, tag);
    document.getElementById('notesEditorArea')?.focus();
  });

  el.querySelector('#notesChecklistBtn').addEventListener('click', _insertChecklist);

  el.querySelector('#notesFgColor').addEventListener('input', e => { document.execCommand('foreColor', false, e.target.value); });
  el.querySelector('#notesHlColor').addEventListener('input', e => { document.execCommand('hiliteColor', false, e.target.value); });

  el.querySelector('#notesImgBtn').addEventListener('click', _pickImage);
  el.querySelector('#notesAudioBtn').addEventListener('click', _showAudioModal);

  el.querySelector('#notesTextModeBtn').addEventListener('click', _exitDraw);
  el.querySelector('#notesDrawModeBtn').addEventListener('click', _enterDraw);

  el.querySelectorAll('.notes-draw-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.notes-draw-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _drawTool = btn.dataset.tool;
    });
  });
  el.querySelector('#notesDrawColor').addEventListener('input', e => { _drawColor = e.target.value; });
  el.querySelector('#notesDrawSize').addEventListener('input', e => { _drawSize = +e.target.value; });
  el.querySelector('#notesDrawOpacity').addEventListener('input', e => { _drawOpacity = +e.target.value / 100; });
  el.querySelector('#notesDrawUndo').addEventListener('click', _drawUndo);
  el.querySelector('#notesDrawClear').addEventListener('click', _drawClear);

  const area = el.querySelector('#notesEditorArea');
  area.addEventListener('input', () => { _schedSave(); _updateFooter(); });
  area.addEventListener('keydown', _handleKey);
  area.addEventListener('click', _handleCheckClick);
  el.querySelector('#notesTitleInput').addEventListener('input', _schedSave);

  el.querySelector('#notesTagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); _addTag(e.target.value); }
    if (e.key === 'Backspace' && !e.target.value) _removeLastTag();
  });

  const exportBtn  = el.querySelector('#notesExportBtn');
  const exportMenu = el.querySelector('#notesExportMenu');
  exportBtn.addEventListener('click', e => { e.stopPropagation(); exportMenu.classList.toggle('hidden'); _clampMenu(exportMenu); });
  exportMenu.querySelectorAll('[data-export]').forEach(b => {
    b.addEventListener('click', () => { _exportNote(b.dataset.export); exportMenu.classList.add('hidden'); });
  });

  const moreBtn  = el.querySelector('#notesMoreBtn');
  const moreMenu = el.querySelector('#notesMoreMenu');
  moreBtn.addEventListener('click', e => { e.stopPropagation(); moreMenu.classList.toggle('hidden'); _clampMenu(moreMenu); });
  moreMenu.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', () => { _noteAction(b.dataset.action); moreMenu.classList.add('hidden'); });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.notes-drop').forEach(d => d.classList.add('hidden'));
  });

  // Color/BG swatches
  el.querySelector('#notesEdBody').addEventListener('click', e => {
    const ci = e.target.closest('[data-ci]');
    if (ci) { const n = _find(_noteId); if (n) { n.color = NOTE_COLORS[+ci.dataset.ci]; autoSave(); _applyNoteStyle(n); } }
    const bid = e.target.closest('[data-bid]');
    if (bid) { const n = _find(_noteId); if (n) { n.background = bid.dataset.bid; autoSave(); _applyNoteStyle(n); } }
  });
}

/* Reflect active formats at the caret onto the toolbar buttons */
const _STATE_CMDS = ['bold','italic','underline','strikeThrough',
  'insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight'];

function _refreshToolbar() {
  const tb = document.getElementById('notesFmtTb');
  if (!tb || tb.classList.contains('hidden')) return;
  _STATE_CMDS.forEach(cmd => {
    const btn = tb.querySelector(`[data-cmd="${cmd}"]`);
    if (!btn) return;
    let on = false;
    try { on = document.queryCommandState(cmd); } catch { /* unsupported */ }
    btn.classList.toggle('is-on', on);
  });
}

/* Keep dropdown menus inside the viewport (mobile) */
function _clampMenu(menu) {
  if (menu.classList.contains('hidden')) return;
  menu.style.transform = '';
  const r = menu.getBoundingClientRect();
  let dx = 0;
  if (r.left < 8) dx = 8 - r.left;
  else if (r.right > window.innerWidth - 8) dx = (window.innerWidth - 8) - r.right;
  if (dx) menu.style.transform = `translateX(${dx}px)`;
}

function _handleKey(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
    if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
    if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); document.execCommand('undo'); }
    if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); document.execCommand('redo'); }
  }
}

function _handleCheckClick(e) {
  const cb = e.target.closest('.n-cb');
  if (!cb) return;
  cb.classList.toggle('checked');
  cb.closest('.n-cl-item')?.classList.toggle('done', cb.classList.contains('checked'));
  _schedSave();
}

function _insertChecklist() {
  document.execCommand('insertHTML', false,
    `<div class="n-cl-item"><span class="n-cb" contenteditable="false"></span><span class="n-cl-text">&nbsp;</span></div>`);
}

function _applyNoteStyle(note) {
  const body = document.getElementById('notesEdBody');
  if (!body) return;
  const bg = BG_OPTIONS.find(b => b.id === note.background)?.bg || '';
  body.style.setProperty('--note-bg', bg || 'transparent');
  // Pastel backgrounds are light — switch editor text to dark so it stays readable
  body.classList.toggle('is-light-bg', !!bg);
}

// ═══════════════════════════════════════════════════════════════
//  TAGS
// ═══════════════════════════════════════════════════════════════
function _renderTagPills() {
  const note = _find(_noteId);
  const el   = document.getElementById('notesTagPills');
  if (!el || !note) return;
  el.innerHTML = (note.tags || []).map((t, i) =>
    `<span class="notes-tag-badge-ed">#${_esc(t)}<button data-ti="${i}" style="background:none;border:none;color:inherit;cursor:pointer;font-size:.65rem;margin-left:.1rem;opacity:.7">×</button></span>`
  ).join('');
  el.querySelectorAll('[data-ti]').forEach(b => {
    b.addEventListener('click', () => { note.tags.splice(+b.dataset.ti, 1); _renderTagPills(); autoSave(); });
  });
}

function _addTag(val) {
  const tag = val.trim().replace(/^#+/, '').replace(/[,\s]+/g, '').toLowerCase();
  const inp = document.getElementById('notesTagInput');
  if (!tag) { if (inp) inp.value = ''; return; }
  const note = _find(_noteId);
  if (!note) return;
  if (!note.tags.includes(tag)) { note.tags.push(tag); _renderTagPills(); autoSave(); }
  if (inp) inp.value = '';
}

function _removeLastTag() {
  const note = _find(_noteId);
  if (!note || !note.tags.length) return;
  note.tags.pop(); _renderTagPills(); autoSave();
}

// ═══════════════════════════════════════════════════════════════
//  DRAWING
// ═══════════════════════════════════════════════════════════════
function _enterDraw() {
  _drawMode = true;
  document.getElementById('notesEditorArea').classList.add('hidden');
  document.getElementById('notesDrawWrap').classList.remove('hidden');
  document.getElementById('notesDrawTb').classList.remove('hidden');
  document.getElementById('notesFmtTb').classList.add('hidden');
  document.getElementById('notesTextModeBtn').classList.remove('active');
  document.getElementById('notesDrawModeBtn').classList.add('active');
  // Size the canvas after layout settles so clientWidth/Height are real
  requestAnimationFrame(() => _initCanvas());
}

function _exitDraw() {
  _drawMode = false;
  document.getElementById('notesEditorArea').classList.remove('hidden');
  document.getElementById('notesDrawWrap').classList.add('hidden');
  document.getElementById('notesDrawTb').classList.add('hidden');
  document.getElementById('notesFmtTb').classList.remove('hidden');
  document.getElementById('notesTextModeBtn').classList.add('active');
  document.getElementById('notesDrawModeBtn').classList.remove('active');
}

function _initCanvas() {
  const wrap   = document.getElementById('notesDrawWrap');
  const canvas = document.getElementById('notesDrawCanvas');
  if (!canvas || !wrap) return;
  const w = wrap.clientWidth || 800;
  const h = Math.max(wrap.clientHeight || 400, 400);
  canvas.width  = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
  _redraw(canvas, ctx);

  const pos = (e, c) => {
    const r = c.getBoundingClientRect();
    const ev = e.touches ? e.touches[0] : e;
    return { x: (ev.clientX - r.left) * (c.width / r.width), y: (ev.clientY - r.top) * (c.height / r.height) };
  };

  const onDown = e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* mouse fallback */ }
    _isDrawing = true;
    _curStroke = { tool: _drawTool, color: _drawColor, size: _drawSize, opacity: _drawOpacity, points: [pos(e, canvas)] };
    _redraw(canvas, ctx);
  };
  const onMove = e => { e.preventDefault(); if (!_isDrawing || !_curStroke) return; _curStroke.points.push(pos(e, canvas)); _redraw(canvas, ctx); };
  const onUp   = e => { e.preventDefault(); if (!_isDrawing) return; _isDrawing = false; if (_curStroke?.points.length) { _strokes.push(_curStroke); _redoStack = []; } _curStroke = null; _redraw(canvas, ctx); _schedSave(); };

  canvas.removeEventListener('pointerdown', canvas._od); canvas.removeEventListener('pointermove', canvas._om); canvas.removeEventListener('pointerup', canvas._ou); canvas.removeEventListener('pointerleave', canvas._ou);
  canvas._od = onDown; canvas._om = onMove; canvas._ou = onUp;
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointerleave', onUp);
}

function _redraw(canvas, ctx) {
  if (!canvas) { canvas = document.getElementById('notesDrawCanvas'); if (!canvas) return; ctx = canvas.getContext('2d'); }
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  [..._strokes, ...(_curStroke ? [_curStroke] : [])].forEach(s => {
    if (!s.points.length) return;
    ctx.save();
    ctx.globalAlpha = s.tool === 'highlighter' ? 0.4 : s.opacity;
    ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : s.tool === 'highlighter' ? 'multiply' : 'source-over';
    ctx.strokeStyle = s.tool === 'eraser' ? 'rgba(0,0,0,1)' : s.color;
    ctx.lineWidth   = s.tool === 'eraser' ? s.size * 3 : s.tool === 'marker' ? s.size * 2 : s.tool === 'highlighter' ? s.size * 4 : s.size;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (s.points.length === 1) {
      // Single tap → visible dot
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(s.points[0].x, s.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        const m = { x: (s.points[i-1].x + s.points[i].x) / 2, y: (s.points[i-1].y + s.points[i].y) / 2 };
        ctx.quadraticCurveTo(s.points[i-1].x, s.points[i-1].y, m.x, m.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  });
}

function _drawUndo() { if (_strokes.length) { _redoStack.push(_strokes.pop()); _redraw(); _schedSave(); } }
function _drawClear() { if (!confirm('Clear all drawings?')) return; _redoStack = [..._strokes, ..._redoStack]; _strokes = []; _redraw(); _schedSave(); }

// ═══════════════════════════════════════════════════════════════
//  IMAGE
// ═══════════════════════════════════════════════════════════════
function _pickImage() {
  if (!_imgInput) {
    _imgInput = document.createElement('input');
    _imgInput.type = 'file'; _imgInput.accept = 'image/*'; _imgInput.style.display = 'none';
    document.body.appendChild(_imgInput);
    _imgInput.addEventListener('change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const dataUrl = await _compress(file);
      document.execCommand('insertHTML', false, `<img src="${dataUrl}" style="max-width:100%;border-radius:8px;margin:.5rem 0" />`);
      _schedSave(); _imgInput.value = '';
    });
  }
  _imgInput.click();
}

async function _compress(file, max = 900, q = 0.82) {
  return new Promise(resolve => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', q));
    };
    img.src = url;
  });
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO
// ═══════════════════════════════════════════════════════════════
function _showAudioModal() {
  const modal = document.getElementById('notesAudioModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const timerEl = document.getElementById('notesAudioTimer');
  if (timerEl) timerEl.textContent = '00:00';
  document.getElementById('notesAudioRecordBtn').onclick = _startRec;
  document.getElementById('notesAudioCancelBtn').onclick = () => { _stopRec(false); modal.classList.add('hidden'); };
}

function _startRec() {
  if (!navigator.mediaDevices) { showToast('Microphone not supported'); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    _audioChunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    _mediaRec = new MediaRecorder(stream, { mimeType: mime });
    _mediaRec.ondataavailable = e => { if (e.data.size > 0) _audioChunks.push(e.data); };
    _mediaRec.onstop = _onRecStopped;
    _mediaRec.start(200);
    _recSeconds = 0;
    _recTimer = setInterval(() => {
      _recSeconds++;
      const m = String(Math.floor(_recSeconds/60)).padStart(2,'0');
      const s = String(_recSeconds%60).padStart(2,'0');
      const el = document.getElementById('notesAudioTimer');
      if (el) el.textContent = `${m}:${s}`;
      if (_recSeconds >= 180) _stopRec(true);
    }, 1000);
    const recBtn  = document.getElementById('notesAudioRecordBtn');
    const stopBtn = document.getElementById('notesAudioStopBtn');
    if (recBtn)  recBtn.style.display  = 'none';
    if (stopBtn) { stopBtn.style.display = ''; stopBtn.onclick = () => _stopRec(true); }
  }).catch(() => showToast('Microphone access denied'));
}

function _stopRec(save) {
  clearInterval(_recTimer);
  if (_mediaRec && _mediaRec.state !== 'inactive') {
    if (save) _mediaRec._save = true;
    _mediaRec.stop();
    _mediaRec.stream?.getTracks().forEach(t => t.stop());
  }
  const recBtn  = document.getElementById('notesAudioRecordBtn');
  const stopBtn = document.getElementById('notesAudioStopBtn');
  if (recBtn)  recBtn.style.display  = '';
  if (stopBtn) stopBtn.style.display = 'none';
}

function _onRecStopped() {
  if (!_mediaRec?._save) { document.getElementById('notesAudioModal')?.classList.add('hidden'); return; }
  const blob = new Blob(_audioChunks, { type: _mediaRec.mimeType || 'audio/webm' });
  const reader = new FileReader();
  reader.onload = ev => {
    const dur = _recSeconds;
    const player = `<div class="n-audio-player"><audio controls src="${ev.target.result}" style="flex:1;height:28px"></audio><span style="font-size:.7rem;color:var(--text-muted)">${String(Math.floor(dur/60)).padStart(2,'0')}:${String(dur%60).padStart(2,'0')}</span></div>`;
    document.execCommand('insertHTML', false, player);
    _schedSave();
    document.getElementById('notesAudioModal')?.classList.add('hidden');
    showToast('Audio inserted');
  };
  reader.readAsDataURL(blob);
}

// ═══════════════════════════════════════════════════════════════
//  NOTE LIFECYCLE
// ═══════════════════════════════════════════════════════════════
function _noteAction(action) {
  switch (action) {
    case 'pin':       _togglePin(_noteId); break;
    case 'favorite':  _toggleFav(_noteId); break;
    case 'archive':   _archiveNote(_noteId); break;
    case 'duplicate': _duplicateNote(_noteId); break;
    case 'move':      _moveNote(_noteId); break;
    case 'trash':     _saveNote(false); _trashNote(_noteId); _closeEditor(); break;
  }
}

function _togglePin(id)  { const n = _find(id); if (!n) return; n.isPinned   = !n.isPinned;   autoSave(); _renderHome(); showToast(n.isPinned   ? 'Pinned'   : 'Unpinned'); }
function _toggleFav(id)  { const n = _find(id); if (!n) return; n.isFavorite = !n.isFavorite; autoSave(); _renderHome(); showToast(n.isFavorite ? 'Added to favorites' : 'Removed from favorites'); }
function _trashNote(id)  { const n = _find(id); if (!n) return; n.isTrashed  = true; autoSave(); _renderHome(); showToast('Moved to Trash'); }
function _restoreNote(id){ const n = _find(id); if (!n) return; n.isTrashed  = false; autoSave(); _renderHome(); showToast('Restored'); }
function _permDelete(id) { if (!confirm('Permanently delete this note?')) return; state.notes.items = state.notes.items.filter(n => n.id !== id); autoSave(); _renderHome(); showToast('Deleted permanently'); }
function _archiveNote(id){ const n = _find(id); if (!n) return; n.isArchived = !n.isArchived; autoSave(); showToast(n.isArchived ? 'Archived' : 'Unarchived'); if (n.isArchived && _noteId === id) _closeEditor(); }
function _duplicateNote(id) {
  const n = _find(id); if (!n) return;
  const copy = JSON.parse(JSON.stringify(n));
  copy.id = uid(); copy.title = (copy.title || 'Untitled') + ' (copy)';
  copy.isPinned = false; copy.createdAt = new Date().toISOString(); copy.updatedAt = copy.createdAt;
  state.notes.items.unshift(copy); autoSave(); showToast('Duplicated'); _renderHome();
}
function _moveNote(id) {
  const folders = state.notes.folders;
  const name = prompt(`Move to folder:\n${folders.map(f => f.name).join('\n')}`);
  if (!name) return;
  const f = folders.find(f => f.name.toLowerCase() === name.toLowerCase().trim());
  if (!f) { showToast('Folder not found'); return; }
  const n = _find(id); if (n) { n.folderId = f.id; autoSave(); showToast(`Moved to "${f.name}"`); _renderHome(); }
}

// ═══════════════════════════════════════════════════════════════
//  FOLDERS
// ═══════════════════════════════════════════════════════════════
function _folderModal(folderId) {
  const existing = folderId ? state.notes.folders.find(f => f.id === folderId) : null;
  const name = prompt(folderId ? 'Rename folder:' : 'New folder name:', existing?.name || '');
  if (!name?.trim()) return;
  if (folderId) {
    const f = state.notes.folders.find(f => f.id === folderId);
    if (f) f.name = name.trim();
    showToast('Renamed');
  } else {
    const colors = ['#0a84ff','#32d74b','#ff9f0a','#bf5af2','#ff453a','#64d2ff'];
    const f = { id: uid(), name: name.trim(), color: colors[state.notes.folders.length % colors.length], createdAt: new Date().toISOString() };
    state.notes.folders.push(f);
    _folder = f.id;
    showToast(`"${f.name}" created`);
  }
  autoSave(); _renderHome();
}

function _deleteFolder(id) {
  const notes = state.notes.items.filter(n => n.folderId === id);
  if (!confirm(`Delete folder${notes.length ? ` and move ${notes.length} note(s) to Inbox` : ''}?`)) return;
  notes.forEach(n => { n.folderId = 'folder-inbox'; });
  state.notes.folders = state.notes.folders.filter(f => f.id !== id);
  if (_folder === id) _folder = null;
  autoSave(); _renderHome(); showToast('Folder deleted');
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════
function _exportNote(fmt) {
  _saveNote(false);
  const note = _find(_noteId); if (!note) return;
  const title = note.title || 'note';
  const plain = document.getElementById('notesEditorArea')?.innerText || '';
  const html  = document.getElementById('notesEditorArea')?.innerHTML || '';
  if (fmt === 'txt') {
    _dl(`${title}.txt`, plain, 'text/plain');
  } else if (fmt === 'markdown') {
    const md = html.replace(/<h1[^>]*>(.*?)<\/h1>/gi,'# $1\n').replace(/<h2[^>]*>(.*?)<\/h2>/gi,'## $1\n').replace(/<h3[^>]*>(.*?)<\/h3>/gi,'### $1\n').replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis,'> $1\n').replace(/<strong[^>]*>(.*?)<\/strong>/gi,'**$1**').replace(/<b[^>]*>(.*?)<\/b>/gi,'**$1**').replace(/<em[^>]*>(.*?)<\/em>/gi,'*$1*').replace(/<i[^>]*>(.*?)<\/i>/gi,'*$1*').replace(/<u[^>]*>(.*?)<\/u>/gi,'__$1__').replace(/<li[^>]*>(.*?)<\/li>/gi,'- $1\n').replace(/<br[^>]*>/gi,'\n').replace(/<p[^>]*>(.*?)<\/p>/gis,'$1\n').replace(/<div[^>]*>(.*?)<\/div>/gis,'$1\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').trim();
    _dl(`${title}.md`, `# ${note.title || 'Note'}\n\n${md}`, 'text/markdown');
  } else if (fmt === 'html') {
    _dl(`${title}.html`, `<!doctype html><html><head><meta charset="utf-8"><title>${_esc(title)}</title></head><body style="font-family:sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem">${html}</body></html>`, 'text/html');
  } else if (fmt === 'pdf') {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(), M = 50;
    doc.setFillColor(28,28,30); doc.rect(0,0,PW,70,'F');
    doc.setFillColor(10,132,255); doc.rect(0,70,PW,3,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text(note.title || 'Note', M, 45);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(150,155,165);
    doc.text(new Date(note.updatedAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}), M, 60);
    doc.setTextColor(28,28,30); doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(plain, PW - M*2);
    doc.text(lines, M, 95);
    doc.save(`${title.replace(/[^a-z0-9]/gi,'_')}.pdf`);
  }
  showToast(`Exported as ${fmt.toUpperCase()}`);
}

function _dl(filename, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ═══════════════════════════════════════════════════════════════
//  FILTERING & HELPERS
// ═══════════════════════════════════════════════════════════════
function _filtered() {
  let notes = state.notes.items;
  switch (_filter) {
    case 'all':       notes = notes.filter(n => !n.isTrashed && !n.isArchived); break;
    case 'favorites': notes = notes.filter(n => !n.isTrashed && n.isFavorite);  break;
    case 'pinned':    notes = notes.filter(n => !n.isTrashed && n.isPinned);    break;
    case 'archived':  notes = notes.filter(n => !n.isTrashed && n.isArchived);  break;
    case 'trash':     notes = notes.filter(n => n.isTrashed);                   break;
  }
  if (_folder && _filter === 'all') notes = notes.filter(n => n.folderId === _folder);
  if (_search) {
    const q = _search.toLowerCase();
    notes = notes.filter(n => (n.title||'').toLowerCase().includes(q) || (n.preview||'').toLowerCase().includes(q) || (n.tags||[]).some(t => t.includes(q)));
  }
  return [...notes].sort(SORT_FNS[_sort] || SORT_FNS.updatedAt);
}

function _find(id)         { return state.notes.items.find(n => n.id === id) || null; }
function _wc(text)         { return (text.trim().match(/\S+/g) || []).length; }
function _preview(text)    { return text.replace(/\s+/g, ' ').trim().slice(0, 140); }
function _esc(s)           { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _fmtDate(iso)     { return iso ? new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : ''; }
function _sectionTitle()   {
  if (_folder) return state.notes.folders.find(f => f.id === _folder)?.name || 'Folder';
  return FILTER_LABELS[_filter] || 'Notes';
}
