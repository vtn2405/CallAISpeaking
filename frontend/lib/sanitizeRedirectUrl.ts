/**
 * Ensures the `next` redirect target is always a same-origin relative path.
 * Prevents Open Redirect attacks where an attacker forges ?next=https://evil.com.
 *
 * Rules:
 *  - Must start with "/"
 *  - Must NOT start with "//" (protocol-relative URL)
 *  - Falls back to `fallback` (default: "/dashboard") when invalid.
 */
export function sanitizeRedirectUrl(
  next: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!next) return fallback;
  // Reject absolute URLs and protocol-relative URLs
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  // Reject anything that could be a URL with a scheme embedded after path chars
  try {
    // Using URL constructor with a dummy base: if it resolves to a different origin, reject.
    const resolved = new URL(next, 'http://localhost');
    if (resolved.origin !== 'http://localhost') return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}
