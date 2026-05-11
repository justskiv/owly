<p align="center">
  <img src="banner.png" alt="Owly" />
</p>

<h1 align="center">Owly</h1>

<p align="center">
  Personal command center. Plan, tasks, projects, archive — all in plain JSON on your disk.
</p>

<div align="center">

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Status](https://img.shields.io/badge/status-early%20active-orange)](#status)

[![CI](https://github.com/justskiv/owly/actions/workflows/ci.yml/badge.svg)](https://github.com/justskiv/owly/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/justskiv/owly/branch/main/graph/badge.svg)](https://app.codecov.io/gh/justskiv/owly)
[![Coverage Status](https://coveralls.io/repos/github/justskiv/owly/badge.svg?branch=main)](https://coveralls.io/github/justskiv/owly?branch=main)
[![Telegram](https://img.shields.io/badge/Telegram-@ntuzov-blue?logo=telegram&logoColor=white)](https://t.me/ntuzov)

</div>

---

## What it is

Owly is a local-first desktop app for running your week — a unified planner, task list, project board, and archive in
a single dark-themed window. All state lives in plain JSON files in the app's data directory. There is no cloud, no
account, no sync server.

An external client — a script, an agent, or just `vim` — can read or mutate any state by dropping a command file into
`data/commands/pending/`. The app's file-watcher picks it up, validates it against a Zod schema, and either executes the
mutation or moves the file to `failed/` with the error attached.

## Status

> [!IMPORTANT]
> **Early-active**, single maintainer.

## Features

- **Plan** — weekly grid 07:00–23:00, drag/resize blocks, side pool of tasks, projects, directions, backlog
- **Tasks** — dual-mode list, deadline grouping, sidebar filters, search, live counts
- **Projects** — Kanban by board, category filters, inline card creation, drag-drop
- **Context** — direction cards with nested projects by cadence
- **Horizon** — projects × months matrix, dynamic backlog
- **Review** — week / month / year periods, gauges and charts driven by real data
- **Quick Add** — Spotlight-style overlay on `Cmd+N`, inline date modifiers (`!tomorrow`), live preview
- **Command queue** — file-based mutation API for external scripts and agents

## Install

```bash
git clone https://github.com/justskiv/owly.git
cd owly
task install
task dev
```

### Prerequisites

| Tool                            | Version | Purpose                     |
|---------------------------------|---------|-----------------------------|
| Node.js                         | ≥ 20    | Frontend toolchain          |
| Rust                            | stable  | Tauri native runtime        |
| [go-task](https://taskfile.dev) | ≥ 3     | Task runner (`task <name>`) |

Plus platform-specific build tools — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

## Data on disk

All user state lives under `data/` in the app data directory:

```
data/
├── entities.json              tasks, projects, directions, contacts, goals, notes
├── schedule/
│   └── YYYY-wNN.json          weekly blocks (ISO week)
├── config.json                preferences, area colors, scheduling rules
├── templates/
│   └── default.json           routine templates
├── dashboards/                custom dashboards (legacy)
└── commands/
    ├── pending/               external client writes here
    ├── done/                  successful mutations
    └── failed/                validation or execution errors
```

Writes are atomic — temp file plus rename through the Rust `write_file` command. Reads are validated against Zod schemas
in `src/schemas/` on every load; a malformed file is surfaced rather than silently dropped.

## Architecture

Tauri 2 for the native shell, React 19 for the UI, TypeScript strict end-to-end. State is split into Zustand stores by
domain (`schedule`, `entities`, `config`, `ui`, …), each auto-persisting to JSON via subscription. Zod schemas in
`src/schemas/` are the source of truth — types flow from schemas, not the other way around. Dark theme only. CSS uses
semantic class names from a hand-authored design system; Tailwind is installed but utility classes are not used in
components (migration deferred).

- **Frontend** — React 19, Zustand, Vite
- **Native** — Tauri 2 (Rust)
- **Validation** — Zod (schema-first)
- **Tests** — Vitest, Testing Library, Playwright
- **Storage** — JSON files, atomic writes

## Command queue

External clients write a JSON file to `data/commands/pending/<id>.json`. Owly's file-watcher picks it up, validates it
against `src/schemas/command.ts`, runs the mutation, then moves the file to `data/commands/done/` or
`data/commands/failed/`. Failed files include the validation or execution error inline, so the writer can inspect and
retry without re-reading the schema.

```json
{
  "id": "01HFGZ...",
  "timestamp": "2026-05-10T12:00:00Z",
  "action": "create_entity",
  "type": "task",
  "title": "Ship banner asset",
  "deadline": "2026-05-12"
}
```

Full action reference and payload schemas: [`docs/api/commands-api.md`](./docs/api/commands-api.md).

## Development

```bash
task dev            # Tauri + Vite, opens the app window
task web            # frontend-only, on :1420
task check          # pre-commit: typecheck + lint + rust:test + test + fe:build
task test           # Vitest
task seed           # generate sample data into data/
```

Code style and anti-patterns: [`CODESTYLE.md`](./CODESTYLE.md).
