import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "auto_vision_session";
const SESSION_SECONDS = 8 * 60 * 60;
export function jsonError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function checkOrigin(request: Request): Response | null {
  const host = request.headers.get("host") || new URL(request.url).host;
  try {
    const origin = new URL(request.headers.get("origin") || "");
    if (["https:", "http:"].includes(origin.protocol) && origin.host === host)
      return null;
  } catch {}
  return jsonError("Origem da solicitação inválida.", 403);
}
function equal(a: string, b: string) {
  const first = Buffer.from(a),
    second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
function signature(expiry: string) {
  return createHmac("sha256", process.env.APP_PASSWORD || "")
    .update(`auto-vision-studio:${expiry}`)
    .digest("base64url");
}
export function hasStudioSession(request: Request, now = Date.now()) {
  if (!process.env.APP_PASSWORD) return process.env.NODE_ENV !== "production";
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!token) return false;
  const [expiry, supplied, extra] = token.split(".");
  if (extra || !expiry || !supplied || !/^\d+$/.test(expiry)) return false;
  const seconds = Number(expiry);
  if (
    !Number.isSafeInteger(seconds) ||
    seconds <= Math.floor(now / 1000) ||
    seconds > Math.floor(now / 1000) + SESSION_SECONDS + 60
  )
    return false;
  return equal(supplied, signature(expiry));
}
export function matchesStudioPassword(password: string) {
  return process.env.APP_PASSWORD
    ? equal(password, process.env.APP_PASSWORD)
    : process.env.NODE_ENV !== "production";
}
export function sessionCookie(now = Date.now()) {
  const expiry = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${COOKIE}=${expiry}.${signature(expiry)}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function clearSessionCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function checkStudioAccess(request: Request): Response | null {
  const originError = checkOrigin(request);
  if (originError) return originError;
  if (!process.env.OPENAI_API_KEY)
    return jsonError(
      "A geração ainda não está configurada. Adicione OPENAI_API_KEY nos segredos do servidor.",
      503,
    );
  if (process.env.NODE_ENV === "production" && !process.env.APP_PASSWORD)
    return jsonError(
      "Configure APP_PASSWORD no servidor para proteger a geração.",
      503,
    );
  // Keep compatibility with already-open tabs during this deployment.
  const legacyPassword = request.headers.get("x-app-password");
  if (
    !hasStudioSession(request) &&
    !(legacyPassword && matchesStudioPassword(legacyPassword))
  ) {
    return jsonError(
      "Entre no estúdio com sua senha antes de gerar. Sua sessão pode ter expirado.",
      401,
    );
  }
  return null;
}
