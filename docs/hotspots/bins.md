# Bin Day

Shows which bin needs to go out based on upcoming calendar events, with a "today" or "tomorrow" label.

## Entity

Required. A `calendar.*` entity. The calendar must have events named **"Yellow Bin"** or **"Red Bin"** on the collection days.

## Settings

| Setting | Description |
|---------|-------------|
| Yellow Bin Image | Asset image to show for yellow bin days |
| Red Bin Image | Asset image to show for red bin days |
| Label | Optional text label on the floorplan |

## How It Works

- When a "Yellow Bin" or "Red Bin" event is today or tomorrow, the matching bin image is shown with a label.
- If no upcoming event is found, the hotspot is hidden.

## Tips

- Create a calendar in Home Assistant and add recurring events for each bin type.
- Upload images of your actual bins as assets for a clear visual reminder.
