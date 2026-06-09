-- AlterTable
ALTER TABLE "Admission" ADD COLUMN "documentsRequiredNote" TEXT;
ALTER TABLE "Admission" ADD COLUMN "eligibilityFlags" TEXT;
ALTER TABLE "Admission" ADD COLUMN "homeAddress" TEXT;
ALTER TABLE "Admission" ADD COLUMN "parentIcNumber" TEXT;
ALTER TABLE "Admission" ADD COLUMN "parentRelationship" TEXT;
ALTER TABLE "Admission" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "specialNeeds" TEXT;

-- AlterTable
ALTER TABLE "LeaveApplication" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "LeaveApplication" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "LeaveApplication" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "LeaveApplication" ADD COLUMN "documentUrl" TEXT;
ALTER TABLE "LeaveApplication" ADD COLUMN "principalApprovedAt" DATETIME;
ALTER TABLE "LeaveApplication" ADD COLUMN "principalApproverId" TEXT;
ALTER TABLE "LeaveApplication" ADD COLUMN "principalRemarks" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "link" TEXT;

-- CreateTable
CREATE TABLE "PrivateSchoolProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "ownerOrganisation" TEXT NOT NULL,
    "ownerContactName" TEXT,
    "ownerContactPhone" TEXT,
    "ownerContactEmail" TEXT,
    "district" TEXT NOT NULL,
    "curriculumModel" TEXT NOT NULL,
    "studentCapacity" INTEGER NOT NULL DEFAULT 0,
    "feeRangeBnd" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrivateSchoolProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolLicense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "issuedDate" DATETIME NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "authorisedLevels" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT,
    "documentPath" TEXT,
    "issuedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolLicense_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LicenseRenewal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "licenseId" TEXT NOT NULL,
    "previousExpiry" DATETIME NOT NULL,
    "newExpiry" DATETIME NOT NULL,
    "renewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "LicenseRenewal_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "SchoolLicense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "inspectionDate" DATETIME NOT NULL,
    "inspectorUserId" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "rating" TEXT,
    "findings" TEXT NOT NULL DEFAULT '[]',
    "followUpDueDate" DATETIME,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "reportPath" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolInspection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "findingCategory" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedTo" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionActionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "SchoolInspection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionEvidenceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "description" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionEvidenceDocument_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "SchoolInspection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceCircular" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circularNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "acknowledgementDueDate" DATETIME,
    "targetScope" TEXT NOT NULL,
    "targetDistrict" TEXT,
    "issuedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CircularTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circularId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "acknowledgedAt" DATETIME,
    "acknowledgedByUserId" TEXT,
    "acknowledgedNotes" TEXT,
    CONSTRAINT "CircularTarget_circularId_fkey" FOREIGN KEY ("circularId") REFERENCES "ComplianceCircular" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CircularTarget_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CpdWorkshopSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sessionDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CpdWorkshopSession_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "CpdWorkshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CpdWorkshopResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'document',
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CpdWorkshopResource_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "CpdWorkshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "fromSchoolId" TEXT,
    "toSchoolId" TEXT NOT NULL,
    "fromGradeLevel" TEXT,
    "toGradeLevel" TEXT,
    "fromClassName" TEXT,
    "toClassName" TEXT,
    "transitionType" TEXT NOT NULL DEFAULT 'GRADE_PROMOTION',
    "academicYear" TEXT NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "processedById" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentTransition_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentTransition_fromSchoolId_fkey" FOREIGN KEY ("fromSchoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentTransition_toSchoolId_fkey" FOREIGN KEY ("toSchoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "system" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "payloadSize" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "examDate" DATETIME NOT NULL,
    "venue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExamCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "seatNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'registered',
    CONSTRAINT "ExamCandidate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamCandidate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SenStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "diagnosisType" TEXT NOT NULL,
    "supportLevel" TEXT NOT NULL DEFAULT 'LEVEL_1',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SenStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IepGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senStudentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IepGoal_senStudentId_fkey" FOREIGN KEY ("senStudentId") REFERENCES "SenStudent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IepSessionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senStudentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "conductedBy" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IepSessionLog_senStudentId_fkey" FOREIGN KEY ("senStudentId") REFERENCES "SenStudent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1,
    "kohaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LibraryLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "borrowedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "returnedAt" DATETIME,
    "fineAmount" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "LibraryLoan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryHold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    CONSTRAINT "LibraryHold_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryHold_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schoolId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "schoolId" TEXT,
    "location" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'Good',
    "purchaseDate" DATETIME,
    "value" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetMaintenanceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "cost" REAL,
    "conductedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetMaintenanceLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "schoolId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StaffAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "checkInAt" DATETIME,
    "checkOutAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABSENT',
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "locationLat" REAL,
    "locationLng" REAL,
    "locationLabel" TEXT,
    "autoMarked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffAttendanceRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'EXCELLENCE',
    "description" TEXT,
    "awardedDate" DATETIME NOT NULL,
    "awardedBy" TEXT,
    "badgeColor" TEXT NOT NULL DEFAULT 'gold',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Award_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostingRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetirementApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "retirementType" TEXT NOT NULL DEFAULT 'NORMAL',
    "requestedDate" DATETIME NOT NULL,
    "reason" TEXT,
    "documentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewRemarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetirementApplication_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffAttendanceConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '07:30',
    "cutoffTime" TEXT NOT NULL DEFAULT '09:00',
    "absenceAlertDays" INTEGER NOT NULL DEFAULT 3,
    "frequentAbsenceDays" INTEGER NOT NULL DEFAULT 3,
    "frequentLatenessCount" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RATING',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "responderId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialAid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "aidType" TEXT NOT NULL,
    "amount" REAL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "eligibilityStatus" TEXT NOT NULL DEFAULT 'active',
    "approvedDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialAid_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HostelRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "hostelName" TEXT NOT NULL,
    "roomNumber" TEXT,
    "checkInDate" DATETIME,
    "emergencyContact" TEXT,
    "semester" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HostelRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "busRoute" TEXT NOT NULL,
    "busNumber" TEXT,
    "provider" TEXT,
    "pickupPoint" TEXT,
    "dropoffPoint" TEXT,
    "semester" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 5,
    "schoolId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationTriggerLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "triggerType" TEXT NOT NULL,
    "ranAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationsSent" INTEGER NOT NULL DEFAULT 0,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "summary" TEXT
);

-- CreateTable
CREATE TABLE "ConsentForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "schoolId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dueDate" DATETIME,
    "targetGradeLevel" TEXT,
    "targetStudentIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConsentFormRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "acknowledgedAt" DATETIME,
    "acknowledgmentNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentFormRecipient_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ConsentForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SelfServiceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "preferredSchools" TEXT,
    "transferReason" TEXT,
    "transferEffectiveDate" DATETIME,
    "currentPosition" TEXT,
    "desiredPosition" TEXT,
    "promotionJustification" TEXT,
    "courseName" TEXT,
    "courseProvider" TEXT,
    "courseDates" TEXT,
    "courseCost" REAL,
    "courseJustification" TEXT,
    "documentType" TEXT,
    "profileChanges" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "documentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewerRemarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SelfServiceRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdmissionDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admissionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT,
    "docStatus" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionDocument_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AdmissionDocument" ("admissionId", "filePath", "filename", "id", "type", "uploadedAt") SELECT "admissionId", "filePath", "filename", "id", "type", "uploadedAt" FROM "AdmissionDocument";
DROP TABLE "AdmissionDocument";
ALTER TABLE "new_AdmissionDocument" RENAME TO "AdmissionDocument";
CREATE TABLE "new_ClassRoster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeLevel" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 35,
    "programme" TEXT,
    "formTeacherId" TEXT,
    "schoolId" TEXT,
    CONSTRAINT "ClassRoster_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClassRoster" ("academicYear", "capacity", "className", "formTeacherId", "gradeLevel", "id", "programme") SELECT "academicYear", "capacity", "className", "formTeacherId", "gradeLevel", "id", "programme" FROM "ClassRoster";
DROP TABLE "ClassRoster";
ALTER TABLE "new_ClassRoster" RENAME TO "ClassRoster";
CREATE UNIQUE INDEX "ClassRoster_className_academicYear_schoolId_key" ON "ClassRoster"("className", "academicYear", "schoolId");
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gradeLevel" TEXT,
    "creditHours" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schoolId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("code", "createdAt", "creditHours", "description", "gradeLevel", "id", "name", "status", "updatedAt") SELECT "code", "createdAt", "creditHours", "description", "gradeLevel", "id", "name", "status", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_code_schoolId_key" ON "Course"("code", "schoolId");
CREATE TABLE "new_CpdWorkshop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "subject" TEXT,
    "description" TEXT,
    "objectives" TEXT,
    "targetAudience" TEXT,
    "prerequisites" TEXT,
    "facilitatorId" TEXT,
    "imageUrl" TEXT,
    "hours" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "location" TEXT,
    "maxParticipants" INTEGER NOT NULL DEFAULT 30,
    "category" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CpdWorkshop_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CpdWorkshop" ("createdAt", "endDate", "hours", "id", "location", "maxParticipants", "provider", "startDate", "status", "subject", "title") SELECT "createdAt", "endDate", "hours", "id", "location", "maxParticipants", "provider", "startDate", "status", "subject", "title" FROM "CpdWorkshop";
DROP TABLE "CpdWorkshop";
ALTER TABLE "new_CpdWorkshop" RENAME TO "CpdWorkshop";
CREATE TABLE "new_PerformanceEvaluation" (
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
    "selfAssessment" TEXT,
    "selfAssessmentTeachingScore" REAL,
    "selfAssessmentProfessionalScore" REAL,
    "selfAssessmentConductScore" REAL,
    "selfAssessmentSubmittedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending_self_assessment',
    "reviewerId" TEXT,
    "reviewerComments" TEXT,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PerformanceEvaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PerformanceEvaluation" ("academicYear", "comments", "conductScore", "createdAt", "evaluatorId", "id", "overallScore", "professionalScore", "rating", "reviewedAt", "reviewerComments", "reviewerId", "status", "submittedAt", "teacherId", "teachingScore", "updatedAt") SELECT "academicYear", "comments", "conductScore", "createdAt", "evaluatorId", "id", "overallScore", "professionalScore", "rating", "reviewedAt", "reviewerComments", "reviewerId", "status", "submittedAt", "teacherId", "teachingScore", "updatedAt" FROM "PerformanceEvaluation";
DROP TABLE "PerformanceEvaluation";
ALTER TABLE "new_PerformanceEvaluation" RENAME TO "PerformanceEvaluation";
CREATE TABLE "new_School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "authority" TEXT NOT NULL DEFAULT 'MOE',
    "schoolType" TEXT NOT NULL DEFAULT 'secondary',
    "address" TEXT,
    "phone" TEXT,
    "principal" TEXT,
    "gradeLevels" TEXT NOT NULL DEFAULT '["Year 7","Year 8","Year 9","Year 10","Year 11"]',
    "programmes" TEXT NOT NULL DEFAULT '["Academic"]',
    "classLetters" TEXT NOT NULL DEFAULT '["A","B","C","D","E"]',
    "establishedYear" INTEGER,
    "motto" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_School" ("address", "code", "createdAt", "id", "name", "phone", "principal") SELECT "address", "code", "createdAt", "id", "name", "phone", "principal" FROM "School";
DROP TABLE "School";
ALTER TABLE "new_School" RENAME TO "School";
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");
CREATE TABLE "new_SchoolEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "endDate" DATETIME,
    "type" TEXT NOT NULL DEFAULT 'event',
    "description" TEXT,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SchoolEvent" ("createdAt", "date", "description", "endDate", "id", "title", "type", "updatedAt") SELECT "createdAt", "date", "description", "endDate", "id", "title", "type", "updatedAt" FROM "SchoolEvent";
DROP TABLE "SchoolEvent";
ALTER TABLE "new_SchoolEvent" RENAME TO "SchoolEvent";
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT,
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
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("academicStanding", "academicStandingUpdatedAt", "className", "createdAt", "dateOfBirth", "enrollmentStatus", "gender", "gradeLevel", "icNumber", "id", "nationality", "studentId", "updatedAt", "userId") SELECT "academicStanding", "academicStandingUpdatedAt", "className", "createdAt", "dateOfBirth", "enrollmentStatus", "gender", "gradeLevel", "icNumber", "id", "nationality", "studentId", "updatedAt", "userId" FROM "Student";
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
    "staffType" TEXT NOT NULL DEFAULT 'TEACHING',
    "annualLeaveBalance" INTEGER NOT NULL DEFAULT 14,
    "medicalLeaveBalance" INTEGER NOT NULL DEFAULT 14,
    "maternityLeaveBalance" INTEGER NOT NULL DEFAULT 90,
    "paternityLeaveBalance" INTEGER NOT NULL DEFAULT 7,
    "unpaidLeaveBalance" INTEGER NOT NULL DEFAULT 30,
    "leaveBalanceYear" TEXT NOT NULL DEFAULT '2025/2026',
    "ssmLastSyncedAt" DATETIME,
    "ssmBalances" TEXT,
    "dateOfBirth" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "schoolId" TEXT,
    CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Teacher" ("annualLeaveBalance", "cpdHours", "cpdTarget", "createdAt", "department", "designation", "employmentStatus", "id", "joinDate", "leaveBalanceYear", "medicalLeaveBalance", "qualification", "staffId", "status", "subjects", "updatedAt", "userId") SELECT "annualLeaveBalance", "cpdHours", "cpdTarget", "createdAt", "department", "designation", "employmentStatus", "id", "joinDate", "leaveBalanceYear", "medicalLeaveBalance", "qualification", "staffId", "status", "subjects", "updatedAt", "userId" FROM "Teacher";
DROP TABLE "Teacher";
ALTER TABLE "new_Teacher" RENAME TO "Teacher";
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");
CREATE UNIQUE INDEX "Teacher_staffId_key" ON "Teacher"("staffId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schoolId" TEXT,
    "systemAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatar", "createdAt", "displayName", "email", "id", "password", "role", "status", "updatedAt", "username") SELECT "avatar", "createdAt", "displayName", "email", "id", "password", "role", "status", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PrivateSchoolProfile_schoolId_key" ON "PrivateSchoolProfile"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateSchoolProfile_registrationNo_key" ON "PrivateSchoolProfile"("registrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolLicense_licenseNumber_key" ON "SchoolLicense"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCircular_circularNumber_key" ON "ComplianceCircular"("circularNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CircularTarget_circularId_schoolId_key" ON "CircularTarget"("circularId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCandidate_examId_studentId_subjectCode_key" ON "ExamCandidate"("examId", "studentId", "subjectCode");

-- CreateIndex
CREATE UNIQUE INDEX "SenStudent_studentId_key" ON "SenStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceRecord_teacherId_date_key" ON "StaffAttendanceRecord"("teacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementApplication_teacherId_key" ON "RetirementApplication"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceConfig_schoolId_key" ON "StaffAttendanceConfig"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_responderId_key" ON "SurveyResponse"("surveyId", "responderId");

-- CreateIndex
CREATE UNIQUE INDEX "HostelRecord_studentId_key" ON "HostelRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "BusRecord_studentId_key" ON "BusRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentFormRecipient_formId_parentUserId_studentId_key" ON "ConsentFormRecipient"("formId", "parentUserId", "studentId");

