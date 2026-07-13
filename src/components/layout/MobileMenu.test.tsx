import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MobileMenu } from "./MobileMenu";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com", user_metadata: { full_name: "Test User" } },
    roles: ["participant"],
    signOut: vi.fn(),
  }),
}));

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/dashboard"]}>
      <MobileMenu />
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/solde" element={<div>Solde page</div>} />
        <Route path="/profil" element={<div>Profil page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MobileMenu", () => {
  beforeEach(() => {
    // Radix Sheet uses PointerEvent APIs missing in jsdom.
    Object.assign(HTMLElement.prototype, {
      hasPointerCapture: () => false,
      releasePointerCapture: () => {},
      setPointerCapture: () => {},
      scrollIntoView: () => {},
    });
  });

  it("navigue vers le lien cliqué et ferme le tiroir", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole("button", { name: /ouvrir le menu/i }));

    const link = await screen.findByRole("link", { name: /mon solde/i });
    await user.click(link);

    // Route change happens
    expect(await screen.findByText("Solde page")).toBeInTheDocument();

    // Sheet is closed → link no longer in the DOM
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /mon solde/i })).not.toBeInTheDocument();
    });
  });

  it("expose tous les liens du sidebar", async () => {
    const user = userEvent.setup();
    render(<TestApp />);
    await user.click(screen.getByRole("button", { name: /ouvrir le menu/i }));

    for (const label of [
      "Accueil",
      "Mes tontines",
      "Discussions",
      "Payer",
      "Mon solde",
      "Notifications",
      "Mon profil",
    ]) {
      expect(await screen.findByRole("link", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });
});