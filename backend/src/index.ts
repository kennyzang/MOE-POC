import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from './routes/auth'
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

// Error handling
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`\nMOE SERPS API running at http://localhost:${PORT}`)
  console.log(`Health: http://localhost:${PORT}/health\n`)
})

export default app
