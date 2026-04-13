import { DEFAULT_FALLBACK_BOXES, MODULE_ID } from "./constants.js";
import {
  generateHealthSVG,
  getEmbeddedHealthAssetUris,
  getHealthSvgLayout,
  parseHealthTrackFromActor,
} from "./health-svg.js";
import { getMonitorFlags, mergeDefaultFlags } from "./flags.js";
import { uploadSvgAsWorldTexture } from "./texture-upload.js";

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
  // Only GM uploads; other clients receive the TileDocument update over the socket.
  if (!game.user?.isGM) return;

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
    const len = raw.numBoxes ?? parsed.track.length;
    track = [...parsed.track];
    while (track.length < len) track.push("healthy");
    if (track.length > len) track = track.slice(0, len);
    let secondaryTrack = Array.isArray(parsed.secondaryTrack)
      ? [...parsed.secondaryTrack]
      : null;
    if (secondaryTrack) {
      while (secondaryTrack.length < len) secondaryTrack.push("healthy");
      if (secondaryTrack.length > len) secondaryTrack = secondaryTrack.slice(0, len);
    }

    const layout = getHealthSvgLayout(actor);
    const svg = generateHealthSVG(track, boxW, boxH, {
      mode,
      assetUris,
      secondaryTrack,
      hideLevelLabels: layout.hideLevelLabels,
      showDicePenalty: layout.showDicePenalty,
      dicePenalty:
        actor.type === "Wraith" ? (parsed.dicePenalty ?? 0) : undefined,
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
    const payload = { texture: { src } };
    if (raw.numBoxes == null) {
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
