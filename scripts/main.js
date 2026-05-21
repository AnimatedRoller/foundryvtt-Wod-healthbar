import { MODULE_ID } from "./constants.js";
import {
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
});

Hooks.once("ready", () => {
  console.log(
    `${MODULE_ID} | Ready. Place via Tiles (heart icon), Alt+H, chat /phm, or Game Settings → ${game.modules.get(MODULE_ID)?.title ?? MODULE_ID} → Place Health Monitor.`
  );
});
