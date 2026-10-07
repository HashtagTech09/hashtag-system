export function getRecoveryIntent(location: Pick<Location, "hash" | "search" | "pathname">) {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  return {
    requested: location.pathname === "/reset-password" || hash.get("type") === "recovery" || query.get("type") === "recovery"
      || query.has("code") || hash.has("error") || query.has("error"),
    failed: [hash, query].some(params => params.has("error") || params.has("error_code") || params.has("error_description")),
    hasCode: query.has("code"),
  };
}

// Capture intent, never tokens, before the SDK consumes the callback URL.
export const initialRecoveryIntent = getRecoveryIntent(window.location);

export function clearRecoveryUrl() {
  const url = new URL(window.location.href);
  ["code", "type", "error", "error_code", "error_description"].forEach(key => url.searchParams.delete(key));
  url.hash = "";
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}
