import type { HotspotType, HotspotConfig, Condition, RuleResult, EntityState, FloorplanImageMode, CycleImages } from "@floorplan-ha/shared";

// ─── Raw API shapes (match Prisma output) ─────────────────────────────────────

export interface StateRuleRaw {
  id: string;
  hotspotId: string;
  priority: number;
  conditionType: string;
  conditionJson: Condition;
  resultJson: RuleResult;
  createdAt: string;
  updatedAt: string;
}

export interface HotspotRaw {
  id: string;
  floorplanId: string;
  name: string;
  type: HotspotType;
  /** Normalized 0–1 (fraction of floorplan width) */
  x: number;
  /** Normalized 0–1 (fraction of floorplan height) */
  y: number;
  /** Normalized 0–1 */
  width: number;
  /** Normalized 0–1 */
  height: number;
  rotation: number;
  zIndex: number;
  entityId: string | null;
  configJson: HotspotConfig;
  stateRules: StateRuleRaw[];
  createdAt: string;
  updatedAt: string;
}

export interface FloorplanWithHotspotsRaw {
  id: string;
  dashboardId: string;
  name: string;
  imageMode: FloorplanImageMode;
  imageStretch: boolean;
  imageAssetId: string | null;
  cycleImagesJson: CycleImages | Record<string, never>;
  /** Intrinsic image width in pixels (used for aspect ratio) */
  width: number;
  /** Intrinsic image height in pixels (used for aspect ratio) */
  height: number;
  backgroundColor: string;
  hotspots: HotspotRaw[];
  createdAt: string;
  updatedAt: string;
}

// ─── Hotspot renderer contract ────────────────────────────────────────────────

export interface HotspotRendererProps {
  hotspot: HotspotRaw;
  entityState: EntityState | undefined;
  ruleResult: RuleResult | null;
  isEditMode?: boolean;
}

/** Definition registered in the hotspot registry for each supported type */
export interface HotspotTypeDefinition {
  type: HotspotType;
  /** Display label used in the type picker UI */
  label: string;
  /** Short description shown in the type picker UI */
  description: string;
  /** Emoji or single character icon for the type picker */
  icon: string;
  Renderer: React.ComponentType<HotspotRendererProps>;
  defaultConfig: HotspotConfig;
  /**
   * Optional migration function called when loading an older config shape.
   * Return a corrected config if the stored data is missing fields.
   */
  migrate?: (config: Record<string, unknown>) => HotspotConfig;
}
