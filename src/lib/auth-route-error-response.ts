import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

const AUTH_LOG_PREFIX = "[auth]";

/**
 * Maps Prisma / config failures to a safe client message and logs the real error.
 */
export function jsonAuthRouteError(error: unknown): NextResponse {
  console.error(AUTH_LOG_PREFIX, error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message =
      error.code === "P1000"
        ? "Database rejected the connection (wrong user or password in DATABASE_URL)."
        : error.code === "P1001"
          ? "Cannot reach the database server. Check DATABASE_URL and that the host allows your deployment."
          : error.code === "P1002" || error.code === "P1003"
            ? "The database in DATABASE_URL does not exist or is not accessible."
            : error.code === "P1012" || error.code === "P1013"
              ? "DATABASE_URL is invalid or malformed."
              : error.code === "P1017"
                ? "Database server closed the connection. Try again or check pool/timeout settings."
                : `Database error (${error.code}). See server logs for details.`;
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        error:
          "Could not connect to the database. Check DATABASE_URL, SSL settings, and that the database is reachable from your host.",
      },
      { status: 503 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  if (error instanceof Error && error.message === "JWT_SECRET is required") {
    return NextResponse.json(
      { error: "Server misconfiguration: JWT_SECRET is not set." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error:
        "Something went wrong while signing you in. Please try again. If it continues, check server logs.",
    },
    { status: 500 },
  );
}
