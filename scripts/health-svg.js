import {
  DEFAULT_BOX_HEIGHT,
  DEFAULT_BOX_WIDTH,
  DEFAULT_FALLBACK_BOXES,
  MODULE_ID,
} from "./constants.js";

export const HEALTH_BOX_GAP = 12;
const LEVEL_LABEL_HEIGHT = 20;
const FOOTER_LABEL_HEIGHT = 26;
const DEFAULT_LEVEL_LABELS = [
  "bruised",
  "hurt",
  "injured",
  "wounded",
  "mauled",
  "crippled",
  "incapacitated",
];
const BOX_ASSET = `modules/${MODULE_ID}/Box.png`;
const ICON_BY_SYMBOL = {
  "/": `modules/${MODULE_ID}/slash.png`,
  X: `modules/${MODULE_ID}/Cross.png`,
  "*": `modules/${MODULE_ID}/Star.png`,
};

/**
 * Map WoD20 health track cell values to the symbol shown in each box.
 * Supports both semantic strings and direct symbol strings.
 */
export function mapStatusToSymbol(status) {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!s || s === "healthy" || s === "ok" || s === "none")
    return "";
  if (s === "bashing" || s === "/") return "/";
  if (s === "lethal" || s === "x") return "X";
  if (s === "aggravated" || s === "*") return "*";
  return "";
}

/**
 * Normalize actor.system.health.track into a string array of logical cell values.
 * Returns { track, valid } where valid is false if the structure was unexpected.
 */
export function parseHealthTrackFromActor(actor) {
  const raw = actor?.system?.health?.track;
  const expectedBoxes = getExpectedHealthBoxCount(actor?.system);
  if (Array.isArray(raw)) {
    const parsed = raw.map((v) => String(v));
    while (parsed.length < expectedBoxes) parsed.push("healthy");
    return { track: parsed, valid: true };
  }

  // WoD20 often stores health as damage counts instead of a string track array.
  const fromDamage = buildTrackFromDamage(actor?.system, expectedBoxes);
  if (fromDamage) {
    return { track: fromDamage, valid: true };
  }

  console.warn(
    `${MODULE_ID} | Actor "${actor?.name ?? actor?.id}" has no usable health track data; using ${DEFAULT_FALLBACK_BOXES} empty boxes.`
  );
  return {
    track: Array(DEFAULT_FALLBACK_BOXES).fill(""),
    valid: false,
  };
}

function buildTrackFromDamage(systemData, expectedBoxes = DEFAULT_FALLBACK_BOXES) {
  const damage = systemData?.health?.damage;
  if (!damage || typeof damage !== "object") return null;

  const bashing = asNonNegativeInt(damage.bashing);
  const lethal = asNonNegativeInt(damage.lethal);
  const aggravated = asNonNegativeInt(damage.aggravated);
  const totalDamage = bashing + lethal + aggravated;

  const totalHealthLevels = Math.max(
    expectedBoxes,
    asNonNegativeInt(systemData?.traits?.health?.totalhealthlevels?.value) ||
      estimateHealthLevelsFromMap(systemData?.health) ||
      DEFAULT_FALLBACK_BOXES
  );

  if (!totalDamage && !totalHealthLevels) return null;

  const track = Array(Math.max(totalHealthLevels, totalDamage)).fill("healthy");
  let i = 0;

  // Worst damage should overwrite first, then lethal, then bashing.
  for (let n = 0; n < aggravated && i < track.length; n++, i++) track[i] = "aggravated";
  for (let n = 0; n < lethal && i < track.length; n++, i++) track[i] = "lethal";
  for (let n = 0; n < bashing && i < track.length; n++, i++) track[i] = "bashing";

  return track;
}

function estimateHealthLevelsFromMap(health) {
  if (!health || typeof health !== "object") return 0;
  const levelKeys = [
    "bruised",
    "hurt",
    "injured",
    "wounded",
    "mauled",
    "crippled",
    "incapacitated",
  ];
  let sum = 0;
  for (const k of levelKeys) {
    const node = health[k];
    if (!node || typeof node !== "object") continue;
    sum += asNonNegativeInt(node.total ?? node.value ?? 0);
  }
  return sum;
}

function asNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function getExpectedHealthBoxCount(systemData) {
  return (
    asNonNegativeInt(systemData?.traits?.health?.totalhealthlevels?.value) ||
    estimateHealthLevelsFromMap(systemData?.health) ||
    DEFAULT_FALLBACK_BOXES
  );
}

/**
 * Build a self-contained SVG (Arial/sans-serif) for the health row.
 * @param {string[]} healthTrack
 * @param {number} boxWidth
 * @param {number} boxHeight
 * @param {object} [options]
 * @param {"normal"|"unlinked"|"error"} [options.mode]
 */
export function generateHealthSVG(
  healthTrack,
  boxWidth = DEFAULT_BOX_WIDTH,
  boxHeight = DEFAULT_BOX_HEIGHT,
  options = {}
) {
  const mode = options.mode ?? "normal";
  const n = Math.max(1, healthTrack?.length ?? 0);
  const totalW = n * boxWidth + (n - 1) * HEALTH_BOX_GAP;
  const boxes = [];

  for (let i = 0; i < n; i++) {
    const x = i * (boxWidth + HEALTH_BOX_GAP);
    let symbol = mapStatusToSymbol(healthTrack[i]);
    if (mode === "unlinked") symbol = "?";
    if (mode === "error") symbol = i === Math.floor(n / 2) ? "⚠" : "";
    const levelLabel = getLevelLabel(i);
    const iconPath = ICON_BY_SYMBOL[symbol];

    boxes.push(`
      <g>
        <image href="${escapeXml(BOX_ASSET)}" x="${x}" y="0" width="${boxWidth}" height="${boxHeight}" preserveAspectRatio="none"/>
        ${iconPath
          ? `<image href="${escapeXml(iconPath)}" x="${x}" y="0" width="${boxWidth}" height="${boxHeight}" preserveAspectRatio="none"/>`
          : `<text x="${x + boxWidth / 2}" y="${boxHeight / 2}"
              font-family="'Modesto Condensed', 'Modesto', Arial, Helvetica, sans-serif"
              font-size="${Math.floor(boxHeight * 0.88)}"
              font-weight="bold"
              fill="#fff"
              text-anchor="middle"
              dominant-baseline="central">${escapeXml(symbol)}</text>`}
        <text x="${x + boxWidth / 2}" y="${boxHeight + 12}"
          font-family="'Modesto Condensed', 'Modesto', Arial, Helvetica, sans-serif"
          font-size="11"
          fill="#fff"
          text-anchor="middle"
          dominant-baseline="central">${escapeXml(levelLabel)}</text>
      </g>`);
  }

  const labelExtra = mode === "unlinked" || mode === "error" ? FOOTER_LABEL_HEIGHT : 0;
  const totalH = boxHeight + LEVEL_LABEL_HEIGHT + labelExtra;
  const label =
    mode === "unlinked"
      ? `<text x="${totalW / 2}" y="${boxHeight + LEVEL_LABEL_HEIGHT + 16}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#ddd" text-anchor="middle">No actor linked - right-click or HUD to configure</text>`
      : mode === "error"
        ? `<text x="${totalW / 2}" y="${boxHeight + LEVEL_LABEL_HEIGHT + 16}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#f88" text-anchor="middle">Linked actor missing</text>`
        : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  ${boxes.join("\n")}
  ${label}
</svg>`;
}

export function getHealthTextureDimensions(
  numBoxes,
  boxWidth = DEFAULT_BOX_WIDTH,
  boxHeight = DEFAULT_BOX_HEIGHT,
  options = {}
) {
  const n = Math.max(1, Number(numBoxes) || DEFAULT_FALLBACK_BOXES);
  const mode = options.mode ?? "normal";
  const width = n * boxWidth + (n - 1) * HEALTH_BOX_GAP;
  const footer = mode === "unlinked" || mode === "error" ? FOOTER_LABEL_HEIGHT : 0;
  const height = boxHeight + LEVEL_LABEL_HEIGHT + footer;
  return { width, height };
}

function getLevelLabel(index) {
  return DEFAULT_LEVEL_LABELS[index] ?? `level ${index + 1}`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

