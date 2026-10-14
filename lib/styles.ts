export const styles = [
  {
    id: "proshot",
    name: "ProShot",
    tag: "EDITORIAL",
    description: "Precisão em cada detalhe",
    image: "proshot",
    prompt:
      "Professional automotive editorial photograph in a clean modern outdoor architectural setting. Crisp realistic paint reflections, balanced daylight, premium commercial photography.",
  },
  {
    id: "bokeh",
    name: "Bokeh",
    tag: "FOCO",
    description: "O seu carro em destaque",
    image: "bokeh",
    prompt:
      "Telephoto automotive portrait with shallow depth of field, creamy realistic background bokeh and tack-sharp vehicle.",
  },
  {
    id: "low-angle",
    name: "Low Angle",
    tag: "PRESENÇA",
    description: "Uma nova perspectiva",
    image: "low-angle",
    prompt:
      "Ground-level low-angle automotive photograph, imposing presence, realistic perspective and dramatic architecture.",
  },
  {
    id: "rolling",
    name: "Rolling",
    tag: "MOVIMENTO",
    description: "Energia em movimento",
    image: "rolling",
    prompt:
      "Realistic rolling automotive photograph on a scenic road. Keep vehicle sharply defined with physically plausible wheel and background motion blur.",
  },
  {
    id: "drone",
    name: "Drone View",
    tag: "PERSPECTIVA",
    description: "Um olhar de cima",
    image: "drone",
    prompt:
      "Photorealistic elevated drone view of the same vehicle on a scenic road. Plausible roof details and vehicle proportions.",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    tag: "ATMOSFERA",
    description: "Cada foto, uma cena",
    image: "cinematic",
    prompt:
      "Cinematic automotive still with moody blue hour lighting, wet pavement reflections, subtle film grain and cinematic contrast.",
  },
  {
    id: "studio",
    name: "Studio",
    tag: "MINIMAL",
    description: "Design em sua essência",
    image: "studio",
    prompt:
      "High-end automotive studio photograph on a seamless dark charcoal cyclorama, softbox lighting and controlled paint reflections.",
  },
  {
    id: "golden",
    name: "Golden Hour",
    tag: "LUZ NATURAL",
    description: "A luz do momento perfeito",
    image: "golden",
    prompt:
      "Photorealistic automotive photograph during golden hour, warm sunlight, long soft shadows, scenic open landscape.",
  },
  {
    id: "night",
    name: "Neon Night",
    tag: "URBANO",
    description: "Depois que o sol se põe",
    image: "night",
    prompt:
      "Photorealistic nighttime automotive portrait in an urban setting, tasteful blue neon reflections and realistic street lighting.",
  },
] as const;
export const ratios = {
  "1:1": [1024, 1024],
  "4:5": [1024, 1280],
  "9:16": [864, 1536],
  "16:9": [1536, 864],
} as const;
export type Ratio = keyof typeof ratios;
export function buildPrompt(id: string, ratio: Ratio) {
  const style = styles.find((s) => s.id === id);
  if (!style) throw new Error("Estilo inválido.");
  return `Edit the vehicle shown in the supplied reference photographs. All photographs depict the SAME vehicle from different angles. Use the first image as the main composition reference and all other images to cross-check body shape, paint, wheels, trim, badges and visible details. Never combine different angles into a collage and never replace the vehicle with a generic model. Preserve the exact vehicle identity, model, body shape, color, wheels, logos and unique details. Do not add vehicles or people. Preserve readable plate details when visible. ${style.prompt} Compose the complete vehicle inside a ${ratio} frame, with generous safe margins for a final center crop. Do not add text or watermarks. Produce a believable professional photograph, not an illustration.`;
}
