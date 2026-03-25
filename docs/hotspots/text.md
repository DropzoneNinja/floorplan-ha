# Text / Value

Displays a live value from a Home Assistant entity as text on the floorplan.

## Entity

Required. The entity whose state value is shown.

## Settings

| Setting | Description |
|---------|-------------|
| Template | Text to display. Use `{{state}}` for the entity value or `{{attr.name}}` for an attribute |
| Font Size | Text size in pixels |
| Color | Text color |
| Align | Text alignment: `left`, `center`, or `right` |

## Template Examples

| Template | Output |
|----------|--------|
| `{{state}}` | The raw state value (e.g. `21.5`) |
| `{{state}} °C` | Value with unit (e.g. `21.5 °C`) |
| `{{attr.friendly_name}}` | An entity attribute |

## Tips

- Combine with **State Rules** to change text color based on the value (e.g. red when temperature is high).
