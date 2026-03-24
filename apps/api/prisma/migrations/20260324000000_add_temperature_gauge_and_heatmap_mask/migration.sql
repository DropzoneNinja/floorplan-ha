-- AlterEnum
ALTER TYPE "HotspotType" ADD VALUE 'temperature_gauge';

-- AlterTable
ALTER TABLE "floorplans" ADD COLUMN "heatmap_mask_asset_id" TEXT;

-- AddForeignKey
ALTER TABLE "floorplans" ADD CONSTRAINT "floorplans_heatmap_mask_asset_id_fkey" FOREIGN KEY ("heatmap_mask_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
