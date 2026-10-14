export const MAX_UPLOAD = 20 * 1024 * 1024;
export const MAX_API_UPLOAD = 4 * 1024 * 1024;
export const MAX_REFERENCE_PHOTOS = 10;
// Leave headroom below Vercel's 4.5 MB multipart request limit.
export const MAX_REFERENCE_BYTES = Math.floor(3.5 * 1024 * 1024);
export function validateFile(file: {
  name: string;
  size: number;
  type: string;
}) {
  if (!file.size) throw new Error("O arquivo está vazio. Escolha outra foto.");
  if (file.size > MAX_UPLOAD)
    throw new Error(
      "A foto excede 20 MB. Exporte uma versão menor e tente novamente.",
    );
  const extension = file.name.split(".").pop()?.toLowerCase();
  const validExtension = /^(jpe?g|png|heic|heif)$/.test(extension || "");
  const validMime =
    /^(image\/(jpeg|jpg|png|heic|heif|heic-sequence|heif-sequence))$/.test(
      file.type,
    );
  if (!validExtension && !validMime)
    throw new Error("Formato não suportado. Envie JPG, JPEG, PNG ou HEIC.");
  return /^(heic|heif)$/.test(extension || "") || /hei[cf]/.test(file.type)
    ? "heic"
    : "standard";
}
export function detectImage(bytes: Uint8Array): "jpeg" | "png" | "heic" | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "png";
  const signature = new TextDecoder().decode(bytes.slice(4, 40));
  if (
    signature.startsWith("ftyp") &&
    /heic|heix|hevc|hevx|mif1|msf1/.test(signature)
  )
    return "heic";
  return null;
}
