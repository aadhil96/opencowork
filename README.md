# OpenCowork

Open source AI co-work desktop app for contract review and legal research.

Built with Electron + React. Powered by any model via [OpenRouter](https://openrouter.ai) — works with free models out of the box.

![OpenCowork Screenshot](https://placeholder.com/screenshot)

## Features

- **Contract Review** — Upload PDF, DOCX, or TXT contracts and ask the AI anything about them
- **Agentic Analysis** — AI autonomously extracts clauses, flags risks, summarizes, and compares to market standard
- **Legal Research** — Separate research mode for open-ended legal questions
- **Multiple Sessions** — ChatGPT-style sidebar with independent chat sessions
- **Any Model** — Connect any OpenRouter model; defaults to a free OSS model
- **Light & Dark Theme** — Persistent theme preference
- **Local First** — API key and settings stored locally, never sent to any server other than OpenRouter

## Quick Start

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai/keys) API key (free tier available)

### Install & Run

```bash
git clone https://github.com/your-username/opencowork.git
cd opencowork
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Setup

1. Launch the app
2. Click **Settings** in the bottom-left sidebar
3. Paste your OpenRouter API key
4. Select a model — `GPT OSS 120B (Free)` is the default and requires no credits

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| UI | React 18 + TypeScript |
| Build | electron-vite + Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| AI | OpenRouter (streaming + tool use) |
| Doc parsing | mammoth.js (DOCX), native iframe (PDF) |
| Storage | electron-store |

## AI Tools (Agentic Mode)

When a document is loaded, the AI can call these tools autonomously:

| Tool | What it does |
|---|---|
| `extract_clauses` | Pull all clauses of a given type |
| `identify_risks` | Flag risky clauses with severity levels |
| `summarize_document` | Generate a structured executive summary |
| `search_document` | Find a term or concept in the document |
| `compare_to_standard` | Compare a clause to market standard terms |

## Contributing

Pull requests are welcome. For major changes, open an issue first.

## License

MIT
