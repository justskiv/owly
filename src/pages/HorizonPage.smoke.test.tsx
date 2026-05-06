import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HorizonPage } from "./HorizonPage";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { useHorizonStore } from "../store/horizon";
import {
  edgeConfig,
  edgeEntities,
  edgeHorizonFile,
} from "../test/fixtures/edge";

describe("HorizonPage smoke", () => {
  test("renders board and backlog without crashing", () => {
    useConfigStore.setState({ config: edgeConfig });
    useEntityStore.setState({ entities: edgeEntities });
    useHorizonStore.setState({
      baseMonth: edgeHorizonFile.base_month,
      projects: edgeHorizonFile.projects,
      groupCollapsed: edgeHorizonFile.group_collapsed,
      sectionCollapsed: edgeHorizonFile.section_collapsed,
    });

    const { container } = render(<HorizonPage />);

    expect(container.querySelector(".horizon-view")).not.toBeNull();
  });
});
