import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from './routes/auth'
import studentRoutes from './routes/students'
import teacherRoutes from './routes/teachers'
import courseRoutes from './routes/courses'
import gradeRoutes from './routes/grades'
import attendanceRoutes from './routes/attendance'
import admissionRoutes from './routes/admissions'
import certificationRoutes from './routes/certifications'
import facilityRoutes from './routes/facilities'
import financeRoutes from './routes/finance'
import dashboardRoutes from './routes/dashboard'
import enrollmentRoutes from './routes/enrollments'
import egncRoutes from './routes/egnc'
import emsRoutes from './routes/ems'
import smsRoutes from './routes/sms'
import aiRoutes from './routes/ai'
import notificationRoutes from './routes/notifications'
import configRoutes from './routes/config'
import pushRoutes from './routes/push'
import adminRoutes from './routes/admin'
import eventsRoutes from './routes/events'
import approvalsRoutes from './routes/approvals'
import counselorRoutes from './routes/counselor'
import hodRoutes from './routes/hod'
import parentRoutes from './routes/parent'
import fileRoutes from './routes/files'
import path from 'path'
import { errorHandler, notFound } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT ?? 4000

// Security
app.use(helmet({ contentSecurityPolicy: false }))
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map(s => s.trim()),
    credentials: true,
  })
)

// Parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Logging
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'))

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0', ts: new Date().toISOString() }))

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/students', studentRoutes)
app.use('/api/v1/teachers', teacherRoutes)
app.use('/api/v1/courses', courseRoutes)
app.use('/api/v1/grades', gradeRoutes)
app.use('/api/v1/attendance', attendanceRoutes)
app.use('/api/v1/admissions', admissionRoutes)
app.use('/api/v1/certifications', certificationRoutes)
app.use('/api/v1/facilities', facilityRoutes)
app.use('/api/v1/finance', financeRoutes)
app.use('/api/v1/dashboard', dashboardRoutes)
app.use('/api/v1/enrollments', enrollmentRoutes)
app.use('/api/v1/egnc', egncRoutes)
app.use('/api/v1/ems', emsRoutes)
app.use('/api/v1/sms', smsRoutes)
app.use('/api/v1/ai', aiRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/config', configRoutes)
app.use('/api/v1/push', pushRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/events', eventsRoutes)
app.use('/api/v1/approvals', approvalsRoutes)
app.use('/api/v1/counselor', counselorRoutes)
app.use('/api/v1/hod', hodRoutes)
app.use('/api/v1/parent', parentRoutes)
app.use('/api/v1/files', fileRoutes)

// Serve uploaded files (used by download route — not direct public access)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Error handling
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`\nMOE SERPS API running at http://localhost:${PORT}`)
  console.log(`Health: http://localhost:${PORT}/health\n`)
})

export default app
