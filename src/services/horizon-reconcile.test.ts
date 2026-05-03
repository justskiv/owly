import { describe, expect, it } from "vitest";
import type { HorizonProjectState } from "../schemas";
import { reconcile } from "./horizon-reconcile";

const mk = (id: string): HorizonProjectState => ({
  project_id: id,
  months: [],
  size: "mid",
  hidden: false,
});

describe("reconcile", () => {
  it("empty inputs → empty diffs", () => {
    expect(reconcile(new Set(), [])).toEqual({ toAdd: [], toRemove: [] });
  });

  it("entities present, horizon empty → all toAdd", () => {
    const r = reconcile(new Set(["a", "b", "c"]), []);
    expect(r.toAdd.sort()).toEqual(["a", "b", "c"]);
    expect(r.toRemove).toEqual([]);
  });

  it("horizon present, entities empty → all toRemove", () => {
    const r = reconcile(new Set(), [mk("x"), mk("y")]);
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove.sort()).toEqual(["x", "y"]);
  });

  it("mixed diff: keeps overlap, adds missing, removes orphans", () => {
    const r = reconcile(
      new Set(["a", "b", "c"]),
      [mk("b"), mk("c"), mk("d")],
    );
    expect(r.toAdd).toEqual(["a"]);
    expect(r.toRemove).toEqual(["d"]);
  });

  it("identical sets → empty diffs (idempotent)", () => {
    const r = reconcile(new Set(["x", "y"]), [mk("x"), mk("y")]);
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove).toEqual([]);
  });
});
