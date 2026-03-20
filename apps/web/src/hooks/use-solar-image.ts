import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import SunCalc from "suncalc";
import { api } from "../api/client.ts";
import type { CycleImages } from "@floorplan-ha/shared";

/**
 * Returns the current floorplan asset ID to display based on time of day
 * relative to today's sunrise and sunset times at the HA home location.
 *
 * Day is split into 12 equal intervals (sunrise → sunset).
 * Night is split into 12 equal intervals (sunset → next sunrise).
 *
 * Falls back to the nearest populated slot if the exact slot is empty.
 * Falls back to any non-null image when HA config (lat/lon) is unavailable.
 * Re-evaluates every 60 seconds so the image advances at the correct time.
 */
export function useSolarImage(cycle: CycleImages | null): string | null {
  const { data: haConfig } = useQuery({
    queryKey: ["ha-config"],
    queryFn: () => api.ha.config(),
    staleTime: 60 * 60 * 1000, // 1 hour — location doesn't change
    retry: false,
  });

  const [assetId, setAssetId] = useState<string | null>(null);

  useEffect(() => {
    if (!cycle) {
      setAssetId(null);
      return;
    }

    // If HA config (lat/lon) isn't available, show the first populated image
    if (!haConfig) {
      const fallback = [...cycle.day, ...cycle.night].find((id) => id != null) ?? null;
      setAssetId(fallback);
      return;
    }

    function evaluate() {
      if (!cycle || !haConfig) return;

      const now = new Date();
      const times = SunCalc.getTimes(now, haConfig.latitude, haConfig.longitude);
      const sunrise = times.sunrise;
      const sunset = times.sunset;

      // Convert to minutes from midnight for arithmetic
      const toMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

      const nowMin = toMinutes(now);
      const riseMin = toMinutes(sunrise);
      const setMin = toMinutes(sunset);

      let idx: number;
      let phase: "day" | "night";

      if (nowMin >= riseMin && nowMin < setMin) {
        // Daytime
        const dayDuration = setMin - riseMin;
        const interval = dayDuration / 12;
        const elapsed = nowMin - riseMin;
        idx = Math.min(Math.floor(elapsed / interval), 11);
        phase = "day";
      } else {
        // Nighttime — night starts at sunset and wraps through midnight
        const dayDuration = setMin - riseMin;
        const nightDuration = 1440 - dayDuration;
        const interval = nightDuration / 12;
        // How many minutes since sunset (wrapping past midnight)
        const nightElapsed = nowMin >= setMin ? nowMin - setMin : nowMin + (1440 - setMin);
        idx = Math.min(Math.floor(nightElapsed / interval), 11);
        phase = "night";
      }

      // Use the exact slot if populated, otherwise scan outward for nearest filled slot
      const slots = cycle[phase];
      let result = slots[idx] ?? null;
      if (!result) {
        for (let offset = 1; offset <= 11 && !result; offset++) {
          result = slots[(idx + offset) % 12] ?? slots[(idx - offset + 12) % 12] ?? null;
        }
      }
      // Final fallback: check the other phase
      if (!result) {
        const other = phase === "day" ? cycle.night : cycle.day;
        result = other.find((id) => id != null) ?? null;
      }

      setAssetId(result);
    }

    evaluate();
    const timer = setInterval(evaluate, 60 * 1000);
    return () => clearInterval(timer);
  }, [cycle, haConfig]);

  return assetId;
}
