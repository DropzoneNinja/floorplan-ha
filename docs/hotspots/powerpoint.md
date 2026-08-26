# Powerpoint Overview

A single indicator representing all your Australian double power points (GPOs). Tap to reveal each configured powerpoint location on the floorplan; tap a location to open a dialog and switch each of its two outlets on/off independently.

## Entity

Not required. This hotspot manages its own list of powerpoint locations, each with two outlet entities.

## Settings

| Setting | Description |
|---------|-------------|
| Items | List of powerpoint locations to monitor and control (see below) |
| Background Color | Button background color (`transparent` to hide) |

### Adding a Powerpoint

Each item in the list has:

| Field | Description |
|-------|-------------|
| Location name | Display name for the physical GPO (e.g. "Lounge Room GPO") |
| Position (X, Y) | Where the powerpoint sits on the floorplan (0–1, as a fraction of width/height) |
| Outlet A (left) | Free-text name (e.g. "Lamp") plus the HA switch entity for the left socket |
| Outlet B (right) | Free-text name (e.g. "Heater") plus the HA switch entity for the right socket |

## Tips

- The aggregate icon glows on the side (left/right) where any configured outlet across the house is currently on.
- Each pin on the floorplan shows a tiny Australian double-socket icon with the active side highlighted.
- Since the two sides of a double GPO often power different things, give each outlet a name that reflects what's actually plugged in.
