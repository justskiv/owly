import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import App from "../../App";
import type { Entity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { empty } from "../scenarios/empty";
import { getCurrentFS, installFS, ROOT } from "../virtual-fs";
import { quickAdd, flushAllWrites } from "./automation";

const ENTITIES_PATH = `${ROOT}/entities.json`;

function readEntities(): Entity[] {
  return (
    JSON.parse(getCurrentFS().read(ENTITIES_PATH)) as { entities: Entity[] }
  ).entities;
}

// E-37: full destructive lifecycle through EntityEditor — create via
// Quick Add, edit title, archive, then confirm-delete. EntityEditor
// is the only UI that exposes status and the two-click delete; a
// regression in handleSave (line 184) or handleDelete (line 254)
// is silent without this end-to-end. Other tests cover create
// (F-2/J-3) but stop before edit/archive/delete.
test("E-37: entity lifecycle (create → edit → archive → delete)", async () => {
  installFS(empty());
  const screen = render(<App />);
  await expect
    .poll(() => useUIStore.getState().bootReady, { timeout: 5000 })
    .toBe(true);

  // ----- CREATE -----------------------------------------------------
  await quickAdd(screen, "Lifecycle task");
  await flushAllWrites();

  const created = useEntityStore
    .getState()
    .entities.find((e) => e.title === "Lifecycle task");
  expect(created).toBeTruthy();
  if (!created) return;
  expect(readEntities().find((e) => e.id === created.id)?.status).toBe(
    "active",
  );

  // ----- EDIT TITLE ------------------------------------------------
  // EntityEditor has the only Status select and the only delete-with-
  // confirm path, so drive it directly through the store. The
  // accessible name of the title input comes from "Название *" via
  // <label htmlFor="ee-title-input">; the asterisk is part of the
  // displayed text but matches /название/i.
  useUIStore.getState().openEntityEditorEdit(created.id);
  const titleInput = screen.getByLabelText(/название/i);
  await userEvent.clear(titleInput);
  await userEvent.type(titleInput, "Lifecycle task (edited)");
  await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));
  await flushAllWrites();

  await expect
    .poll(
      () =>
        useEntityStore
          .getState()
          .entities.find((e) => e.id === created.id)?.title,
    )
    .toBe("Lifecycle task (edited)");
  expect(readEntities().find((e) => e.id === created.id)?.title).toBe(
    "Lifecycle task (edited)",
  );

  // ----- ARCHIVE ---------------------------------------------------
  // Reopen the editor — handleSave closed it on the previous save.
  // The Save click commits a state change but EntityEditor's mount
  // isn't synchronous; wait via the Save button locator (which retries
  // until the editor remounts) before reaching for plain DOM nodes.
  useUIStore.getState().openEntityEditorEdit(created.id);
  await expect
    .element(screen.getByRole("button", { name: /сохранить/i }))
    .toBeVisible();
  // EntityEditor's Status <select> has no htmlFor/id pairing with its
  // sibling <label>, so getByLabelText can't find it. Pick the select
  // by an option value that's unique to the status enum (only Status
  // contains "archived"; Priority has high/medium/low).
  const allSelects = Array.from(
    screen.container.querySelectorAll<HTMLSelectElement>("select"),
  );
  const statusSel = allSelects.find((s) =>
    Array.from(s.options).some((o) => o.value === "archived"),
  );
  if (!statusSel) throw new Error("Status select not in DOM");
  await userEvent.selectOptions(statusSel, "archived");
  await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));
  await flushAllWrites();

  await expect
    .poll(
      () =>
        useEntityStore
          .getState()
          .entities.find((e) => e.id === created.id)?.status,
    )
    .toBe("archived");
  expect(readEntities().find((e) => e.id === created.id)?.status).toBe(
    "archived",
  );

  // ----- DELETE ----------------------------------------------------
  // First click sets confirmingDelete; second click commits. The
  // button's accessible name flips from "Удалить" → "Точно удалить?",
  // so each click resolves a different locator.
  useUIStore.getState().openEntityEditorEdit(created.id);
  await userEvent.click(
    screen.getByRole("button", { name: /^удалить$/i }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: /точно удалить/i }),
  );
  await flushAllWrites();

  await expect
    .poll(() =>
      useEntityStore
        .getState()
        .entities.some((e) => e.id === created.id),
    )
    .toBe(false);
  expect(
    readEntities().some((e) => e.id === created.id),
  ).toBe(false);
});
