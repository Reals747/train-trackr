-- CreateTable (additive only — does not modify or remove existing tables or data)
CREATE TABLE "WorkflowGeneralComments" (
    "traineeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "generalComments" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowGeneralComments_pkey" PRIMARY KEY ("traineeId","positionId")
);

-- AddForeignKey
ALTER TABLE "WorkflowGeneralComments" ADD CONSTRAINT "WorkflowGeneralComments_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowGeneralComments" ADD CONSTRAINT "WorkflowGeneralComments_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
