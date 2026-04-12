# WoD20 Health Monitor

A [Foundry Virtual Tabletop](https://foundryvtt.com/) **v13** module for the **World of Darkness 20th Anniversary** system ([WoD20](https://github.com/JohanFalt/Foundry_WoD20)). It adds **tiles** that mirror an actor’s health track from the character sheet—empty boxes, **/**, **X**, and **\***—and **update automatically** when that actor’s health changes.

---

## Requirements

- **Foundry VTT** v13 or newer  
- **WoD20** system active in the world  
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

1. Open the **Tiles** layer (tiles icon in the scene controls).
2. Click **Place Health Monitor** (heart-pulse icon) in the tiles tool strip.
3. Foundry switches focus to the tiles layer if needed. **Left-click** where you want the tile on the scene.
4. A new tile appears (placeholder row of **?** boxes) and the **Health Monitor — Link Actor** dialog opens.

**Cancel placement:** press **Esc**, or choose another tool (e.g. tile **Select**). You can also end placement from the same control strip.

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

Changing health on the **actor sheet** (or anything that updates `system.health.track`) updates **every** tile linked to that actor.

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
| **Place Health Monitor** does not appear | WoD20 must be the **active system**. The tool is hidden in other systems. |
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
