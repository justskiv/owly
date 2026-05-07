// Structural selectors used by e2e tests. Co-located so a UI rename
// updates one place. Each entry should also have a `// for E2E
// selector` marker on the corresponding render in src/components/**.

export const sel = {
  topNav: {
    plan: '[data-tab="plan"]',
    tasks: '[data-tab="tasks"]',
    projects: '[data-tab="projects"]',
    context: '[data-tab="context"]',
    horizon: '[data-tab="horizon"]',
    review: '[data-tab="review"]',
  },
  screen: {
    plan: '[data-screen="plan"]',
    tasks: '[data-screen="tasks"]',
    projects: '[data-screen="projects"]',
    context: '[data-screen="context"]',
    horizon: '[data-screen="horizon"]',
    review: '[data-screen="review"]',
  },
  quickAdd: {
    dialog: { role: "dialog" as const, name: /быстрое создание/i },
    input: "Что добавить?",
  },
  planner: {
    grid: '[data-testid="planner-grid"]',
    dayBody: (date: string) => `.day-body[data-date="${date}"]`,
    block: (title: string) => new RegExp(`^${title},`, "i"),
  },
};
