/**
 * MDI icon paths for common Home Assistant entity domains.
 * Keys are MDI icon names (e.g. "mdi:lightbulb").
 * Paths are the SVG path `d` attribute for a 24×24 viewBox.
 */
export const ICON_PATHS: Record<string, string> = {
  // ── Lighting ──────────────────────────────────────────────────────────────
  "mdi:lightbulb":
    "M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26C17.81 13.47 19 11.38 19 9c0-3.87-3.13-7-7-7zm-1 14v-1h2v1h-2zm3-2.63V15h-4v-1.63C8.48 12.48 7 10.86 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.86-1.48 3.48-3 4.37z",
  "mdi:lightbulb-outline":
    "M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26C17.81 13.47 19 11.38 19 9c0-3.87-3.13-7-7-7zm-1 14v-1h2v1h-2zm3-2.63V15h-4v-1.63C8.48 12.48 7 10.86 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.86-1.48 3.48-3 4.37z",
  "mdi:ceiling-light":
    "M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2M11 14v-3H9V9h6v2h-2v3h-2z",
  "mdi:floor-lamp":
    "M11 2h2v2h-2V2m1 5c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2h2c0-2.21-1.79-4-4-4m-1 7h2v7h2v1H9v-1h2v-7z",
  "mdi:lamp":
    "M6 2h12l-6 9-6-9m6 9v11h-3v2h6v-2h-3V11",
  "mdi:led-strip-variant":
    "M2 6h2v2H2V6m4 0h2v2H6V6m4 0h2v2h-2V6m4 0h2v2h-2V6m4 0h2v2h-2V6M2 10h2v2H2v-2m4 0h2v2H6v-2m4 0h2v2h-2v-2m4 0h2v2h-2v-2m4 0h2v2h-2v-2M2 14h2v2H2v-2m4 0h2v2H6v-2m4 0h2v2h-2v-2m4 0h2v2h-2v-2m4 0h2v2h-2v-2",
  "mdi:string-lights":
    "M3.5 4.5A1.5 1.5 0 0 1 5 6a1.5 1.5 0 0 1-1.5 1.5A1.5 1.5 0 0 1 2 6a1.5 1.5 0 0 1 1.5-1.5M8.5 4.5A1.5 1.5 0 0 1 10 6a1.5 1.5 0 0 1-1.5 1.5A1.5 1.5 0 0 1 7 6a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 15 6a1.5 1.5 0 0 1-1.5 1.5A1.5 1.5 0 0 1 12 6a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 20 6a1.5 1.5 0 0 1-1.5 1.5A1.5 1.5 0 0 1 17 6a1.5 1.5 0 0 1 1.5-1.5M2 2h20v2H2V2m0 18h20v2H2v-2m1-7h18v4H3v-4z",
  "mdi:spotlight":
    "M5.41 6L4 7.41 6.29 9.7A9.01 9.01 0 0 0 4 15h16a9 9 0 0 0-2.29-5.3L20 7.41 18.59 6 16.3 8.29A8.96 8.96 0 0 0 12 7a8.96 8.96 0 0 0-4.3 1.29L5.41 6M13 2h-2v3h2V2z",

  // ── Switches & Controls ───────────────────────────────────────────────────
  "mdi:power":
    "M16.56 5.44l-1.45 1.45A5.969 5.969 0 0 1 18 12a6 6 0 0 1-6 6 6 6 0 0 1-6-6c0-2.17 1.16-4.06 2.89-5.11L7.44 5.44A7.961 7.961 0 0 0 4 12a8 8 0 0 0 8 8 8 8 0 0 0 8-8c0-2.72-1.36-5.12-3.44-6.56zM13 3h-2v10h2V3z",
  "mdi:toggle-switch":
    "M17 6H7c-3.31 0-6 2.69-6 6s2.69 6 6 6h10c3.31 0 6-2.69 6-6s-2.69-6-6-6zm0 10H7c-2.21 0-4-1.79-4-4s1.79-4 4-4h10c2.21 0 4 1.79 4 4s-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  "mdi:toggle-switch-off":
    "M17 6H7c-3.31 0-6 2.69-6 6s2.69 6 6 6h10c3.31 0 6-2.69 6-6s-2.69-6-6-6zm0 10H7c-2.21 0-4-1.79-4-4s1.79-4 4-4h10c2.21 0 4 1.79 4 4s-1.79 4-4 4zM7 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  "mdi:light-switch":
    "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-7 3a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2m0 12a4 4 0 0 1-4-4 4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4z",
  "mdi:light-switch-off":
    "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2M12 6a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2m-4 9a4 4 0 0 1 4-4 4 4 0 0 1 4 4H8z",
  "mdi:gesture-tap-button":
    "M5 3h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 0 2-2m7 1.5A3.5 3.5 0 0 0 8.5 8 3.5 3.5 0 0 0 12 11.5 3.5 3.5 0 0 0 15.5 8 3.5 3.5 0 0 0 12 4.5M9 17l3 4 3-4H9z",
  "mdi:button-pointer":
    "M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m8 4a6 6 0 0 0-6 6 6 6 0 0 0 6 6 6 6 0 0 0 6-6 6 6 0 0 0-6-6m0 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z",

  // ── Plugs & Outlets ───────────────────────────────────────────────────────
  "mdi:power-plug":
    "M16 7V3h-2v4h-4V3H8v4c0 2.33 1.67 4.31 4 4.9V22h2v-10.1c2.33-.59 4-2.57 4-4.9z",
  "mdi:power-plug-off":
    "M20.84 22.73L16.06 17.95C15.6 19.25 14.4 20.19 13 20.41V22h-2v-1.59c-2.33-.59-4-2.57-4-4.91V11.5h.5l-3.77-3.78 1.42-1.41L20.84 22.73M8 7V3h2v4h.5L16 12.5V12H8.5L8 7M16 9.85V7h-2v.85L16 9.85z",
  "mdi:power-socket":
    "M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-2 7a1 1 0 0 1 1 1 1 1 0 0 1-1 1 1 1 0 0 1-1-1 1 1 0 0 1 1-1m4 0a1 1 0 0 1 1 1 1 1 0 0 1-1 1 1 1 0 0 1-1-1 1 1 0 0 1 1-1m-4 4h4a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2 2 2 0 0 1 2-2z",
  "mdi:power-socket-eu":
    "M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1.5 5.5a1.5 1.5 0 0 1 1.5 1.5 1.5 1.5 0 0 1-1.5 1.5A1.5 1.5 0 0 1 9 9a1.5 1.5 0 0 1 1.5-1.5m3 0A1.5 1.5 0 0 1 15 9a1.5 1.5 0 0 1-1.5 1.5A1.5 1.5 0 0 1 12 9a1.5 1.5 0 0 1 1.5-1.5M12 13a4 4 0 0 1 4 4H8a4 4 0 0 1 4-4z",

  // ── Doors & Windows ───────────────────────────────────────────────────────
  "mdi:door":
    "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h8V5H8zm5 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
  "mdi:door-open":
    "M14 2v20l-7-2V4l7-2m0 0l5 2v16l-5 2V2M9 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
  "mdi:window-closed":
    "M3 3h18v18H3V3m2 2v14h14V5H5m6 2h2v4h2l-3 3-3-3h2V7z",
  "mdi:window-open":
    "M3 3h18v18H3V3m2 2v14h14V5H5m3 2h8l-4 4-4-4z",
  "mdi:garage":
    "M19 20H5V9l7-7 7 7v11zm-7-9c-1.1 0-2 .9-2 2v4h4v-4c0-1.1-.9-2-2-2z",
  "mdi:gate":
    "M3 14v-4h4V7l4-4 4 4v3h4v4h-2v5h-4v-5H9v5H5v-5H3z",
  "mdi:curtains":
    "M3 2v2h1v16H3v2h18v-2h-1V4h1V2H3m4 2h2v16H7V4m4 0h2v16h-2V4m4 0h2v16h-2V4z",

  // ── Climate & HVAC ────────────────────────────────────────────────────────
  "mdi:thermometer":
    "M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0m-3 5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z",
  "mdi:thermostat":
    "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
  "mdi:air-conditioner":
    "M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22v-2z",
  "mdi:radiator":
    "M5 4v3h5V4h4v3h5v4h-5V8h-4v3H5V8H2V4h3m-3 7h3v2H2v-2m18-7h3v4h-3V4z",
  "mdi:heat-wave":
    "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41M4 10.5H1v2h3v-2m9-9.95h-2V3.5h2V.55m7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79m-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4M20 10.5v2h3v-2h-3m-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6m-1 16.95h2V19.5h-2v2.95m-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z",

  // ── Fans ──────────────────────────────────────────────────────────────────
  "mdi:fan":
    "M12 11a1 1 0 0 1 1 1 1 1 0 0 1-1 1 1 1 0 0 1-1-1 1 1 0 0 1 1-1m0-9A10 10 0 0 1 22 12 10 10 0 0 1 12 22 10 10 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8c0 1.38.35 2.67.97 3.8L7.5 13c-.63-.84-1-1.87-1-3 0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.13-.37 2.16-1 3l2.53 2.8C19.65 14.67 20 13.38 20 12a8 8 0 0 0-8-8z",
  "mdi:fan-off":
    "M12 11a1 1 0 0 1 1 1c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1m10.11 1c-.55 2.95-2.58 5.39-5.25 6.59L14 15.82c.63-.84 1-1.87 1-3a5 5 0 0 0-5-5c-1.13 0-2.16.37-3 1L4.18 6.14C6.04 4.21 8.72 3.08 11.71 3c4.15-.06 7.8 2.58 9.1 6.53.22.79.27 1 .3 1.47M2.39 1.73L1.11 3l3.41 3.41C3.34 8.07 2.44 9.95 2 12c.55 2.95 2.58 5.39 5.25 6.59L10 15.82c-.63-.84-1-1.87-1-3a5 5 0 0 1 5-5c1.13 0 2.16.37 3 1L20.73 12l1.27-1.27L2.39 1.73z",
  "mdi:ceiling-fan":
    "M12 11a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1M5 2h6v6c-1.1 0-2.09.37-2.86.96L5 5.83V2m8 0h6v3.83l-3.14 3.13A4.95 4.95 0 0 0 13 8V2m-1 12c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1m0 3a4 4 0 0 1-4-4 4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4m0 5v-3.17A4 4 0 0 0 16 15.83V19h3v2H5v-2h3v-3.17A4 4 0 0 0 12 14v3.83",

  // ── Sensors ───────────────────────────────────────────────────────────────
  "mdi:motion-sensor":
    "M11.5 2C8.47 2 6 4.47 6 7.5c0 2.14 1.21 3.99 3 4.97V22h5v-9.53c1.79-.98 3-2.83 3-4.97C17 4.47 14.53 2 11.5 2zm1.5 9.29V20h-3v-8.71C8.26 10.8 7 9.27 7 7.5 7 5.01 9.01 3 11.5 3S16 5.01 16 7.5c0 1.77-1.26 3.3-3 3.79z",
  "mdi:smoke-detector":
    "M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 2a8 8 0 0 1 8 8 8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8m0 3a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5m0 2a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3m0 2a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1z",
  "mdi:water-alert":
    "M12 3.77l5.25 7A5.25 5.25 0 1 1 6.75 10.77l5.25-7M12 1L5.33 10a7.25 7.25 0 1 0 13.34 0L12 1m-1 11h2v2h-2v-2m0-6h2v4h-2V6z",
  "mdi:leak":
    "M14.12 14.12A3 3 0 0 1 12 15a3 3 0 0 1-3-3 3 3 0 0 1 .88-2.12m1.6-1.6A3 3 0 0 1 12 8a3 3 0 0 1 3 3 3 3 0 0 1-.12.88M21.17 8c.11.64.17 1.31.17 2s-.06 1.36-.17 2m-1.83 3.83c-.47 1-1.1 1.94-1.9 2.73M13 2.05c.68.07 1.35.2 2 .39m-3 0A9.93 9.93 0 0 1 14 2m0 20a9.93 9.93 0 0 1-4-.76m-5.24-4.24A9.94 9.94 0 0 1 2 12c0-.69.07-1.36.17-2m1.66-3.83C4.79 5.1 5.75 4.26 6.83 3.66M11 2.05c-.68.07-1.35.2-2 .39M2.83 14c.47 1 1.1 1.94 1.9 2.73M3 12l-1 1 1 1M21 12l1 1-1 1",
  "mdi:co2":
    "M14 13h1.5v1.5H14V13m-9 0h1.5v1.5H5V13M3 9h18v11H3V9m2 2v7h14v-7H5m2.5 2h2v1h-2v2H10v-5H7.5V13M15.5 13h-2v5h2v-1.5h1.5V15H15.5v-2z",
  "mdi:water":
    "M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2m2.5 11.5a2.5 2.5 0 0 0-2.5 2.5A2.5 2.5 0 0 0 14.5 18.5a2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5m-5-3A2.5 2.5 0 0 0 7 13a2.5 2.5 0 0 0 2.5 2.5A2.5 2.5 0 0 0 12 13a2.5 2.5 0 0 0-2.5-2.5m5-5A2.5 2.5 0 0 0 10 8a2.5 2.5 0 0 0 2.5 2.5A2.5 2.5 0 0 0 15 8a2.5 2.5 0 0 0-2.5-2.5z",

  // ── Security ──────────────────────────────────────────────────────────────
  "mdi:shield":
    "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
  "mdi:shield-home":
    "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93C9.33 17.79 7 14.5 7 11V7.18L12 5zm0 2L9 8.09V11c0 2.06 1 3.87 3 5.4 2-1.53 3-3.34 3-5.4V8.09L12 7z",
  "mdi:camera":
    "M4 4h3l2-2h6l2 2h3c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm8 3c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z",
  "mdi:doorbell":
    "M5 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5m7 3a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2 2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0-2-2m-5 8h10v2H7v-2z",
  "mdi:alarm-light":
    "M11 6H8L12 2l4 4h-3v8h-2V6M8 16h8l2 2H6l2-2m13 3H3v3h18v-3z",

  // ── Locks ─────────────────────────────────────────────────────────────────
  "mdi:lock":
    "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  "mdi:lock-open":
    "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",

  // ── Covers & Blinds ───────────────────────────────────────────────────────
  "mdi:blinds":
    "M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z",
  "mdi:blinds-open":
    "M3 3h18v2H3V3zm16 4H5v2h14V7zm0 4H5v2h14v-2zm0 4H5v2h14v-2zm0 4H5v2h14v-2z",
  "mdi:roller-shade":
    "M3 2h18a1 1 0 0 1 1 1v2H2V3a1 1 0 0 1 1-1m0 5v15h18V7H3m8 2h2v11h-2V9z",
  "mdi:roller-shade-closed":
    "M2 3v2h20V3H2m0 4v15h20V7H2z",

  // ── Media Players ─────────────────────────────────────────────────────────
  "mdi:speaker":
    "M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  "mdi:television":
    "M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z",
  "mdi:cast":
    "M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5c-1.1 0-2 .9-2 2v3h2v-3h14v12h-5v2h5c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9 9.5a4.5 4.5 0 0 1 4.5 4.5H13a2 2 0 0 0-2 2h-.5a4 4 0 0 1-4-4v-.5a4.5 4.5 0 0 1 4.5-4.5z",
  "mdi:remote":
    "M13 9h-2V7h2v2m0 2h-2v2h2v-2m4-9H7c-1.11 0-2 .89-2 2v18c0 1.11.89 2 2 2h10c1.11 0 2-.89 2-2V4c0-1.11-.89-2-2-2m0 2v4H7V4h10M7 22V10h10v12H7m4-6h-2v2h2v-2m0 4h-2v2h2v-2m4-4h-2v2h2v-2m0 4h-2v2h2v-2z",

  // ── Appliances ────────────────────────────────────────────────────────────
  "mdi:washing-machine":
    "M2 2h20v20H2V2m2 2v16h16V4H4m8 1a7 7 0 0 1 7 7 7 7 0 0 1-7 7A7 7 0 0 1 5 12a7 7 0 0 1 7-7m0 2a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5m-2.5 1.5a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 9.5 13.5 2.5 2.5 0 0 1 7 11a2.5 2.5 0 0 1 2.5-2.5z",
  "mdi:dishwasher":
    "M2 2h20v20H2V2m2 2v16h16V4H4m2 1h12v2H6V5m0 4h12v8H6V9m2 2v4h8v-4H8z",
  "mdi:microwave":
    "M3 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3m0 2h14v12H3V6m16 0h2v4h-2V6m0 6h2v2h-2v-2m0 4h2v2h-2v-2M7 8v8l5-4-5-4z",
  "mdi:coffee-maker":
    "M3 2h6a2 2 0 0 1 2 2 2 2 0 0 1-2 2H5v2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5v4H3V2m2 2v4h4V4H5m0 6v2h4v-2H5m10-8h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m0 2v14h4V4h-4m1 1h2v2h-2V5m0 4h2v2h-2V9z",
  "mdi:fridge":
    "M7 2h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m0 8v10h10V10H7m0-2h10V4H7v4m4 3v5H9v-5h2m0-5V6H9v2h2z",
  "mdi:robot-vacuum":
    "M12 2A10 10 0 0 1 22 12 10 10 0 0 1 12 22 10 10 0 0 1 2 12 10 10 0 0 1 12 2m0 2A8 8 0 0 0 4 12a8 8 0 0 0 8 8 8 8 0 0 0 8-8 8 8 0 0 0-8-8m0 3a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m-2 4v2h4v-2h-4z",

  // ── Water & Plumbing ──────────────────────────────────────────────────────
  "mdi:shower":
    "M9.33 11.5c.28.43.67.76 1.17 1H2v-1h7.33M17 5.08V2h-2v3.08C12.19 5.55 10 7.98 10 11v1h8v-1c0-3.02-2.19-5.45-5-5.92M10 13v9h2v-9h-2m4 0v9h2v-9h-2M6.11 8.04C4.78 9.1 4 10.63 4 12.5c0 2.27 1.08 4.28 2.75 5.55l1.26-1.68C6.82 15.46 6 14.08 6 12.5c0-1.13.44-2.16 1.11-2.96L6.11 8.04z",
  "mdi:bathtub":
    "M16 10h-2V5h-4v5H8C5.24 10 3 12.24 3 15v3h18v-3c0-2.76-2.24-5-5-5zM11 5h2v5h-2V5zM5 17h14v1H5v-1z",
  "mdi:water-pump":
    "M2 12h2V6h1V4H3a1 1 0 0 0-1 1v7M7 4v2h1v6H6v2h4v-2H8V6h1V4H7m10 0c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5m0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z",
  "mdi:water-heater":
    "M10 2h4v3a5.97 5.97 0 0 1 3.94 2.56L20 6.5l-1 1.73-2.06-1.19A6.02 6.02 0 0 1 18 9H6a6.02 6.02 0 0 1 1.06-1.96L5 8.23 4 6.5l2.06-1.94A5.97 5.97 0 0 1 10 5V2m-6 9h16a6 6 0 0 1-6 6v5h-4v-5a6 6 0 0 1-6-6z",

  // ── Energy & Network ──────────────────────────────────────────────────────
  "mdi:solar-panel":
    "M4 2h16a2 2 0 0 1 2 2v7H2V4a2 2 0 0 1 2-2M2 13h20v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7m4-9v7h4V4H6m6 0v7h4V4h-4m6 0v7h2V4h-2M6 13v7h4v-7H6m6 0v7h4v-7h-4m6 0v7h2v-7h-2z",
  "mdi:lightning-bolt":
    "M7 2v11h3v9l7-12h-4l4-8z",
  "mdi:battery":
    "M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z",
  "mdi:meter-electric":
    "M9 9.5H7V14h2V9.5m0 6H7V17h2v-1.5m0-11H7v2h2v-2M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6v-2H5V5h14v14h-6v2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5m7 4l-2 4h3l-2 6 5-7h-3l2-3h-3z",
  "mdi:wifi":
    "M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 0 0-6 0zm-4-4 2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z",
  "mdi:router-wireless":
    "M3.31 11.28L5.6 13.57C7.16 12 9.42 11 12 11s4.84 1 6.4 2.57l2.29-2.29C18.54 9.13 15.42 8 12 8s-6.54 1.13-8.69 2.28m-2.29-2.3C3.63 7.13 7.6 6 12 6s8.37 1.13 11 2.97l-2.29 2.3C18.66 9.7 15.49 8.5 12 8.5S5.34 9.7 3.29 11.27L1 8.98m9 13.02v-4h4v4h-2v2h-2v-2m2-4c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",

  // ── Presence & People ─────────────────────────────────────────────────────
  "mdi:home":
    "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  "mdi:account":
    "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  "mdi:human":
    "M12 2a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2m-1 5h2l1 5-1 1v6h-2v-4h-.2L10 15v4H8V13l-1-1 1-5h2m5 0c1.1 0 2 .9 2 2v3h-2V9h-1l-1-2h2z",
  "mdi:dog":
    "M4.5 11H3L2 10l1-1h2l.5.5L8 8l1 1v2L7 12v2h1l.5.5v2.5h-1.5l-.5-.5V15L5 14H4v1l-.5.5H2v-1.5L2.5 13H4l.5-1V11m15.5-1h-3c-.83 0-1.5.67-1.5 1.5V13h-1.5v1.5H15v1.5h1V19h1l1-1v-2l2-2 1-1v-1l-1-1m-9 0H8l-1.5 1.5V13h1.5v5H9v.5h1.5v-2L11 16l.5-1.5v-2L11 11m2 1l-.5 1.5v2l.5 1.5h1l.5-1.5v-2L14 12h-1z",

  // Generic fallback
  default:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z",
};

/** Organized icon categories for the icon picker UI */
export interface IconCategory {
  label: string;
  icons: Array<{ key: string; label: string }>;
}

export const ICON_CATEGORIES: IconCategory[] = [
  {
    label: "Lighting",
    icons: [
      { key: "mdi:lightbulb", label: "Bulb" },
      { key: "mdi:lightbulb-outline", label: "Bulb outline" },
      { key: "mdi:ceiling-light", label: "Ceiling light" },
      { key: "mdi:floor-lamp", label: "Floor lamp" },
      { key: "mdi:lamp", label: "Lamp" },
      { key: "mdi:led-strip-variant", label: "LED strip" },
      { key: "mdi:string-lights", label: "String lights" },
      { key: "mdi:spotlight", label: "Spotlight" },
    ],
  },
  {
    label: "Switches & Buttons",
    icons: [
      { key: "mdi:power", label: "Power" },
      { key: "mdi:toggle-switch", label: "Toggle on" },
      { key: "mdi:toggle-switch-off", label: "Toggle off" },
      { key: "mdi:light-switch", label: "Light switch" },
      { key: "mdi:light-switch-off", label: "Switch off" },
      { key: "mdi:gesture-tap-button", label: "Tap button" },
      { key: "mdi:button-pointer", label: "Button" },
    ],
  },
  {
    label: "Plugs & Outlets",
    icons: [
      { key: "mdi:power-plug", label: "Plug" },
      { key: "mdi:power-plug-off", label: "Plug off" },
      { key: "mdi:power-socket", label: "Socket" },
      { key: "mdi:power-socket-eu", label: "Socket EU" },
    ],
  },
  {
    label: "Climate",
    icons: [
      { key: "mdi:thermometer", label: "Thermometer" },
      { key: "mdi:thermostat", label: "Thermostat" },
      { key: "mdi:air-conditioner", label: "AC" },
      { key: "mdi:radiator", label: "Radiator" },
      { key: "mdi:heat-wave", label: "Heat" },
    ],
  },
  {
    label: "Fans",
    icons: [
      { key: "mdi:fan", label: "Fan" },
      { key: "mdi:fan-off", label: "Fan off" },
      { key: "mdi:ceiling-fan", label: "Ceiling fan" },
    ],
  },
  {
    label: "Doors & Windows",
    icons: [
      { key: "mdi:door", label: "Door" },
      { key: "mdi:door-open", label: "Door open" },
      { key: "mdi:window-closed", label: "Window closed" },
      { key: "mdi:window-open", label: "Window open" },
      { key: "mdi:garage", label: "Garage" },
      { key: "mdi:gate", label: "Gate" },
      { key: "mdi:curtains", label: "Curtains" },
    ],
  },
  {
    label: "Covers & Blinds",
    icons: [
      { key: "mdi:blinds", label: "Blinds closed" },
      { key: "mdi:blinds-open", label: "Blinds open" },
      { key: "mdi:roller-shade", label: "Roller shade" },
    ],
  },
  {
    label: "Sensors",
    icons: [
      { key: "mdi:motion-sensor", label: "Motion" },
      { key: "mdi:smoke-detector", label: "Smoke" },
      { key: "mdi:water-alert", label: "Water alert" },
      { key: "mdi:leak", label: "Leak" },
      { key: "mdi:co2", label: "CO₂" },
      { key: "mdi:water", label: "Water" },
    ],
  },
  {
    label: "Security",
    icons: [
      { key: "mdi:shield", label: "Shield" },
      { key: "mdi:shield-home", label: "Shield home" },
      { key: "mdi:lock", label: "Lock" },
      { key: "mdi:lock-open", label: "Lock open" },
      { key: "mdi:camera", label: "Camera" },
      { key: "mdi:doorbell", label: "Doorbell" },
      { key: "mdi:alarm-light", label: "Alarm" },
    ],
  },
  {
    label: "Media",
    icons: [
      { key: "mdi:speaker", label: "Speaker" },
      { key: "mdi:television", label: "TV" },
      { key: "mdi:cast", label: "Cast" },
      { key: "mdi:remote", label: "Remote" },
    ],
  },
  {
    label: "Appliances",
    icons: [
      { key: "mdi:washing-machine", label: "Washer" },
      { key: "mdi:dishwasher", label: "Dishwasher" },
      { key: "mdi:microwave", label: "Microwave" },
      { key: "mdi:coffee-maker", label: "Coffee" },
      { key: "mdi:fridge", label: "Fridge" },
      { key: "mdi:robot-vacuum", label: "Robot vacuum" },
    ],
  },
  {
    label: "Water",
    icons: [
      { key: "mdi:shower", label: "Shower" },
      { key: "mdi:bathtub", label: "Bathtub" },
      { key: "mdi:water-pump", label: "Water pump" },
      { key: "mdi:water-heater", label: "Water heater" },
    ],
  },
  {
    label: "Energy & Network",
    icons: [
      { key: "mdi:solar-panel", label: "Solar" },
      { key: "mdi:lightning-bolt", label: "Lightning" },
      { key: "mdi:battery", label: "Battery" },
      { key: "mdi:meter-electric", label: "Meter" },
      { key: "mdi:wifi", label: "WiFi" },
      { key: "mdi:router-wireless", label: "Router" },
    ],
  },
  {
    label: "Presence",
    icons: [
      { key: "mdi:home", label: "Home" },
      { key: "mdi:account", label: "Person" },
      { key: "mdi:human", label: "Human" },
      { key: "mdi:dog", label: "Pet" },
    ],
  },
];
