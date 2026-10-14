# Warren AI

A mobile-first AI assistant for web and Android, built with React, Vite, and a Node.js API. It supports **Gemini and Groq** without exposing provider keys to the browser.

## Current features

- Responsive chat interface with dark/light themes
- Local browser chat history, conversation search, rename-by-first-message, and delete
- Chat API wired to Groq and Gemini
- Automatic provider selection: Groq first, Gemini fallback when both keys are configured
- Input validation, request-size limits, CORS configuration, security headers, and per-IP rate limiting
- Clear error states when keys are missing or providers are unavailable

**Current limitations:** Account sign-in, cloud-synced history, streaming tokens, file uploads, and the Android package are not implemented yet. Chats are stored in the current browser only.

## Requirements

- Node.js 18.17+ (Node 20 LTS recommended)
- npm
- At least one Gemini API key or Groq API key

## Configure API keys

1. Copy `.env.example` to `.env` in the repository root.
2. Put your key in one or both of these server-only variables:
   - `GEMINI_API_KEY=your_gemini_key`
   - `GROQ_API_KEY=your_groq_key`
3. Keep `AI_PROVIDER=auto` to try Groq first and fall back to Gemini, or set it to `groq` or `gemini` to use only one provider.
4. Never paste keys into frontend code, commit them, or share them in chat. The root `.env` is ignored by Git.

You do not need to share either API key with the developer or place it in GitHub. Add it privately in your local `.env` or your hosting provider's environment-variable settings.

## Run locally

Install frontend dependencies from the repository root and API dependencies from the `server` directory:

```bash
npm install
npm --prefix server install
```

Create `.env` from `.env.example`, then start both the frontend and API:

```bash
npm run dev:full
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The frontend proxies `/api` requests to the API on port 3000.

To run separately, use `npm run dev` for the frontend and `npm run dev:server` for the API. Check API status at `http://localhost:3000/api/health`.

Build the web app:

```bash
npm run build
npm run preview
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `auto`, `groq`, or `gemini` |
| `GROQ_API_KEY` | Secret Groq key (server only) |
| `GEMINI_API_KEY` | Secret Gemini key (server only) |
| `GROQ_MODEL` | Optional Groq model override |
| `GEMINI_MODEL` | Optional Gemini model override |
| `PORT` | API port; defaults to 3000 |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `VITE_API_BASE_URL` | Frontend API base; defaults to `/api` |

## Planned next

1. Test real provider calls with your private keys.
2. Deploy the frontend and API and set production CORS origins.
3. Add account authentication and cloud chat storage.
4. Add Android packaging with Capacitor and test on a real device.

## Project

[GitHub repository](https://github.com/james-warren-labs/Warren-App)
