import { prisma } from "@/lib/prisma";

/** Cryptographically random 8-digit numeric store join code, zero-padded. */
export function randomEightDigitCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/** Generate a storeCode guaranteed unique against existing Store rows. */
export async function generateUniqueStoreCode(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = randomEightDigitCode();
    const existing = await prisma.store.findUnique({
      where: { storeCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Unable to generate unique store code");
}

export const STORE_CODE_REGEX = /^\d{8}$/;
