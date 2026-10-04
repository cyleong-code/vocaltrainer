// IndexedDB storage. Everything the user records stays in this browser unless they choose to analyse it
// with a configured server-side transcription service.
const DB_NAME = "speakwell";
const DB_VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        let out;
        try {
          out = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = () => resolve(out && "result" in out ? out.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const db = {
  async getSetting(key, fallback = null) {
    const r = await tx("settings", "readonly", (s) => s.get(key));
    return r ? r.value : fallback;
  },
  setSetting(key, value) {
    return tx("settings", "readwrite", (s) => s.put({ key, value }));
  },
  saveSession(session) {
    return tx("sessions", "readwrite", (s) => s.put(session));
  },
  getSession(id) {
    return tx("sessions", "readonly", (s) => s.get(id));
  },
  async listSessions() {
    const all = await tx("sessions", "readonly", (s) => s.getAll());
    return (all || []).sort((a, b) => a.createdAt - b.createdAt);
  },
  deleteSession(id) {
    return tx("sessions", "readwrite", (s) => s.delete(id));
  },
  async deleteAll() {
    await tx("sessions", "readwrite", (s) => s.clear());
    await tx("settings", "readwrite", (s) => s.clear());
  },
};

export function newId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
