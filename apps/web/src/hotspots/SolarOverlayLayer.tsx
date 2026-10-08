import { useShallow } from "zustand/react/shallow";
import type { EntityState, SolarConfig, SolarPanel } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { ICON_PATHS } from "./icons.ts";
import { fmtWatts, readWatts, computeHouseConsumption, SOLAR_COLOR, GRID_IMPORT_COLOR, GRID_EXPORT_COLOR, CONSUMPTION_COLOR, IDLE_COLOR } from "./solar-utils.ts";

interface SolarOverlayLayerProps {
  hotspots: HotspotRaw[];
  imageBounds?: ImageFitBounds;
}

/** Minimum watts (either sign) before a wire is considered "active" and animates. */
const FLOW_THRESHOLD = 5;

/**
 * Always-on floorplan overlay for Solar hotspots.
 *
 * Unlike Power/Powerpoint/Music, there is no master icon or toggle — every
 * placed panel, the junction box, the house box, and the grid box are drawn
 * directly at their configured positions, every time the floorplan is shown.
 */
export function SolarOverlayLayer({ hotspots, imageBounds = FULL_BOUNDS }: SolarOverlayLayerProps) {
  const solarHotspots = hotspots.filter((h) => h.type === "solar");
  if (solarHotspots.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      // Power/Battery/Powerpoint elevate their heatmap/pins overlay to
      // triggeredByZIndex - 1 while open, which would otherwise paint over this
      // always-on layer's boxes — including lines like the Power hotspot's house
      // connector, which should run *behind* the boxes, not across them. 40 keeps
      // Solar above any realistic hotspot zIndex, but — importantly — still below
      // the z-50 convention nearly every modal in this app uses (history graphs,
      // blind/light controls, weather details, etc.), which must stay on top.
      // Music is the one overlay that goes further (triggeredByZIndex + 1000); its
      // own control dialog already compensates for that with zIndex 5000, so Solar
      // doesn't need to chase it too.
      style={{ zIndex: 40 }}
    >
      <div
        style={{
          position: "absolute",
          left: `${imageBounds.x * 100}%`,
          top: `${imageBounds.y * 100}%`,
          width: `${imageBounds.width * 100}%`,
          height: `${imageBounds.height * 100}%`,
        }}
      >
        {solarHotspots.map((hotspot) => (
          <SolarSystem key={hotspot.id} hotspot={hotspot} />
        ))}
      </div>
    </div>
  );
}

function SolarSystem({ hotspot }: { hotspot: HotspotRaw }) {
  const config = hotspot.configJson as unknown as SolarConfig;
  const panels = config.panels ?? [];
  const panelWidth = config.panelWidth ?? 0.05;
  const panelHeight = config.panelHeight ?? 0.08;
  const junctionBox = config.junctionBox ?? null;
  const houseBox = config.houseBox ?? null;
  const gridBox = config.gridBox ?? null;

  const entityIds = [
    ...panels.map((p) => p.entityId),
    ...(gridBox?.entityId ? [gridBox.entityId] : []),
  ];
  const states = useEntityStateStore(
    useShallow((s): Record<string, EntityState | undefined> =>
      Object.fromEntries(entityIds.map((id) => [id, s.getState(id)])),
    ),
  );

  const { solarTotal, gridWatts, consumption } = computeHouseConsumption(config, (id) => states[id]);

  return (
    <>
      {/* Wires drawn first so boxes/panels sit on top */}
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {junctionBox && houseBox && (
          <Wire
            from={junctionBox}
            to={houseBox}
            watts={solarTotal}
            color={SOLAR_COLOR}
            idleColor={IDLE_COLOR}
          />
        )}
        {gridBox && houseBox && (
          <Wire
            from={(gridWatts ?? 0) < 0 ? houseBox : gridBox}
            to={(gridWatts ?? 0) < 0 ? gridBox : houseBox}
            watts={gridWatts}
            color={(gridWatts ?? 0) < 0 ? GRID_EXPORT_COLOR : GRID_IMPORT_COLOR}
            idleColor={IDLE_COLOR}
          />
        )}
      </svg>

      {panels.map((panel) => (
        <PanelTile key={panel.id} panel={panel} width={panelWidth} height={panelHeight} watts={readWatts(states[panel.entityId])} />
      ))}

      {/* Each box's share of the house's total incoming power (solar + grid import − export) */}
      {junctionBox && (
        <JunctionBoxBadge
          x={junctionBox.x} y={junctionBox.y} watts={solarTotal}
          pct={solarTotal !== null && consumption !== null && consumption > 0 ? (solarTotal / consumption) * 100 : null}
        />
      )}
      {houseBox && <HouseBoxBadge x={houseBox.x} y={houseBox.y} watts={consumption} />}
      {gridBox && (
        <GridBoxBadge
          x={gridBox.x} y={gridBox.y} watts={gridWatts} hasEntity={gridBox.entityId !== null}
          pct={gridWatts !== null && consumption !== null && consumption > 0 ? (Math.abs(gridWatts) / consumption) * 100 : null}
        />
      )}
    </>
  );
}

// ─── Wire ───────────────────────────────────────────────────────────────────

function Wire({
  from,
  to,
  watts,
  color,
  idleColor,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  watts: number | null;
  color: string;
  idleColor: string;
}) {
  const midX = (from.x + to.x) / 2;
  const d = `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
  const isActive = watts !== null && Math.abs(watts) >= FLOW_THRESHOLD;

  return (
    <path
      d={d}
      fill="none"
      stroke={isActive ? color : idleColor}
      strokeWidth={3}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      opacity={isActive ? 0.9 : 0.35}
      className={isActive ? "wire-flow" : undefined}
    />
  );
}

// ─── Panel tile ───────────────────────────────────────────────────────────────

function PanelTile({
  panel,
  width,
  height,
  watts,
}: {
  panel: SolarPanel;
  width: number;
  height: number;
  watts: number | null;
}) {
  return (
    <div
      className="absolute flex flex-col items-center justify-center overflow-hidden rounded-[2px] border border-sky-200/40"
      style={{
        left: `${panel.x * 100}%`,
        top: `${panel.y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        background:
          "linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)," +
          "repeating-linear-gradient(0deg, transparent 0, transparent calc(25% - 1px), rgba(148,197,255,0.35) calc(25% - 1px), rgba(148,197,255,0.35) 25%)," +
          "repeating-linear-gradient(90deg, transparent 0, transparent calc(33% - 1px), rgba(148,197,255,0.35) calc(33% - 1px), rgba(148,197,255,0.35) 33%)",
        containerType: "size",
      }}
    >
      <span
        style={{
          fontSize: "max(7px, 20cqmin)",
          fontWeight: 700,
          color: "#ffffff",
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {watts !== null ? fmtWatts(watts) : "—"}
      </span>
    </div>
  );
}

// ─── Boxes ────────────────────────────────────────────────────────────────────

function Badge({
  x,
  y,
  icon,
  color,
  label,
  sublabel,
  pct,
}: {
  x: number;
  y: number;
  icon: string;
  color: string;
  label: string;
  sublabel?: string;
  /** This box's share of the house's total incoming power, 0–100. Omit to hide. */
  pct?: number | null;
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        background: "rgba(15,23,42,0.85)",
        border: `2px solid ${color}`,
        boxShadow: `0 0 10px ${color}55`,
        backdropFilter: "blur(4px)",
        minWidth: 44,
        minHeight: 44,
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, color }}>
        <path d={ICON_PATHS[icon] ?? ICON_PATHS["default"]} fill="currentColor" />
      </svg>
      <span style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>
        {label}
      </span>
      {sublabel && (
        <span style={{ color: "#9ca3af", fontSize: 10, lineHeight: 1, whiteSpace: "nowrap" }}>{sublabel}</span>
      )}
      {pct !== null && pct !== undefined && (
        <span style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1, whiteSpace: "nowrap" }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

function JunctionBoxBadge({ x, y, watts, pct }: { x: number; y: number; watts: number | null; pct: number | null }) {
  return (
    <Badge
      x={x}
      y={y}
      icon="mdi:solar-panel"
      color={watts !== null && watts > 0 ? SOLAR_COLOR : IDLE_COLOR}
      label={watts !== null ? fmtWatts(watts) : "—"}
      sublabel="Solar"
      pct={pct}
    />
  );
}

function HouseBoxBadge({ x, y, watts }: { x: number; y: number; watts: number | null }) {
  return (
    <Badge
      x={x}
      y={y}
      icon="mdi:home"
      color={watts !== null ? CONSUMPTION_COLOR : IDLE_COLOR}
      label={watts !== null ? fmtWatts(watts) : "—"}
      sublabel="Home"
    />
  );
}

function GridBoxBadge({
  x, y, watts, hasEntity, pct,
}: {
  x: number; y: number; watts: number | null; hasEntity: boolean; pct: number | null;
}) {
  const exporting = watts !== null && watts < 0;
  const color = !hasEntity ? IDLE_COLOR : exporting ? GRID_EXPORT_COLOR : GRID_IMPORT_COLOR;
  return (
    <Badge
      x={x}
      y={y}
      icon="mdi:meter-electric"
      color={color}
      label={watts !== null ? fmtWatts(Math.abs(watts)) : "—"}
      sublabel={!hasEntity ? "Grid" : exporting ? "Export" : "Import"}
      pct={pct}
    />
  );
}
