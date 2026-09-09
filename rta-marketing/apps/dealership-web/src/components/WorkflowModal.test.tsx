import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkflowModal } from "./WorkflowModal";

function ModalHarness({ busy = false }: { busy?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open workflow
      </button>
      <WorkflowModal
        open={open}
        busy={busy}
        eyebrow="Sales"
        title="Create sale"
        description="Record a funded vehicle sale."
        onClose={() => setOpen(false)}
      >
        <label>
          Customer
          <input name="customer" />
        </label>
      </WorkflowModal>
    </>
  );
}

describe("WorkflowModal", () => {
  it("locks scrolling, moves focus, closes with Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole("button", { name: "Open workflow" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Create sale" });
    expect(dialog).toHaveAccessibleDescription(
      "Record a funded vehicle sale.",
    );
    expect(document.body.style.overflow).toBe("hidden");

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Close dialog" }),
      ).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
  });

  it("blocks dismissal while a mutation is busy", () => {
    const onClose = vi.fn();
    render(
      <WorkflowModal
        open
        busy
        eyebrow="Documents"
        title="Uploading"
        onClose={onClose}
      >
        Upload in progress
      </WorkflowModal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close dialog" }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
