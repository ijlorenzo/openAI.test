// Orchestrates Google Drive sync: token storage, redirect sign-in, and
// pull → merge → push. The app supplies getState/setState so this module
// stays free of DOM and rendering concerns.
import { Drive, DriveError, buildAuthUrl, parseAuthHash, redirectUri, FILE_NAME } from './drive.js';
import { mergeStates, normalize } from './store.js';

const TOKEN_KEY = 'macrolog.drive.token';
const STATE_KEY = 'macrolog.drive.state';
const SILENT_KEY = 'macrolog.drive.silentAt';

export function createSync({ getState, setState, getClientId, onStatus = () => {}, fetchImpl = null, nav = (url) => { location.href = url; } }) {
  let status = { state: 'off', message: '', lastSync: 0, email: null };
  let timer = null;
  let inFlight = null;

  const set = (patch) => { status = { ...status, ...patch }; onStatus(status); };
  const loadToken = () => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; } };
  const saveToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };
  const validToken = () => { const t = loadToken(); return t && t.expiresAt > Date.now() ? t : null; };
  const connected = () => getState().sync?.provider === 'drive';

  function refreshStatus() {
    const S = getState();
    if (!connected()) return set({ state: 'off', lastSync: 0 });
    const t = validToken();
    set({ state: t ? (status.state === 'syncing' ? 'syncing' : 'ok') : 'needs-auth', lastSync: S.sync.lastSync || 0, email: loadToken()?.email || status.email });
  }

  /** Start sign-in by redirecting to Google. silent=true tries without UI. */
  function connect({ silent = false } = {}) {
    const clientId = getClientId();
    if (!clientId) { set({ state: 'off', message: 'Add a Google client ID first.' }); return false; }
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(STATE_KEY, JSON.stringify({ state, silent, at: Date.now(), path: location.hash })); } catch { /* ignore */ }
    if (silent) { try { localStorage.setItem(SILENT_KEY, String(Date.now())); } catch { /* ignore */ } }
    nav(buildAuthUrl({ clientId, redirect: redirectUri(), state, silent, hint: loadToken()?.email || '' }));
    return true;
  }

  /**
   * Call at boot. If the URL carries Google's response, store the token and
   * mark the account connected. Returns 'connected' | 'denied' | 'silent-failed' | null.
   */
  function handleRedirect() {
    const r = parseAuthHash(location.hash);
    if (!r) return null;
    let expected = null;
    try { expected = JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
    history.replaceState(null, '', location.pathname + location.search);
    if (r.error) {
      if (expected?.silent) { set({ state: 'needs-auth', message: '' }); return 'silent-failed'; }
      set({ state: connected() ? 'needs-auth' : 'off', message: r.error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed (${r.error}).` });
      return 'denied';
    }
    if (expected && expected.state !== r.state) { set({ message: 'Sign-in response did not match this device. Try again.' }); return 'denied'; }
    saveToken({ accessToken: r.accessToken, expiresAt: r.expiresAt, email: loadToken()?.email || null });
    const S = getState();
    if (S.sync.provider !== 'drive') { S.sync = { ...S.sync, provider: 'drive' }; setState(S, { silent: true }); }
    set({ state: 'ok', message: '' });
    return 'connected';
  }

  function disconnect() {
    saveToken(null);
    const S = getState();
    S.sync = { provider: null, fileId: null, lastSync: 0 };
    setState(S);
    set({ state: 'off', message: '', lastSync: 0, email: null });
  }

  /** Try a silent re-auth at most once per hour when the token has lapsed. */
  function maybeSilentRefresh() {
    if (!connected() || validToken()) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    const last = Number(localStorage.getItem(SILENT_KEY) || 0);
    if (Date.now() - last < 60 * 60 * 1000) return false;
    return connect({ silent: true });
  }

  const stripVolatile = (S) => { const c = normalize(S); c.sync = { provider: null, fileId: null, lastSync: 0 }; return JSON.stringify(c); };

  /** Pull, merge, push. Resolves with the merged state or null if nothing to do. */
  function syncNow({ reason = 'manual' } = {}) {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      if (!connected()) return null;
      const t = validToken();
      if (!t) { set({ state: 'needs-auth' }); return null; }
      set({ state: 'syncing', message: '' });
      const drive = new Drive(t.accessToken, fetchImpl);
      try {
        let S = getState();
        let file = S.sync.fileId ? { id: S.sync.fileId } : await drive.find(FILE_NAME);
        let remoteText = null;
        if (file) {
          try { remoteText = await drive.download(file.id); } catch (e) { if (e.status === 404) file = null; else throw e; }
        }
        let merged = S;
        if (remoteText) {
          let remote = null;
          try { remote = JSON.parse(remoteText); } catch { remote = null; }
          if (remote && typeof remote === 'object') merged = mergeStates(S, remote);
        }
        const changed = !remoteText || stripVolatile(merged) !== stripVolatile(JSON.parse(remoteText || '{}'));
        merged.sync = { provider: 'drive', fileId: file?.id || null, lastSync: Date.now() };
        if (changed) {
          const text = JSON.stringify(merged);
          const saved = file ? await drive.update(file.id, text) : await drive.create(text, FILE_NAME);
          merged.sync.fileId = saved.id || file?.id || null;
        }
        setState(merged);
        if (!t.email) { const email = await drive.whoAmI(); if (email) saveToken({ ...t, email }); set({ email }); }
        set({ state: 'ok', lastSync: merged.sync.lastSync, message: '' });
        return merged;
      } catch (e) {
        if (e instanceof DriveError && e.status === 401) { saveToken(null); set({ state: 'needs-auth', message: '' }); }
        else set({ state: 'error', message: e.message || 'Sync failed' });
        return null;
      } finally {
        inFlight = null;
        void reason;
      }
    })();
    return inFlight;
  }

  /** Debounced sync after local changes. */
  function scheduleSync(delay = 2500) {
    if (!connected() || !validToken()) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow({ reason: 'change' }), delay);
  }

  return { connect, disconnect, handleRedirect, syncNow, scheduleSync, maybeSilentRefresh, refreshStatus, status: () => status, hasToken: () => !!validToken(), connected };
}
