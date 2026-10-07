import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
const mock = vi.hoisted(() => ({
  callback: null as null | ((event: AuthChangeEvent, session: Session | null) => void),
  getSession: vi.fn(), from: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: mock.from, auth: { ...mock, onAuthStateChange: (callback: typeof mock.callback) => {
    mock.callback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  } },
} }));
vi.mock("@/lib/authRecovery", () => ({ initialRecoveryIntent: { requested: false } }));
import { AuthProvider, useAuth } from "./useAuth";
const session = (id = "one") => ({ user: { id } } as Session);
const staff = { id: 1, name: "Test staff", organization_id: 1 };
function Draft() { const [value, setValue] = useState(""); return <input aria-label="Draft" value={value} onChange={e => setValue(e.target.value)} />; }
function Probe() {
  const auth = useAuth();
  return <>{auth.loading ? <p>Loading</p> : <Draft />}<p>{auth.staffUser?.name || "No staff"}</p>
    <p>{auth.isAdmin ? "Admin" : "No admin"}</p><p>{auth.recoveryRequested ? "Recovery" : "Normal"}</p></>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mock.from.mockImplementation((table: string) => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    query.select.mockReturnValue(query);
    let filters = 0;
    query.eq.mockImplementation(() => {
      if (table === "user_roles" && ++filters === 2) return Promise.resolve({ data: [{ roles: { name: "admin" } }], error: null });
      return query;
    });
    query.maybeSingle.mockResolvedValue({ data: staff, error: null });
    return query;
  });
});
afterEach(cleanup);
describe("staff sessions", () => {
  it("loads staff and roles from an existing session", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });
  it("preserves drafts when tab focus or token refresh repeats the same user", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("Admin");
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "keep this" } });
    act(() => mock.callback?.("SIGNED_IN", session()));
    act(() => mock.callback?.("TOKEN_REFRESHED", session()));
    expect(screen.getByLabelText("Draft")).toHaveValue("keep this");
    expect(mock.from).toHaveBeenCalledTimes(2);
  });
  it("removes permissions on signout", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("Admin");
    act(() => mock.callback?.("SIGNED_OUT", null));
    expect(screen.getByText("No admin")).toBeInTheDocument();
    expect(screen.getByText("No staff")).toBeInTheDocument();
  });
  it("does not grant admin when profile loading fails", async () => {
    mock.from.mockImplementation(() => { throw new Error("denied"); });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByLabelText("Draft");
    expect(screen.getByText("No admin")).toBeInTheDocument();
  });
  it("routes recovery events separately from a normal login", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("Admin");
    act(() => mock.callback?.("PASSWORD_RECOVERY", session()));
    expect(screen.getByText("Recovery")).toBeInTheDocument();
  });
  it("does not restore stale profile results after signout", async () => {
    let resolveStaff: (result: unknown) => void;
    const pending = new Promise(resolve => { resolveStaff = resolve; });
    mock.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => pending }) }) });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(mock.from).toHaveBeenCalled());
    act(() => mock.callback?.("SIGNED_OUT", null));
    await act(async () => resolveStaff({ data: staff, error: null }));
    expect(screen.getByText("No admin")).toBeInTheDocument();
    expect(screen.getByText("No staff")).toBeInTheDocument();
  });
});
