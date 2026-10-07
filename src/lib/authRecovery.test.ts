import { describe, expect, it } from "vitest";
import { clearRecoveryUrl, getRecoveryIntent } from "./authRecovery";

describe("recovery callbacks", () => {
  it("recognizes implicit recovery at the site root without retaining tokens", () => {
    expect(getRecoveryIntent({ pathname: "/", search: "", hash: "#type=recovery&access_token=test-only" }))
      .toEqual({ requested: true, failed: false, hasCode: false });
  });
  it("recognizes the reset route for PKCE callback processing", () => {
    expect(getRecoveryIntent({ pathname: "/reset-password", search: "?code=test-only", hash: "" }).requested).toBe(true);
  });
  it("recognizes expired link errors even at the site root", () => {
    expect(getRecoveryIntent({ pathname: "/", search: "", hash: "#error=access_denied&error_code=otp_expired" }))
      .toEqual({ requested: true, failed: true, hasCode: false });
  });
  it("does not redirect ordinary sign-ins", () => {
    expect(getRecoveryIntent({ pathname: "/login", search: "", hash: "" }).requested).toBe(false);
  });
  it("cleans callback parameters without dropping other search parameters", () => {
    window.history.replaceState({}, "", "/reset-password?code=test-only&source=email#error=invalid");
    clearRecoveryUrl();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/reset-password?source=email");
  });
});
