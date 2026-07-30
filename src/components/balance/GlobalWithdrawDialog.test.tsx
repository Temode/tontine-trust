import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

const rpcMock = vi.fn();
/** Route les RPC hors flux retrait (blocage, config) vers une réponse neutre. */
function rpcRouter(...args: unknown[]) {
  const name = args[0] as string;
  if (name === "my_withdrawal_block") return Promise.resolve({ data: [], error: null });
  return rpcMock(...args);
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcRouter(...args),
    from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

import { GlobalWithdrawDialog } from "./GlobalWithdrawDialog";

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GlobalWithdrawDialog open onOpenChange={() => {}} available={100000} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  toastError.mockReset();
  toastSuccess.mockReset();
  rpcMock.mockReset();
});

describe("GlobalWithdrawDialog — erreurs 400 backend", () => {
  it("affiche un message clair quand la RPC renvoie une erreur 400 (22003)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "integer out of range", code: "22003" },
    });

    renderDialog();

    fireEvent.change(screen.getByPlaceholderText(/50000/i), { target: { value: "5000" } });
    fireEvent.change(screen.getByPlaceholderText(/\+224/i), { target: { value: "622000111" } });
    fireEvent.change(screen.getByPlaceholderText(/Retapez/i), { target: { value: "622000111" } });

    fireEvent.click(screen.getByRole("button", { name: /Valider la demande/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [title, opts] = toastError.mock.calls[0];
    expect(title).toBe("Retrait impossible");
    // Le message brut ne doit pas être vide et doit être humainement lisible
    expect(String((opts as { description: string }).description).length).toBeGreaterThan(0);
    // L'UI n'a pas planté silencieusement : le succès n'a pas été appelé
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("affiche un message dédié pour INSUFFICIENT_BALANCE", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "INSUFFICIENT_BALANCE" },
    });
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText(/50000/i), { target: { value: "5000" } });
    fireEvent.change(screen.getByPlaceholderText(/\+224/i), { target: { value: "622000111" } });
    fireEvent.change(screen.getByPlaceholderText(/Retapez/i), { target: { value: "622000111" } });
    fireEvent.click(screen.getByRole("button", { name: /Valider la demande/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][1].description).toMatch(/insuffisant/i);
  });

  it("bloque la demande et informe l'utilisateur quand les retraits sont suspendus", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "WITHDRAWAL_BLOCKED" },
    });
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText(/50000/i), { target: { value: "5000" } });
    fireEvent.change(screen.getByPlaceholderText(/\+224/i), { target: { value: "622000111" } });
    fireEvent.change(screen.getByPlaceholderText(/Retapez/i), { target: { value: "622000111" } });
    fireEvent.click(screen.getByRole("button", { name: /Valider la demande/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][1].description).toMatch(/suspendus/i);
  });
});