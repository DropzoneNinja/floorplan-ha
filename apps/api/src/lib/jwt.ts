import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";

const SECRET = new TextEncoder().encode(env.SESSION_SECRET);
const ALGORITHM = "HS256";
const EXPIRY = "7d";

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
