# Blind / Cover

Controls a roller blind, shade, or cover. Tap to open a position slider. Long-press to control multiple covers together.

## Entity

Required. A `cover.*` entity.

## Settings

| Setting | Description |
|---------|-------------|
| Icon | MDI icon name (e.g. `mdi:blinds`) |
| Label | Optional text label shown below the icon |
| Background Color | Button background color (`transparent` to hide) |
| Group Entities | Additional cover entity IDs controlled together on long-press |
| Battery Entity | Entity ID of a battery sensor linked to this cover motor |
| Low Battery Threshold | Battery % below which a low-battery warning appears (default: 40%) |

## Tips

- Add all blinds in the same room to **Group Entities** so a long-press controls them all at once.
- The position slider shows a live preview of the cover position.
