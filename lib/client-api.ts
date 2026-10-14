export async function apiError(response: Response) {
  const body = await response.json().catch(() => null);
  if (typeof body?.error === "string") return body.error;
  if (response.status === 413)
    return "As fotos excedem o limite de envio. Remova algumas referências e tente novamente.";
  if (response.status === 504)
    return "A edição demorou além do limite do servidor. Tente novamente com um estilo por vez.";
  if (response.status === 401)
    return "Sua sessão expirou. Entre no estúdio novamente.";
  return `Não foi possível concluir a solicitação (erro ${response.status}). Tente novamente.`;
}
export async function timedFetch(
  url: string,
  options: RequestInit,
  timeout: number,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted)
      throw new Error(
        "O tempo de resposta se esgotou. Tente novamente em alguns instantes.",
      );
    if (options.signal?.aborted) throw error;
    throw new Error(
      "Falha na conexão. Verifique sua internet e tente novamente.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
