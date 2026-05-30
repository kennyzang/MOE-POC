/*
  Warnings:

  - The required column `applicationNumber` was added to the `Admission` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "absenceReason" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "notifiedAt" DATETIME;
ALTER TABLE "AttendanceRecord" ADD COLUMN "parentNote" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "reasonSubmittedAt" DATETIME;

-- AlterTable
ALTER TABLE "SchoolExpense" ADD COLUMN "approvalRequestId" TEXT;
ALTER TABLE "SchoolExpense" ADD COLUMN "submittedBy" TEXT;

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admissionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionDocument_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "band" TEXT NOT NULL,
    "absences14d" INTEGER NOT NULL DEFAULT 0,
    "gradeAvg" REAL,
    "gradeTrend" REAL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CounselorCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "counselorUserId" TEXT,
    "openedReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CounselorCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "daysRequested" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "hodApproverId" TEXT,
    "hodApprovedAt" DATETIME,
    "hodRemarks" TEXT,
    "substituteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveApplication_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FeeType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "gradeLevel" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClassRoster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeLevel" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 35,
    "programme" TEXT,
    "formTeacherId" TEXT
);

-- CreateTable
CREATE TABLE "AcademicStandingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "previousStanding" TEXT NOT NULL,
    "newStanding" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "gradeAvg" REAL NOT NULL,
    "thresholdUsed" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicStandingHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "levelsRequired" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "level1ApproverId" TEXT,
    "level1ApprovedAt" DATETIME,
    "level1Remarks" TEXT,
    "level2ApproverId" TEXT,
    "level2ApprovedAt" DATETIME,
    "level2Remarks" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GradeAmendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "originalScore" REAL NOT NULL,
    "proposedScore" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" DATETIME,
    "approverRemarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CpdWorkshop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "subject" TEXT,
    "hours" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "location" TEXT,
    "maxParticipants" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CpdEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "completedAt" DATETIME,
    "hoursAwarded" REAL,
    CONSTRAINT "CpdEnrollment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "CpdWorkshop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CpdEnrollment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentTeacherMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "meetingDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParentTeacherMeeting_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentTeacherMeeting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Admission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationNumber" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "icNumber" TEXT,
    "nationality" TEXT,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "parentEmail" TEXT,
    "guardianUserId" TEXT,
    "gradeApplied" TEXT NOT NULL,
    "programmeStream" TEXT,
    "previousSchool" TEXT,
    "medicalConditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "eligibilityScore" REAL,
    "hasSiblingPriority" BOOLEAN NOT NULL DEFAULT false,
    "siblingName" TEXT,
    "siblingStudentId" TEXT,
    "docsComplete" BOOLEAN NOT NULL DEFAULT false,
    "previousAcademicAvg" REAL,
    "offerLetterPath" TEXT,
    "submittedAt" DATETIME,
    "decidedAt" DATETIME,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Admission" ("applicantName", "createdAt", "dateOfBirth", "decidedAt", "gender", "gradeApplied", "icNumber", "id", "nationality", "parentEmail", "parentName", "parentPhone", "previousSchool", "remarks", "status", "submittedAt", "updatedAt") SELECT "applicantName", "createdAt", "dateOfBirth", "decidedAt", "gender", "gradeApplied", "icNumber", "id", "nationality", "parentEmail", "parentName", "parentPhone", "previousSchool", "remarks", "status", "submittedAt", "updatedAt" FROM "Admission";
DROP TABLE "Admission";
ALTER TABLE "new_Admission" RENAME TO "Admission";
CREATE UNIQUE INDEX "Admission_applicationNumber_key" ON "Admission"("applicationNumber");
CREATE TABLE "new_FeeInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "semester" TEXT,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "description" TEXT,
    "lineItems" TEXT,
    "holdActive" BOOLEAN NOT NULL DEFAULT false,
    "holdReason" TEXT,
    "overdueNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FeeInvoice" ("amount", "createdAt", "description", "dueDate", "id", "paidAt", "semester", "status", "studentId") SELECT "amount", "createdAt", "description", "dueDate", "id", "paidAt", "semester", "status", "studentId" FROM "FeeInvoice";
DROP TABLE "FeeInvoice";
ALTER TABLE "new_FeeInvoice" RENAME TO "FeeInvoice";
CREATE UNIQUE INDEX "FeeInvoice_invoiceNumber_key" ON "FeeInvoice"("invoiceNumber");
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "nationality" TEXT,
    "icNumber" TEXT,
    "gradeLevel" TEXT,
    "className" TEXT,
    "enrollmentStatus" TEXT NOT NULL DEFAULT 'pending',
    "academicStanding" TEXT NOT NULL DEFAULT 'GOOD_STANDING',
    "academicStandingUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("className", "createdAt", "dateOfBirth", "enrollmentStatus", "gender", "gradeLevel", "icNumber", "id", "nationality", "studentId", "updatedAt", "userId") SELECT "className", "createdAt", "dateOfBirth", "enrollmentStatus", "gender", "gradeLevel", "icNumber", "id", "nationality", "studentId", "updatedAt", "userId" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
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
    "annualLeaveBalance" INTEGER NOT NULL DEFAULT 14,
    "medicalLeaveBalance" INTEGER NOT NULL DEFAULT 14,
    "leaveBalanceYear" TEXT NOT NULL DEFAULT '2025/2026',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Teacher" ("cpdHours", "cpdTarget", "createdAt", "department", "designation", "employmentStatus", "id", "joinDate", "qualification", "staffId", "status", "subjects", "updatedAt", "userId") SELECT "cpdHours", "cpdTarget", "createdAt", "department", "designation", "employmentStatus", "id", "joinDate", "qualification", "staffId", "status", "subjects", "updatedAt", "userId" FROM "Teacher";
DROP TABLE "Teacher";
ALTER TABLE "new_Teacher" RENAME TO "Teacher";
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");
CREATE UNIQUE INDEX "Teacher_staffId_key" ON "Teacher"("staffId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FeeType_code_key" ON "FeeType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoster_className_academicYear_key" ON "ClassRoster"("className", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "CpdEnrollment_workshopId_teacherId_key" ON "CpdEnrollment"("workshopId", "teacherId");
