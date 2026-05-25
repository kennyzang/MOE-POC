export type UserRole =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'admin'
  | 'manager'
  | 'finance'
  | 'admissions'

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
