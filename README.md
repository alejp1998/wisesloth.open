<div align="center">

<img src="express-app/public/favicons/sloth-logo-square.png" alt="WiseSloth.open logo" width="112" height="112" />

# WiseSloth.open

**Your study material. Your server. Your API key.**

Turn notes, exams, PDFs and web links into AI quizzes and flashcards.<br />
Share them with your class, track your progress, and challenge friends in live battles.

[![Verify release](https://github.com/alejp1998/wisesloth.open/actions/workflows/checks.yml/badge.svg)](https://github.com/alejp1998/wisesloth.open/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-F4C542.svg)](LICENSE)
![Self-hosted](https://img.shields.io/badge/Self--hosted-Bring_your_own_key-8B5CF6)

![Node](https://img.shields.io/badge/Node-24-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

[🚀 Self-host](#start-with-docker) · [✨ Features](#features) · [🌍 Share quizzes](#host-it-for-a-class-team-or-friends) · [🔑 Keys & budgets](#api-keys-and-spending-limits) · [🛠️ Contribute](#development-and-verification)

Created by **[Alejandro Jarabo-Peñas](https://alejp.me)** · Based on **[WiseSloth.app](https://wisesloth.app)**

</div>

---

## Features

| | What you can do |
|---|---|
| 🧠 **Create with AI** | Generate quizzes from old exams, notes, PDFs, a topic description or public web links. |
| 🃏 **Study your way** | Build flashcard decks and personality quizzes, shuffle questions, and refine questions or cards with AI-assisted edits. |
| ⚡ **Compete live** | Host real-time study battles and compare scores with friends. |
| 🌍 **Share & discover** | Publish quizzes on your own domain, follow creators, favorite quizzes and track results. |
| 📄 **Take it with you** | Export quizzes to PDF or DOCX for offline study. |
| 🔑 **Choose your key** | Use a host-provided API key or save your own encrypted key in Settings. |
| 💸 **Control spending** | Track estimated AI costs and configure personal or instance-wide weekly USD thresholds. |
| 🏡 **Keep your data** | Use permanent local accounts and retain your material in your own database and image storage. |

## Contents

- [Start with Docker](#start-with-docker)
- [Host it for a class, team or friends](#host-it-for-a-class-team-or-friends)
- [API keys and spending limits](#api-keys-and-spending-limits)
- [Import from links and PDFs](#import-from-links-and-pdfs)
- [Architecture](#architecture)
- [Backups, upgrades and recovery](#backups-upgrades-and-recovery)
- [Development and verification](#development-and-verification)
- [License](#license)

### Made for self-hosting

This edition uses permanent local accounts. It includes no Google login, CAPTCHA,
browser fingerprinting, ads, analytics, payments, subscription tiers, token grants,
or scheduled deletion of study material. It starts with a fresh database; it is
not an in-place migration of the hosted production service.

## Start with Docker

Requirements: Docker Engine with the Compose plugin, Python 3 (for generating
configuration), and a server with enough memory for MySQL and the AI service.

```sh
git clone https://github.com/alejp1998/wisesloth.open.git
cd wisesloth.open
python3 scripts/setup.py
```

The setup command creates `.env` with random database passwords, a session secret,
an encryption secret, and an initial administrator password. It never overwrites
an existing `.env`; secrets are not printed. Open `.env` in your editor:

- Set `OPENAI_API_KEY` to your own key, or leave it blank and add a personal key in
  **Settings** after signing in.
- Keep `APP_URL=http://localhost:8080` for a local installation.
- Find `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then start the application:

```sh
docker compose up --build -d --wait
```

Open [http://localhost:8080](http://localhost:8080), sign in, and change your password
in **Settings**. Generate a quiz or flashcards from text, a PDF, instructions, or a
public web link. Server-mode API keys stay on the server. Saved personal keys are encrypted using
AES-256-GCM; passwords are hashed with scrypt. Back up `.env` privately: losing
`KEY_ENCRYPTION_SECRET` makes saved personal keys unreadable.

Only the web service binds a host port. MySQL and the AI service remain on the
private Compose network. Images live in a named local volume; no cloud storage or
Redis account is needed. Containers run the web and AI services as non-root users.

## Host it for a class, team or friends

Give the server a domain and HTTPS reverse proxy. For example, with Caddy on the
same host:

```caddyfile
quiz.example.org {
    reverse_proxy 127.0.0.1:8080
}
```

Set these values in `.env` and recreate the services:

```dotenv
APP_URL=https://quiz.example.org
TRUST_PROXY=1
BIND_ADDRESS=127.0.0.1
PORT=8080
```

```sh
docker compose up -d --build --wait
```

`APP_URL` must match the address visitors use, including its port. It controls
sharing metadata, secure cookies and allowed origins for browser writes. Set
`TRUST_PROXY=1` only when the web port is reachable exclusively through your
trusted proxy. For a local-network HTTP installation, use the server's reachable
address as `APP_URL` and set `BIND_ADDRESS=0.0.0.0`.

General HTTP limits apply per signed-in account so a shared school/network IP
does not combine every participant's requests. The host can change
`HTTP_RATE_LIMIT_PER_15_MIN` (zero disables this general limiter); authentication
and signup still have their own rate limits.

Registration is disabled by default. Administrators can create permanent user
accounts from **Settings → Create an account for someone**. Users can change their
initial passwords and add their own provider keys. To allow public signup, set
`ALLOW_REGISTRATION=true` and recreate the web container.

New quizzes are **private**. Open their settings, change visibility to **public**,
and share the quiz's URL on your own domain. Visitors can read a public quiz;
participants sign in to take it and save results. **Followers** visibility limits
access to the author's followers. A private quiz is accessible to its author and
instance administrators. Changing a quiz back to private revokes public access,
even for users who previously tried or favorited it. Results are visible to their
participant, quiz author and administrators.

Live battle participants also use permanent local accounts. Only the host can
start a battle, and answers are bound to the signed-in account.

Flashcards, question randomization, AI-assisted edits, skills/preferences,
PDF/DOCX exports and live battles are retained. A live battle and an unfinished
quiz attempt use process memory: restarting the web container ends those sessions.
Use one web process per instance; this release does not support horizontal scaling.

## API keys and spending limits

The host selects `LLM_MODEL`; the default is `openai/gpt-6-luna`. Server-mode generation
and AI edits use that configured model. There are no automatic provider fallbacks.

Host credentials can use `OPENAI_API_KEY`, `GEMINI_API_KEY`, or
`ANTHROPIC_API_KEY` with the corresponding LiteLLM model prefix (`openai/`,
`gemini/`, or `anthropic/`). A personal key in **Settings** overrides the host's
key for that user and must belong to the configured provider. An administrator
changing providers should ask users to replace or clear their saved keys.
`LLM_API_BASE` supports a trusted OpenAI-compatible endpoint.

### Keep your key in the browser

In **Settings → Browser API key**, choose Gemini or OpenAI, enter your own key,
and select **Use key in this tab**. The key stays in tab memory, is cleared on
reload or logout, and is sent only to the selected provider's fixed HTTPS API
endpoint. It is never stored in local/session storage or sent to this application's
server. Generation and all AI edit forms use this mode until you disconnect.

The server prepares the existing prompts and schemas, then validates the generated
content before saving it. It still receives your study material and generated
content. Browser requests have no host cost, bypass server spending thresholds,
and are marked `browser` in the usage log with zero server cost. Use your provider's
dashboard for personal billing and limits; provider quotas still apply.

Trust the instance and browser extensions you use: a host controls the page's
JavaScript, so browser-direct calls cannot offer a cryptographic guarantee against
a malicious host. Self-hosting reviewed code gives you control of that trust boundary.
No host API key is ever embedded in browser assets.

Modern model examples: [`openai/gpt-6-luna`](https://developers.openai.com/api/docs/models/gpt-6-luna)
and [`gemini/gemini-3.8-flash`](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).

### Get a Gemini key from Google AI Studio

1. Sign in to [Google AI Studio's API Keys dashboard](https://aistudio.google.com/apikey) with your Google account and accept its terms.
2. Create an API key in a new project, or import an existing project and create its key.
3. For server generation, set `LLM_MODEL=gemini/gemini-3.8-flash` and `GEMINI_API_KEY` in your private `.env`, then recreate the services. Alternatively, use **Settings → Browser API key** to keep your key in this browser tab.

Google currently lists a [free API tier for Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash).
Availability and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) depend on your project and region;
free access is subject to quotas. Check your project's billing tier before use.
Google's free-tier terms may allow submitted content to be used to improve its products;
review the [terms](https://ai.google.dev/gemini-api/terms) before sending sensitive material.
The [official key guide](https://ai.google.dev/gemini-api/docs/api-key) covers project imports and permissions.

For server mode, check the configured price estimates when changing models. If your
project is confirmed to use the free API tier, custom rates can be set to zero;
paid projects should use the current rates from Google's pricing page.

**Settings** displays this week's estimated spending and recent AI requests.
Users can set their own weekly USD threshold; administrators can also set a
threshold for the whole instance. These apply to server-mode requests, including
server-stored personal keys. Blank means **unlimited**; zero pauses new server AI
requests. Taking existing quizzes does not require tokens or an AI budget.
Weeks begin Monday at 00:00 UTC.

The limits are spending thresholds, not prepaid balances: the request that crosses
a threshold can exceed it. Paid requests are serialized across the instance, and
usage is committed before the next request's budget check. Provider billing is
authoritative; set provider-side limits when a strict financial ceiling is needed.
Deleting an account preserves spending history so it cannot reset the host limit.

Costs normally use LiteLLM's bundled model catalog. For models not listed there,
set `LLM_INPUT_USD_PER_MILLION` and `LLM_OUTPUT_USD_PER_MILLION` to the appropriate
rates. Set `LLM_USE_CATALOG_PRICES=false` to use these custom rates even for a
recognized model name, for example behind an OpenAI-compatible gateway.
The sample values are illustrative, not a price quote. Malformed provider
responses are counted when usage is available. A transport failure or response with missing
usage is recorded conservatively as `UNCERTAIN_REQUEST_COST_USD` (default `$1`),
with outcome `uncertain`; review the provider's usage before retrying. No local
tracker can observe usage incurred outside this application.

`INSTANCE_WEEKLY_BUDGET_USD` seeds the host's initial setting once. Change an
existing instance's limit in administrator **Settings**. `LLM_MAX_OUTPUT_TOKENS`
is a configurable per-response generation limit, not a user token allowance.

## Import from links and PDFs

The **From text** form for notes, old exams and flashcards accepts a public HTTP(S)
link, optionally combined with pasted notes. The server extracts readable HTML,
Markdown or plain text, stores the source URL with the study text, and generates
from that content. Imports are limited to 2 MB and 50,000 combined characters.
Use the PDF tab to upload a PDF and select the pages to process in your browser.

Link imports reject loopback, private, reserved and metadata-server addresses,
nonstandard ports, credentials in URLs, and unsafe redirects. DNS resolution is
validated and pinned to the socket to prevent rebinding. Pages requiring login,
JavaScript rendering, or unsupported formats may need their text pasted manually.
Imported pages are content, not trusted instructions. Review generated answers.

The interface loads fonts and pinned browser libraries from third-party CDNs.
It requires network access to those CDNs and your configured AI provider. The app
never logs full study prompts or completion content by default.

## Architecture

Three services run together in Docker Compose. Only the web service exposes a
host port; the AI service and database communicate over the private network.

```text
Browser → HTTPS reverse proxy → Express / EJS → FastAPI / LiteLLM → Your AI provider
                                     ↓
                                   MySQL
```

| Component | Source | Purpose |
|---|---|---|
| **Web app** | [`express-app/`](express-app) | Accounts, quizzes, flashcards, sharing, live battles and spending settings. |
| **AI service** | [`fastapi-api/`](fastapi-api) | Generation and editing with the host's configured model and provider. |
| **Database** | [`compose.yaml`](compose.yaml) | MySQL 8.4 stores accounts, study material, results, sessions and usage. |
| **Local storage** | Named Docker volume | Uploaded quiz images, shared between the AI and web services. |

See [`.env.example`](.env.example) for configuration and [AGENTS.md](AGENTS.md)
for contributor conventions.

## Backups, upgrades and recovery

Keep private copies of `.env`, the database and uploaded images. Stop writes while
making a consistent backup. For example, from this directory:

```sh
mkdir -p backups
docker compose stop web ai
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -u "$MYSQL_USER" --single-transaction --no-tablespaces "$MYSQL_DATABASE"' > backups/database.sql
docker compose run --rm --no-deps --entrypoint tar ai -czf - -C /data uploads > backups/uploads.tar.gz
docker compose start ai web
```

Store backups privately; database dumps contain study material and encrypted
personal keys. The encryption secret is required to restore those keys. Restore
the SQL into the same database and the archive into the uploads volume, then start
the services. Keep a consistent Compose project name so upgrades reuse the same
named volumes.

```sh
git pull
docker compose up -d --build --wait
```

Database migrations run before the web server starts. Do not use `docker compose
down -v` on an instance whose data you want to keep. Change a forgotten administrator
password by editing `ADMIN_PASSWORD` in `.env`, then running:

```sh
docker compose run --rm --no-deps web node scripts/reset-admin-password.js
```

That command resets the configured administrator's password without printing it.
Normal startup never resets an existing account's password.

## Development and verification

The app uses Express/EJS, FastAPI/LiteLLM and MySQL 8.4. Node 24 and Python 3.12 are
used in the Docker images and CI. You can run offline unit checks locally:

```sh
cd express-app
npm ci --ignore-scripts
npm run lint
npm test -- --runInBand
npm run build
cd ..
python3 -m venv .venv
.venv/bin/pip install -r fastapi-api/requirements.txt ruff==0.17.0
PYTHONPATH=fastapi-api .venv/bin/python -m unittest discover -s fastapi-api/tests -v
.venv/bin/ruff check fastapi-api
.venv/bin/ruff format --check fastapi-api
```

For a fresh installation and end-to-end check, use a **disposable** project and
`compose.test.yaml`. It supplies a local mock provider so tests never incur API
charges. These tests create accounts and quizzes; do not run them against a real
instance. Use a generated test `.env` with no real provider keys:

```sh
PORT=18080 APP_URL=http://localhost:18080 docker compose -p wisesloth-open-test -f compose.yaml -f compose.test.yaml up -d --build --wait
SMOKE_URL=http://localhost:18080 python3 scripts/smoke-test.py
docker compose -p wisesloth-open-test -f compose.yaml -f compose.test.yaml down -v
```

CI runs unit tests, lint, dependency audits and the fresh-instance smoke test.
Real provider access depends on your key, account and chosen model; the automated
checks use mock responses and do not assert that every provider supports every
structured-output feature.

## License

MIT. Bundled and externally loaded third-party libraries retain their own licenses.
