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

### 1. Create a GitHub OAuth App

<https://github.com/settings/developers> → **New OAuth App**

| Field | Value |
| --- | --- |
| Application name | `atelier CMS` (any name) |
| Homepage URL | your site URL |
| Authorization callback URL | `https://atelier-oauth.<your-subdomain>.workers.dev/callback` |

You won't know the Worker URL until step 2, so put a placeholder here and come
back and correct it — the callback URL must match exactly or GitHub refuses the
login.

Afterwards, note the **Client ID**, and generate a **Client Secret**.

### 2. Deploy the Worker

```bash
cd oauth-worker
npx wrangler login       # opens a browser to authorize the Cloudflare CLI
npx wrangler deploy      # prints the deployed URL
```

### 3. Supply the credentials

Put the Client ID in `wrangler.toml` (replacing `REPLACE-ME`), then set the
secret — this stores it encrypted with Cloudflare, never in git:

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler deploy      # redeploy so the new Client ID takes effect
```

### 4. Point the CMS at it

In `public/admin/config.yml`, set `backend.base_url` to the deployed Worker URL.

### 5. Verify

Visit `https://your-site/admin` and click **Login with GitHub**. A popup should
appear, ask for authorization once, then close and drop you into the editor.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `redirect_uri mismatch` | Callback URL in the GitHub OAuth App doesn't exactly match `<worker-url>/callback` |
| Popup opens then hangs | `base_url` in `config.yml` is wrong or missing |
| `Invalid OAuth state` | Cookies blocked, or the login took longer than 10 minutes |
| Logs | `npx wrangler tail` streams live Worker logs |
