const DB_NAME = 'ezlifz-images';
const STORE_NAME = 'images';
let _db = null;
const _cache = new Map();

async function _openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
    req.onsuccess  = e => { _db = e.target.result; resolve(_db); };
    req.onerror    = e => reject(e.target.error);
  });
}

export async function storeImage(key, dataUrl) {
  _cache.set(key, dataUrl);
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  });
}

export async function loadImage(key) {
  if (_cache.has(key)) return _cache.get(key);
  const db = await _openDB();
  return new Promise(resolve => {
    const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
    req.onsuccess = e => { const v = e.target.result || null; if (v) _cache.set(key, v); resolve(v); };
    req.onerror   = () => resolve(null);
  });
}

export function getCachedImage(key) {
  return _cache.get(key) || null;
}

export async function removeImage(key) {
  _cache.delete(key);
  try {
    const db = await _openDB();
    await new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = resolve;
      tx.onerror    = resolve;
    });
  } catch {}
}

export async function preloadImages(keys) {
  await Promise.all(keys.map(k => loadImage(k).catch(() => null)));
}

export async function clearAllImages() {
  _cache.clear();
  const db = await _openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = resolve;
    tx.onerror    = resolve;
  });
}

export function compressFile(file, maxDim = 600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => compressDataUrl(e.target.result, maxDim, quality).then(resolve);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compressDataUrl(dataUrl, maxDim = 600, quality = 0.78) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else       { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
