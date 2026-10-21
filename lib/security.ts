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
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}
export const STAFF_ROLES = ["verifier", "operator", "manager", "admin"];
