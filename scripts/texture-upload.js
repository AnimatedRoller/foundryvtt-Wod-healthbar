import { MODULE_ID } from "./constants.js";

/**
 * Foundry validates tile texture.src and rejects data: URLs (no file extension).
 * Upload SVG to world data and return a path Foundry accepts (ends with .svg).
 */
export async function uploadSvgAsWorldTexture(svgString, tileDocumentId, versionTag = Date.now()) {
  const world = game.world;
  if (!world?.id) {
    throw new Error(`${MODULE_ID}: no active world`);
  }

  const dirPath = `worlds/${world.id}/${MODULE_ID}`;
  const fileName = `tile-${tileDocumentId}-${versionTag}.svg`;
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const file = new File([blob], fileName, { type: "image/svg+xml" });

  const FP =
    foundry?.applications?.apps?.FilePicker?.implementation ??
    foundry?.applications?.apps?.FilePicker ??
    globalThis.FilePicker;
  if (typeof FP?.upload !== "function") {
    throw new Error(`${MODULE_ID}: FilePicker.upload is not available`);
  }

  const response = await FP.upload("data", dirPath, file, {}, { notify: false });

  if (typeof response === "string") return response;
  if (response?.path) return response.path;
  if (response?.url) return response.url;

  return `${dirPath}/${fileName}`;
}

/** Module-relative path to bundled placeholder (valid .svg extension for create). */
export function getPlaceholderTextureSrc() {
  return `modules/${MODULE_ID}/assets/placeholder-health.svg`;
}
