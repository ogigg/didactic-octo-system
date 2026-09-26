const DEFAULT_PATH = "/";
// Parsing base for relative paths. Anything that resolves to a different
// origin was an absolute or protocol-relative URL in disguise.
const PARSE_BASE = "http://admin.invalid";
// Browsers read `\` as `/` and drop tabs and newlines, so `/\evil.test` and
// `/\t/evil.test` both turn into `//evil.test`.
const UNSAFE_CHARACTERS = /[\\\u0000-\u001f\u007f]/;
// Encoded `/`, `\` and `%` in the path can become separators if any layer
// decodes the path again before the browser sees it.
const ENCODED_SEPARATOR = /%(?:2f|5c|25)/i;

function isLocalPath(path: string): boolean {
  return (
    path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\")
  );
}

/**
 * Returns `value` as a same-origin path (with its query and hash) that is safe
 * to redirect to after login, or `/` when it is anything else: missing, not a
 * string, an absolute or protocol-relative URL, a backslash or encoded
 * separator trick, or the login page itself.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !isLocalPath(value)) return DEFAULT_PATH;
  if (UNSAFE_CHARACTERS.test(value)) return DEFAULT_PATH;

  const pathEnd = value.search(/[?#]/);
  const rawPath = pathEnd === -1 ? value : value.slice(0, pathEnd);
  if (ENCODED_SEPARATOR.test(rawPath)) return DEFAULT_PATH;

  let url: URL;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return DEFAULT_PATH;
  }
  if (url.origin !== PARSE_BASE) return DEFAULT_PATH;

  // Dot segments can collapse into a leading `//` (`/.//evil.test`), so check
  // the normalised path again.
  if (!isLocalPath(url.pathname) || url.pathname.startsWith("/login")) {
    return DEFAULT_PATH;
  }

  return url.pathname + url.search + url.hash;
}
