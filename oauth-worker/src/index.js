/**
 * GitHub OAuth helper for Decap CMS, running on Cloudflare Workers.
 *
 * Why this exists: Decap CMS runs entirely in the browser, but exchanging a
 * GitHub login for an access token requires sending a *client secret*. Anything
 * shipped to a browser is public, so that exchange must happen server-side.
 * This Worker is that server-side step — and nothing more.
 *
 * The flow:
 *   1. CMS opens a popup to  /auth
 *   2. We redirect the popup to GitHub's consent screen
 *   3. GitHub redirects back to  /callback?code=...
 *   4. We trade that short-lived code + our secret for an access token
 *   5. We hand the token to the CMS window via postMessage, and close the popup
 */

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/** Renders the tiny HTML page that hands the result back to the CMS window. */
function postMessagePage(payload) {
  // Decap's handshake: the popup announces itself, the CMS window answers,
  // and only then do we send the payload back — to that window's origin.
  const body = JSON.stringify(payload);
  return `<!doctype html>
<html><body><script>
  (function () {
    function receiveMessage(e) {
      window.opener.postMessage(
        'authorization:github:success:${body.replace(/'/g, "\\'")}',
        e.origin
      );
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:github', '*');
  })();
</script></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      // "state" is a random value we hand to GitHub and expect back unchanged.
      // It proves the callback we receive was triggered by a login *we*
      // started, rather than forged by someone else (CSRF protection).
      const state = crypto.randomUUID();

      const authUrl = new URL(GITHUB_AUTHORIZE_URL);
      authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', `${url.origin}/callback`);
      // "repo" is required: the CMS commits files to the repository.
      authUrl.searchParams.set('scope', 'repo,user');
      authUrl.searchParams.set('state', state);

      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl.toString(),
          // HttpOnly so browser JS can't read it; SameSite=Lax so it still
          // survives the redirect back from GitHub.
          'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
        },
      });
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      const cookie = request.headers.get('Cookie') || '';
      const expectedState = cookie.match(/oauth_state=([^;]+)/)?.[1];

      if (!code || !returnedState || returnedState !== expectedState) {
        return new Response('Invalid OAuth state or missing code.', { status: 400 });
      }

      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'atelier-oauth-worker',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const data = await tokenResponse.json();

      if (!data.access_token) {
        return new Response(`OAuth exchange failed: ${data.error_description || 'unknown error'}`, {
          status: 401,
        });
      }

      return new Response(
        postMessagePage({ token: data.access_token, provider: 'github' }),
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            // Clear the one-time state cookie.
            'Set-Cookie': 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
          },
        },
      );
    }

    return new Response('Not found', { status: 404 });
  },
};
