/** The selected image stays in this browser, outside the small preference JSON. */
const DB_NAME = 'ps-arena-appearance-v1';
const MAX_BYTES = 1024 * 1024;
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const validateBackground = (file: Blob) => {
  if (!MIME_TYPES.has(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (!file.size || file.size > MAX_BYTES) throw new Error('Choose an image smaller than 1 MB.');
};

function imageStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let db: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error && transaction) { try { transaction.abort(); } catch { /* Already finished. */ } }
      db?.close();
      if (error) reject(error); else resolve(value as T);
    };
    const timeout = window.setTimeout(() => finish(new Error('Image storage timed out. Close other Arena tabs and try again.')), 10_000);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (settled) { request.transaction?.abort(); return; }
        request.result.createObjectStore('images');
      };
      request.onerror = () => finish(new Error('Image storage is unavailable in this browser.'));
      request.onblocked = () => finish(new Error('Close other Arena tabs and try again.'));
      request.onsuccess = () => {
        db = request.result;
        if (settled) { db.close(); return; }
        try {
          transaction = db.transaction('images', mode);
          const result = action(transaction.objectStore('images'));
          transaction.oncomplete = () => finish(undefined, result.result);
          transaction.onabort = transaction.onerror = () => finish(new Error('The image could not be stored. Free some browser storage and try again.'));
        } catch { finish(new Error('Image storage is unavailable or full. Free some browser storage and try again.')); }
      };
    } catch { finish(new Error('Image storage is unavailable in this browser.')); }
  });
}

export async function readBackground(): Promise<Blob | undefined> {
  const stored: unknown = await imageStore('readonly', store => store.get('background'));
  if (stored === undefined) return undefined;
  // Keep early Blob records readable; new records use bytes for Safari compatibility.
  if (stored instanceof Blob) { validateBackground(stored); return stored; }
  if (!stored || typeof stored !== 'object' || !('bytes' in stored) || !('type' in stored) ||
      !(stored.bytes instanceof Uint8Array) || typeof stored.type !== 'string' || stored.bytes.byteLength > MAX_BYTES) {
    throw new Error('The saved image is invalid. Choose it again.');
  }
  const blob = new Blob([new Uint8Array(stored.bytes)], { type: stored.type });
  validateBackground(blob);
  return blob;
}
export const removeBackground = () => imageStore('readwrite', store => store.delete('background'));
export async function saveBackground(file: File): Promise<void> {
  validateBackground(file);
  // Decode before persisting: an extension or MIME declaration is not proof of an image.
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    let decodeTimeout: number | undefined;
    try {
      await Promise.race([image.decode(), new Promise<never>((_, reject) => {
        decodeTimeout = window.setTimeout(() => { image.src = ''; reject(new Error('Opening this image timed out. Try another image.')); }, 10_000);
      })]);
    } finally { clearTimeout(decodeTimeout); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8192 || image.naturalHeight > 8192) {
      throw new Error('Choose an image with each side no larger than 8192 pixels.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await imageStore('readwrite', store => store.put({ bytes, type: file.type }, 'background'));
  } catch (error) {
    if (error instanceof Error && error.name !== 'EncodingError') throw error;
    throw new Error('This image could not be opened. Try another PNG, JPEG or WebP.');
  } finally { URL.revokeObjectURL(url); }
}
export const backgroundChanged = () => window.dispatchEvent(new Event('arena:background-changed'));
