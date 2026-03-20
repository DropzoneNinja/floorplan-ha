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
  | "custom";

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
}

export interface StateIconConfig {
  icon: string;
  onColor: string;
  offColor: string;
  badgeEnabled: boolean;
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

export type HotspotConfig =
  | ActionConfig
  | TextConfig
  | StateImageConfig
  | StateIconConfig
  | BadgeConfig
  | SceneConfig
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
