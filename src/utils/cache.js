// ─────────────────────────────────────────────────────────
//  Firestore read cache — two layers:
//    1. sessionStorage  (survives page refreshes, cleared on tab close)
//    2. in-memory       (fastest, same-tab only)
//  TTL: 30 minutes for collections, 10 minutes for documents
// ─────────────────────────────────────────────────────────

const MEM   = {};
const TTL   = { registrations: 10 * 60 * 1000, auditLog: 10 * 60 * 1000, default: 15 * 60 * 1000 };

function getTTL(key) {
  return TTL[key] || TTL.default;
}

// ── sessionStorage helpers (serialises dates as strings) ──
function ssGet(key) {
  try {
    const raw = sessionStorage.getItem("mjca_" + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > getTTL(key)) { sessionStorage.removeItem("mjca_" + key); return null; }
    return data;
  } catch { return null; }
}

function ssSet(key, data) {
  try { sessionStorage.setItem("mjca_" + key, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* quota exceeded — silent */ }
}

function ssDel(key) {
  try {
    if (key) sessionStorage.removeItem("mjca_" + key);
    else Object.keys(sessionStorage).filter(k => k.startsWith("mjca_")).forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

// ── Public API ─────────────────────────────────────────────

export function cacheSet(key, data) {
  MEM[key] = { data, ts: Date.now() };
  ssSet(key, data);
}

export function cacheGet(key) {
  // 1. Memory
  const m = MEM[key];
  if (m && Date.now() - m.ts < getTTL(key)) return m.data;
  delete MEM[key];

  // 2. sessionStorage
  const s = ssGet(key);
  if (s) { MEM[key] = { data: s, ts: Date.now() }; return s; }

  return null;
}

export function cacheClear(key) {
  if (key) { delete MEM[key]; ssDel(key); }
  else { Object.keys(MEM).forEach(k => delete MEM[k]); ssDel(); }
}

// ── Field migration shim ───────────────────────────────────
//  Firestore records created before the rename still use
//  the old field name "dateProclamation". This function maps
//  it to the new name "dateSavaliPublished" transparently so
//  both old and new records work during the migration window.
//  Once all Firestore documents are migrated, this shim and
//  the dateProclamation references below can be removed.
export function normaliseRecord(data) {
  if (data.dateProclamation !== undefined && data.dateSavaliPublished === undefined) {
    data.dateSavaliPublished = data.dateProclamation;
    delete data.dateProclamation;
  }
  return data;
}

// ── Deduplicate in-flight requests ────────────────────────
//  Prevents multiple components mounting at the same time
//  from firing duplicate Firestore reads simultaneously.
const inflight = {};

export async function cachedFetch(key, fetchFn) {
  const cached = cacheGet(key);
  if (cached) return cached;

  // Already fetching — wait for it
  if (inflight[key]) return inflight[key];

  inflight[key] = fetchFn().then(data => {
    cacheSet(key, data);
    delete inflight[key];
    return data;
  }).catch(err => {
    delete inflight[key];
    throw err;
  });

  return inflight[key];
}
