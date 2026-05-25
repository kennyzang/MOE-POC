-- AlterTable
ALTER TABLE "Admission" ADD COLUMN "icNumber" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "icNumber" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Teacher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "qualification" TEXT,
    "subjects" TEXT,
    "joinDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cpdHours" REAL NOT NULL DEFAULT 0,
    "cpdTarget" REAL NOT NULL DEFAULT 20,
    "employmentStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Teacher" ("createdAt", "department", "designation", "id", "joinDate", "qualification", "staffId", "status", "subjects", "updatedAt", "userId") SELECT "createdAt", "department", "designation", "id", "joinDate", "qualification", "staffId", "status", "subjects", "updatedAt", "userId" FROM "Teacher";
DROP TABLE "Teacher";
ALTER TABLE "new_Teacher" RENAME TO "Teacher";
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");
CREATE UNIQUE INDEX "Teacher_staffId_key" ON "Teacher"("staffId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
