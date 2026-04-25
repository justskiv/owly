# LLM Guides

Гайды для внешних клиентов (AI-агенты, скрипты, человек), которые
порождают контент или мутируют данные TuzovOS. Каждый документ
описывает контракт, доступные операции, ограничения и
анти-паттерны.

## Список

- [commands-api.md](./commands-api.md) — file-based API мутаций
  через `commands/pending/`: actions, формат команды, atomic
  write, жизненный цикл pending → done/failed, scheduling
  preferences, отладка.
- [dashboard-authoring.md](./dashboard-authoring.md) — как писать
  `.jsx` дашборды для `data/dashboards/`: props, виджеты,
  дизайн-токены, anti-patterns, чеклист самопроверки.
