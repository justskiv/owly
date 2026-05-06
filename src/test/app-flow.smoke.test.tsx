import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { Shell } from "../components/layout/Shell";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { useUIStore } from "../store/ui";
import { edgeConfig } from "./fixtures/edge";

describe("cross-screen flow", () => {
  test("Cmd+N creates a task and it shows up on Tasks", async () => {
    useConfigStore.setState({ config: edgeConfig });
    useUIStore.setState({ bootReady: true });

    const user = userEvent.setup();
    render(<Shell />);

    await user.keyboard("{Meta>}[KeyN]{/Meta}");

    expect(
      await screen.findByRole("dialog", {
        name: /быстрое создание/i,
      }),
    ).toBeVisible();

    const input = await screen.findByPlaceholderText("Что добавить?");
    await user.type(input, "Smoke flow entity");
    await user.keyboard("{Enter}");

    // Wait for the async addEntity → persistEntities chain to settle
    // before navigating; otherwise the click can race the store update
    // and the entity never renders on Tasks.
    await waitFor(() =>
      expect(
        useEntityStore
          .getState()
          .entities.some((e) => e.title === "Smoke flow entity"),
      ).toBe(true),
    );

    await user.click(
      await screen.findByRole("button", { name: /^задачи$/i }),
    );

    expect(
      await screen.findByText("Smoke flow entity"),
    ).toBeInTheDocument();
  });
});
