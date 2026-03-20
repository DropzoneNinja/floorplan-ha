import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed admin users
  const adminUsers = [
    {
      email: process.env["ADMIN_EMAIL"] ?? "admin@localhost",
      password: process.env["ADMIN_PASSWORD"] ?? "changeme123",
    },
    { email: "reg@wreck.zone", password: "TestTest99" },
  ];

  for (const { email, password } of adminUsers) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const passwordHash = await argon2.hash(password);
      await prisma.user.create({ data: { email, passwordHash, role: "admin" } });
      console.log(`Created admin user: ${email}`);
    } else {
      console.log(`Admin user already exists: ${email}`);
    }
  }

  // Create default dashboard
  const existing_dashboard = await prisma.dashboard.findUnique({ where: { slug: "home" } });
  if (!existing_dashboard) {
    const dashboard = await prisma.dashboard.create({
      data: {
        name: "Home",
        slug: "home",
        description: "Main home dashboard",
        isDefault: true,
      },
    });
    console.log(`Created default dashboard: ${dashboard.name}`);

    // Create default floorplan
    await prisma.floorplan.create({
      data: {
        dashboardId: dashboard.id,
        name: "Ground Floor",
        backgroundColor: "#1a1a1a",
      },
    });
    console.log("Created default floorplan: Ground Floor");
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
