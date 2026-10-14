import {
  validateFile,
  MAX_API_UPLOAD,
  MAX_REFERENCE_BYTES,
  MAX_REFERENCE_PHOTOS,
} from "./validation";
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "Não foi possível abrir esta foto. O arquivo pode estar danificado.",
        ),
      );
    img.src = url;
  });
}
export async function importPhoto(file: File) {
  const format = validateFile(file);
  let blob: Blob = file;
  let url = URL.createObjectURL(blob);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch (error) {
    URL.revokeObjectURL(url);
    if (format !== "heic") throw error;
    try {
      const { default: convert } = await import("heic2any");
      const converted = await convert({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      blob = Array.isArray(converted) ? converted[0] : converted;
      url = URL.createObjectURL(blob);
      img = await loadImage(url);
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(
        "Não foi possível converter este HEIC. No iPhone, exporte a foto como JPEG em Arquivos ou use Câmera → Formatos → Mais Compatível para novas fotos.",
      );
    }
  }
  try {
    // Safari honors EXIF orientation when drawing an HTMLImageElement.
    const scale = Math.min(
      1,
      2048 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error(
        "Seu navegador não conseguiu preparar a foto. Recarregue e tente novamente.",
      );
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const normalized = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(
                new Error("Falha ao preparar a imagem. Tente uma foto menor."),
              ),
        "image/jpeg",
        0.9,
      ),
    );
    if (normalized.size > MAX_API_UPLOAD)
      throw new Error(
        "A imagem preparada excede 4 MB. Escolha uma foto menor.",
      );
    return {
      file: new File([normalized], "vehicle.jpg", { type: "image/jpeg" }),
      preview: URL.createObjectURL(normalized),
      width: canvas.width,
      height: canvas.height,
      originalName: file.name,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Re-encode only when the complete reference set exceeds the upload budget.
// Process sequentially to keep memory usage bounded on iPhone Safari.
export async function prepareReferenceFiles(files: File[]) {
  if (!files.length || files.length > MAX_REFERENCE_PHOTOS)
    throw new Error("Escolha de 1 a 10 fotos do mesmo veículo.");
  if (files.reduce((sum, file) => sum + file.size, 0) <= MAX_REFERENCE_BYTES)
    return files;
  for (const [edge, quality] of [
    [1536, 0.84],
    [1280, 0.76],
    [1024, 0.68],
    [864, 0.6],
  ]) {
    const prepared: File[] = [];
    for (const [index, file] of files.entries()) {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const scale = Math.min(
          1,
          edge / Math.max(img.naturalWidth, img.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx)
          throw new Error(
            "Não foi possível preparar as referências. Tente menos fotos.",
          );
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b
                ? resolve(b)
                : reject(new Error("Falha ao preparar as referências.")),
            "image/jpeg",
            quality,
          ),
        );
        prepared.push(
          new File([blob], `reference-${index + 1}.jpg`, {
            type: "image/jpeg",
          }),
        );
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (
      prepared.reduce((sum, file) => sum + file.size, 0) <= MAX_REFERENCE_BYTES
    )
      return prepared;
  }
  throw new Error(
    "Estas fotos ainda excedem o limite de envio. Remova algumas referências e tente novamente.",
  );
}
