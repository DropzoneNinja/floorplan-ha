# Clock

Displays the current time (and optionally the date) as an analog or digital clock. No Home Assistant entity needed.

## Entity

Not required.

## Settings

| Setting | Description |
|---------|-------------|
| Style | `digital` — digits display; `analog` — clock face with hands |
| Show Seconds | Show seconds hand (analog) or `:SS` digits (digital) |
| Hour Format | `12` or `24` hour format (digital only) |
| Show Date | Show a date line below the time (e.g. "Mon, 24 Mar") |
| Color | Color for hands or digits |
| Background Color | Clock background color (`transparent` to hide) |
| Font Size | Text size in pixels (leave blank to auto-scale with the hotspot) |
| Timezone | IANA timezone (e.g. `America/New_York`). Leave blank for local browser time |
| Timezone Label | Custom label below the clock. Leave blank to show the timezone abbreviation automatically |

## Tips

- Add multiple clocks with different **Timezone** settings to show times around the world.
- Set **Background Color** to `transparent` if you want the clock to float over your floorplan image.
