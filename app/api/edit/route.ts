import { EditError, editVehicle, validateEdit } from "@/lib/editor";
import { checkStudioAccess, jsonError } from "@/lib/studio-auth";
import { MAX_REFERENCE_BYTES, MAX_REFERENCE_PHOTOS } from "@/lib/validation";
import type { Ratio } from "@/lib/styles";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const accessError = checkStudioAccess(request);
  if (accessError) return accessError;
  if (
    Number(request.headers.get("content-length") || 0) >
    MAX_REFERENCE_BYTES + 64 * 1024
  )
    return jsonError(
      "As fotos excedem o limite de envio. Remova algumas referências e tente novamente.",
      413,
    );
  try {
    const form = await request.formData();
    const images = [...form.getAll("images"), ...form.getAll("image")];
    const style = form.get("style"),
      ratio = form.get("ratio");
    if (
      !images.length ||
      images.some((file) => !(file instanceof File)) ||
      typeof style !== "string" ||
      typeof ratio !== "string"
    )
      return jsonError(
        "Envie de 1 a 10 fotos do veículo, um estilo e uma proporção.",
        400,
      );
    if (images.length > MAX_REFERENCE_PHOTOS)
      return jsonError("Envie no máximo 10 fotos do mesmo veículo.", 400);
    const files = images as File[];
    if (
      files.reduce((total, file) => total + file.size, 0) > MAX_REFERENCE_BYTES
    )
      return jsonError(
        "As fotos preparadas excedem o limite de envio. Reduza a quantidade de referências.",
        413,
      );
    validateEdit(style, ratio);
    const result = await editVehicle(
      files,
      style,
      ratio as Ratio,
      process.env.OPENAI_API_KEY!,
    );
    return new Response(new Uint8Array(result), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="auto-vision-${style}-${ratio.replace(":", "x")}.jpg"`,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof EditError
        ? error.message
        : "Não foi possível processar as fotos. Importe-as novamente e tente outra vez.",
      error instanceof EditError ? error.status : 400,
    );
  }
}
