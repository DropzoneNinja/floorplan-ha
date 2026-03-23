import path from "node:path";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import archiver from "archiver";
import unzipper from "unzipper";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface DatabaseExport {
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

// ─── Core backup/restore ───────────────────────────────────────────────────────

/** Export all relevant DB tables as a plain JS object. */
async function exportDatabase(): Promise<DatabaseExport> {
  const [
    users,
    allowedEmails,
    dashboards,
    floorplans,
    hotspots,
    hotspotStateRules,
    assets,
    appSettings,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.allowedEmail.findMany(),
    prisma.dashboard.findMany(),
    prisma.floorplan.findMany(),
    prisma.hotspot.findMany(),
    prisma.hotspotStateRule.findMany(),
    prisma.asset.findMany(),
    prisma.appSetting.findMany(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      users,
      allowedEmails,
      dashboards,
      floorplans,
      hotspots,
      hotspotStateRules,
      assets,
      appSettings,
    },
  };
}

export type BackupType = "manual" | "changed" | "weekly" | "monthly";

/**
 * Create a backup zip containing database.json and all uploaded images.
 * Returns the filename and size of the created zip.
 */
export async function createBackup(type: BackupType = "manual"): Promise<BackupFile> {
  await fs.mkdir(env.BACKUP_STORAGE_PATH, { recursive: true });

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `floorplan-${type}-${date}.zip`;
  const zipPath = path.join(env.BACKUP_STORAGE_PATH, filename);

  const dbExport = await exportDatabase();

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    // Add database export
    archive.append(JSON.stringify(dbExport, null, 2), { name: "database.json" });

    // Add all files from the uploads directory
    archive.directory(env.ASSET_STORAGE_PATH, "uploads");

    archive.finalize();
  });

  const stat = await fs.stat(zipPath);

  // Record the backup time in settings
  await prisma.appSetting.upsert({
    where: { key: "backup_last_run_at" },
    update: { valueJson: new Date().toISOString() },
    create: { key: "backup_last_run_at", valueJson: new Date().toISOString() },
  });

  return { filename, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
}

/** List all backup zip files in BACKUP_STORAGE_PATH, newest first. */
export async function listBackups(): Promise<BackupFile[]> {
  await fs.mkdir(env.BACKUP_STORAGE_PATH, { recursive: true });

  const entries = await fs.readdir(env.BACKUP_STORAGE_PATH);
  const backups: BackupFile[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".zip")) continue;
    const fullPath = path.join(env.BACKUP_STORAGE_PATH, entry);
    const stat = await fs.stat(fullPath);
    backups.push({ filename: entry, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() });
  }

  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
}

/** Delete a specific backup file. Validates the filename to prevent path traversal. */
export async function deleteBackup(filename: string): Promise<void> {
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new Error("Invalid filename");
  }
  const fullPath = path.join(env.BACKUP_STORAGE_PATH, filename);
  await fs.unlink(fullPath);
}

/**
 * Restore all application data from a backup zip buffer.
 * Clears the current database (except revision_history) and image files,
 * then re-imports everything from the zip.
 */
export async function restoreBackup(zipBuffer: Buffer): Promise<void> {
  // Parse zip in memory
  const directory = await unzipper.Open.buffer(zipBuffer);

  const dbFile = directory.files.find((f) => f.path === "database.json");
  if (!dbFile) throw new Error("Invalid backup: database.json not found");

  const dbJson = JSON.parse((await dbFile.buffer()).toString("utf8")) as DatabaseExport;

  if (dbJson.version !== 1) throw new Error(`Unsupported backup version: ${dbJson.version}`);

  const {
    users = [],
    allowedEmails = [],
    dashboards = [],
    floorplans = [],
    hotspots = [],
    hotspotStateRules = [],
    assets = [],
    appSettings = [],
  } = dbJson.data;

  // ── Database restore ──────────────────────────────────────────────────────
  // Delete in dependency order (children first, parents last)
  await prisma.$transaction([
    prisma.hotspotStateRule.deleteMany(),
    prisma.hotspot.deleteMany(),
    prisma.floorplan.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.dashboard.deleteMany(),
    prisma.allowedEmail.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Re-create in reverse dependency order
  await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.user.createMany({ data: users as any[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.allowedEmail.createMany({ data: allowedEmails as any[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.appSetting.createMany({ data: appSettings as any[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.dashboard.createMany({ data: dashboards as any[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.asset.createMany({ data: assets as any[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.floorplan.createMany({ data: floorplans as any[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.hotspot.createMany({ data: hotspots as any[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.hotspotStateRule.createMany({ data: hotspotStateRules as any[] }),
  ]);

  // ── Image files restore ───────────────────────────────────────────────────
  // Clear existing uploads
  const existingFiles = await fs.readdir(env.ASSET_STORAGE_PATH).catch(() => [] as string[]);
  await Promise.all(
    existingFiles.map((f) => fs.unlink(path.join(env.ASSET_STORAGE_PATH, f)).catch(() => {})),
  );

  // Write files from backup
  const uploadFiles = directory.files.filter(
    (f) => f.path.startsWith("uploads/") && f.type !== "Directory",
  );

  await fs.mkdir(env.ASSET_STORAGE_PATH, { recursive: true });

  await Promise.all(
    uploadFiles.map(async (f) => {
      const basename = path.basename(f.path);
      if (!basename) return;
      const dest = path.join(env.ASSET_STORAGE_PATH, basename);
      const buf = await f.buffer();
      await fs.writeFile(dest, buf);
    }),
  );
}

// ─── Change detection ─────────────────────────────────────────────────────────

/**
 * Returns true if any revision history entry exists after the last backup time.
 * If lastRunAt is null (never backed up), always returns true.
 */
async function hasChangedSinceLastBackup(lastRunAt: string | null): Promise<boolean> {
  if (!lastRunAt) return true;
  const recent = await prisma.revisionHistory.findFirst({
    where: { createdAt: { gt: new Date(lastRunAt) } },
  });
  return recent !== null;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/** Read a string value from app_settings. Returns null if key not found. */
async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) return null;
  const v = row.valueJson;
  return typeof v === "string" ? v : null;
}

const THIRTY_MINUTES = 30 * 60 * 1000;

/**
 * Start the background backup scheduler.
 * Checks every 30 minutes whether an automatic backup should run.
 */
export function startBackupScheduler(): void {
  const check = async () => {
    try {
      const schedule = (await getSetting("backup_schedule")) ?? "off";
      if (schedule === "off") return;

      const lastRunAt = await getSetting("backup_last_run_at");
      const changed = await hasChangedSinceLastBackup(lastRunAt);
      if (!changed) return;

      if (schedule === "on_change") {
        await createBackup("changed");
        return;
      }

      const thresholdDays = schedule === "weekly" ? 7 : 30;
      const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
      const lastTime = lastRunAt ? new Date(lastRunAt).getTime() : 0;
      const elapsed = Date.now() - lastTime;

      if (elapsed >= thresholdMs) {
        await createBackup(schedule === "weekly" ? "weekly" : "monthly");
      }
    } catch (err) {
      console.error("[backup-scheduler] Error during scheduled backup check:", err);
    }
  };

  // Run immediately on startup (catches up if the container was restarted)
  void check();
  setInterval(check, THIRTY_MINUTES);
}
