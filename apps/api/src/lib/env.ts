import { z } from "zod";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().default(3001),
    SESSION_SECRET: z.string().min(32),
    HA_BASE_URL: z.string().url(),
    HA_TOKEN: z.string().min(1),
    ASSET_STORAGE_PATH: z.string().default("/uploads"),
    BACKUP_STORAGE_PATH: z.string().default("/backups"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && data.CORS_ORIGIN === "*") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN must not be '*' in production",
      });
    }
  });

function loadEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = typeof env;
