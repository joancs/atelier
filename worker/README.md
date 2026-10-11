# CMS login (the site's Worker code)

`index.js` completes the GitHub login handshake for the Decap CMS editor at
`/admin`. It is the only part of the site that runs code on a server; every
other request is served straight from the built files in `dist/`. Which paths
reach this code is set by `run_worker_first` in `../wrangler.jsonc`.

It deploys together with the site, automatically, on every push to `main`.

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
| Callback URL | `https://atelier.joancorreasilva.workers.dev/oauth/callback` |
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

The callback URL must match exactly or GitHub refuses the login.

### 2. Give the Worker the credentials

- **Client ID** — not a secret. Put it in `../wrangler.jsonc` under `vars`
  (replacing `REPLACE-ME`) and commit it.
- **Client secret** — Cloudflare dashboard → **Workers & Pages** → `atelier` →
  **Settings** → **Variables and Secrets** → **Add** → Type **Secret**, name
  `GITHUB_CLIENT_SECRET`, paste the value. It is stored encrypted by
  Cloudflare and never appears in git. Secrets survive later deploys.

### 3. Verify

Visit `/admin` on the site and click **Login with GitHub**. A popup should
appear, ask for authorization once, then close and drop you into the editor.

## When the site gets its own domain

The login code itself needs no change — it always uses the address it is
running on. Update:

- `base_url` in `../public/admin/config.yml`
- the GitHub App's **Callback URL** (add the new one; the App accepts several)

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `redirect_uri mismatch` | The GitHub App has no Callback URL matching `<site>/oauth/callback` exactly |
| Popup opens then hangs | `base_url` in `config.yml` isn't the address the editor is open on |
| `OAuth exchange failed` | Client ID or `GITHUB_CLIENT_SECRET` is wrong or missing |
| Logged in, but can't save | App isn't installed on `atelier`, or Contents permission isn't *Read and write* |
| `Invalid OAuth state` | Cookies blocked, or the login took longer than 10 minutes |
| Logs | `npm run logs` streams live logs from the deployed Worker |

## Tests

`npm test` runs `index.test.js` (also run by CI on every pull request). Most
importantly it checks that a login token is only ever handed to this site, and
never to another website that opened the login popup.
