/** Site prefix. Empty in local dev; "/ground-record" on GitHub Pages. */
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/**
 * Prefix a same-site root path so it still works under the Pages base path.
 * Absolute http(s) URLs, data URLs, and hashes are left unchanged.
 */
export function withBasePath(path: string): string {
  if (!path) return path;
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    path.startsWith("//") ||
    path.startsWith("#") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!basePath) return normalized;
  if (normalized === basePath || normalized.startsWith(`${basePath}/`)) return normalized;
  return `${basePath}${normalized}`;
}
