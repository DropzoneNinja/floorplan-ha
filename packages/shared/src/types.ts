// ─── Domain Models ────────────────────────────────────────────────────────────

export type UserRole = "admin" | "viewer";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FloorplanImageMode = "single" | "day_night_cycle" | "none";

export interface CycleImages {
  day: (string | null)[];   // 12 asset IDs (index 0 = dawn, 11 = dusk)
  night: (string | null)[]; // 12 asset IDs (index 0 = after sunset, 11 = pre-dawn)
}

export interface Floorplan {
  id: string;
  dashboardId: string;
  name: string;
  imageMode: FloorplanImageMode;
  imageStretch: boolean;
  imageAssetId: string | null;
  cycleImages: CycleImages;
  width: number;
  height: number;
  backgroundColor: string;
  /** Asset ID of the heatmap mask PNG (white=interior, black/transparent=exterior). */
  heatmapMaskAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Hotspot ──────────────────────────────────────────────────────────────────

export type HotspotType =
  | "action"
  | "text"
  | "state_image"
  | "state_icon"
  | "badge"
  | "scene"
  | "blind"
  | "bins"
  | "custom"
  | "weather"
  | "temperature_gauge"
  | "windrose"
  | "battery";

export interface HotspotPosition {
  /** Normalized 0–1 (percentage of floorplan width) */
  x: number;
  /** Normalized 0–1 (percentage of floorplan height) */
  y: number;
  /** Normalized 0–1 */
  width: number;
  /** Normalized 0–1 */
  height: number;
  rotation: number;
  zIndex: number;
}

export interface Hotspot {
  id: string;
  floorplanId: string;
  name: string;
  type: HotspotType;
  position: HotspotPosition;
  entityId: string | null;
  config: HotspotConfig;
  createdAt: string;
  updatedAt: string;
}

// ─── Hotspot Configs (per type) ───────────────────────────────────────────────

export interface ActionConfig {
  tapAction: ServiceCall | null;
  holdAction: ServiceCall | null;
  doubleTapAction: ServiceCall | null;
  icon: string | null;
  /** Icon key shown when entity state is "on/open/active". Falls back to `icon` if null. */
  onIcon: string | null;
  /** Icon key shown when entity state is "off/closed". Falls back to `icon` if null. */
  offIcon: string | null;
  /** Fill color for the icon when entity is on. Uses CSS currentColor if null. */
  onColor: string | null;
  /** Fill color for the icon when entity is off. Uses CSS currentColor if null. */
  offColor: string | null;
  label: string | null;
  /** Background CSS color, "transparent" for no background, or null for the default style. */
  backgroundColor: string | null;
  /** When true the label text is not rendered (useful for invisible overlay buttons). */
  hideLabel: boolean;
}

export interface TextConfig {
  template: string; // e.g. "{{state}} °C"
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface StateImageConfig {
  onAssetId: string | null;
  offAssetId: string | null;
  animationType: "none" | "fade" | "crossfade";
  stretchToFit?: boolean;
}

export interface StateIconConfig {
  icon: string;
  onColor: string;
  offColor: string;
  badgeEnabled: boolean;
  /** Entity ID of a battery sensor (e.g. sensor.motion_battery) */
  batteryEntityId?: string | null;
  /** Battery % below which the low-battery icon is shown. Defaults to 40. */
  lowBatteryThreshold?: number | null;
}

export interface BadgeConfig {
  stateLabels: Record<string, string>; // { "on": "Open", "off": "Closed" }
  stateColors: Record<string, string>;
}

export interface SceneConfig {
  serviceCall: ServiceCall;
  icon: string | null;
  label: string | null;
}

export interface BlindConfig {
  /** MDI icon key shown on the floorplan hotspot, e.g. "mdi:blinds" */
  icon: string;
  /** Optional label rendered below the icon on the floorplan */
  label: string | null;
  /** CSS color string, "transparent" for no background, or null for the default style */
  backgroundColor: string | null;
  /** Entity IDs controlled together when long-pressing this hotspot */
  groupEntityIds?: string[];
  /** Entity ID of a battery sensor to watch (e.g. sensor.cover_battery) */
  batteryEntityId?: string | null;
  /** Battery % below which the low-battery icon is shown. Defaults to 40. */
  lowBatteryThreshold?: number | null;
}

export interface BatteryItem {
  /** Stable UUID used as React key */
  id: string;
  /** Display name shown below the icon in the overlay */
  name: string;
  /** HA entity ID for the battery sensor, e.g. "sensor.motion_battery" */
  entityId: string;
  /** Normalized 0–1 horizontal position on the floorplan */
  x: number;
  /** Normalized 0–1 vertical position on the floorplan */
  y: number;
}

export interface BatteryConfig {
  /** Battery % below which the item is shown as red. Default 30. */
  lowThreshold: number;
  /** Battery % below which the item is shown as yellow. Default 50. */
  mediumThreshold: number;
  /** List of battery locations placed on the floorplan */
  items: BatteryItem[];
  /** CSS background color, "transparent" for no background, or null for the default style. */
  backgroundColor: string | null;
}

export interface BinsConfig {
  /** Asset ID for the yellow bin image */
  yellowBinAssetId: string | null;
  /** Asset ID for the red bin image */
  redBinAssetId: string | null;
  /** Optional label rendered on the floorplan */
  label: string | null;
}

export interface WeatherConfig {
  /** HA entity ID for current UV index, e.g. "sensor.uv_index". Shown in current conditions header. */
  uvEntityId: string | null;
  /** Temperature unit for display. */
  temperatureUnit: "celsius" | "fahrenheit";
  /** HA entity ID for actual outside temperature, e.g. "sensor.outside_temperature". Shown as reference line on today's chart. */
  outsideTempEntityId: string | null;
}

export interface TemperatureGaugeConfig {
  /** When true this gauge represents the outside temperature sensor. */
  isOutside: boolean;
  /** Unit for display and colour-scale calculations. */
  unit: "celsius" | "fahrenheit";
  /**
   * Radius of the radial gradient heat spread as a fraction of the floorplan width.
   * Only used for indoor gauges. Default 0.25.
   */
  radius: number;
  /**
   * "full"    — circular badge with icon, colour ring, and temperature text (default).
   * "minimal" — temperature text only, no background or decoration.
   */
  displayMode: "full" | "minimal";
  /** CSS colour for the temperature text. Null uses white in full mode and
   *  the temperature-mapped colour in minimal mode. */
  textColor: string | null;
}

export interface WindroseConfig {
  /**
   * Degrees to rotate the compass ring so that "N" aligns with map north.
   * 0 = north is up. Rotates only the ring/labels, never the arrow.
   */
  northOffset: number;
  /** HA entity ID for wind speed, e.g. "sensor.wind_speed". Null = speed not displayed. */
  speedEntityId: string | null;
  /** Unit label appended after the speed number, e.g. "km/h". Null = no unit shown. */
  speedUnit: string | null;
  /** Whether to show N/S/E/W cardinal labels. Default true. */
  showCardinals: boolean;
  /** Whether to also show NE/SE/SW/NW intercardinal labels. Default false. */
  showIntercardinals: boolean;
  /**
   * "from" — meteorological convention: entity value is the direction wind comes FROM.
   *           Arrow is flipped 180° to show where it blows into. (default)
   * "into" — entity value is already the direction wind blows into. Arrow used as-is.
   */
  bearingMode: "from" | "into";
  /** CSS colour for the arrow, hub, ring and tick marks. Null = default blue (#60a5fa). */
  roseColor: string | null;
  /** CSS colour for all text labels and speed value. Null = default white. */
  labelColor: string | null;
  /** Font size for cardinal labels in SVG units (default 8). Intercardinals scale at 75%. */
  labelSize: number;
}

export type HotspotConfig =
  | ActionConfig
  | TextConfig
  | StateImageConfig
  | StateIconConfig
  | BadgeConfig
  | SceneConfig
  | BlindConfig
  | BinsConfig
  | WeatherConfig
  | TemperatureGaugeConfig
  | WindroseConfig
  | Record<string, unknown>;

// ─── Service Calls ────────────────────────────────────────────────────────────

export interface ServiceCall {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: {
    entityId?: string;
    deviceId?: string;
    areaId?: string;
  };
}

// ─── State Rules ──────────────────────────────────────────────────────────────

export type ConditionType = "exact_match" | "numeric_range" | "truthy" | "falsy" | "fallback";

export interface ExactMatchCondition {
  type: "exact_match";
  value: string;
}

export interface NumericRangeCondition {
  type: "numeric_range";
  min?: number | undefined;
  max?: number | undefined;
}

export interface TruthyCondition {
  type: "truthy";
}

export interface FalsyCondition {
  type: "falsy";
}

export interface FallbackCondition {
  type: "fallback";
}

export type Condition =
  | ExactMatchCondition
  | NumericRangeCondition
  | TruthyCondition
  | FalsyCondition
  | FallbackCondition;

export interface RuleResult {
  styleOverrides?: {
    color?: string | undefined;
    backgroundColor?: string | undefined;
    opacity?: number | undefined;
    borderColor?: string | undefined;
    glow?: string | undefined;
  } | undefined;
  imageAssetId?: string | undefined;
  textOverride?: string | undefined;
  animationType?: string | undefined;
  hidden?: boolean | undefined;
}

export interface HotspotStateRule {
  id: string;
  hotspotId: string;
  priority: number;
  condition: Condition;
  result: RuleResult;
  createdAt: string;
  updatedAt: string;
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSetting {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

// ─── HA Entity State ─────────────────────────────────────────────────────────

export interface EntityState {
  entityId: string;
  state: string;
  attributes: Record<string, unknown>;
  lastChanged: string;
  lastUpdated: string;
}

export interface HaConnectionStatus {
  connected: boolean;
  lastConnectedAt: string | null;
  error: string | null;
}

// ─── Revision History ────────────────────────────────────────────────────────

export type RevisionAction = "create" | "update" | "delete";

export interface RevisionHistory {
  id: string;
  entityType: string;
  entityId: string;
  action: RevisionAction;
  before: unknown;
  after: unknown;
  userId: string | null;
  createdAt: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
