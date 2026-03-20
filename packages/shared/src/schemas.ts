import { z } from "zod";

// ─── Condition Schemas ────────────────────────────────────────────────────────

export const ExactMatchConditionSchema = z.object({
  type: z.literal("exact_match"),
  value: z.string(),
});

export const NumericRangeConditionSchema = z.object({
  type: z.literal("numeric_range"),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const TruthyConditionSchema = z.object({ type: z.literal("truthy") });
export const FalsyConditionSchema = z.object({ type: z.literal("falsy") });
export const FallbackConditionSchema = z.object({ type: z.literal("fallback") });

export const ConditionSchema = z.discriminatedUnion("type", [
  ExactMatchConditionSchema,
  NumericRangeConditionSchema,
  TruthyConditionSchema,
  FalsyConditionSchema,
  FallbackConditionSchema,
]);

// ─── Rule Result Schema ───────────────────────────────────────────────────────

export const RuleResultSchema = z.object({
  styleOverrides: z
    .object({
      color: z.string().optional(),
      backgroundColor: z.string().optional(),
      opacity: z.number().min(0).max(1).optional(),
      borderColor: z.string().optional(),
      glow: z.string().optional(),
    })
    .optional(),
  imageAssetId: z.string().optional(),
  textOverride: z.string().optional(),
  animationType: z.string().optional(),
  hidden: z.boolean().optional(),
});

// ─── Hotspot State Rule Schemas ───────────────────────────────────────────────

export const CreateHotspotStateRuleSchema = z.object({
  priority: z.number().int().min(0),
  condition: ConditionSchema,
  result: RuleResultSchema,
});

export const UpdateHotspotStateRuleSchema = CreateHotspotStateRuleSchema.partial();

// ─── Service Call Schema ──────────────────────────────────────────────────────

export const ServiceCallSchema = z.object({
  domain: z.string().min(1),
  service: z.string().min(1),
  serviceData: z.record(z.unknown()).optional(),
  target: z
    .object({
      entityId: z.string().optional(),
      deviceId: z.string().optional(),
      areaId: z.string().optional(),
    })
    .optional(),
});

// ─── Hotspot Position Schema ──────────────────────────────────────────────────

export const HotspotPositionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  rotation: z.number().default(0),
  zIndex: z.number().int().min(0).default(0),
});

// ─── Hotspot Schemas ──────────────────────────────────────────────────────────

export const HotspotTypeSchema = z.enum([
  "action",
  "text",
  "state_image",
  "state_icon",
  "badge",
  "scene",
  "blind",
  "bins",
  "custom",
]);

export const CreateHotspotSchema = z.object({
  floorplanId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: HotspotTypeSchema,
  position: HotspotPositionSchema,
  entityId: z.string().nullable().default(null),
  config: z.record(z.unknown()).default({}),
});

export const UpdateHotspotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: HotspotPositionSchema.partial().optional(),
  entityId: z.string().nullable().optional(),
  config: z.record(z.unknown()).optional(),
});

export const BulkUpdateHotspotPositionsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    position: HotspotPositionSchema.partial(),
  }),
);

// ─── Floorplan Schemas ────────────────────────────────────────────────────────

const CycleImagesSchema = z.object({
  day: z.array(z.string().uuid().nullable()).length(12),
  night: z.array(z.string().uuid().nullable()).length(12),
});

const defaultCycleImages = { day: Array(12).fill(null) as null[], night: Array(12).fill(null) as null[] };

export const CreateFloorplanSchema = z.object({
  dashboardId: z.string().uuid(),
  name: z.string().min(1).max(100),
  imageMode: z.enum(["single", "day_night_cycle", "none"]).default("single"),
  imageStretch: z.boolean().default(true),
  imageAssetId: z.string().uuid().nullable().default(null),
  cycleImagesJson: CycleImagesSchema.default(defaultCycleImages),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  backgroundColor: z.string().default("#1a1a1a"),
});

export const UpdateFloorplanSchema = CreateFloorplanSchema.omit({ dashboardId: true }).partial();

// ─── Dashboard Schemas ────────────────────────────────────────────────────────

export const CreateDashboardSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().nullable().default(null),
  isDefault: z.boolean().default(false),
});

export const UpdateDashboardSchema = CreateDashboardSchema.partial();

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "viewer"]).default("viewer"),
});

export const CreateAllowedEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "viewer"]).default("viewer"),
});

// ─── Settings Schema ──────────────────────────────────────────────────────────

export const UpdateSettingSchema = z.object({
  value: z.unknown(),
});

// ─── HA Service Call Schema ───────────────────────────────────────────────────

export const HaCallServiceSchema = z.object({
  serviceData: z.record(z.unknown()).optional(),
  target: z
    .object({
      entityId: z.string().optional(),
      deviceId: z.string().optional(),
      areaId: z.string().optional(),
    })
    .optional(),
});
