// Google sign-in (OAuth 2.0 implicit flow via full-page redirect, which works
// inside iOS home-screen web apps where popups do not) and a tiny Drive client
// for the app's private appDataFolder. No Google script is loaded.

export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FILE_NAME = 'macrolog.json';

/** The directory URL of the app, used as the OAuth redirect URI. */
export function redirectUri(href = location.href) {
  const u = new URL(href);
  u.hash = ''; u.search = '';
  if (!u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/[^/]*$/, '');
  return u.href;
}

export function buildAuthUrl({ clientId, redirect, state, silent = false, hint = '' }) {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  });
  if (silent) p.set('prompt', 'none'); else p.set('prompt', 'select_account');
  if (hint) p.set('login_hint', hint);
  return `${AUTH_URL}?${p.toString()}`;
}

/** Parse the fragment Google redirects back with. Returns null if it is not an auth response. */
export function parseAuthHash(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (!h) return null;
  const p = new URLSearchParams(h);
  if (!p.has('access_token') && !p.has('error')) return null;
  const expiresIn = Number(p.get('expires_in') || 3600);
  return {
    accessToken: p.get('access_token'),
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
    state: p.get('state') || '',
    error: p.get('error'),
    scope: p.get('scope') || '',
  };
}

export class DriveError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export class Drive {
  constructor(token, fetchImpl = null) { this.token = token; this.fetch = fetchImpl || ((...a) => fetch(...a)); }

  async req(url, init = {}) {
    let res;
    try {
      const f = this.fetch; // call unbound: native fetch must not get a Drive instance as `this`
      res = await f(url, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...(init.headers || {}) } });
    } catch {
      throw new DriveError('Could not reach Google Drive. Check your connection.', 0);
    }
    if (res.status === 401) throw new DriveError('Google sign-in expired.', 401);
    if (res.status === 403) throw new DriveError('Google Drive refused the request (permission or quota).', 403);
    if (!res.ok) throw new DriveError(`Google Drive error ${res.status}`, res.status);
    return res;
  }

  /** Find the app's data file. Returns { id, modifiedTime } or null. */
  async find(name = FILE_NAME) {
    const q = encodeURIComponent(`name='${name}' and trashed=false`);
    const res = await this.req(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime,size)&pageSize=5`);
    const d = await res.json();
    const files = d.files || [];
    // If duplicates ever exist, use the most recently modified.
    files.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    return files[0] || null;
  }

  async download(id) {
    const res = await this.req(`${API}/files/${encodeURIComponent(id)}?alt=media`);
    return res.text();
  }

  async create(text, name = FILE_NAME) {
    const boundary = 'macrolog' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
    const res = await this.req(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
    return res.json();
  }

  async update(id, text) {
    const res = await this.req(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text,
    });
    return res.json();
  }

  /** Who is signed in (for the status line). Uses the token's own info endpoint. */
  async whoAmI() {
    try {
      const f = this.fetch;
      const res = await f(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(this.token)}`);
      if (!res.ok) return null;
      const d = await res.json();
      return d.email || null;
    } catch { return null; }
  }
}
