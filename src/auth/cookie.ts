export const SESSION_COOKIE = "sid";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function parseCookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function serializeSessionCookie(
  sessionId: string,
  opts: { secure: boolean; clear?: boolean },
): string {
  const value = opts.clear ? "" : sessionId;
  const parts = [`${SESSION_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  parts.push(opts.clear ? "Max-Age=0" : `Max-Age=${SESSION_TTL_SECONDS}`);
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function wantsSecureCookie(input: {
  protocol?: string;
  headers: Record<string, unknown>;
}): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const proto = input.headers["x-forwarded-proto"];
  if (typeof proto === "string" && proto.split(",")[0].trim().toLowerCase() === "https") {
    return true;
  }
  return input.protocol === "https";
}
