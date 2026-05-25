-- CreateTable
CREATE TABLE "PerformanceEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "teachingScore" REAL,
    "professionalScore" REAL,
    "conductScore" REAL,
    "overallScore" REAL,
    "rating" TEXT,
    "comments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewerId" TEXT,
    "reviewerComments" TEXT,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PerformanceEvaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
