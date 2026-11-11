import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthUrl, parseAuthHash, redirectUri, Drive, FILE_NAME } from '../src/drive.js';

test('redirectUri is the app directory without index.html, hash or query', () => {
  assert.equal(redirectUri('https://ijlorenzo.github.io/openAI.test/index.html?x=1#y'), 'https://ijlorenzo.github.io/openAI.test/');
  assert.equal(redirectUri('https://ijlorenzo.github.io/openAI.test/'), 'https://ijlorenzo.github.io/openAI.test/');
  assert.equal(redirectUri('http://localhost:8080/'), 'http://localhost:8080/');
});

test('auth URL carries the implicit-flow parameters', () => {
  const u = new URL(buildAuthUrl({ clientId: 'abc.apps', redirect: 'https://x.y/app/', state: 's1' }));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('response_type'), 'token');
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.appdata');
  assert.equal(u.searchParams.get('prompt'), 'select_account');
  const s = new URL(buildAuthUrl({ clientId: 'a', redirect: 'r', state: 's', silent: true }));
  assert.equal(s.searchParams.get('prompt'), 'none');
});

test('parseAuthHash reads tokens and errors', () => {
  const r = parseAuthHash('#access_token=tok&token_type=Bearer&expires_in=3599&state=s1&scope=x');
  assert.equal(r.accessToken, 'tok');
  assert.equal(r.state, 's1');
  assert.ok(r.expiresAt > Date.now() + 3000 * 1000);
  assert.equal(parseAuthHash('#error=access_denied&state=s1').error, 'access_denied');
  assert.equal(parseAuthHash(''), null);
  assert.equal(parseAuthHash('#foo=bar'), null);
});

function fakeDrive() {
  const files = new Map();
  let n = 0;
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const auth = init.headers?.Authorization;
    if (auth !== 'Bearer good') return new Response('', { status: 401 });
    if (u.pathname === '/drive/v3/files' && (init.method || 'GET') === 'GET') {
      const q = u.searchParams.get('q') || '';
      const m = q.match(/name='([^']+)'/);
      const list = [...files.values()].filter((f) => f.name === m[1]).map(({ id, modifiedTime }) => ({ id, modifiedTime }));
      return Response.json({ files: list });
    }
    if (u.pathname.startsWith('/drive/v3/files/') && u.searchParams.get('alt') === 'media') {
      const f = files.get(decodeURIComponent(u.pathname.split('/').pop()));
      return f ? new Response(f.text) : new Response('', { status: 404 });
    }
    if (u.pathname === '/upload/drive/v3/files' && init.method === 'POST') {
      const parts = init.body.split(/--[^\r\n]+\r\n/).filter(Boolean);
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].trim());
      const text = parts[1].split('\r\n\r\n')[1].replace(/\r\n--.*$/s, '');
      const id = 'f' + (++n);
      files.set(id, { id, name: meta.name, text, modifiedTime: new Date().toISOString() });
      return Response.json({ id });
    }
    if (u.pathname.startsWith('/upload/drive/v3/files/') && init.method === 'PATCH') {
      const id = decodeURIComponent(u.pathname.split('/').pop());
      const f = files.get(id);
      if (!f) return new Response('', { status: 404 });
      f.text = init.body; f.modifiedTime = new Date().toISOString();
      return Response.json({ id });
    }
    return new Response('', { status: 400 });
  };
  return { files, fetchImpl };
}

test('Drive client: find, create, download, update against a fake API', async () => {
  const { files, fetchImpl } = fakeDrive();
  const d = new Drive('good', fetchImpl);
  assert.equal(await d.find(), null);
  const created = await d.create('{"a":1}');
  assert.ok(created.id);
  const found = await d.find();
  assert.equal(found.id, created.id);
  assert.equal(await d.download(found.id), '{"a":1}');
  await d.update(found.id, '{"a":2}');
  assert.equal(files.get(found.id).text, '{"a":2}');
  assert.equal(files.get(found.id).name, FILE_NAME);
});

test('Drive client surfaces expired sign-in as a 401 DriveError', async () => {
  const { fetchImpl } = fakeDrive();
  const d = new Drive('bad', fetchImpl);
  await assert.rejects(() => d.find(), (e) => e.status === 401);
});
