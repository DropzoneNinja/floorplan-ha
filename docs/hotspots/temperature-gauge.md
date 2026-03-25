# Temperature Heatmap

The temperature heatmap overlay lets you visualise the temperature distribution across your home directly on the floorplan. Indoor temperature sensors radiate circular colour gradients that blend together, while the outdoor sensor fills the exterior with a single colour. Everything is clipped precisely to your house shape using a mask image you provide.

---

## How it works

| Element             | Behaviour                                  |
|---------------------|--------------------------------------------|
| **Outside gauge**   | Solid colour fill over the exterior region |
| **Inside gauge(s)** | Radial gradient centred at the sensor      |
|                     |  location, fading over distance            |
| **Mask image**      | PNG that defines interior vs exterior —    |
|                     |  gradients are clipped to it               |
| **Toggle**          | Click any temperature gauge to show/hide   |
|                     |  the heatmap                               | 
--------------------------------------------------------------------

## Colour scale

Temperature is mapped to a continuous colour gradient:

| Temp (°C) | Colour   |
|-----------|----------|
|   ≤ 0     | 🔵 Blue  |
|    15     | 🩵 Cyan  |
|    20     | 🟢 Green |
|    25     | 🟡 Amber |
|  ≥ 32     | 🔴 Red   |
------------------------
Fahrenheit values are converted to Celsius internally for colour mapping.

---

## Step 1 — Create the mask image

The mask is a PNG image with the **same aspect ratio as your floorplan image** (ideally the same resolution).

- **White pixels** (or any opaque pixel) = house interior
- **Black/transparent pixels** = house exterior

### Using any paint tool

1. Open your floorplan image as a reference.
2. Create a new blank image of the same size (e.g. 1920×1080).
3. Fill the entire image black.
4. Paint the interior floor area of your home solid white.
   Include all rooms, hallways, and interior spaces.
   Exclude exterior walls, garden, and outdoor areas.
5. Save as **PNG** (not JPEG — you need clean edges).

> **Tip:** You do not need pixel-perfect edges. The heatmap is semi-transparent and slight imperfections at wall boundaries are not noticeable.

---

## Step 2 — Upload the mask

1. Open the app and navigate to **Assets** (top navigation bar).
2. Click **Upload** and select your mask PNG.
3. Note the asset name — you will assign it to the floorplan next.

---

## Step 3 — Assign the mask to the floorplan

1. Navigate to **Dashboards** → find your floorplan → click **Edit** (pencil icon).
2. Scroll to **Heatmap mask image (optional)** and expand the section.
3. Click **Upload heatmap mask** and select the mask image you uploaded.
4. Click **Save**.

---

## Step 4 — Place an outside temperature gauge

1. Open the **Admin** panel for your floorplan.
2. Enable **Edit mode**.
3. Click **Add Hotspot** and choose **Temperature Gauge 🌡️**.
4. Drag the gauge to a location in the **exterior** area of your floorplan (e.g. outside the walls).
5. In the **Entity** tab, connect it to your outside temperature HA entity
   (e.g. `sensor.outside_temperature`).
6. In the **Actions** tab:
   - Set **Sensor type** to **🏠 Outside**.
   - Choose your **Temperature unit** (°C or °F — must match what HA reports).
7. Save.

> **Note:** Only one outside gauge is used. If you place multiple outside gauges, only the first one found is used for exterior colouring.

---

## Step 5 — Place indoor temperature gauges

Repeat for each room or temperature sensor inside the house:

1. Click **Add Hotspot** → **Temperature Gauge 🌡️**.
2. Drag it to the sensor's physical location on the floorplan (centre of the room works well).
3. **Entity** tab → connect to the room's temperature sensor entity
   (e.g. `sensor.living_room_temperature`).
4. **Actions** tab:
   - **Sensor type**: **🛋 Inside**
   - **Temperature unit**: °C or °F
   - **Heat radius**: adjust with the slider. This controls how far the gradient spreads from this sensor.
     - Small rooms: 10–20%
     - Large open areas: 25–40%
5. Save.

---

## Step 6 — Using the heatmap

On the dashboard (or in admin preview mode):

- **Click any temperature gauge** → the heatmap overlay appears.
- Indoor gauges pulse gently while the heatmap is visible.
- **Click the canvas** (anywhere that is not a hotspot) → heatmap dismisses.

---

## Tips and tuning

### Radius tuning

The **heat radius** is expressed as a fraction of the floorplan width. Two overlapping gradients blend together smoothly, so it is fine to set larger radii for sensors that cover multiple rooms.

Start with **25%** and increase if you want more coverage, or decrease for a more localised reading.

### No mask image

The heatmap still works without a mask, but the indoor/outdoor distinction is lost:
- The outdoor colour fills the entire background.
- Indoor gradients are drawn over the top without clipping.

This is useful for open-plan spaces or if you do not need exterior colouring.

### Unit consistency

The temperature unit set on each gauge must match what Home Assistant actually reports. If HA reports in °C but you set °F, the colour and display value will be wrong. Check your sensor entity in HA — the `unit_of_measurement` attribute shows the correct unit.

### Multiple floors

Create a separate floorplan for each floor. Each floorplan has its own mask and its own set of temperature gauges. The heatmap state (visible/hidden) is global per browser session — toggling on one floorplan will not affect another.

---

## Troubleshooting

| Symptom | Likely cause |
|------------------------------|----------------------------------------------|
| Heatmap shows no colour      | No temperature sensor entity linked, or     | 
|                              |  sensor is unavailable                       |
| Outside colour bleeds inside | Mask image has gaps — repaint the interior   |
|                              |  edges                                       |
| Inside colour bleeds outside | Mask is inverted — swap black/white in the.  |
|                              |  mask image                                  |
| Gradient colours look wrong  | Temperature unit mismatch — check °C vs °F   |
|                              |  on each gauge                               |
| Mask not loading             | Asset was deleted or CORS issue — re-upload  |
|                              |  and re-assign                               |
