import {
  checkOrigin,
  clearSessionCookie,
  hasStudioSession,
  jsonError,
  matchesStudioPassword,
  sessionCookie,
} from "@/lib/studio-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authenticated = hasStudioSession(request);
  return Response.json(
    {
      authenticated,
      generationReady: authenticated && Boolean(process.env.OPENAI_API_KEY),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  if (process.env.NODE_ENV === "production" && !process.env.APP_PASSWORD)
    return jsonError(
      "A senha do estúdio ainda não está configurada no servidor.",
      503,
    );
  if (Number(request.headers.get("content-length") || 0) > 2048)
    return jsonError("Senha inválida.", 400);
  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return jsonError("Digite sua senha para entrar.", 400);
  }
  if (typeof password !== "string" || password.length > 1024)
    return jsonError("Digite uma senha válida.", 400);
  if (!matchesStudioPassword(password))
    return jsonError(
      "Senha incorreta. Confira a senha do estúdio e tente novamente.",
      401,
    );
  return Response.json(
    {
      authenticated: true,
      generationReady: Boolean(process.env.OPENAI_API_KEY),
    },
    { headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie() } },
  );
}
export async function DELETE(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  return Response.json(
    { authenticated: false },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearSessionCookie(),
      },
    },
  );
}
