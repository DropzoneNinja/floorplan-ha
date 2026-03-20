import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

/**
 * Abstraction for asset file storage.
 * The current implementation is local filesystem-backed.
 * Swap out for an S3-compatible implementation by implementing this interface.
 */
export interface AssetStorage {
  /**
   * Persist a file buffer and return the unique stored filename and full path.
   */
  save(buffer: Buffer, originalFilename: string): Promise<{ filename: string; storagePath: string }>;

  /**
   * Delete a stored file by its storage path.
   * Resolves silently if the file does not exist.
   */
  delete(storagePath: string): Promise<void>;
}

/**
 * Local filesystem implementation of AssetStorage.
 * Files are stored in the directory pointed to by basePath (ASSET_STORAGE_PATH).
 */
export class LocalFileStorage implements AssetStorage {
  constructor(private readonly basePath: string) {}

  async save(
    buffer: Buffer,
    originalFilename: string,
  ): Promise<{ filename: string; storagePath: string }> {
    await fs.mkdir(this.basePath, { recursive: true });

    const ext = path.extname(originalFilename) || "";
    const filename = `${randomUUID()}${ext}`;
    const storagePath = path.join(this.basePath, filename);

    await fs.writeFile(storagePath, buffer);

    return { filename, storagePath };
  }

  async delete(storagePath: string): Promise<void> {
    await fs.unlink(storagePath).catch(() => {
      // File may already be gone — not an error
    });
  }
}

/** Singleton instance initialized at server startup via initAssetStorage(). */
let _storage: AssetStorage | null = null;

export function initAssetStorage(basePath: string): void {
  _storage = new LocalFileStorage(basePath);
}

export function getAssetStorage(): AssetStorage {
  if (!_storage) {
    throw new Error("AssetStorage has not been initialized. Call initAssetStorage() first.");
  }
  return _storage;
}
