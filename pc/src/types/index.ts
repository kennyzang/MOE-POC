export type UserRole =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'admin'
  | 'manager'
  | 'finance'
  | 'admissions'
  | 'hod'
  | 'principal'
  | 'counselor'

export interface User {
  id: string
  username: string
  displayName: string
  email?: string
  role: UserRole
  avatar?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  token: string
  user: User
}

// ─── Domain Models ──────────────────────────────────────────────

export interface Student {
  id: string
  userId: string
  studentId: string
  dateOfBirth?: string
  gender?: string
  nationality?: string
  gradeLevel?: string
  className?: string
  enrollmentStatus: string
  user: User
  enrollments?: Enrollment[]
  grades?: Grade[]
}

export interface PerformanceEvaluation {
  id: string
  teacherId: string
  academicYear: string
  evaluatorId: string
  teachingScore?: number
  professionalScore?: number
  conductScore?: number
  overallScore?: number
  rating?: string
  comments?: string
  status: string
  reviewerId?: string
  reviewerComments?: string
  submittedAt?: string
  reviewedAt?: string
  createdAt: string
  teacher?: { user?: { displayName?: string } }
}

export interface Teacher {
  id: string
  userId: string
  staffId: string
  designation?: string
  department?: string
  qualification?: string
  subjects?: string
  joinDate?: string
  status: string
  cpdHours?: number
  cpdTarget?: number
  employmentStatus?: string
  user: User
  certifications?: Certification[]
  courseAssignments?: CourseAssignment[]
  performanceEvaluations?: PerformanceEvaluation[]
}

export interface Course {
  id: string
  code: string
  name: string
  description?: string
  gradeLevel?: string
  creditHours: number
  status: string
  assignments?: CourseAssignment[]
  enrollments?: Enrollment[]
}

export interface CourseAssignment {
  id: string
  courseId: string
  teacherId: string
  semester?: string
  schedule?: string
  course?: Course
  teacher?: Teacher
}

export interface Enrollment {
  id: string
  studentId: string
  courseId: string
  semester?: string
  status: string
  course?: Course
  student?: Student
}

export interface GradeItem {
  id: string
  courseId: string
  name: string
  type: string
  maxScore: number
  weight: number
  dueDate?: string
  course?: Course
}

export interface Grade {
  id: string
  studentId: string
  gradeItemId: string
  score?: number
  letterGrade?: string
  remarks?: string
  gradedAt?: string
  student?: Student
  gradeItem?: GradeItem
}

export interface AttendanceSession {
  id: string
  courseId: string
  date: string
  topic?: string
  status: string
  course?: Course
  _count?: { records: number }
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: string
  checkedInAt?: string
  session?: AttendanceSession
  student?: Student
}

export interface Admission {
  id: string
  applicationNumber?: string
  applicantName: string
  dateOfBirth?: string
  gender?: string
  icNumber?: string
  nationality?: string
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  parentRelationship?: string
  gradeApplied: string
  previousSchool?: string
  programmeStream?: string
  medicalConditions?: string
  previousAcademicAvg?: number
  hasSiblingPriority?: boolean
  siblingName?: string
  siblingStudentId?: string
  docsComplete?: boolean
  eligibilityScore?: number
  status: string
  submittedAt: string
  decidedAt?: string
  remarks?: string
}

export interface Certification {
  id: string
  teacherId: string
  name: string
  issuedBy?: string
  issuedDate?: string
  expiryDate?: string
  status: string
  documentUrl?: string
  teacher?: Teacher
}

export interface Facility {
  id: string
  name: string
  type: string
  capacity?: number
  location?: string
  status: string
  bookings?: FacilityBooking[]
}

export interface TimetableSlot {
  id: string
  courseId: string
  teacherId: string
  gradeLevel: string
  className?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room?: string
  semester: string
  course?: { id: string; code: string; name: string }
  teacher?: { id: string; user?: { displayName?: string } }
}

export interface FacilityBooking {
  id: string
  facilityId: string
  bookedBy: string
  purpose: string
  date: string
  startTime: string
  endTime: string
  status: string
  createdAt: string
  facility?: { id: string; name: string; type: string }
}

export interface FeeInvoice {
  id: string
  studentId: string
  semester?: string
  amount: number
  status: string
  dueDate?: string
  paidAt?: string
  description?: string
  student?: Student
}

export interface SchoolExpense {
  id: string
  category: string
  description: string
  amount: number
  date: string
  approvedBy?: string
  status: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

// ─── API Response ───────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
}

// ─── Dashboard Stats ────────────────────────────────────────────

export interface AdminDashboardStats {
  totalStudents: number
  totalTeachers: number
  totalCourses: number
  attendanceRate: number
  pendingAdmissions: number
  enrollmentByGrade: { gradeLevel: string; count: number }[]
  recentAdmissions: Admission[]
  financeSummary: { totalFees: number; collected: number; outstanding: number }
}

export interface CourseSchedule {
  courseId: string
  courseCode: string
  courseName: string
  gradeLevel: string
  schedule: string | null
}

export interface AttendanceBreakdown {
  present: number
  absent: number
  late: number
  excused: number
}

export interface AttendanceAlert {
  studentId: string
  name: string
  className: string
  attendanceRate: number
}

export interface StudentDashboardStats {
  enrolledCourses: number
  attendanceRate: number
  gpa: number
  upcomingItems: GradeItem[]
  courseSchedules: CourseSchedule[]
  attendanceBreakdown: AttendanceBreakdown
}

export interface EgncService {
  name: string
  status: 'connected' | 'disconnected' | 'maintenance'
  lastSync: string | null
  description: string
}
