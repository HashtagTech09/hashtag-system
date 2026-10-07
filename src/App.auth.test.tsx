import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
const mock = vi.hoisted(() => ({ auth: {
  user: null as null | { id: string }, loading: false, staffUser: null as null | { scope_restricted: boolean },
  staffRoles: [] as { roles: { name: string } }[], isAdmin: false, isManager: false,
  isAdminOrManager: false, recoveryRequested: false, signOut: vi.fn(),
} }));
vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => mock.auth,
}));
vi.mock("@/contexts/TestDateContext", () => ({ TestDateProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./pages/Login", () => ({ default: () => <p>Login page</p> }));
vi.mock("./pages/ResetPassword", () => ({ default: () => <p>Recovery page</p> }));
vi.mock("./pages/Dashboard", () => ({ default: () => <p>Admin dashboard</p> }));
vi.mock("./pages/StaffDashboard", () => ({ default: () => <p>Staff dashboard</p> }));
vi.mock("./pages/Settings", () => ({ default: () => <p>Company settings</p> }));
import App from "./App";
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  Object.assign(mock.auth, { user: null, loading: false, staffUser: null, staffRoles: [],
    isAdmin: false, isManager: false, isAdminOrManager: false, recoveryRequested: false });
});
afterEach(cleanup);
describe("staff route authorization", () => {
  it("sends signed-out users to login", async () => {
    render(<App />);
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });
  it("denies a login with no linked staff record", () => {
    mock.auth.user = { id: "test" };
    render(<App />);
    expect(screen.getByText("Staff access not configured")).toBeInTheDocument();
  });
  it("does not treat a parent as a staff member", () => {
    Object.assign(mock.auth, { user: { id: "test" }, staffUser: { scope_restricted: false }, staffRoles: [{ roles: { name: "parent" } }] });
    render(<App />);
    expect(screen.getByText("Staff access not configured")).toBeInTheDocument();
  });
  it("allows the established admin role to use company settings", () => {
    window.history.replaceState({}, "", "/settings");
    Object.assign(mock.auth, { user: { id: "test" }, staffUser: { scope_restricted: false }, staffRoles: [{ roles: { name: "admin" } }], isAdmin: true, isAdminOrManager: true });
    render(<App />);
    expect(screen.getByText("Company settings")).toBeInTheDocument();
  });
  it("denies direct admin-page navigation by an instructor", async () => {
    window.history.replaceState({}, "", "/settings");
    Object.assign(mock.auth, { user: { id: "test" }, staffUser: { scope_restricted: false }, staffRoles: [{ roles: { name: "instructor" } }] });
    render(<App />);
    expect(await screen.findByText("Staff dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Company settings")).not.toBeInTheDocument();
  });
  it("sends recovery callbacks at the root to the reset page, not the dashboard", async () => {
    mock.auth.recoveryRequested = true;
    render(<App />);
    expect(await screen.findByText("Recovery page")).toBeInTheDocument();
  });
});
