import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PowerSensor } from "@floorplan-ha/shared";
import { api } from "../api/client.ts";
import { fmtWatts, powerToColor } from "./power-utils.ts";
import { type Range, RANGES, buildBuckets, isoDate, sensorKind, usageKwh, PowerHistoryShell } from "./power-history-chart.tsx";

/** Usage history for one power sensor. See power-history-chart.tsx for the chart/shell. */

interface PowerHistoryModalProps {
  sensor: PowerSensor;
  /** Unit the sensor reports, e.g. "W", "kW", "kWh". */
  unit: string | undefined;
  /** Live draw in watts, or null when unavailable. */
  currentWatts: number | null;
  onClose: () => void;
}

export function PowerHistoryModal({ sensor, unit, currentWatts, onClose }: PowerHistoryModalProps) {
  const [range, setRange] = useState<Range>("days");

  const now = new Date();
  const rangeDef = RANGES.find((r) => r.key === range)!;
  const kind = sensorKind(unit);
  const buckets = buildBuckets(range, now);

  const { data, isLoading } = useQuery({
    queryKey: ["power-usage", sensor.entityId, range, isoDate(now)],
    queryFn: () =>
      api.ha.statistics(
        sensor.entityId,
        `${isoDate(buckets[0]!.start)}T00:00:00`,
        `${isoDate(now)}T23:59:59`,
        rangeDef.period,
        "mean,change",
      ),
    enabled: kind !== null,
    staleTime: 5 * 60 * 1000,
  });

  const values =
    kind === null
      ? null
      : usageKwh(data?.statistics ?? [], buckets, rangeDef.period, kind, unit ?? "", now);

  const accent = currentWatts !== null ? powerToColor(currentWatts, 1) : "#60a5fa";

  return (
    <PowerHistoryShell
      title={sensor.name}
      subtitle={rangeDef.heading}
      accent={accent}
      nowLabel="Now"
      nowValue={currentWatts !== null ? fmtWatts(currentWatts) : "—"}
      range={range}
      onRangeChange={setRange}
      buckets={buckets}
      supported={kind !== null}
      unsupportedMessage={`This sensor reports ${unit ? `"${unit}"` : "no unit"}. Usage history needs a power (W or kW) or energy (kWh or Wh) sensor.`}
      isLoading={isLoading}
      values={values}
      onClose={onClose}
    />
  );
}
