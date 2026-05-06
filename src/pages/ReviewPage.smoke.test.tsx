import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ReviewPage } from "./ReviewPage";
import { useScheduleStore } from "../store/schedule";
import {
  typicalBlocks,
  typicalWeekId,
} from "../test/fixtures/typical";

describe("ReviewPage smoke", () => {
  test("renders week summary", async () => {
    useScheduleStore.setState({
      blocks: typicalBlocks,
      currentWeek: typicalWeekId,
    });
    render(<ReviewPage />);
    expect(
      await screen.findByRole("heading", { name: /ревью/i }),
    ).toBeInTheDocument();
  });
});
