// Tests for the CMS login handshake in index.js. Run with `npm test`.
//
// GitHub is never contacted: the token exchange is replaced with a fake, and
// the page the popup receives is run in a sandbox that plays the part of the
// browser window, so we can see exactly who the token is sent to.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from './index.js';

const SITE = 'https://atelier.example.workers.dev';
// Contains characters that would break out of a <script> tag if the page
// embedded the token carelessly.
const TOKEN = "ghu_abc'</script><b>";

const env = {
  GITHUB_CLIENT_ID: 'Iv1.test',
  GITHUB_CLIENT_SECRET: 'secret',
  ASSETS: { fetch: async () => new Response('static site', { status: 404 }) },
};

beforeEach(() => {
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: TOKEN }));
});

/** Runs /oauth/auth and returns the state value handed to GitHub. */
async function startLogin() {
  const res = await worker.fetch(new Request(`${SITE}/oauth/auth`), env);
  return new URL(res.headers.get('Location')).searchParams.get('state');
}

/** Completes the callback and returns the HTML page sent to the popup. */
async function finishLogin(state) {
  const res = await worker.fetch(
    new Request(`${SITE}/oauth/callback?code=x&state=${state}`, {
      headers: { Cookie: `oauth_state=${state}` },
    }),
    env,
  );
  assert.equal(res.status, 200);
  return res.text();
}

/**
 * Runs the popup page's script with a fake window whose opener is a page on
 * `openerOrigin`, and returns every message the popup sends to it.
 */
function runPopup(html, openerOrigin) {
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const sent = [];
  const listeners = [];
  const window = {
    opener: { postMessage: (msg, target) => sent.push({ msg, target }) },
    addEventListener: (_type, fn) => listeners.push(fn),
    removeEventListener: () => {},
  };
  vm.runInNewContext(script, { window });
  // The opener answers the popup's handshake, as Decap does.
  for (const fn of listeners) fn({ origin: openerOrigin });
  return sent;
}

test('/oauth/auth redirects to GitHub with the right callback', async () => {
  const res = await worker.fetch(new Request(`${SITE}/oauth/auth`), env);
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('Location'));
  assert.equal(location.host, 'github.com');
  assert.equal(location.searchParams.get('redirect_uri'), `${SITE}/oauth/callback`);
  assert.equal(location.searchParams.get('client_id'), 'Iv1.test');
  assert.ok(!location.searchParams.has('scope'), 'GitHub Apps take no scope');
  assert.match(res.headers.get('Set-Cookie'), /HttpOnly; Secure/);
});

test('callback rejects a state that does not match the cookie', async () => {
  const state = await startLogin();
  const res = await worker.fetch(
    new Request(`${SITE}/oauth/callback?code=x&state=forged`, {
      headers: { Cookie: `oauth_state=${state}` },
    }),
    env,
  );
  assert.equal(res.status, 400);
});

test('callback reports a failed token exchange', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error_description: 'bad code' }));
  const state = await startLogin();
  const res = await worker.fetch(
    new Request(`${SITE}/oauth/callback?code=x&state=${state}`, {
      headers: { Cookie: `oauth_state=${state}` },
    }),
    env,
  );
  assert.equal(res.status, 401);
});

test('token is delivered intact to the site itself', async () => {
  const html = await finishLogin(await startLogin());
  const sent = runPopup(html, SITE);
  assert.ok(sent.every((m) => m.target === SITE), 'every message is addressed to the site');
  const success = sent.find((m) => m.msg.startsWith('authorization:github:success:'));
  assert.ok(success, 'token was sent');
  const payload = JSON.parse(success.msg.slice('authorization:github:success:'.length));
  assert.equal(payload.token, TOKEN);
});

test('token is NOT delivered to another website', async () => {
  const html = await finishLogin(await startLogin());
  const sent = runPopup(html, 'https://evil.example');
  assert.ok(!sent.some((m) => m.msg.includes('success')));
});

test('token cannot break out of the <script> tag', async () => {
  const html = await finishLogin(await startLogin());
  assert.ok(!html.includes('</script><b>'));
});

test('other /oauth/ paths fall back to the static site', async () => {
  const res = await worker.fetch(new Request(`${SITE}/oauth/nope`), env);
  assert.equal(await res.text(), 'static site');
});
