import {
  DEFAULT_BOX_HEIGHT,
  DEFAULT_BOX_WIDTH,
  DEFAULT_FALLBACK_BOXES,
  MODULE_ID,
} from "./constants.js";

export const HEALTH_BOX_GAP = 12;
const LEVEL_LABEL_HEIGHT = 20;
const FOOTER_LABEL_HEIGHT = 26;
const ROW_GAP = 14;
const MIN_VISIBLE_BOXES = 7;
const DEFAULT_LEVEL_LABELS = [
  "bruised",
  "hurt",
  "injured",
  "wounded",
  "mauled",
  "crippled",
  "incapacitated",
];
const BOX_ASSET = `/modules/${MODULE_ID}/Box.png`;
const ICON_BY_SYMBOL = {
  "/": `/modules/${MODULE_ID}/slash.png`,
  X: `/modules/${MODULE_ID}/Cross.png`,
  "*": `/modules/${MODULE_ID}/Star.png`,
};
let cachedAssetUris = null;

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
  const actorType = String(actor?.type ?? "");
  const systemData = actor?.system;
  const raw = actor?.system?.health?.track;
  const expectedBoxes = getExpectedHealthBoxCount(systemData, actorType);
  if (Array.isArray(raw)) {
    const parsed = raw.map((v) => String(v));
    while (parsed.length < expectedBoxes) parsed.push("healthy");
    const secondaryTrack =
      actorType === "Changeling"
        ? buildTrackFromDamageNode(systemData?.health?.damage?.chimerical, expectedBoxes)
        : null;
    return { track: parsed, secondaryTrack, valid: true };
  }

  if (actorType === "Wraith") {
    const wraithBoxes = Math.max(10, expectedBoxes);
    const wraithTrack =
      buildTrackFromDamageNode(systemData?.health?.damage?.corpus, wraithBoxes) ??
      Array(wraithBoxes).fill("healthy");
    return { track: wraithTrack, secondaryTrack: null, valid: true };
  }

  // WoD20 often stores health as damage counts instead of a string track array.
  const fromDamage = buildTrackFromDamageNode(systemData?.health?.damage, expectedBoxes);
  if (fromDamage) {
    const secondaryTrack =
      actorType === "Changeling"
        ? buildTrackFromDamageNode(systemData?.health?.damage?.chimerical, expectedBoxes)
        : null;
    return { track: fromDamage, secondaryTrack, valid: true };
  }

  console.warn(
    `${MODULE_ID} | Actor "${actor?.name ?? actor?.id}" has no usable health track data; using ${DEFAULT_FALLBACK_BOXES} empty boxes.`
  );
  return {
    track: Array(DEFAULT_FALLBACK_BOXES).fill(""),
    secondaryTrack: null,
    valid: false,
  };
}

function buildTrackFromDamageNode(damageNode, expectedBoxes = DEFAULT_FALLBACK_BOXES) {
  if (!damageNode || typeof damageNode !== "object") return null;

  const bashing = asNonNegativeInt(damageNode.bashing);
  const lethal = asNonNegativeInt(damageNode.lethal);
  const aggravated = asNonNegativeInt(damageNode.aggravated);
  const totalDamage = bashing + lethal + aggravated;

  const totalHealthLevels = Math.max(MIN_VISIBLE_BOXES, expectedBoxes);

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

function getExpectedHealthBoxCount(systemData, actorType = "") {
  const base = (
    asNonNegativeInt(systemData?.traits?.health?.totalhealthlevels?.value) ||
    estimateHealthLevelsFromMap(systemData?.health) ||
    DEFAULT_FALLBACK_BOXES
  );
  if (actorType === "Wraith") return Math.max(10, base, MIN_VISIBLE_BOXES);
  return Math.max(MIN_VISIBLE_BOXES, base);
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
  const secondaryTrack = Array.isArray(options.secondaryTrack)
    ? options.secondaryTrack
    : null;
  const rows = secondaryTrack ? 2 : 1;
  const n = Math.max(1, healthTrack?.length ?? 0);
  const totalW = n * boxWidth + (n - 1) * HEALTH_BOX_GAP;
  const boxes = [];
  const buildRow = (track, rowIndex, rowLabel) => {
    const rowY = rowIndex * (boxHeight + LEVEL_LABEL_HEIGHT + ROW_GAP);
    const row = [];
    if (rowLabel) {
      row.push(
        `<text x="0" y="${rowY - 4}" font-family="'Modesto Condensed', 'Modesto', Arial, Helvetica, sans-serif" font-size="11" fill="#ddd" text-anchor="start">${escapeXml(rowLabel)}</text>`
      );
    }

    for (let i = 0; i < n; i++) {
      const x = i * (boxWidth + HEALTH_BOX_GAP);
      let symbol = mapStatusToSymbol(track[i]);
      if (mode === "unlinked") symbol = "?";
      if (mode === "error") symbol = i === Math.floor(n / 2) ? "⚠" : "";
      const levelLabel = getLevelLabel(i);
      const iconPath = ICON_BY_SYMBOL[symbol];
      const assets = options.assetUris ?? {};
      const boxHref = assets.box ?? BOX_ASSET;
      const iconHref = iconPath ? assets[symbol] ?? iconPath : null;

      row.push(`
      <g>
        <rect x="${x}" y="${rowY}" width="${boxWidth}" height="${boxHeight}" fill="transparent" stroke="#fff" stroke-width="2"/>
        <image href="${escapeXml(boxHref)}" x="${x}" y="${rowY}" width="${boxWidth}" height="${boxHeight}" preserveAspectRatio="none"/>
        ${iconHref
          ? `<image href="${escapeXml(iconHref)}" x="${x}" y="${rowY}" width="${boxWidth}" height="${boxHeight}" preserveAspectRatio="none"/>`
          : `<text x="${x + boxWidth / 2}" y="${rowY + boxHeight / 2}"
              font-family="'Modesto Condensed', 'Modesto', Arial, Helvetica, sans-serif"
              font-size="${Math.floor(boxHeight * 0.88)}"
              font-weight="bold"
              fill="#fff"
              text-anchor="middle"
              dominant-baseline="central">${escapeXml(symbol)}</text>`}
        <text x="${x + boxWidth / 2}" y="${rowY + boxHeight + 12}"
          font-family="'Modesto Condensed', 'Modesto', Arial, Helvetica, sans-serif"
          font-size="11"
          fill="#fff"
          text-anchor="middle"
          dominant-baseline="central">${escapeXml(levelLabel)}</text>
      </g>`);
    }
    return row.join("\n");
  };

  boxes.push(buildRow(healthTrack, 0, secondaryTrack ? "Human" : ""));
  if (secondaryTrack) boxes.push(buildRow(secondaryTrack, 1, "Chimerical"));

  const labelExtra = mode === "unlinked" || mode === "error" ? FOOTER_LABEL_HEIGHT : 0;
  const totalH =
    rows * (boxHeight + LEVEL_LABEL_HEIGHT) + (rows - 1) * ROW_GAP + labelExtra;
  const label =
    mode === "unlinked"
      ? `<text x="${totalW / 2}" y="${totalH - 10}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#ddd" text-anchor="middle">No actor linked - right-click or HUD to configure</text>`
      : mode === "error"
        ? `<text x="${totalW / 2}" y="${totalH - 10}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#f88" text-anchor="middle">Linked actor missing</text>`
        : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  ${boxes.join("\n")}
  ${label}
</svg>`;
}

/**
 * Load PNG assets and convert to data URLs so they always render when embedded
 * inside uploaded SVG tile textures.
 */
export async function getEmbeddedHealthAssetUris() {
  if (cachedAssetUris) return cachedAssetUris;
  try {
    const [box, slash, cross, star] = await Promise.all([
      fetchAsDataUrl(BOX_ASSET),
      fetchAsDataUrl(ICON_BY_SYMBOL["/"]),
      fetchAsDataUrl(ICON_BY_SYMBOL["X"]),
      fetchAsDataUrl(ICON_BY_SYMBOL["*"]),
    ]);
    cachedAssetUris = { box, "/": slash, X: cross, "*": star };
  } catch (err) {
    console.warn(`${MODULE_ID} | Failed to preload box/icon assets`, err);
    cachedAssetUris = null;
  }
  return cachedAssetUris;
}

export function getHealthTextureDimensions(
  numBoxes,
  boxWidth = DEFAULT_BOX_WIDTH,
  boxHeight = DEFAULT_BOX_HEIGHT,
  options = {}
) {
  const n = Math.max(1, Number(numBoxes) || DEFAULT_FALLBACK_BOXES);
  const mode = options.mode ?? "normal";
  const rows = Math.max(1, Number(options.rows) || 1);
  const width = n * boxWidth + (n - 1) * HEALTH_BOX_GAP;
  const footer = mode === "unlinked" || mode === "error" ? FOOTER_LABEL_HEIGHT : 0;
  const height =
    rows * (boxHeight + LEVEL_LABEL_HEIGHT) + (rows - 1) * ROW_GAP + footer;
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

async function fetchAsDataUrl(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Asset fetch failed: ${path} (${response.status})`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
