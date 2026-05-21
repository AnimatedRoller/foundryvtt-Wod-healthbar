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
import { registerActorMonitorHooks } from "./actor-monitor-hooks.js";
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
          numBoxes: num,
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

/** Begin click-to-place mode (scene control button, keybinding, or settings menu). */
export async function beginPlacementMode() {
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

/**
 * Find the Tiles scene control across Foundry v12–v14 control shapes.
 * @param {Record<string, object>|Map|object[]} controls
 */
export function resolveTilesControl(controls) {
  if (!controls) return null;

  if (controls instanceof Map) {
    const tiles = controls.get("tiles");
    if (tiles) {
      tiles.tools ??= {};
      return tiles;
    }
  }

  if (controls.tiles) {
    controls.tiles.tools ??= {};
    return controls.tiles;
  }

  if (Array.isArray(controls)) {
    const tiles = controls.find((c) => c?.name === "tiles");
    if (tiles) {
      tiles.tools ??= {};
      return tiles;
    }
    return null;
  }

  for (const entry of Object.values(controls)) {
    if (entry?.name === "tiles") {
      entry.tools ??= {};
      return entry;
    }
  }

  return null;
}

export function mayPlaceHealthMonitor() {
  return (
    game.user?.isGM ||
    canvas?.scene?.canUserModify?.(game.user, "update")
  );
}

function invokePlaceHealthMonitorTool() {
  if (!mayPlaceHealthMonitor()) {
    ui.notifications?.warn(game.i18n.localize("WOD20HM.ErrNoPermission"));
    return;
  }
  void beginPlacementMode();
}

function onPlaceHealthMonitorTool(_event, active) {
  if (active === false) return;
  invokePlaceHealthMonitorTool();
}

/** @param {{ tools: Record<string, object> }} tilesControl */
export function registerPlaceHealthMonitorOnControl(tilesControl) {
  const tools = tilesControl.tools;
  const orders = Object.values(tools).map((t) => Number(t?.order) || 0);
  const order = orders.length ? Math.max(...orders) + 1 : 0;

  tools.wod20HealthMonitor = {
    name: "wod20HealthMonitor",
    title: game.i18n?.localize?.("WOD20HM.PlaceHealthMonitor") ?? "Place Health Monitor",
    icon: "fas fa-heart-pulse",
    order,
    button: true,
    visible: true,
    onClick: invokePlaceHealthMonitorTool,
    onChange: onPlaceHealthMonitorTool,
  };
}

export function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tiles = resolveTilesControl(controls);
    if (!tiles?.tools) {
      console.warn(
        `${MODULE_ID} | Could not register Tiles tool; use Game Settings → Module Settings → WoD20 Health Monitor (cog), Ctrl+Shift+P, or /phm in chat.`
      );
      return;
    }
    registerPlaceHealthMonitorOnControl(tiles);
  });
}

export function registerActorAndTileHooks() {
  registerActorMonitorHooks();

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
    const id = String(game.system?.id ?? "");
    if (id !== "WoD20" && id !== "wod5e" && id !== "worldofdarkness") {
      console.info(
        `${MODULE_ID} | Active system is "${game.system?.id ?? "unknown"}"; tested layouts are WoD20, worldofdarkness, and WoD5E.`
      );
    }
  });
}
