import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { STORE_CODE_REGEX } from "@/lib/store-code";

const schema = z.object({
  currentStoreCode: z.string().regex(STORE_CODE_REGEX, "Store code must be 8 digits"),
  kickScope: z.enum(["trainers_only", "trainers_and_admins"]),
});

function randomEightDigitCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * Security reset: rotate the store join code and remove selected staff accounts.
 * Owner (and WEBSITE_DEVELOPER) only — same gate as deleting the store.
 */
export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "settings.store.delete" });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(parsed.error.flatten().formErrors.join(" ") || "Invalid request", 400);
  }

  const { currentStoreCode, kickScope } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, storeCode: true, name: true },
      });
      if (!store) {
        throw new StoreCodeResetError("STORE_NOT_FOUND");
      }
      if (store.storeCode !== currentStoreCode) {
        throw new StoreCodeResetError("CODE_MISMATCH");
      }

      const rolesToRemove: Role[] =
        kickScope === "trainers_only" ? [Role.TRAINER] : [Role.TRAINER, Role.ADMIN];

      await tx.user.deleteMany({
        where: {
          storeId: store.id,
          role: { in: rolesToRemove },
        },
      });

      let newCode = "";
      for (let i = 0; i < 20; i += 1) {
        const candidate = randomEightDigitCode();
        const existing = await tx.store.findUnique({
          where: { storeCode: candidate },
          select: { id: true },
        });
        if (!existing) {
          newCode = candidate;
          break;
        }
      }
      if (!newCode) {
        throw new Error("Unable to generate unique store code");
      }

      const updated = await tx.store.update({
        where: { id: store.id },
        data: { storeCode: newCode },
        select: { id: true, name: true, storeCode: true, createdAt: true },
      });

      return { store: updated };
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof StoreCodeResetError) {
      if (e.code === "STORE_NOT_FOUND") return errorResponse("Store not found", 404);
      if (e.code === "CODE_MISMATCH") {
        return errorResponse("The store code you entered does not match.", 400);
      }
    }
    throw e;
  }
}

class StoreCodeResetError extends Error {
  constructor(readonly code: "STORE_NOT_FOUND" | "CODE_MISMATCH") {
    super(code);
    this.name = "StoreCodeResetError";
  }
}
