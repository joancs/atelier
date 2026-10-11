# OAuth helper Worker

A ~100-line Cloudflare Worker whose only job is to complete the GitHub login
handshake for the Decap CMS editor at `/admin`.

It is separate from the website itself: the site is static files, this is the
one small piece that has to run server-side (because it holds a secret).

## Why it's needed

Decap CMS runs in the browser and commits directly to GitHub. To get permission
to do that, it needs a GitHub access token. Obtaining one requires sending a
**client secret** to GitHub — and any secret shipped to a browser is readable by
anyone. So that single exchange has to happen somewhere the public can't see.

## Setup (one time)

### 1. Create a GitHub App

A **GitHub App** (not an "OAuth App"): its login tokens can only reach the
repositories it is installed on, so a leaked token can touch `atelier` and
nothing else. GitHub enforces this on every request.

<https://github.com/settings/apps> → **New GitHub App**

| Field | Value |
| --- | --- |
| GitHub App name | `atelier CMS` (must be unique on GitHub — add a suffix if taken) |
| Homepage URL | `https://atelier.joancorreasilva.workers.dev` |
| Callback URL | `https://atelier-oauth.joancorreasilva.workers.dev/callback` |
| Expire user authorization tokens | ✅ keep on — a token stops working after 8 hours |
| Request user authorization (OAuth) during installation | ☐ off |
| Webhook → Active | ☐ off — the App doesn't need to receive events |
| Repository permissions → **Contents** | **Read and write** |
| All other permissions | No access (in particular *not* Workflows) |
| Where can this GitHub App be installed? | Only on this account |

After **Create GitHub App**:

1. Note the **Client ID** (starts with `Iv`), and click **Generate a new client
   secret** — copy it now, GitHub shows it only once. You do **not** need a
   private key.
2. Left menu → **Install App** → your account → **Only select repositories** →
   `atelier` → **Install**.

The callback URL must match the Worker's URL exactly or GitHub refuses the
login.

### 2. Deploy the Worker

Run these from the repository root (not from inside `oauth-worker/` — there,
Wrangler would pick up the *site's* `wrangler.jsonc` and redeploy the site
instead):

```bash
npx wrangler login       # opens a browser to authorize the Cloudflare CLI
npm run oauth:deploy     # prints the deployed URL
```

### 3. Supply the credentials

Put the Client ID in `wrangler.toml` (replacing `REPLACE-ME`) and commit it,
then set the secret — this stores it encrypted with Cloudflare, never in git:

```bash
npm run oauth:secret     # paste the client secret when prompted
npm run oauth:deploy     # redeploy so the new Client ID takes effect
```

### 4. Point the CMS at it

`public/admin/config.yml` → `backend.base_url` must be the deployed Worker URL,
and `SITE_ORIGIN` in `wrangler.toml` must be the site's URL. Both are already
set for the `*.workers.dev` addresses; update them when the site gets its own
domain.

### 5. Verify

Visit `https://your-site/admin` and click **Login with GitHub**. A popup should
appear, ask for authorization once, then close and drop you into the editor.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `redirect_uri mismatch` | Callback URL in the GitHub App doesn't exactly match `<worker-url>/callback` |
| Popup opens, then nothing happens | `SITE_ORIGIN` in `wrangler.toml` doesn't exactly match the site's URL |
| Logged in, but can't save | App isn't installed on `atelier`, or Contents permission isn't *Read and write* |
| Popup opens then hangs | `base_url` in `config.yml` is wrong or missing |
| `Invalid OAuth state` | Cookies blocked, or the login took longer than 10 minutes |
| Logs | `npm run oauth:logs` streams live Worker logs |
