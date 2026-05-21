import { DEFAULT_FALLBACK_BOXES, MODULE_ID } from "./constants.js";
import {
  generateHealthSVG,
  getEmbeddedHealthAssetUris,
  getHealthSvgLayout,
  parseHealthTrackFromActor,
  parseWillpowerTrackFromActor,
  trimLevelLabelsToTrack,
} from "./health-svg.js";
import { getMonitorFlags, mergeDefaultFlags } from "./flags.js";
import { enqueueTileRefresh } from "./refresh-queue.js";
import { uploadSvgAsWorldTexture } from "./texture-upload.js";

function resolveActor(actorId) {
  if (!actorId) return null;
  const fromGet = game.actors.get(actorId);
  if (fromGet) return fromGet;
  return game.actors.find((a) => a.uuid === actorId) ?? null;
}

function syncTrackToLength(track, len) {
  const out = [...track];
  while (out.length < len) out.push("healthy");
  if (out.length > len) return out.slice(0, len);
  return out;
}

function resolveBoxCount(rawNumBoxes, parsedTrackLength) {
  const actorLen = Math.max(1, parsedTrackLength || DEFAULT_FALLBACK_BOXES);
  const stored = rawNumBoxes != null ? Math.max(1, Number(rawNumBoxes) || actorLen) : null;
  return Math.max(actorLen, stored ?? actorLen);
}

/**
 * Regenerate SVG texture from flags + linked actor. Syncs numBoxes to track length.
 */
export async function refreshHealthMonitorTile(tileDocument) {
  if (!tileDocument || !canvas?.ready) return;
  if (!game.user?.isGM) return;

  return enqueueTileRefresh(tileDocument.id, () =>
    refreshHealthMonitorTileImpl(tileDocument)
  );
}

async function refreshHealthMonitorTileImpl(tileDocument) {
  const raw = mergeDefaultFlags(getMonitorFlags(tileDocument));
  const assetUris = await getEmbeddedHealthAssetUris();
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
    const willpower = parseWillpowerTrackFromActor(actor);
    const willLen = willpower.track?.length ?? 0;
    const len = resolveBoxCount(
      raw.numBoxes,
      Math.max(parsed.track.length, willLen)
    );
    track = syncTrackToLength(parsed.track, len);
    let secondaryTrack = Array.isArray(parsed.secondaryTrack)
      ? syncTrackToLength(parsed.secondaryTrack, len)
      : null;

    const layout = getHealthSvgLayout(actor);
    const willpowerPayload =
      willpower.valid && willpower.track
        ? {
            track: syncTrackToLength(willpower.track, len),
            secondaryTrack: willpower.secondaryTrack
              ? syncTrackToLength(willpower.secondaryTrack, len)
              : null,
          }
        : null;

    const svg = generateHealthSVG(track, boxW, boxH, {
      mode,
      assetUris,
      secondaryTrack,
      willpower: willpowerPayload,
      hideLevelLabels: layout.hideLevelLabels,
      showDicePenalty: layout.showDicePenalty,
      dicePenalty: parsed.dicePenalty ?? 0,
      levelLabels: trimLevelLabelsToTrack(parsed.levelLabels, len),
      secondaryLevelLabels: secondaryTrack
        ? trimLevelLabelsToTrack(parsed.secondaryLevelLabels, len)
        : undefined,
    });
    let src;
    try {
      src = await uploadSvgAsWorldTexture(svg, tileDocument.id, Date.now());
    } catch (e) {
      console.error(`${MODULE_ID} | SVG upload failed`, e);
      ui.notifications?.error(
        game.i18n.localize("WOD20HM.ErrTextureUpload")
      );
      return;
    }
    const flagPatch = { ...raw, numBoxes: len };
    const payload = { texture: { src } };
    if (raw.numBoxes !== len) {
      payload.flags = { [MODULE_ID]: flagPatch };
    }
    await tileDocument.update(payload);
    return;
  }

  const len = raw.numBoxes ?? track.length;
  while (track.length < len) track.push("healthy");
  if (track.length > len) track = track.slice(0, len);
  const svg = generateHealthSVG(track, boxW, boxH, { mode, assetUris });
  let src;
  try {
    src = await uploadSvgAsWorldTexture(svg, tileDocument.id, Date.now());
  } catch (e) {
    console.error(`${MODULE_ID} | SVG upload failed`, e);
    ui.notifications?.error(game.i18n.localize("WOD20HM.ErrTextureUpload"));
    return;
  }
  await tileDocument.update({ texture: { src } });
}
