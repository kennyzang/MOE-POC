-- Add missing column to CounselorCase
ALTER TABLE "CounselorCase" ADD COLUMN "resolutionNotes" TEXT;

-- CreateTable (was never migrated, only existed via db push)
CREATE TABLE "CounselorCaseActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedTo" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CounselorCaseActionItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CounselorCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable (was never migrated, only existed via db push)
CREATE TABLE "CounselorCaseEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "description" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CounselorCaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CounselorCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "CounselorCaseActionItem" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "CounselorCaseActionItem" ADD COLUMN "resultNotes" TEXT;
