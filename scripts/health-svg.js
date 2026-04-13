import {
  DEFAULT_BOX_HEIGHT,
  DEFAULT_BOX_WIDTH,
  DEFAULT_FALLBACK_BOXES,
  MODULE_ID,
} from "./constants.js";

export const HEALTH_BOX_GAP = 12;
const LEVEL_LABEL_HEIGHT = 20;
const FOOTER_LABEL_HEIGHT = 26;
const DICE_PENALTY_BAND_HEIGHT = 24;
const ROW_GAP = 14;
const MIN_VISIBLE_BOXES = 7;
/** WoD20 health tier keys in wound-severity order (maps to system.health.<key>). */
const HEALTH_TIER_KEYS = [
  "bruised",
  "hurt",
  "injured",
  "wounded",
  "mauled",
  "crippled",
  "incapacitated",
];
const DEFAULT_LEVEL_LABELS = HEALTH_TIER_KEYS;
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
    const trackLen = parsed.length;
    const levelLabels = buildLevelLabelsFromHealthMap(
      systemData?.health,
      trackLen
    );
    return {
      track: parsed,
      secondaryTrack,
      valid: true,
      dicePenalty: readHealthDicePenalty(systemData),
      levelLabels,
      secondaryLevelLabels: resolveChangelingSecondaryLevelLabels(
        systemData,
        actorType,
        trackLen,
        levelLabels
      ),
    };
  }

  if (actorType === "Wraith") {
    const wraithBoxes = Math.max(10, expectedBoxes);
    const wraithTrack =
      buildTrackFromDamageNode(systemData?.health?.damage?.corpus, wraithBoxes) ??
      Array(wraithBoxes).fill("healthy");
    return {
      track: wraithTrack,
      secondaryTrack: null,
      valid: true,
      dicePenalty: readHealthDicePenalty(systemData),
      levelLabels: null,
      secondaryLevelLabels: null,
    };
  }

  // WoD20 often stores health as damage counts instead of a string track array.
  const fromDamage = buildTrackFromDamageNode(systemData?.health?.damage, expectedBoxes);
  if (fromDamage) {
    const secondaryTrack =
      actorType === "Changeling"
        ? buildTrackFromDamageNode(systemData?.health?.damage?.chimerical, expectedBoxes)
        : null;
    const trackLen = fromDamage.length;
    const levelLabels = buildLevelLabelsFromHealthMap(
      systemData?.health,
      trackLen
    );
    return {
      track: fromDamage,
      secondaryTrack,
      valid: true,
      dicePenalty: readHealthDicePenalty(systemData),
      levelLabels,
      secondaryLevelLabels: resolveChangelingSecondaryLevelLabels(
        systemData,
        actorType,
        trackLen,
        levelLabels
      ),
    };
  }

  console.warn(
    `${MODULE_ID} | Actor "${actor?.name ?? actor?.id}" has no usable health track data; using ${DEFAULT_FALLBACK_BOXES} empty boxes.`
  );
  const fallbackLen = DEFAULT_FALLBACK_BOXES;
  const levelLabels = buildLevelLabelsFromHealthMap(
    systemData?.health,
    fallbackLen
  );
  return {
    track: Array(fallbackLen).fill(""),
    secondaryTrack: null,
    valid: false,
    dicePenalty: readHealthDicePenalty(systemData),
    levelLabels,
    secondaryLevelLabels: resolveChangelingSecondaryLevelLabels(
      systemData,
      actorType,
      fallbackLen,
      levelLabels
    ),
  };
}

/**
 * WoD20 wound / dice penalty (corpus for Wraith, main damage or health for others).
 */
function readHealthDicePenalty(systemData) {
  const corpus = systemData?.health?.damage?.corpus;
  if (corpus && typeof corpus === "object") {
    const fromCorpus =
      corpus.woundpenalty ?? corpus.woundPenalty ?? corpus.dicepenalty ?? corpus.dicePenalty;
    if (fromCorpus != null && fromCorpus !== "") {
      const n = Number(fromCorpus);
      return Number.isFinite(n) ? n : 0;
    }
  }
  const dmg = systemData?.health?.damage;
  if (dmg && typeof dmg === "object") {
    const fromDamage = dmg.woundpenalty ?? dmg.woundPenalty;
    if (fromDamage != null && fromDamage !== "") {
      const n = Number(fromDamage);
      return Number.isFinite(n) ? n : 0;
    }
  }
  const h = systemData?.health;
  if (h && typeof h === "object") {
    const fromHealth = h.woundpenalty ?? h.woundPenalty;
    if (fromHealth != null && fromHealth !== "") {
      const n = Number(fromHealth);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

/**
 * Boxes per tier from system.health.<tier> (.total / .value), or 1 if the tier
 * exists as an object without a numeric count. Missing tier → 0.
 */
function boxCountForHealthTier(health, tierKey) {
  const node = health?.[tierKey];
  if (!node || typeof node !== "object") return 0;
  if (node.total != null || node.value != null) {
    return asNonNegativeInt(node.total ?? node.value);
  }
  return 1;
}

function healthHasAnyTierObject(health) {
  if (!health || typeof health !== "object") return false;
  return HEALTH_TIER_KEYS.some((k) => health[k] && typeof health[k] === "object");
}

/**
 * One label per health box: repeats tier names when that tier has multiple boxes.
 */
function buildLevelLabelsFromHealthMap(health, numBoxes) {
  const n = Math.max(1, Number(numBoxes) || 1);
  if (!healthHasAnyTierObject(health)) {
    return staticTierLabels(n);
  }
  const labels = [];
  for (const key of HEALTH_TIER_KEYS) {
    const count = boxCountForHealthTier(health, key);
    for (let i = 0; i < count; i++) labels.push(key);
  }
  if (labels.length === 0) {
    return staticTierLabels(n);
  }
  while (labels.length < n) {
    labels.push(`level ${labels.length + 1}`);
  }
  return labels.slice(0, n);
}

function staticTierLabels(numBoxes) {
  const n = Math.max(1, Number(numBoxes) || 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(DEFAULT_LEVEL_LABELS[i] ?? `level ${i + 1}`);
  }
  return out;
}

function resolveChangelingSecondaryLevelLabels(
  systemData,
  actorType,
  trackLen,
  humanLabels
) {
  if (actorType !== "Changeling") return null;
  const chim = systemData?.health?.chimerical;
  if (chim && typeof chim === "object" && healthHasAnyTierObject(chim)) {
    return buildLevelLabelsFromHealthMap(chim, trackLen);
  }
  return humanLabels ? [...humanLabels] : staticTierLabels(trackLen);
}

/**
 * Match label array length to the tile track after numBoxes trim/pad.
 */
export function trimLevelLabelsToTrack(labels, trackLen) {
  if (!Array.isArray(labels)) return undefined;
  const n = Math.max(1, Number(trackLen) || 1);
  const out = [...labels];
  while (out.length < n) {
    out.push(`level ${out.length + 1}`);
  }
  return out.slice(0, n);
}

/**
 * SVG layout flags for actor-linked tiles (tile size must match refresh).
 * Wraith: no per-box level labels; all linked types: dice penalty row.
 */
export function getHealthSvgLayout(actor) {
  if (!actor) {
    return { hideLevelLabels: false, showDicePenalty: false };
  }
  const isWraith = String(actor.type) === "Wraith";
  return {
    hideLevelLabels: isWraith,
    showDicePenalty: true,
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
  let sum = 0;
  for (const k of HEALTH_TIER_KEYS) {
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
  const hideLevelLabels = options.hideLevelLabels === true;
  const labelUnder = hideLevelLabels ? 0 : LEVEL_LABEL_HEIGHT;
  const showDicePenalty =
    mode === "normal" && options.showDicePenalty === true;
  const rowStride = boxHeight + labelUnder + ROW_GAP;
  const n = Math.max(1, healthTrack?.length ?? 0);
  const totalW = n * boxWidth + (n - 1) * HEALTH_BOX_GAP;
  const primaryLevelLabels = Array.isArray(options.levelLabels)
    ? options.levelLabels
    : null;
  const secondaryLevelLabels = Array.isArray(options.secondaryLevelLabels)
    ? options.secondaryLevelLabels
    : primaryLevelLabels;
  const boxes = [];
  const buildRow = (track, rowIndex, rowLabel, labelsForRow) => {
    const rowY = rowIndex * rowStride;
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
      const levelLabel = resolveBoxLevelLabel(labelsForRow, i);
      const iconPath = ICON_BY_SYMBOL[symbol];
      const assets = options.assetUris ?? {};
      const boxHref = assets.box ?? BOX_ASSET;
      const iconHref = iconPath ? assets[symbol] ?? iconPath : null;
      const levelText = hideLevelLabels
        ? ""
        : `<text x="${x + boxWidth / 2}" y="${rowY + boxHeight + 12}"
          font-family="'Modesto Condensed', 'Modesto', Arial, Helvetica, sans-serif"
          font-size="11"
          fill="#fff"
          text-anchor="middle"
          dominant-baseline="central">${escapeXml(levelLabel)}</text>`;

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
        ${levelText}
      </g>`);
    }
    return row.join("\n");
  };

  boxes.push(
    buildRow(
      healthTrack,
      0,
      secondaryTrack ? "Human" : "",
      primaryLevelLabels
    )
  );
  if (secondaryTrack) {
    boxes.push(
      buildRow(secondaryTrack, 1, "Chimerical", secondaryLevelLabels)
    );
  }

  const rowsContentHeight =
    rows * (boxHeight + labelUnder) + (rows - 1) * ROW_GAP;
  let totalH = rowsContentHeight;
  let dicePenaltyLine = "";
  if (showDicePenalty) {
    const lineY = rowsContentHeight + 18;
    dicePenaltyLine = `<text x="${totalW / 2}" y="${lineY}" font-family="'Modesto Condensed', 'Modesto', Arial, Helvetica, sans-serif" font-size="12" fill="#ddd" text-anchor="middle">${escapeXml(
      formatDicePenaltyLine(options.dicePenalty)
    )}</text>`;
    totalH += DICE_PENALTY_BAND_HEIGHT;
  }
  const labelExtra = mode === "unlinked" || mode === "error" ? FOOTER_LABEL_HEIGHT : 0;
  totalH += labelExtra;
  const label =
    mode === "unlinked"
      ? `<text x="${totalW / 2}" y="${totalH - 10}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#ddd" text-anchor="middle">No actor linked - right-click or HUD to configure</text>`
      : mode === "error"
        ? `<text x="${totalW / 2}" y="${totalH - 10}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#f88" text-anchor="middle">Linked actor missing</text>`
        : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  ${boxes.join("\n")}
  ${dicePenaltyLine}
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
  const labelUnder = options.hideLevelLabels ? 0 : LEVEL_LABEL_HEIGHT;
  const diceBand =
    mode === "normal" && options.showDicePenalty ? DICE_PENALTY_BAND_HEIGHT : 0;
  const width = n * boxWidth + (n - 1) * HEALTH_BOX_GAP;
  const footer = mode === "unlinked" || mode === "error" ? FOOTER_LABEL_HEIGHT : 0;
  const height =
    rows * (boxHeight + labelUnder) +
    (rows - 1) * ROW_GAP +
    diceBand +
    footer;
  return { width, height };
}

function resolveBoxLevelLabel(labelsForRow, index) {
  if (Array.isArray(labelsForRow) && labelsForRow[index] != null) {
    return String(labelsForRow[index]);
  }
  return DEFAULT_LEVEL_LABELS[index] ?? `level ${index + 1}`;
}

function formatDicePenaltyLine(value) {
  if (value === null || value === undefined || value === "") return "Dice penalty: —";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Dice penalty: —";
  return `Dice penalty: ${n}`;
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
