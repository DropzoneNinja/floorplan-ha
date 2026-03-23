import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";

const SECRET = new TextEncoder().encode(env.SESSION_SECRET);
const ALGORITHM = "HS256";
const EXPIRY = "7d";
const RESET_EXPIRY = "15m";

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });
  return payload as unknown as JwtPayload;
}

export async function signPasswordResetToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: "password_reset" })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(RESET_EXPIRY)
    .sign(SECRET);
}

export async function verifyPasswordResetToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });
  if (payload["type"] !== "password_reset" || typeof payload["sub"] !== "string") {
    throw new Error("Invalid password reset token");
  }
  return payload["sub"];
}
