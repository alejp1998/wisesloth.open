# WiseSloth.open

This is the self-hosted edition. The upstream production checkout is separate;
never deploy to or modify it while working here.

- Express/EJS: `express-app`. FastAPI/LiteLLM: `fastapi-api`.
- Verify with `npm ci && npm test -- --runInBand` in `express-app`,
  `python -m unittest discover -s tests` in `fastapi-api`, and `npm run lint`.
- Keep permanent accounts and saved content. No fingerprints, CAPTCHA, ads,
  analytics, subscriptions, token allowances, or automatic content deletion.
- Server-paid AI calls use `helpers/ai-client.js`, which records usage before
  controllers persist generated content and serializes calls for budget checks.
- Browser BYOK uses fixed provider endpoints and tab memory only. Never send the
  browser key to this server, persist it in browser storage, or fall back to a
  host-paid request. Validate completions before saving; browser usage has zero
  host cost and uses provider-side personal spending controls.
- Never serialize API keys or password hashes in public responses or logs.
- Docker uses project-scoped containers and named volumes. Only web is exposed.
  Verify with a distinct project name and port.
- Preserve test visibility and author checks. Auth uses scrypt and session rotation.
- Run `npm run build` to regenerate browser `.min.js` files. Edit source files.
- Declare EJS variables; new AJAX partials need registering in
  `helpers/load-template-content.js`. Sanitize Markdown before MathJax runs.
- Keep documentation and code in English; preserve unrelated work.
