# Weather

Shows a live 5-day weather forecast with UV index. Tap a day to see an hourly breakdown.

## Entity

Not required. Weather data is fetched automatically from Open-Meteo based on your Home Assistant location.

## Settings

| Setting | Description |
|---------|-------------|
| UV Index Entity | HA entity ID for UV index (e.g. `sensor.uv_index`) |
| Temperature Unit | Display temperatures in `celsius` or `fahrenheit` |
| Outside Temp Entity | HA entity ID for your outdoor temperature sensor (shown as a reference line on the forecast) |

## Tips

- The **Outside Temp Entity** overlays your actual sensor reading onto the forecast chart, making it easy to compare forecast vs. reality.
- Tap any day in the forecast to see a detailed hourly temperature and condition breakdown.
