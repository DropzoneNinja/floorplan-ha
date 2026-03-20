import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance for the process lifetime
export const prisma = new PrismaClient({
  log: process.env["NODE_ENV"] === "development" ? ["query", "warn", "error"] : ["error"],
});
