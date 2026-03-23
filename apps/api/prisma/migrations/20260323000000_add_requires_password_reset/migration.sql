-- AlterTable
ALTER TABLE "users" ADD COLUMN "requires_password_reset" BOOLEAN NOT NULL DEFAULT false;
