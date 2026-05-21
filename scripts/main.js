import { MODULE_ID } from "./constants.js";
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
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | WoD20 Health Monitor ready.`);
});
