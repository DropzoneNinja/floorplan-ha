# Wind Rose

A compass rose showing live wind direction and optional wind speed.

## Entity

Required. A `sensor.*` entity reporting wind direction in degrees (0–360).

## Settings

| Setting | Description |
|---------|-------------|
| North Offset | Rotate the compass so "N" aligns with your floorplan's north (0–359°) |
| Speed Entity | HA entity ID for a wind speed sensor (optional) |
| Speed Unit | Label for the speed value (e.g. `km/h`, `mph`) |
| Show Cardinals | Show N / S / E / W labels |
| Show Intercardinals | Show NE / SE / SW / NW labels |
| Bearing Mode | `from` — direction the wind is coming from (standard); `into` — direction the wind is blowing toward |
| Rose Color | Color for the arrow, ring, and tick marks |
| Label Color | Color for the text labels and speed value |
| Label Size | Font size for the cardinal labels |

## Tips

- Leave **North Offset** at 0 if your floorplan has north pointing straight up.
- Most weather stations report wind direction as "from", so leave **Bearing Mode** as `from` unless your sensor differs.
