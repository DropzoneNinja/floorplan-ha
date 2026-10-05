# Power Usage

A single indicator showing how much electricity your home is drawing right now. The icon shows the combined watts of every power sensor you add, and its colour follows how much is being used. Tap it to see a heatmap of consumption across the floorplan. Tap a sensor on the heatmap to see its usage history.

## Entity

Not required. This hotspot manages its own list of power sensors.

## Settings

| Setting | Description |
|---------|-------------|
| Heat radius | How far each sensor's heat gradient spreads, as a percentage of the floorplan width (default: 25%) |
| Background Color | Icon background colour (`transparent` to hide) |
| Items | List of power sensors (see below) |

### Adding a Power Sensor

Each item in the list has:

| Field | Description |
|-------|-------------|
| Name | Display name for the room or location (e.g. "Kitchen") |
| Entity | The HA sensor to read (see [Supported sensors](#supported-sensors)) |
| Position (X, Y) | Where the sensor sits on the floorplan (0–1, as a fraction of width/height) |

Add the sensor from the **Actions** tab, then click where it sits on the floorplan. You can drag it later while the hotspot is selected.

## Supported sensors

| Sensor unit | Live icon and heatmap | Usage history |
|-------------|-----------------------|---------------|
| `W` or `kW` | Yes | Yes |
| `kWh` or `Wh` | No (not a live reading) | Yes |

Usage history comes from Home Assistant long-term statistics. HA only records these for sensors with a **state class**:

- Power sensors (`W`/`kW`) need `state_class: measurement`.
- Energy sensors (`kWh`/`Wh`) need `state_class: total_increasing`.

Without a state class, the history popup shows "No usage recorded for this period".

## Icon colour

The icon shows the sum of all live readings, and its colour follows the same scale as the heatmap:

| Power | Colour |
|-------|--------|
| 0 W | 🔵 Blue (idle) |
| 300 W | 🟢 Green |
| 1000 W | 🟡 Amber |
| ≥ 2000 W | 🔴 Red |

The scale is fixed and the same for every Power hotspot. Values in between are blended smoothly.

## Heatmap

Tapping the icon shows a heatmap radiating from each placed sensor, in the same way as the temperature heatmap. Each sensor shows a pin with its current draw. The heatmap is clipped to the floorplan's heatmap mask image, if one is set (see [Temperature heatmap](temperature-gauge.md)).

- Tapping a **pin** opens that sensor's usage history.
- Tapping the **floorplan** dismisses the heatmap.
- Showing the power heatmap **replaces** the temperature heatmap, and the reverse. Only one heatmap is on screen at a time.

## Usage history

Tapping a sensor pin opens a popup with three views:

| View | Bars |
|------|------|
| 14 days | One bar per day, for the last 14 days |
| 3 months | One bar per week, for the last 13 weeks |
| 1 year | One bar per month, for the last 12 months |

Bars show energy in kWh. Hover or focus a bar to see its exact value. The side panel shows the current draw, the total for the period, and the peak bar.

For power sensors (`W`/`kW`), each bar is estimated from the average wattage over the bar's period, multiplied by the hours covered. The current day, week, or month is therefore partial until it completes.

## Tips

- Add a sensor for each room you want to track. The icon total is the sum of all of them, so avoid adding the same circuit twice.
- If you want the heatmap to follow the walls of your house, set a heatmap mask on the floorplan (see [Temperature heatmap](temperature-gauge.md)).
- A small heat radius (10–20%) keeps each room distinct. A large radius (25–40%) blends rooms together.
