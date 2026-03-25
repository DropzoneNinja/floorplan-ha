# Action Button

A tappable button that calls a Home Assistant service. Supports tap, long-press, and double-tap gestures.

## Entity

Optional. Bind to any entity to change icon/color based on its state (e.g. a light switch).

## Settings

| Setting | Description |
|---------|-------------|
| Tap Action | Service to call on a single tap |
| Hold Action | Service to call on a long-press (~600ms) |
| Double Tap Action | Service to call on a double-tap (within 300ms) |
| Icon | MDI icon name to display (e.g. `mdi:lightbulb`) |
| On Icon | Icon shown when the entity is "on" |
| Off Icon | Icon shown when the entity is "off" |
| On Color | Icon color when entity is "on" |
| Off Color | Icon color when entity is "off" |
| Label | Text label shown on the button |
| Background Color | Button background color (`transparent` to hide) |
| Hide Label | Hide the label text (useful for invisible overlay buttons) |

## Tips

- Set **Background Color** to `transparent` and **Hide Label** to create an invisible tap zone over part of your floorplan image.
- Use **On/Off Icon** to swap icons between states (e.g. `mdi:lightbulb` vs `mdi:lightbulb-outline`).
