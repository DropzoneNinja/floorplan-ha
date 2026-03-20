import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getAssetStorage } from "../services/asset-storage.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/** Extract pixel dimensions from an image buffer. Returns null for SVG or on failure. */
async function extractDimensions(
  buffer: Buffer,
  mimeType: string,
): Promise<{ width: number; height: number } | null> {
  if (mimeType === "image/svg+xml") return null; // SVG is vector — no fixed pixel size
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width && meta.height) return { width: meta.width, height: meta.height };
  } catch {
    // Non-fatal — dimensions remain null
  }
  return null;
}

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/assets — list all assets (newest first) */
  app.get("/", { preHandler: [requireAuth] }, async (_request, reply) => {
    const assets = await prisma.asset.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send(assets);
  });

  /** GET /api/assets/:id — single asset metadata */
  app.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Asset not found" });
    }
    return reply.send(asset);
  });

  /**
   * GET /api/assets/:id/file — serve the raw file.
   * Public (no auth) so presentation mode can display images without tokens.
   * Instructs browsers/CDN to cache immutable assets for 1 year since filenames are UUID-based.
   */
  app.get("/:id/file", async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Asset not found" });
    }

    void reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.sendFile(asset.filename, env.ASSET_STORAGE_PATH);
  });

  /** POST /api/assets/upload — multipart file upload (admin only) */
  app.post("/upload", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "No file provided" });
    }

    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: `Unsupported file type: ${data.mimetype}. Allowed: PNG, JPEG, WebP, GIF, SVG`,
      });
    }

    // Buffer entire file while enforcing size limit
    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_FILE_SIZE) {
        return reply.status(413).send({
          statusCode: 413,
          error: "Payload Too Large",
          message: "File exceeds 20 MB limit",
        });
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Extract image dimensions (raster formats only)
    const dims = await extractDimensions(buffer, data.mimetype);

    // Persist file via storage abstraction
    const storage = getAssetStorage();
    const { filename, storagePath } = await storage.save(buffer, data.filename);

    const asset = await prisma.asset.create({
      data: {
        filename,
        originalName: data.filename,
        mimeType: data.mimetype,
        sizeBytes: totalSize,
        storagePath,
        ...(dims ?? {}),
      },
    });

    return reply.status(201).send(asset);
  });

  /** DELETE /api/assets/:id — delete asset and file (admin only) */
  app.delete("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Asset not found" });
    }

    // Prevent deletion while the asset is referenced by a floorplan image
    const usedByFloorplan = await prisma.floorplan.findFirst({ where: { imageAssetId: id } });
    if (usedByFloorplan) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Asset is in use by a floorplan and cannot be deleted",
      });
    }

    // Also check if the asset is used in any day/night cycle images (JSON column)
    const cycleUsage = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM floorplans
      WHERE cycle_images_json::text LIKE ${'%' + id + '%'}
    `;
    if ((cycleUsage[0]?.count ?? 0n) > 0n) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Asset is in use by a floorplan day/night cycle and cannot be deleted",
      });
    }

    await prisma.asset.delete({ where: { id } });
    await getAssetStorage().delete(asset.storagePath);

    return reply.status(204).send();
  });
}
