import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { TasksPage } from "./TasksPage";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { useUIStore } from "../store/ui";
import {
  edgeConfig,
  edgeEntities,
  screenshotEntities,
} from "../test/fixtures/edge";

test("Cmd+N opens Quick Add on Tasks", async () => {
  useConfigStore.setState({ config: edgeConfig });
  useEntityStore.setState({ entities: edgeEntities });
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });

  const screen = render(<Shell />);

  await userEvent.keyboard("{Meta>}{n}{/Meta}");

  await expect
    .element(screen.getByRole("dialog", { name: /быстрое создание/i }))
    .toBeVisible();
});

test("Tasks list visual baseline", async () => {
  useConfigStore.setState({ config: edgeConfig });
  useEntityStore.setState({ entities: screenshotEntities });
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });

  const screen = render(<TasksPage />);

  await expect.element(screen.container).toMatchScreenshot("tasks-list");
});
