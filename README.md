# Trench — a chat UI for your local Ollama model

A React web app for chatting with a model running in Ollama (built with a DeepSeek R1
style model in mind — it renders R1's `<think>...</think>` reasoning as a collapsible
"dive" trace instead of dumping it inline). Runs entirely on your machine; nothing
goes to the cloud.

## 1. Install

You need [Node.js](https://nodejs.org) 18+ installed. Then:

```bash
cd ollama-chat-ui
npm install
```

## 2. Make sure your model is pulled in Ollama

```bash
ollama list
```

Note the exact tag (e.g. `huihui_ai/deepseek-r1-abliterated:8b`) — you'll paste this
into the app's settings.

## 3. Run it

```bash
npm run dev
```

This prints two URLs: a `localhost` one (for this computer) and a `Network` one
(for other devices — see step 4). Open either in your browser, click the settings
button in the sidebar, and enter:

- **Server URL**: `http://localhost:11434` (default Ollama address)
- **Model tag**: whatever `ollama list` showed you

## 4. Using it from your phone (or another device)

Two things need to allow outside connections — the dev server (already handled by
this project's `--host` flag) and Ollama itself, which by default only listens on
localhost and only accepts requests from a few known origins.

**Find your computer's LAN IP:**
- Mac/Linux: `ipconfig getifaddr en0` (or `hostname -I` on Linux)
- Windows: `ipconfig` → look for "IPv4 Address"

**Start Ollama listening on your network, with CORS open to the dev server:**

macOS / Linux:
```bash
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve
```

Windows (PowerShell):
```powershell
$env:OLLAMA_HOST="0.0.0.0:11434"
$env:OLLAMA_ORIGINS="*"
ollama serve
```

(If Ollama is already running as a background service, stop it first so this
foreground command takes over the port.)

**On your phone**, connect to the same Wi-Fi as your computer, open
`http://<your-computer-ip>:5173` in a browser, and in the app's settings set the
Server URL to `http://<your-computer-ip>:11434`.

> `OLLAMA_ORIGINS="*"` is the easy path for a home network. If you want to lock it
> down, set it to the specific origin instead, e.g.
> `OLLAMA_ORIGINS="http://<your-computer-ip>:5173"`.

## 5. Building a standalone version (optional)

If you'd rather not run `npm run dev` every time:

```bash
npm run build
npm run preview
```

`preview` serves the production build and is also reachable on your network at
`http://<your-computer-ip>:5173`.

## Notes

- Conversations and your server/model settings are saved in the browser's local
  storage, per device — they won't sync between your laptop and phone.
- The sidebar dot shows whether the app can currently reach your Ollama server.
- If a response never starts streaming, it's almost always the CORS setting
  (`OLLAMA_ORIGINS`) or the server URL — check those first.
