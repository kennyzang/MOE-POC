export type UserRole = 'student' | 'teacher' | 'parent' | 'admin' | 'manager' | 'finance' | 'admissions'

export interface User {
  id: string
  username: string
  displayName: string
  email?: string
  role: UserRole
  avatar?: string
}

export interface LoginResponse {
  success: boolean
  token: string
  user: User
}

export interface Course {
  id: string
  code: string
  name: string
  gradeLevel?: string
  creditHours: number
  status: string
  description?: string
}

export interface CourseAssignment {
  id: string
  courseId: string
  teacherId: string
  semester?: string
  schedule?: string
  course?: Course
}

export interface Enrollment {
  id: string
  studentId: string
  courseId: string
  status: string
  enrolledAt?: string
  course?: Course
}

export interface GradeItem {
  id: string
  courseId: string
  name: string
  type: string
  maxScore: number
  weight: number
  dueDate?: string
  course?: { name: string; code: string }
}

export interface Grade {
  id: string
  studentId: string
  gradeItemId: string
  score: number | null
  letterGrade?: string
  gradedAt?: string
  gradeItem?: GradeItem
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: 'present' | 'absent' | 'late' | 'excused'
  absenceReason?: string
  parentNote?: string
  reasonSubmittedAt?: string
  session?: {
    id: string
    date: string
    topic?: string
    course?: { id: string; code: string; name: string }
  }
  student?: { user: { displayName: string } }
}

export interface AttendanceSession {
  id: string
  courseId: string
  date: string
  topic?: string
  status: string
  course?: { id: string; code: string; name: string }
  _count?: { records: number }
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
  user: User
  courseAssignments?: CourseAssignment[]
}

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

export interface ParentDashboardStats {
  children: Array<{
    studentId: string
    displayName: string
    gradeLevel?: string
    gpa: number
    attendanceRate: number
  }>
}

export interface StudentDashboardStats {
  enrolledCourses: number
  attendanceRate: number
  gpa: number
  upcomingItems: Array<{
    id: string
    name: string
    type: string
    dueDate?: string
    course?: { name: string; code: string }
  }>
}

export interface TeacherDashboardStats {
  myCourses: number
  myStudents: number
  upcomingSessions: AttendanceSession[]
  recentGrades: Grade[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  link?: string
  read: boolean
  createdAt: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  targetAudience: string
  gradeLevel?: string
  priority: 'normal' | 'high' | 'urgent'
  isPinned: boolean
  publishedAt: string
  expiresAt?: string
  createdAt?: string
  author?: { displayName: string }
}

export interface DirectMessage {
  id: string
  threadId: string
  senderId: string
  content: string
  readAt?: string
  createdAt: string
  sender?: { id: string; displayName: string; role: string }
}

export interface MessageThread {
  id: string
  subject: string
  parentUserId: string
  teacherUserId: string
  studentId?: string
  updatedAt: string
  createdAt: string
  parentName?: string
  teacherName?: string
  unreadCount?: number
  messages?: DirectMessage[]
}

export interface StaffAttendanceRecord {
  id: string
  teacherId: string
  date: string
  checkInAt?: string | null
  checkOutAt?: string | null
  status: string
  lateMinutes: number
}

export interface StaffAttendanceConfig {
  startTime: string
  endTime: string
}
