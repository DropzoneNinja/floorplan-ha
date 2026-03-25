# Scene

A one-tap button that activates a Home Assistant scene or runs a script.

## Entity

Optional. Bind to a scene or script entity.

## Settings

| Setting | Description |
|---------|-------------|
| Service | The Home Assistant service to call (domain + service) |
| Icon | Emoji or text icon displayed on the button |
| Label | Text label shown on the button |

## Common Services

| Domain | Service | Description |
|--------|---------|-------------|
| `scene` | `turn_on` | Activate a scene |
| `script` | `turn_on` | Run a script |
| `input_boolean` | `turn_on` | Turn on a helper |

## Tips

- Use the **Service Data** target field to specify which scene or script to activate.
- Use multiple scene hotspots to create a set of lighting presets on your floorplan.
