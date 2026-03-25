# State Icon

An MDI icon that changes color based on entity state. Optionally shows a battery level indicator.

## Entity

Required. Any entity whose on/off state drives the icon color.

## Settings

| Setting | Description |
|---------|-------------|
| Icon | MDI icon name (e.g. `mdi:motion-sensor`) |
| On Color | Icon color when entity is "on" |
| Off Color | Icon color when entity is "off" |
| Badge | Show a small status dot in the top-right corner |
| Battery Entity | Entity ID of a battery sensor linked to this device |
| Low Battery Threshold | Battery % below which a low-battery warning appears (default: 40%) |

## Tips

- Browse icons at [pictogrammers.com/library/mdi](https://pictogrammers.com/library/mdi).
- Enable **Battery Entity** to get a visual warning when a device battery is running low.
- Use **State Rules** to add more colors for states beyond on/off.
