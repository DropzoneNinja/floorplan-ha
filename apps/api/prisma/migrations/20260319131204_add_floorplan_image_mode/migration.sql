-- AlterTable
ALTER TABLE "floorplans" ADD COLUMN     "cycle_images_json" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "image_mode" TEXT NOT NULL DEFAULT 'single';
