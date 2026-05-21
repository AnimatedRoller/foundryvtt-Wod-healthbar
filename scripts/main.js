import { MODULE_ID } from "./constants.js";
import {
  registerActorAndTileHooks,
  registerPlacementKeybinding,
  registerReadyWarnings,
  registerSceneControls,
  registerTileUiHooks,
} from "./tile-controller.js";

Hooks.once("init", () => {
  registerSceneControls();
  registerActorAndTileHooks();
  registerTileUiHooks();
  registerReadyWarnings();
});

Hooks.once("ready", () => {
  registerPlacementKeybinding();
  console.log(
    `${MODULE_ID} | WoD20 Health Monitor ready. Tiles tool: heart-pulse icon, or keybind Alt+H.`
  );
});
