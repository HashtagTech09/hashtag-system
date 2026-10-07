import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  intent: { requested: true, failed: false }, clear: vi.fn(),
  finishRecovery: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: mocks }, recoveryInitialization: Promise.resolve({ failed: false }) }));
vi.mock("@/lib/authRecovery", () => ({ initialRecoveryIntent: mocks.intent, clearRecoveryUrl: mocks.clear }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ finishRecovery: mocks.finishRecovery }) }));
import ResetPassword from "./ResetPassword";

const show = () => render(<MemoryRouter><ResetPassword /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.intent.failed = false;
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "test-user" } } }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(cleanup);
describe("password reset", () => {
  it("shows an actionable error instead of remaining disabled without a session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    show();
    expect(await screen.findByText(/Invalid or expired/)).toBeInTheDocument();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects an expired link even if another session exists", async () => {
    mocks.intent.failed = true;
    show();
    expect(await screen.findByText(/Invalid or expired/)).toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("rejects sessions the server no longer recognizes", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    show();
    expect(await screen.findByText(/Invalid or expired/)).toBeInTheDocument();
  });
  it("handles initialization errors", async () => {
    mocks.getSession.mockRejectedValue(new Error("unavailable"));
    show();
    expect(await screen.findByText(/Invalid or expired/)).toBeInTheDocument();
  });
  it("clears recovery routing before returning to login after an invalid link", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Go to Login" }));
    await waitFor(() => expect(mocks.finishRecovery).toHaveBeenCalled());
  });
  it("updates the authenticated user, then ends only the local session", async () => {
    show();
    const submit = await screen.findByRole("button", { name: "Update Password" });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "test-only-password" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "test-only-password" } });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: "test-only-password" }));
    expect(await screen.findByText(/Your password has been updated/)).toBeInTheDocument();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("keeps the form available after a rejected password update", async () => {
    mocks.updateUser.mockResolvedValue({ error: new Error("Password rejected") });
    show();
    const submit = await screen.findByRole("button", { name: "Update Password" });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "test-only-password" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "test-only-password" } });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalled());
    await waitFor(() => expect(submit).toBeEnabled());
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
