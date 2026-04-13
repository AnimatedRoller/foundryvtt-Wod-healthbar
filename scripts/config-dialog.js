import {
  DEFAULT_BOX_HEIGHT,
  DEFAULT_BOX_WIDTH,
  MODULE_ID,
} from "./constants.js";
import { getMonitorFlags, mergeDefaultFlags } from "./flags.js";
import { getHealthTextureDimensions, parseHealthTrackFromActor } from "./health-svg.js";

function dialogRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.get?.(0)) return html[0];
  return html;
}

/**
 * WoD20 (and many other systems) do not use D&D-style types "character" / "npc".
 * List every actor in the world so GMs can link any sheet (Vampire, Mortal, Creature, etc.).
 */
function actorChoices() {
  return game.actors.filter((a) => a.name?.trim()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Dialog to link / unlink an actor for a health monitor tile.
 * @param {TileDocument} tileDocument
 */
export async function openHealthConfigDialog(tileDocument) {
  if (!tileDocument) return;
  const current = mergeDefaultFlags(getMonitorFlags(tileDocument));
  const currentId = current.actorId ?? "";
  const actors = actorChoices().map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    selected: a.id === currentId || a.uuid === currentId,
  }));
  const templatePath = `modules/${MODULE_ID}/templates/health-config.html`;
  const renderTpl =
    foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  const content = await renderTpl(templatePath, {
    actors,
    blurb: game.i18n.localize("WOD20HM.ConfigBlurb"),
    actorLabel: game.i18n.localize("WOD20HM.ActorLabel"),
    noActorOption: game.i18n.localize("WOD20HM.NoActorOption"),
  });

  return new Promise((resolve) => {
    const dlg = new Dialog(
      {
        title: game.i18n.localize("WOD20HM.ConfigTitle"),
        content,
        buttons: {
          save: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("WOD20HM.Save"),
            callback: async (html) => {
              const root = dialogRoot(html);
              const select = root.querySelector(`select[name="actorId"]`);
              const id = select?.value || null;
              const next = mergeDefaultFlags({
                ...current,
                actorId: id || null,
                numBoxes: null,
              });

              const actor = id ? game.actors.get(id) : null;
              const parsed = actor ? parseHealthTrackFromActor(actor) : null;
              const trackLen = parsed ? parsed.track.length : null;
              const rows = parsed?.secondaryTrack ? 2 : 1;
              const boxes =
                trackLen && trackLen > 0 ? trackLen : 7;
              const { width, height } = getHealthTextureDimensions(
                boxes,
                next.boxWidth || DEFAULT_BOX_WIDTH,
                next.boxHeight || DEFAULT_BOX_HEIGHT,
                { mode: actor ? "normal" : "unlinked", rows }
              );

              await tileDocument.update({
                width,
                height,
                flags: {
                  [MODULE_ID]: { ...next, numBoxes: boxes },
                },
              });
              resolve(true);
            },
          },
          unlink: {
            icon: '<i class="fas fa-unlink"></i>',
            label: game.i18n.localize("WOD20HM.Unlink"),
            callback: async () => {
              const next = mergeDefaultFlags({
                ...current,
                actorId: null,
                numBoxes: null,
              });
              const { width, height } = getHealthTextureDimensions(
                7,
                next.boxWidth || DEFAULT_BOX_WIDTH,
                next.boxHeight || DEFAULT_BOX_HEIGHT,
                { mode: "unlinked" }
              );
              await tileDocument.update({
                width,
                height,
                flags: { [MODULE_ID]: { ...next, numBoxes: 7 } },
              });
              resolve(true);
            },
          },
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("WOD20HM.Close"),
            callback: () => resolve(false),
          },
        },
        default: "save",
      },
      { width: 420 }
    );
    dlg.render(true);
  });
}
