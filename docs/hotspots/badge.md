# Badge

A small pill-shaped label that shows the entity's current state with a color-coded background.

## Entity

Required. The entity whose state is displayed.

## Settings

| Setting | Description |
|---------|-------------|
| State Labels | Map each state value to a display label (e.g. `on` → `Open`) |
| State Colors | Map each state value to a background color (e.g. `on` → `#16a34a`) |

## Example

| State | Label | Color |
|-------|-------|-------|
| `on` | Open | Green (`#16a34a`) |
| `off` | Closed | Dark grey (`#374151`) |

## Tips

- Works well for door/window sensors, alarm states, or any entity with a small set of named states.
- Add an entry for every state your entity can be in to avoid a blank badge.
