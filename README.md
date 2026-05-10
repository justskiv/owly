# Owly

Personal control center: weekly planner, tagged entities, dashboards,
automation through a command queue.

## Stack

- **Runtime:** Tauri 2 (Rust + WebView)
- **UI:** React 19, Zustand
- **Storage:** JSON files in app data dir, validated by Zod
- **Build:** Vite

## Development

```bash
npm install
task dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `task dev` | Tauri + Vite in dev mode |
| `task build` | Build installer bundle |
| `task check` | Pre-commit (typecheck + lint + tests + build) |
| `task test` | Vitest |
| `task seed` | Generate sample data |

## License

This project is licensed under the [PolyForm Perimeter License 1.0.0](https://polyformproject.org/licenses/perimeter/1.0.0/).

You are free to use this software for any purpose — personal, educational, or commercial.
You may not use the source code to create a competing product.
