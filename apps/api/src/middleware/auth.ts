import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";

// Augment FastifyRequest to carry the decoded user
declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * Extract and verify the JWT from the Authorization header or cookie.
 * Attaches the decoded payload to request.user.
 * Returns 401 if missing or invalid.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const tokenFromCookie = (request.cookies as Record<string, string | undefined>)["token"];
  const token = tokenFromHeader ?? tokenFromCookie;

  if (!token) {
    return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Missing token" });
  }

  try {
    request.user = await verifyToken(token);
  } catch {
    return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid or expired token" });
  }
}

/**
 * Require admin role. Must be used after requireAuth.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.user?.role !== "admin") {
    return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Admin access required" });
  }
}
