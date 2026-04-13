import {
  DEFAULT_BOX_HEIGHT,
  DEFAULT_BOX_WIDTH,
  DEFAULT_FALLBACK_BOXES,
  MODULE_ID,
} from "./constants.js";
import { getHealthTextureDimensions } from "./health-svg.js";
import { getPlaceholderTextureSrc } from "./texture-upload.js";
import {
  getMonitorFlags,
  isHealthMonitorTile,
  mergeDefaultFlags,
} from "./flags.js";
import { refreshHealthMonitorTile } from "./tile-refresh.js";
import { openHealthConfigDialog } from "./config-dialog.js";

let placementActive = false;
let placementPointerHandler = null;
let placementKeyHandler = null;

export async function createHealthMonitorTileAt(canvasPoint) {
  const scene = canvas.scene;
  if (!scene) return null;

  const boxW = DEFAULT_BOX_WIDTH;
  const boxH = DEFAULT_BOX_HEIGHT;
  const num = DEFAULT_FALLBACK_BOXES;
  const { width, height } = getHealthTextureDimensions(num, boxW, boxH, {
    mode: "unlinked",
  });

  const snapped =
    typeof canvas.grid.getSnappedPoint === "function"
      ? canvas.grid.getSnappedPoint({ x: canvasPoint.x, y: canvasPoint.y })
      : canvas.grid.getSnappedPosition(canvasPoint.x, canvasPoint.y);
  const x = Math.round(snapped.x - width / 2);
  const y = Math.round(snapped.y - height / 2);

  const src = getPlaceholderTextureSrc();

  const [created] = await scene.createEmbeddedDocuments("Tile", [
    {
      x,
      y,
      width,
      height,
      rotation: 0,
      texture: { src },
      flags: {
        [MODULE_ID]: {
          actorId: null,
          boxWidth: boxW,
          boxHeight: boxH,
          numBoxes: null,
        },
      },
    },
  ]);

  return created ?? null;
}

function endPlacementMode() {
  placementActive = false;
  if (placementPointerHandler && canvas?.stage) {
    canvas.stage.off("pointerdown", placementPointerHandler);
  }
  placementPointerHandler = null;
  if (placementKeyHandler) {
    window.removeEventListener("keydown", placementKeyHandler, true);
  }
  placementKeyHandler = null;
  try {
    ui.controls?.activate?.({ control: "tiles", tool: "select" });
  } catch (_) {
    /* ignore */
  }
}

async function beginPlacementMode() {
  if (!canvas?.ready || !canvas.scene) {
    ui.notifications?.warn(game.i18n.localize("WOD20HM.ErrNoCanvas"));
    return;
  }
  endPlacementMode();
  try {
    await ui.controls?.activate?.({ control: "tiles" });
  } catch (_) {
    /* ignore */
  }
  placementActive = true;
  ui.notifications?.info(game.i18n.localize("WOD20HM.PlacementHint"));

  placementPointerHandler = async (event) => {
    if (!placementActive) return;
    if (canvas.activeLayer !== canvas.tiles) return;
    const ne = event.nativeEvent;
    if (ne?.button !== 0) return;

    const local = event.getLocalPosition(canvas.stage);
    const tileDoc = await createHealthMonitorTileAt(local);
    endPlacementMode();
    if (tileDoc && game.user?.isGM) {
      await refreshHealthMonitorTile(tileDoc);
    }
    if (tileDoc) await openHealthConfigDialog(tileDoc);
  };

  canvas.stage.on("pointerdown", placementPointerHandler);

  placementKeyHandler = (ev) => {
    if (!placementActive) return;
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    endPlacementMode();
    ui.notifications?.info(game.i18n.localize("WOD20HM.PlacementCancelled"));
  };
  window.addEventListener("keydown", placementKeyHandler, true);
}

export function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tiles = controls?.tiles;
    if (!tiles?.tools) return;

    tiles.tools.wod20HealthMonitor = {
      name: "wod20HealthMonitor",
      title: game.i18n?.localize?.("WOD20HM.PlaceHealthMonitor") ?? "Place Health Monitor",
      icon: "fa-solid fa-heart-pulse",
      order: Object.keys(tiles.tools).length,
      button: true,
      visible: true,
      onChange: () => {
        const mayEdit =
          game.user?.isGM ||
          canvas?.scene?.canUserModify?.(game.user, "update");
        if (!mayEdit) {
          ui.notifications?.warn(
            game.i18n.localize("WOD20HM.ErrNoPermission")
          );
          return;
        }
        void beginPlacementMode();
      },
    };
  });
}

function actorHealthTrackChanged(changes) {
  const flat = foundry.utils.flattenObject(changes ?? {});
  return Object.keys(flat).some((k) =>
    k.startsWith("system.health.track") ||
    k.startsWith("system.health.damage") ||
    k.startsWith("system.traits.health.totalhealthlevels") ||
    k.startsWith("system.health.bruised") ||
    k.startsWith("system.health.hurt") ||
    k.startsWith("system.health.injured") ||
    k.startsWith("system.health.wounded") ||
    k.startsWith("system.health.mauled") ||
    k.startsWith("system.health.crippled") ||
    k.startsWith("system.health.incapacitated")
  );
}

export function registerActorAndTileHooks() {
  Hooks.on("updateActor", (actor, changes, _options, _userId) => {
    if (!actorHealthTrackChanged(changes)) return;
    if (!canvas?.tiles?.placeables) return;
    for (const t of canvas.tiles.placeables) {
      const doc = t.document;
      if (!isHealthMonitorTile(doc)) continue;
      const cfg = mergeDefaultFlags(getMonitorFlags(doc));
      if (!cfg.actorId) continue;
      if (cfg.actorId !== actor.id && cfg.actorId !== actor.uuid) continue;
      refreshHealthMonitorTile(doc).catch((e) =>
        console.error(`${MODULE_ID} | updateActor refresh failed`, e)
      );
    }
  });

  Hooks.on("deleteActor", (actor, _options, _userId) => {
    if (!canvas?.tiles?.placeables) return;
    for (const t of canvas.tiles.placeables) {
      const doc = t.document;
      if (!isHealthMonitorTile(doc)) continue;
      const cfg = mergeDefaultFlags(getMonitorFlags(doc));
      if (!cfg.actorId) continue;
      if (cfg.actorId !== actor.id && cfg.actorId !== actor.uuid) continue;
      refreshHealthMonitorTile(doc).catch((e) =>
        console.error(`${MODULE_ID} | deleteActor refresh failed`, e)
      );
    }
  });

  Hooks.on("updateTile", (tileDocument, changed, _options, _userId) => {
    if (!changed.flags?.[MODULE_ID]) return;
    refreshHealthMonitorTile(tileDocument).catch((e) =>
      console.error(`${MODULE_ID} | updateTile refresh failed`, e)
    );
  });

  // Intentionally no canvasReady bulk refresh: it re-uploaded every health tile on
  // every scene load (FilePicker + DB update each), which stalled the canvas on Forge.
  // Textures persist on the TileDocument; refresh runs on place, flag change, and hooks below.
}

export function registerTileUiHooks() {
  const pushConfigureEntry = (items, tileDocument) => {
    if (!Array.isArray(items) || !isHealthMonitorTile(tileDocument)) return;
    items.push({
      name: game.i18n.localize("WOD20HM.ContextConfigure"),
      icon: '<i class="fas fa-link"></i>',
      callback: () => openHealthConfigDialog(tileDocument),
    });
  };

  Hooks.on("getTileContextOptions", (...args) => {
    let items = null;
    let tileDocument = null;
    if (args.length >= 2 && Array.isArray(args[1])) {
      items = args[1];
      const maybeTile = args[0]?.document ?? args[0]?.object?.document;
      if (maybeTile?.documentName === "Tile") tileDocument = maybeTile;
    }
    if (!tileDocument && args[0] instanceof HTMLElement) {
      const li = args[0].closest?.("[data-document-id]");
      const id = li?.dataset?.documentId;
      if (id && canvas?.scene) tileDocument = canvas.scene.tiles.get(id);
      items = Array.isArray(args[1]) ? args[1] : items;
    }
    if (tileDocument) pushConfigureEntry(items, tileDocument);
  });

  Hooks.on("renderTileHUD", (app, element) => {
    const doc = app?.document;
    if (!doc || doc.documentName !== "Tile") return;
    if (!isHealthMonitorTile(doc)) return;
    const wrap = document.createElement("div");
    wrap.className = "wod20hm-tile-hud";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wod20hm-tile-hud-btn";
    btn.textContent = game.i18n.localize("WOD20HM.HudConfigure");
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openHealthConfigDialog(doc);
    });
    wrap.appendChild(btn);
    element?.appendChild?.(wrap);
  });
}

export function registerReadyWarnings() {
  Hooks.once("ready", () => {
    if (game.system?.id !== "WoD20") {
      console.info(
        `${MODULE_ID} | Active system is "${game.system?.id ?? "unknown"}"; tiles use actor.system.health.track when present (WoD20 layout).`
      );
    }
  });
}
