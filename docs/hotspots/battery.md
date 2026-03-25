# Battery Overview

A single indicator that summarises battery health across all your devices. Green = all good, yellow = some low, red = needs attention. Tap to see individual levels.

## Entity

Not required. This hotspot manages its own list of battery sensors.

## Settings

| Setting | Description |
|---------|-------------|
| Low Threshold | Battery % below which a device shows red (default: 30%) |
| Medium Threshold | Battery % below which a device shows yellow (default: 50%) |
| Items | List of devices to monitor (see below) |
| Background Color | Button background color (`transparent` to hide) |

### Adding a Device

Each item in the list has:

| Field | Description |
|-------|-------------|
| Name | Display name for the device (e.g. "Front Door Sensor") |
| Entity | The battery sensor entity ID (e.g. `sensor.front_door_battery`) |
| Position (X, Y) | Where the device sits on the floorplan (0–1, as a fraction of width/height) |

## Tips

- Add every battery-powered device in your home so you have one place to check battery health.
- The popup shows each device's name, battery percentage, and its location on the floorplan.
