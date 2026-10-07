import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ref = "cughejedfefvblxyodtm";
const storageKey = `sb-${ref}-auth-token`;
const user = { id: "test-user", aud: "authenticated", email: "test@example.invalid" };
const mockFetch = vi.fn();
let stopRefresh: (() => Promise<void>) | undefined;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubEnv("VITE_SUPABASE_URL", `https://${ref}.supabase.co`);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-only-public-key");
  window.history.replaceState({}, "", "/reset-password");
});
afterEach(async () => {
  await stopRefresh?.();
  stopRefresh = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});
async function initialize() {
  const client = await import("./client");
  stopRefresh = () => client.supabase.auth.stopAutoRefresh();
  return client;
}
describe("real SDK callback initialization with mocked HTTP", () => {
  it("establishes an implicit recovery session without a password login", async () => {
    window.history.replaceState({}, "", "/#type=recovery&access_token=test-only&refresh_token=test-only&expires_in=3600&token_type=bearer");
    mockFetch.mockResolvedValue(new Response(JSON.stringify(user), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { supabase, recoveryInitialization } = await initialize();
    expect(await recoveryInitialization).toEqual({ failed: false });
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe(user.id);
    expect(mockFetch.mock.calls.every(([url]) => String(url).endsWith("/auth/v1/user"))).toBe(true);
    expect(window.location.hash).toBe("");
  });
  it("exchanges a PKCE recovery code exactly once with its browser verifier", async () => {
    window.history.replaceState({}, "", "/reset-password?code=test-only-code");
    localStorage.setItem(`${storageKey}-code-verifier`, JSON.stringify("test-only-verifier/recovery"));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      access_token: "test-only", refresh_token: "test-only", expires_in: 3600, token_type: "bearer", user,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { supabase, recoveryInitialization } = await initialize();
    expect(await recoveryInitialization).toEqual({ failed: false });
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe(user.id);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain("grant_type=pkce");
    expect(window.location.search).toBe("");
  });
  it("rejects a code opened without its original browser verifier", async () => {
    window.history.replaceState({}, "", "/reset-password?code=test-only-code");
    const { recoveryInitialization } = await initialize();
    expect(await recoveryInitialization).toEqual({ failed: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("reports rejected callback tokens rather than accepting an old stored session", async () => {
    window.history.replaceState({}, "", "/reset-password#type=recovery&access_token=test-only&refresh_token=test-only&expires_in=3600&token_type=bearer");
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ msg: "Invalid token" }), { status: 401, headers: { "Content-Type": "application/json" } }));
    const { recoveryInitialization } = await initialize();
    expect(await recoveryInitialization).toEqual({ failed: true });
  });
});
