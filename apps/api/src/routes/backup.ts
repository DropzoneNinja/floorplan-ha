import path from "node:path";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  createBackup,
  listBackups,
  deleteBackup,
  restoreBackup,
} from "../services/backup.js";
import { env } from "../lib/env.js";

/** Reject filenames that could be used for path traversal. */
function isSafeFilename(filename: string): boolean {
  return /^floorplan-[a-z]+-\d{4}-\d{2}-\d{2}\.zip$/.test(filename);
}

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/backup/list — list available backup files */
  app.get("/list", { preHandler: [requireAuth, requireAdmin] }, async (_req, reply) => {
    const backups = await listBackups();
    return reply.send(backups);
  });

  /** POST /api/backup/create — trigger a manual backup */
  app.post("/create", { preHandler: [requireAuth, requireAdmin] }, async (_req, reply) => {
    const backup = await createBackup();
    return reply.status(201).send(backup);
  });

  /** GET /api/backup/download/:filename — download a backup zip */
  app.get(
    "/download/:filename",
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      const { filename } = request.params as { filename: string };

      if (!isSafeFilename(filename)) {
        return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Invalid filename" });
      }

      const fullPath = path.join(env.BACKUP_STORAGE_PATH, filename);

      // Verify file exists before streaming
      await fs.access(fullPath).catch(() => {
        throw Object.assign(new Error("Backup file not found"), { statusCode: 404 });
      });

      const stat = await fs.stat(fullPath);

      return reply
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("Content-Type", "application/zip")
        .header("Content-Length", stat.size)
        .send(createReadStream(fullPath));
    },
  );

  /** DELETE /api/backup/:filename — delete a backup file */
  app.delete("/:filename", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { filename } = request.params as { filename: string };

    if (!isSafeFilename(filename)) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Invalid filename" });
    }

    await deleteBackup(filename);
    return reply.status(204).send();
  });

  /** POST /api/backup/restore — restore from an uploaded backup zip */
  app.post("/restore", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "No file uploaded" });
    }
    if (!data.filename.endsWith(".zip") && data.mimetype !== "application/zip") {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "File must be a .zip backup" });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const zipBuffer = Buffer.concat(chunks);

    await restoreBackup(zipBuffer);
    return reply.send({ success: true, message: "Restore completed. Please reload the application." });
  });
}
