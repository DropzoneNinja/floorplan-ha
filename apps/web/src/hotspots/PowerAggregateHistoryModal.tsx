import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { EntityState, PowerSensor } from "@floorplan-ha/shared";
import { api } from "../api/client.ts";
import { fmtWatts, powerToColor, readWatts } from "./power-utils.ts";
import {
  type Range,
  RANGES,
  buildBuckets,
  isoDate,
  sensorKind,
  usageKwh,
  sumValues,
  PowerHistoryShell,
} from "./power-history-chart.tsx";

/**
 * Usage history combined across every power sensor on a hotspot: same chart
 * and layout as PowerHistoryModal, but each bar is the sum of all sensors'
 * usage for that period instead of just one sensor's.
 */

interface PowerAggregateHistoryModalProps {
  sensors: PowerSensor[];
  states: Record<string, EntityState | undefined>;
  onClose: () => void;
}

export function PowerAggregateHistoryModal({ sensors, states, onClose }: PowerAggregateHistoryModalProps) {
  const [range, setRange] = useState<Range>("days");

  const now = new Date();
  const rangeDef = RANGES.find((r) => r.key === range)!;
  const buckets = buildBuckets(range, now);

  let totalWatts: number | null = null;
  for (const sensor of sensors) {
    const watts = readWatts(states[sensor.entityId]);
    if (watts !== null) totalWatts = (totalWatts ?? 0) + watts;
  }

  const usable = sensors
    .map((sensor) => {
      const rawUnit = states[sensor.entityId]?.attributes.unit_of_measurement;
      const unit = typeof rawUnit === "string" ? rawUnit : undefined;
      return { sensor, unit, kind: sensorKind(unit) };
    })
    .filter((s): s is { sensor: PowerSensor; unit: string | undefined; kind: NonNullable<ReturnType<typeof sensorKind>> } => s.kind !== null);

  const results = useQueries({
    queries: usable.map(({ sensor }) => ({
      queryKey: ["power-usage", sensor.entityId, range, isoDate(now)],
      queryFn: () =>
        api.ha.statistics(
          sensor.entityId,
          `${isoDate(buckets[0]!.start)}T00:00:00`,
          `${isoDate(now)}T23:59:59`,
          rangeDef.period,
          "mean,change",
        ),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);

  const perSensorValues = usable.map(({ unit, kind }, i) =>
    usageKwh(results[i]?.data?.statistics ?? [], buckets, rangeDef.period, kind, unit ?? "", now),
  );
  const values = usable.length > 0 ? sumValues(perSensorValues) : null;

  const accent = totalWatts !== null ? powerToColor(totalWatts, 1) : "#60a5fa";

  return (
    <PowerHistoryShell
      title="All power sensors"
      subtitle={rangeDef.heading}
      accent={accent}
      nowLabel="Now"
      nowValue={totalWatts !== null ? fmtWatts(totalWatts) : "—"}
      range={range}
      onRangeChange={setRange}
      buckets={buckets}
      supported={usable.length > 0}
      unsupportedMessage="None of the configured power sensors report a power (W or kW) or energy (kWh or Wh) unit, so there's no combined usage history to show."
      isLoading={isLoading}
      values={values}
      onClose={onClose}
    />
  );
}
