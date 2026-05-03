import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "training_tracker_token";

/** Seconds; JWT exp and cookie maxAge must match. Capped ~400d — browsers (e.g. Chrome) reject longer cookie lifetimes. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export type AuthPayload = {
  userId: string;
  username: string;
  role: Role;
  storeId: string;
  name: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_MAX_AGE_SECONDS });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret()) as AuthPayload;
}

export async function getAuthUserFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
