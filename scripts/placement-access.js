import { MODULE_ID } from "./constants.js";
import {
  beginPlacementMode,
  mayPlaceHealthMonitor,
  registerPlaceHealthMonitorOnControl,
  resolveTilesControl,
} from "./tile-controller.js";

const CHAT_TRIGGERS = new Set(["/phm", "/place-health-monitor", "/healthmonitor"]);

function getTilesLayerClass() {
  return (
    foundry.canvas?.layers?.TilesLayer ??
    CONFIG.Canvas?.layers?.tiles?.layerClass ??
    null
  );
}

/**
 * Foundry 13.351: slash commands must be handled before core marks them invalid.
 */
function patchChatLogProcessMessage() {
  const ChatLog = foundry.applications?.sidebar?.tabs?.ChatLog;
  if (!ChatLog?.prototype?.processMessage || ChatLog.prototype._wod20hmPatched) return;
  const original = ChatLog.prototype.processMessage;
  ChatLog.prototype.processMessage = async function (message, options = {}) {
    const text = String(message ?? "").trim().toLowerCase();
    if (CHAT_TRIGGERS.has(text)) {
      if (!mayPlaceHealthMonitor()) {
        ui.notifications?.warn(game.i18n.localize("WOD20HM.ErrNoPermission"));
        return;
      }
      await beginPlacementMode();
      return;
    }
    return original.call(this, message, options);
  };
  ChatLog.prototype._wod20hmPatched = true;
}

/**
 * Foundry 13 builds tile tools from TilesLayer.prepareSceneControls — not only getSceneControlButtons.
 */
export function patchTilesLayerSceneControls() {
  const TilesLayer = getTilesLayerClass();
  if (!TilesLayer?.prepareSceneControls || TilesLayer._wod20hmPatched) return false;

  const original = TilesLayer.prepareSceneControls;
  TilesLayer.prepareSceneControls = function () {
    const control = original.call(this);
    if (control?.tools) registerPlaceHealthMonitorOnControl(control);
    return control;
  };
  TilesLayer._wod20hmPatched = true;
  return true;
}

/** Re-apply tool on already-built scene controls (v13 array shape). */
export function refreshSceneControlsTool() {
  const controls = ui.controls?.controls ?? ui.controls;
  const tiles = resolveTilesControl(controls);
  if (!tiles?.tools) return false;
  registerPlaceHealthMonitorOnControl(tiles);
  try {
    ui.controls?.render?.({ force: true });
  } catch (_) {
    /* ignore */
  }
  return true;
}

export function registerPlacementAccess() {
  patchTilesLayerSceneControls();

  Hooks.once("ready", () => {
    patchChatLogProcessMessage();
    patchTilesLayerSceneControls();
    refreshSceneControlsTool();
  });
}

/**
 * Game Settings → Module Settings → cog next to this module → Place Health Monitor
 */
export function registerPlacementSettingsMenu() {
  const PlaceMonitorMenu = class PlaceMonitorMenu extends FormApplication {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "wod20hm-place-monitor-menu",
        title: game.i18n.localize("WOD20HM.SettingsMenuLabel"),
        template: `modules/${MODULE_ID}/templates/place-settings.html`,
        width: 400,
        height: "auto",
      });
    }

    getData() {
      return {
        instructions: game.i18n.localize("WOD20HM.SettingsMenuHint"),
        placeLabel: game.i18n.localize("WOD20HM.PlaceHealthMonitor"),
      };
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find('[data-action="place"]').on("click", (ev) => {
        ev.preventDefault();
        if (!mayPlaceHealthMonitor()) {
          ui.notifications?.warn(game.i18n.localize("WOD20HM.ErrNoPermission"));
          return;
        }
        this.close();
        void beginPlacementMode();
      });
    }
  };

  game.settings.registerMenu(MODULE_ID, "placeMonitor", {
    name: "WOD20HM.SettingsMenuName",
    label: "WOD20HM.SettingsMenuLabel",
    hint: "WOD20HM.SettingsMenuHint",
    icon: "fas fa-heart-pulse",
    type: PlaceMonitorMenu,
    restricted: false,
  });
}

export function registerPlacementKeybinding() {
  if (!game.keybindings) {
    console.warn(`${MODULE_ID} | Keybindings API unavailable.`);
    return;
  }

  try {
    game.keybindings.register(MODULE_ID, "placeHealthMonitor", {
      name: "WOD20HM.PlaceHealthMonitor",
      hint: "WOD20HM.KeybindPlaceHint",
      editable: [{ key: "KeyP", modifiers: ["CONTROL", "SHIFT"] }],
      onDown: () => {
        if (!mayPlaceHealthMonitor()) {
          ui.notifications?.warn(game.i18n.localize("WOD20HM.ErrNoPermission"));
          return false;
        }
        void beginPlacementMode();
        return true;
      },
      precedence: CONST?.KEYBINDING_PRECEDENCE_NORMAL ?? 50,
    });
  } catch (err) {
    console.error(`${MODULE_ID} | Keybinding registration failed`, err);
  }
}

export function exposePlacementApi() {
  Hooks.once("ready", () => {
    const mod = game.modules.get(MODULE_ID);
    if (!mod) return;
    mod.api = {
      placeMonitor: () => beginPlacementMode(),
    };
  });
}
