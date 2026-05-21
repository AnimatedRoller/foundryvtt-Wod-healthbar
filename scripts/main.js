import { MODULE_ID } from "./constants.js";
import {
  exposePlacementApi,
  registerPlacementAccess,
  registerPlacementKeybinding,
  registerPlacementSettingsMenu,
} from "./placement-access.js";
import {
  registerActorAndTileHooks,
  registerReadyWarnings,
  registerSceneControls,
  registerTileUiHooks,
} from "./tile-controller.js";

Hooks.once("init", () => {
  registerSceneControls();
  registerActorAndTileHooks();
  registerTileUiHooks();
  registerReadyWarnings();
  registerPlacementKeybinding();
  registerPlacementAccess();
  registerPlacementSettingsMenu();
  exposePlacementApi();
});

Hooks.once("ready", () => {
  ui.notifications?.info(game.i18n.localize("WOD20HM.ReadyHint"), { permanent: false });
  console.log(`${MODULE_ID} | Ready (Foundry ${game.version}).`);
});
