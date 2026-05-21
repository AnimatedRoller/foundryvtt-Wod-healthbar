import { MODULE_ID } from "./constants.js";
import {
  registerActorAndTileHooks,
  registerPlacementFallbacks,
  registerReadyWarnings,
  registerSceneControls,
  registerTileUiHooks,
} from "./tile-controller.js";

Hooks.once("init", () => {
  registerSceneControls();
  registerActorAndTileHooks();
  registerTileUiHooks();
  registerReadyWarnings();
  registerPlacementFallbacks();
});

Hooks.once("ready", () => {
  ui.notifications?.info(game.i18n.localize("WOD20HM.ReadyHint"), { permanent: false });
  console.log(`${MODULE_ID} | Ready (Foundry ${game.version}).`);
});
