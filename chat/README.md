# Mimi chat assistant

Mimi is the website chat assistant. It has two parts:

- `mimi.js` (site root): the chat bubble shown on every page. It stays hidden until
  `data-endpoint` on its `<script>` tag is set to the worker URL.
- `chat/worker/`: a Cloudflare Worker that holds the Claude API key and relays
  messages to Claude. `dist/worker.js` is the ready-to-paste bundle.

## Deploying the worker (Cloudflare dashboard)

1. Create a Claude API key at https://platform.claude.com (Settings > API keys) and set a
   monthly spend limit under Settings > Limits.
2. In Cloudflare, go to Workers & Pages > Create > Create Worker, name it `mimi-chat`,
   and deploy the starter.
3. Click Edit code, replace everything with the contents of `chat/worker/dist/worker.js`,
   and click Deploy.
4. In the worker's Settings > Variables and Secrets, add a **Secret** named
   `ANTHROPIC_API_KEY` with the API key as its value.
5. Copy the worker URL (for example `https://mimi-chat.<account>.workers.dev`) and put it
   in `data-endpoint="..."` on the `mimi.js` script tag in each HTML page.

## Changing what Mimi knows

Edit `SYSTEM_PROMPT` in `chat/worker/src/index.js`, then rebuild:

```bash
cd chat/worker
npm install
npx esbuild src/index.js --bundle --format=esm --platform=browser --target=es2022 --minify --outfile=dist/worker.js
```

and paste the new `dist/worker.js` into the Cloudflare editor.
