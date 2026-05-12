import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma, prismaHasWorkflowGeneralComments } from "@/lib/prisma";

const putSchema = z.object({
  traineeId: z.string(),
  positionId: z.string(),
  generalComments: z.string().max(20000),
});

function commentsTableMissingMessage(): string {
  return "Comments storage is not set up on this database yet. From the training-tracker folder, run: npx prisma migrate deploy (use the same DATABASE_URL the app uses).";
}

function isMissingWorkflowCommentsTable(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  const meta = e.meta as { table?: string; modelName?: string } | undefined;
  const tableRef = [meta?.table, meta?.modelName].filter(Boolean).join(" ");
  if (tableRef.includes("WorkflowGeneralComments")) return true;
  return e.message.includes("WorkflowGeneralComments") && e.message.includes("does not exist");
}

function jsonError(message: string, status: number, prismaCode?: string) {
  return NextResponse.json({ error: message, ...(prismaCode ? { prismaCode } : {}) }, { status });
}

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const traineeId = url.searchParams.get("traineeId");
  const positionId = url.searchParams.get("positionId");
  if (!traineeId || !positionId) {
    return errorResponse("traineeId and positionId are required");
  }

  if (!prismaHasWorkflowGeneralComments()) {
    return jsonError(
      "Prisma client is out of date. Run: npx prisma generate — then restart next dev (or redeploy).",
      503,
      "PRISMA_CLIENT_STALE",
    );
  }

  try {
    const trainee = await prisma.trainee.findFirst({
      where: { id: traineeId, storeId: user.storeId },
    });
    if (!trainee) return errorResponse("Trainee not found", 404);

    const position = await prisma.position.findFirst({
      where: { id: positionId, storeId: user.storeId },
    });
    if (!position) return errorResponse("Position not found", 404);

    const row = await prisma.workflowGeneralComments.findFirst({
      where: { traineeId, positionId },
    });

    return NextResponse.json({
      generalComments: row?.generalComments ?? "",
    });
  } catch (e) {
    if (isMissingWorkflowCommentsTable(e)) {
      return jsonError(commentsTableMissingMessage(), 503, "P2021");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[workflow-general-comments GET]", e.code, e.message);
      return jsonError("Could not load comments", 500, e.code);
    }
    if (e instanceof Prisma.PrismaClientInitializationError) {
      console.error("[workflow-general-comments GET]", e.message);
      return jsonError("Could not connect to the database from the server.", 503, e.errorCode);
    }
    console.error("[workflow-general-comments GET]", e);
    const hint = e instanceof Error ? e.message : "unknown";
    return jsonError(
      process.env.NODE_ENV === "development"
        ? `Could not load comments: ${hint}`
        : "Could not load comments",
      500,
    );
  }
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth({ permission: "workflow.edit" });
  if (error) return error;

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid workflow comments payload");

  if (!prismaHasWorkflowGeneralComments()) {
    return jsonError(
      "Prisma client is out of date. Run: npx prisma generate — then restart next dev (or redeploy).",
      503,
      "PRISMA_CLIENT_STALE",
    );
  }

  const trainee = await prisma.trainee.findFirst({
    where: { id: parsed.data.traineeId, storeId: user.storeId },
  });
  if (!trainee) return errorResponse("Trainee not found", 404);

  const position = await prisma.position.findFirst({
    where: { id: parsed.data.positionId, storeId: user.storeId },
  });
  if (!position) return errorResponse("Position not found", 404);

  try {
    const row = await prisma.workflowGeneralComments.upsert({
      where: {
        traineeId_positionId: {
          traineeId: parsed.data.traineeId,
          positionId: parsed.data.positionId,
        },
      },
      create: {
        traineeId: parsed.data.traineeId,
        positionId: parsed.data.positionId,
        generalComments: parsed.data.generalComments,
      },
      update: {
        generalComments: parsed.data.generalComments,
      },
    });

    return NextResponse.json({ generalComments: row.generalComments });
  } catch (e) {
    if (isMissingWorkflowCommentsTable(e)) {
      return jsonError(commentsTableMissingMessage(), 503, "P2021");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[workflow-general-comments PUT]", e.code, e.message);
      return jsonError("Could not save comments", 500, e.code);
    }
    if (e instanceof Prisma.PrismaClientInitializationError) {
      console.error("[workflow-general-comments PUT]", e.message);
      return jsonError("Could not connect to the database from the server.", 503, e.errorCode);
    }
    console.error("[workflow-general-comments PUT]", e);
    return errorResponse("Could not save comments", 500);
  }
}
