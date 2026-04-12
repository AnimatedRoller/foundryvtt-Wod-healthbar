import {
  DEFAULT_BOX_HEIGHT,
  DEFAULT_BOX_WIDTH,
  MODULE_ID,
} from "./constants.js";

export function mergeDefaultFlags(raw) {
  return {
    actorId: raw?.actorId ?? null,
    boxWidth: Number(raw?.boxWidth) || DEFAULT_BOX_WIDTH,
    boxHeight: Number(raw?.boxHeight) || DEFAULT_BOX_HEIGHT,
    numBoxes: raw?.numBoxes ?? null,
  };
}

export function getMonitorFlags(tileDocument) {
  return mergeDefaultFlags(tileDocument?.flags?.[MODULE_ID]);
}

export function isHealthMonitorTile(tileDocument) {
  const f = tileDocument?.flags?.[MODULE_ID];
  return !!(f && typeof f === "object");
}
