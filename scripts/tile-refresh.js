import { DEFAULT_FALLBACK_BOXES, MODULE_ID } from "./constants.js";
import {
  generateHealthSVG,
  parseHealthTrackFromActor,
  svgToDataUrl,
} from "./health-svg.js";
import { getMonitorFlags, mergeDefaultFlags } from "./flags.js";

function resolveActor(actorId) {
  if (!actorId) return null;
  const fromGet = game.actors.get(actorId);
  if (fromGet) return fromGet;
  return game.actors.find((a) => a.uuid === actorId) ?? null;
}

/**
 * Regenerate SVG texture from flags + linked actor. Syncs numBoxes to track length.
 */
export async function refreshHealthMonitorTile(tileDocument) {
  if (!tileDocument || !canvas?.ready) return;
  const raw = mergeDefaultFlags(getMonitorFlags(tileDocument));
  const actor = resolveActor(raw.actorId);
  const boxW = raw.boxWidth;
  const boxH = raw.boxHeight;

  let mode = "normal";
  let track = Array(DEFAULT_FALLBACK_BOXES).fill("");

  if (!raw.actorId) {
    mode = "unlinked";
    track = Array(DEFAULT_FALLBACK_BOXES).fill("");
  } else if (!actor) {
    console.warn(
      `${MODULE_ID} | Linked actor not found for tile ${tileDocument.id} (actorId=${raw.actorId}).`
    );
    mode = "error";
    track = Array(DEFAULT_FALLBACK_BOXES).fill("");
  } else {
    const parsed = parseHealthTrackFromActor(actor);
    track = parsed.track;
    const len = track.length;
    const svg = generateHealthSVG(track, boxW, boxH, { mode });
    const src = svgToDataUrl(svg);
    const payload = { texture: { src } };
    if (raw.numBoxes !== len) {
      payload.flags = {
        [MODULE_ID]: {
          ...raw,
          numBoxes: len,
        },
      };
    }
    await tileDocument.update(payload);
    return;
  }

  const svg = generateHealthSVG(track, boxW, boxH, { mode });
  const src = svgToDataUrl(svg);
  await tileDocument.update({ texture: { src } });
}
