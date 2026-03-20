import type { FastifyInstance } from "fastify";
import * as argon2 from "argon2";
import { LoginSchema, RegisterSchema } from "@floorplan-ha/shared";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const MAX_FAILED_ATTEMPTS = 3;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/login
   * Authenticate with email + password. Returns a JWT in the response body
   * and sets it as an HttpOnly cookie.
   */
  app.post("/login", async (request, reply) => {
    const body = LoginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join(", "),
      });
    }

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user) {
      return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid credentials" });
    }

    if (!user.isEnabled) {
      return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Account is disabled" });
    }

    if (user.lockedAt) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Account is locked due to too many failed login attempts. Contact an admin to unlock.",
      });
    }

    const valid = await argon2.verify(user.passwordHash, body.data.password);
    if (!valid) {
      const newAttempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedAt: newAttempts >= MAX_FAILED_ATTEMPTS ? new Date() : null,
        },
      });

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: "Account locked after too many failed attempts. Contact an admin to unlock.",
        });
      }

      return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid credentials" });
    }

    // Success — reset counters
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedAt: null },
    });

    const token = await signToken({ sub: user.id, email: user.email, role: user.role });

    reply.setCookie("token", token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return reply.send({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  /**
   * POST /api/auth/register
   * Self-service registration. Email must exist in the allowed_emails whitelist.
   */
  app.post("/register", async (request, reply) => {
    const body = RegisterSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { email, password } = body.data;

    const allowed = await prisma.allowedEmail.findUnique({ where: { email } });
    if (!allowed) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "This email address is not authorized for registration",
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: allowed.role },
      select: { id: true, email: true, role: true },
    });

    return reply.status(201).send({ user });
  });

  /**
   * POST /api/auth/logout
   * Clears the auth cookie.
   */
  app.post("/logout", async (_request, reply) => {
    reply.clearCookie("token", { path: "/" });
    return reply.send({ message: "Logged out" });
  });

  /**
   * GET /api/auth/me
   * Returns the current authenticated user.
   */
  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.sub },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "User not found" });
    }
    return reply.send(user);
  });
}
