import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CallSurface } from "./CallSurface";
import { registerCallPriority } from "@/lib/callPriority";
import { GuidedTourProvider } from "@/components/tour/GuidedTour";

describe("call interrupts without destroying work", () => {
  it("retains the exact contribution draft, mount count and focused input", async () => {
    let mounts = 0;
    function Draft() {
      useEffect(() => { mounts += 1; }, []);
      return <input aria-label="Contribution draft" defaultValue="" />;
    }
    function Fixture({ call }: { call: boolean }) {
      const [open, setOpen] = useState(true);
      return <><Dialog open={open} onOpenChange={setOpen}><DialogContent aria-describedby={undefined}>
        <DialogTitle>Contribution</DialogTitle><Draft />
      </DialogContent></Dialog>{call && createPortal(<CallSurface><button>Answer</button></CallSurface>, document.body)}</>;
    }
    const view = render(<Fixture call={false} />);
    const input = screen.getByLabelText("Contribution draft") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "125000" } });
    input.focus();
    view.rerender(<Fixture call />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText("Answer")));
    fireEvent.pointerDown(screen.getByText("Answer"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(input.isConnected).toBe(true);
    expect(input.value).toBe("125000");
    expect(mounts).toBe(1);
    expect(input.closest("[data-call-suspended]")).toBeTruthy();
    view.rerender(<Fixture call={false} />);
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.value).toBe("125000");
    expect(mounts).toBe(1);
    expect(input.closest("[data-call-suspended]")).toBeNull();
  });
  it("resumes the tour at the same step, including after a minimized session", async () => {
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    render(<GuidedTourProvider><div /></GuidedTourProvider>);
    await screen.findByText("Étape suivante", {}, { timeout: 2000 });
    fireEvent.click(screen.getByText("Étape suivante"));
    const title = document.querySelector("#tour-title")?.textContent;
    let release = () => {};
    act(() => { release = registerCallPriority(false); });
    expect(document.querySelector("#tour-title")).toBeNull();
    act(() => release());
    expect(document.querySelector("#tour-title")?.textContent).toBe(title);
    expect(localStorage.getItem("tontine:tour:done")).toBeNull();
  });
});