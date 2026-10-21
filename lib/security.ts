export function safeRedirect(value: string | null, fallback = "/") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return fallback;
  try {
    return new URL(value, "https://civic.invalid").origin ===
      "https://civic.invalid"
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}
export function publicOrigin(request: Request) {
  const canonical = process.env.CIVICPULSE_APP_ORIGIN;
  if (canonical) {
    const url = new URL(canonical);
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("Invalid application origin");
    return url.origin;
  }
  const internal = new URL(request.url);
  // Next.js may normalize request.url to localhost. Host is the browser-facing
  // authority; browser JavaScript cannot forge this forbidden request header.
  // TLS-terminating deployments can set an explicit canonical origin above.
  return new URL(
    `${internal.protocol}//${request.headers.get("host") || internal.host}`,
  ).origin;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    return !!origin && origin === publicOrigin(request);
  } catch {
    return false;
  }
}
export const STAFF_ROLES = ["verifier", "operator", "manager", "admin"];
