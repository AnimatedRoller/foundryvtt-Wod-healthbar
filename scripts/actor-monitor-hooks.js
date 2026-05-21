import { MODULE_ID } from "./constants.js";
import { isHealthMonitorTile, mergeDefaultFlags, getMonitorFlags } from "./flags.js";
import { refreshHealthMonitorTile } from "./tile-refresh.js";

const HEALTH_TIER_KEYS = [
  "bruised",
  "hurt",
  "injured",
  "wounded",
  "mauled",
  "crippled",
  "incapacitated",
];

const ACTOR_REFRESH_DEBOUNCE_MS = 50;
const actorRefreshTimers = new Map();

/**
 * Whether flattened actor update keys touch health or willpower data we mirror.
 */
export function actorMonitorDataChanged(changes) {
  const flat = foundry.utils.flattenObject(changes ?? {});
  return Object.keys(flat).some((k) => actorMonitorKeyMatches(k));
}

function actorMonitorKeyMatches(key) {
  if (key.startsWith("system.health")) return true;
  if (key.startsWith("system.willpower")) return true;
  if (key.startsWith("system.advantages.willpower")) return true;
  if (key.startsWith("system.traits.health.totalhealthlevels")) return true;
  for (const tier of HEALTH_TIER_KEYS) {
    if (key.startsWith(`system.health.${tier}`)) return true;
  }
  return false;
}

function itemMonitorDataChanged(item, changes) {
  if (!item?.parent || item.parent.documentName !== "Actor") return false;
  const flat = foundry.utils.flattenObject(changes ?? {});
  const id = String(item.system?.id ?? "").toLowerCase();
  if (id === "willpower") {
    return Object.keys(flat).some(
      (k) =>
        k.startsWith("system.permanent") ||
        k.startsWith("system.temporary") ||
        k.startsWith("system.max")
    );
  }
  return false;
}

function refreshTilesForActor(actor) {
  if (!canvas?.tiles?.placeables) return;
  for (const t of canvas.tiles.placeables) {
    const doc = t.document;
    if (!isHealthMonitorTile(doc)) continue;
    const cfg = mergeDefaultFlags(getMonitorFlags(doc));
    if (!cfg.actorId) continue;
    if (cfg.actorId !== actor.id && cfg.actorId !== actor.uuid) continue;
    refreshHealthMonitorTile(doc).catch((e) =>
      console.error(`${MODULE_ID} | actor refresh failed`, e)
    );
  }
}

function scheduleActorRefresh(actor) {
  const key = actor.id;
  const prev = actorRefreshTimers.get(key);
  if (prev) clearTimeout(prev);
  actorRefreshTimers.set(
    key,
    setTimeout(() => {
      actorRefreshTimers.delete(key);
      refreshTilesForActor(actor);
    }, ACTOR_REFRESH_DEBOUNCE_MS)
  );
}

function flushActorRefresh(actor) {
  const key = actor.id;
  const timer = actorRefreshTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    actorRefreshTimers.delete(key);
  }
  refreshTilesForActor(actor);
}

export function registerActorMonitorHooks() {
  Hooks.on("updateActor", (actor, changes) => {
    if (!actorMonitorDataChanged(changes)) return;
    scheduleActorRefresh(actor);
  });

  Hooks.on("updateItem", (item, changes) => {
    if (!itemMonitorDataChanged(item, changes)) return;
    const actor = item.parent;
    if (actor) scheduleActorRefresh(actor);
  });

  Hooks.on("deleteActor", (actor) => {
    refreshTilesForActor(actor);
  });

  Hooks.on("closeActorSheet", (app) => {
    const actor = app?.actor;
    if (!actor) return;
    if (!actorRefreshTimers.has(actor.id)) return;
    flushActorRefresh(actor);
  });
}
