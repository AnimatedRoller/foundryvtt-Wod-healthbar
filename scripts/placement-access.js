import { MODULE_ID } from "./constants.js";
import { beginPlacementMode, mayPlaceHealthMonitor } from "./tile-controller.js";

const CHAT_COMMANDS = new Set(["/place-health-monitor", "/phm", "/healthmonitor"]);

/**
 * @param {string} content
 */
export function isPlaceHealthMonitorCommand(content) {
  return CHAT_COMMANDS.has(String(content ?? "").trim().toLowerCase());
}

export function registerPlacementAccess() {
  Hooks.on("chatMessage", (chatLog, message, _chatData) => {
    if (!isPlaceHealthMonitorCommand(message?.content)) return;
    if (!mayPlaceHealthMonitor()) {
      ui.notifications?.warn(game.i18n.localize("WOD20HM.ErrNoPermission"));
      return false;
    }
    void beginPlacementMode();
    return false;
  });
}

/**
 * Game Settings → module config menu (always available when the module is active).
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

  game.keybindings.register(MODULE_ID, "placeHealthMonitor", {
    name: "WOD20HM.PlaceHealthMonitor",
    hint: "WOD20HM.KeybindPlaceHint",
    editable: [{ key: "KeyH", modifiers: ["ALT"] }],
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
}
