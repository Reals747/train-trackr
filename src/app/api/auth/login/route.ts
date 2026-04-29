import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { comparePassword, setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { prisma } from "@/lib/prisma";
import { STORE_CODE_REGEX } from "@/lib/store-code";

const ownerSchema = z.object({
  mode: z.literal("owner"),
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const trainerSchema = z.object({
  mode: z.literal("trainer"),
  storeCode: z.string().regex(STORE_CODE_REGEX, "Store code must be 8 digits"),
  username: z.string().trim().min(1),
});

const schema = z.discriminatedUnion("mode", [ownerSchema, trainerSchema]);

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sign-in details" }, { status: 400 });
    }

    if (parsed.data.mode === "owner") {
      return signInOwner(parsed.data.username.toLowerCase(), parsed.data.password);
    }
    return signInTrainer(parsed.data.storeCode, parsed.data.username.toLowerCase());
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}

async function signInOwner(username: string, password: string) {
  /**
   * Manager-level sign-in (owners, admins, and the privileged website
   * developer account). Usernames are unique per store but can repeat
   * across stores, so we collect every match and try each one.
   *
   * Two valid credentials per candidate:
   *   1. The candidate's actual password (via bcrypt comparePassword).
   *   2. Their store's `storeCode`, but ONLY when the candidate has no
   *      password yet (`passwordHash IS NULL`). This unblocks promoted
   *      trainers — they were created without a password, then bumped to
   *      ADMIN — so they can sign in once and (via the Help-I-don't-have-
   *      a-password flow) set a real password.
   *
   *   Once a real password is set, the store-code shortcut no longer works
   *   for that account, so admins who pick a real password are not at risk
   *   of being impersonated by anyone holding the store code.
   */
  const candidates = await prisma.user.findMany({
    where: {
      username: { equals: username, mode: "insensitive" },
      role: { in: [Role.WEBSITE_DEVELOPER, Role.OWNER, Role.ADMIN] },
    },
    include: { store: true },
  });
  if (candidates.length === 0) {
    return NextResponse.json({ error: "Invalid sign-in or password" }, { status: 401 });
  }
  for (const candidate of candidates) {
    if (candidate.passwordHash) {
      const ok = await comparePassword(password, candidate.passwordHash);
      if (ok) return issueSession(candidate);
      continue;
    }
    if (password === candidate.store.storeCode) {
      return issueSession(candidate);
    }
  }
  return NextResponse.json({ error: "Invalid sign-in or password" }, { status: 401 });
}

async function signInTrainer(storeCode: string, username: string) {
  const store = await prisma.store.findUnique({
    where: { storeCode },
    select: { id: true, name: true, storeCode: true },
  });
  if (!store) {
    return NextResponse.json({ error: "Unknown store code" }, { status: 401 });
  }
  const trainer = await prisma.user.findUnique({
    where: { storeId_username: { storeId: store.id, username } },
    include: { store: true },
  });
  if (!trainer) {
    return NextResponse.json(
      {
        error: "No trainer account for this username in this store",
        code: "unknown_trainer_username",
        storeName: store.name,
      },
      { status: 401 },
    );
  }
  if (trainer.role !== Role.TRAINER) {
    return NextResponse.json(
      { error: "No trainer with that username in this store" },
      { status: 401 },
    );
  }
  return issueSession(trainer);
}

async function issueSession(
  user: {
    id: string;
    username: string;
    role: Role;
    storeId: string;
    name: string;
    store: { name: string; storeCode: string };
  },
) {
  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    storeId: user.storeId,
    name: user.name,
  });
  await setAuthCookie(token);
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      storeId: user.storeId,
      storeName: user.store.name,
      storeCode: user.store.storeCode,
    },
  });
}
