import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ContextPage } from "./ContextPage";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { edgeAreas, edgeConfig, edgeEntities } from "../test/fixtures/edge";

describe("ContextPage smoke", () => {
  test("renders sections for each area", async () => {
    useConfigStore.setState({ config: edgeConfig });
    useEntityStore.setState({ entities: edgeEntities });

    render(<ContextPage />);

    // Label rendered via .toUpperCase() in CategorySection — match
    // case-insensitively so the test stays robust to that detail.
    expect(
      await screen.findByText(new RegExp(`^${edgeAreas[0].label}$`, "i")),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/сначала добавьте области/i),
    ).not.toBeInTheDocument();
  });
});
