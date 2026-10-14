# Warren AI

A mobile-first AI assistant experience for web and Android. This repository currently contains the first frontend prototype.

## Current status

- Responsive React + Vite interface
- Dark/light theme toggle
- Mobile navigation and conversation sidebar
- New chat, local message display, search, delete, and copy actions
- Starter prompts for studying, coding, writing, and brainstorming
- Accessible focus states and reduced-motion support

**Important:** AI generation, account authentication, and cloud conversation storage are not connected yet. Messages are only held in the current browser session. The interface clearly indicates this preview state rather than pretending a response was generated.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build:

```bash
npm run build
npm run preview
```

## Planned architecture

- **Client:** React, Vite, CSS, Lucide icons
- **API:** Node.js + Express
- **Database:** MongoDB
- **AI:** server-side integration with a supported provider such as Groq or OpenAI
- **Android:** Capacitor wrapping the shared responsive web app

## Environment variables

Copy `.env.example` to `.env` for local configuration as backend work is added. Never commit real API keys, database credentials, or authentication secrets. AI provider keys must remain on the server, not in browser code.

## Roadmap

1. Complete and test the responsive UI.
2. Add a backend API, secure authentication, and private per-user data access.
3. Connect a real AI provider with streaming, error handling, and usage limits.
4. Deploy the web client and API.
5. Package and test the Android application with Capacitor.

## Project

[GitHub repository](https://github.com/james-warren-labs/Warren-App)
