# WoD20 Health Monitor

A [Foundry Virtual Tabletop](https://foundryvtt.com/) **v13** module for **World of Darkness** games on Foundry ([WoD20 / worldofdarkness](https://github.com/JohanFalt/Foundry_WoD20), [WoD5e](https://github.com/WoD5E-Developers/wod5e)). It adds **tiles** that mirror an actor’s **health** and **willpower** from the character sheet—empty boxes, **/**, **X**, and **\***—and **update automatically** when those values change.

---

## Requirements

- **Foundry VTT** v13 or newer  
- **WoD20** (recommended): health is read from `actor.system.health.track` as on the WoD20 sheet. Other systems may install and use the module for testing if actors expose a compatible `system.health.track` array.  
- Permission to **create or update tiles** on the scene (typically the GM, or anyone your table allows to edit the scene)

---

## Installation

1. In Foundry, open **Add-on Modules** → **Install Module**.
2. Paste this **manifest URL** into the field at the bottom and click **Install**:

   `https://raw.githubusercontent.com/AnimatedRoller/foundryvtt-Wod-healthbar/main/module.json`

   (Or install from a local folder by pointing Foundry at a copy of this repository.)
3. In your world, enable **WoD20 Health Monitor** under **Module Management**.

---

## User guide

### 1. Place a health monitor tile

**Option A — Tiles tool (left sidebar)**

1. Open a **scene** on the canvas (not just the world view).
2. Click the **Tiles** layer in the left scene controls (stacked-squares icon).
3. In the **tool strip** that appears (along the top or side of the canvas, depending on Foundry version), click **Place Health Monitor** (heart-pulse icon). It is usually the first tool in that strip.
4. **Left-click** on the scene where you want the tile.

**Option B — Game Settings menu (most reliable)**

1. Open **Game Settings** (gear icon in the right sidebar).
2. Under **Module Settings**, find **WoD20 Health Monitor** → **Place Health Monitor**.
3. Click **Place Health Monitor**, then **left-click** on the scene.

**Option C — Keybinding**

1. Open a scene, then press **Alt+H** (default).
2. Assign or change it under **Game Settings** → **Configure Controls**, then filter for **WoD20** or **Place Health Monitor**.
3. **Left-click** on the scene to place the tile.

**Option D — Chat command**

1. In chat, type `/phm` or `/place-health-monitor` and press Enter.
2. **Left-click** on the scene to place the tile.

After placing, the **Health Monitor — Link Actor** dialog opens. A new tile shows a placeholder row of **?** boxes until you link an actor.

**Cancel placement:** press **Esc**, or choose another tool (e.g. tile **Select**).

### 2. Link an actor

1. In the dialog, open the **Actor** dropdown. It lists **characters** and **NPCs** in the world.
2. Pick the actor whose health this tile should show.
3. Click **Save**.

The tile resizes to match that actor’s health **track length** and shows the same symbols as the sheet:

| Sheet / data | On the tile |
|--------------|-------------|
| Healthy / empty | Blank box |
| Bashing | **/** |
| Lethal | **X** |
| Aggravated | **\*** |

Changing health or willpower on the **actor sheet** updates **every** tile linked to that actor. Willpower is a **single row** with one box per maximum willpower; **X** marks temporary willpower (WoD5e uses the same superficial/aggravated track style as health).

### 3. Change or remove the link later

- **Right-click** the tile and choose **Link Actor / Configure** if your Foundry version shows that entry, **or**
- Select the tile and use the **Link actor** control on the **tile HUD** (the small overlay when a tile is selected).

In the dialog you can pick another actor and **Save**, or use **Unlink** to detach the actor. Unlinked tiles show the **?** placeholder row again until you link someone.

### 4. Resize and move the tile

Use Foundry’s normal tile tools: **drag** to move, **resize handles** to change size. The texture is an SVG scaled to the tile, so symbols stay crisp at reasonable sizes.

### 5. Multiple tiles, one actor

You can link **several** tiles to the **same** actor. All of them refresh when that actor’s health track changes.

---

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| **Place Health Monitor** does not appear | Use **Game Settings** → **WoD20 Health Monitor** → **Place Health Monitor**, or chat `/phm`. For the toolbar: open a **scene**, select **Tiles**, then check the tool strip on the canvas edge. Keybind: **Configure Controls**, filter **WoD20**. Confirm the module is **enabled**. |
| Console spam from **parallax-tiles** | That module errors on monitor tiles; v1.0.22 marks them ignored. Update both modules or temporarily disable parallax-tiles if it persists. |
| Nothing happens when placing | Stay on the **Tiles** layer; placement listens while that layer is active. Use **Esc** and try the tool again. |
| Tile shows “Linked actor missing” | The linked actor was **deleted** from the world. Open **Link Actor / Configure** and link a valid actor or **Unlink**. |
| Symbols do not match the sheet | The module reads `actor.system.health.track`. If your sheet or modules store health elsewhere, they may not match until data matches the WoD20 shape described in the module specification. |
| “No permission” when using the tool | Your user needs permission to **modify the scene** (tiles). Ask the GM to adjust scene permissions or have them place the tile. |

---

## For developers

- **Module id:** `wod20-health-monitor`  
- **Flags** on each monitor tile live under that scope (`actorId`, `boxWidth`, `boxHeight`, `numBoxes`).  
- Health graphics are **generated SVG** data URLs; no image assets are required for default behaviour.

`module.json` includes `url`, `manifest`, and `download` for this repo; bump **version** there when you release updates so clients can check for updates.
