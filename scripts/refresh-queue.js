/** Per-tile refresh chains so overlapping uploads cannot apply stale textures. */
const refreshChains = new Map();

/**
 * Run `fn` after any prior refresh for this tile id completes.
 * @param {string} tileId
 * @param {() => Promise<void>} fn
 */
export function enqueueTileRefresh(tileId, fn) {
  const prev = refreshChains.get(tileId) ?? Promise.resolve();
  const next = prev
    .then(() => fn())
    .catch((err) => {
      console.error(err);
    });
  refreshChains.set(tileId, next);
  return next;
}
