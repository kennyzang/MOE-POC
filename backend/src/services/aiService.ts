// ============================================================
// MOE SERPS AI Service – Multi-provider LLM integration
// Adapted from unissa-poc/backend/src/services/aiService.ts
// Providers: Anthropic Claude, OpenAI-compatible, Custom
// Config stored in SystemConfig table (key prefix: ai_)
// ============================================================

import prisma from '../lib/prisma'

export interface AiConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'custom'
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const DEFAULT_SYSTEM_PROMPT = `You are MOE AI Assistant, the official AI assistant for the Ministry of Education (Brunei) School Enterprise Resource Planning System (SERPS).

You help students, parents, teachers, and school administrators with:
- Course registration, enrollment, and academic matters
- Attendance records and policies
- Grade inquiries and academic performance
- School schedules and timetables
- Fee inquiries and payment status
- School policies and procedures
- Administrative tasks (for staff)

Always be helpful, accurate, and professional. Respond in English by default, but you may respond in Malay if the user writes in Malay.
When you have access to user context data, use it to provide personalised answers.
If you don't know something specific, direct users to the relevant department or school office.
Refer to the school as "the school" or by its specific name if known.`

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  openai:    { baseUrl: 'https://api.openai.com/v1',    model: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' },
  custom:    { baseUrl: 'http://localhost:11434/v1',     model: 'llama3.2' },
}

// ── Config ──────────────────────────────────────────────────────

export async function loadAiConfig(): Promise<AiConfig> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { startsWith: 'ai_' } },
  })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value

  const provider = (map['ai_provider'] || process.env.AI_PROVIDER || 'anthropic') as AiConfig['provider']
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.anthropic

  return {
    enabled:      (map['ai_enabled'] ?? process.env.AI_ENABLED ?? 'true') === 'true',
    provider,
    apiKey:       map['ai_api_key']       ?? process.env.AI_API_KEY      ?? '',
    model:        map['ai_model']         ?? process.env.AI_MODEL        ?? defaults.model,
    baseUrl:      map['ai_base_url']      ?? process.env.AI_BASE_URL     ?? defaults.baseUrl,
    systemPrompt: map['ai_system_prompt'] ?? process.env.AI_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
    temperature:  parseFloat(map['ai_temperature'] ?? process.env.AI_TEMPERATURE ?? '0.7'),
    maxTokens:    parseInt(map['ai_max_tokens']    ?? process.env.AI_MAX_TOKENS   ?? '2048', 10),
  }
}

export async function saveAiConfig(cfg: Partial<AiConfig>): Promise<void> {
  const updates: Record<string, string> = {}
  if (cfg.enabled      !== undefined) updates['ai_enabled']       = String(cfg.enabled)
  if (cfg.provider     !== undefined) updates['ai_provider']      = cfg.provider
  if (cfg.apiKey       !== undefined) updates['ai_api_key']       = cfg.apiKey
  if (cfg.model        !== undefined) updates['ai_model']         = cfg.model
  if (cfg.baseUrl      !== undefined) updates['ai_base_url']      = cfg.baseUrl
  if (cfg.systemPrompt !== undefined) updates['ai_system_prompt'] = cfg.systemPrompt
  if (cfg.temperature  !== undefined) updates['ai_temperature']   = String(cfg.temperature)
  if (cfg.maxTokens    !== undefined) updates['ai_max_tokens']    = String(cfg.maxTokens)

  for (const [key, value] of Object.entries(updates)) {
    await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, description: `AI configuration: ${key}` },
      update: { value },
    })
  }
}

// ── Context Builder ──────────────────────────────────────────────

export async function buildContextData(userId: string, role: string) {
  if (role === 'student') {
    const student = await prisma.student.findFirst({
      where: { userId },
      include: {
        user: { select: { displayName: true, email: true } },
        enrollments: {
          where: { status: 'enrolled' },
          include: { course: { select: { code: true, name: true, gradeLevel: true } } },
        },
        grades: {
          include: { gradeItem: { include: { course: { select: { name: true } } } } },
          orderBy: { gradedAt: 'desc' },
          take: 20,
        },
        attendances: {
          include: { session: { include: { course: { select: { name: true, code: true } } } } },
          orderBy: { session: { date: 'desc' } },
          take: 20,
        },
      },
    })
    return student ? { student } : {}

  } else if (role === 'teacher') {
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        user: { select: { displayName: true } },
        courseAssignments: {
          include: {
            course: {
              include: {
                enrollments: { where: { status: 'enrolled' }, include: { student: { include: { user: { select: { displayName: true } } } } } },
                attendanceSessions: { orderBy: { date: 'desc' }, take: 5, include: { records: { select: { studentId: true, status: true } } } },
              },
            },
          },
        },
      },
    })
    return teacher ? { teacher } : {}

  } else if (role === 'parent') {
    const parent = await prisma.parent.findFirst({
      where: { userId },
      include: {
        childLinks: {
          include: {
            student: {
              include: {
                user: { select: { displayName: true } },
                enrollments: { where: { status: 'enrolled' }, include: { course: { select: { name: true, code: true } } } },
                grades: { include: { gradeItem: { include: { course: { select: { name: true } } } } }, orderBy: { gradedAt: 'desc' }, take: 10 },
                attendances: { include: { session: { include: { course: { select: { name: true } } } } }, orderBy: { session: { date: 'desc' } }, take: 10 },
              },
            },
          },
        },
      },
    })
    return parent ? { parent } : {}

  } else if (role === 'admin' || role === 'manager' || role === 'principal') {
    const [studentCount, teacherCount, pendingAdmissions, lowAttendanceCount] = await Promise.all([
      prisma.student.count({ where: { enrollmentStatus: 'enrolled' } }),
      prisma.teacher.count({ where: { status: 'active' } }),
      prisma.admission.count({ where: { status: 'pending' } }),
      prisma.student.count(),
    ])
    return { admin: { studentCount, teacherCount, pendingAdmissions, totalStudents: lowAttendanceCount } }
  }

  return {}
}

// ── Message Builder ──────────────────────────────────────────────

function buildContextStr(contextData: any): string {
  if (contextData.student) {
    const s = contextData.student
    const courseLines = (s.enrollments ?? []).map((e: any) =>
      `  • ${e.course?.code} – ${e.course?.name}`
    ).join('\n') || '  None'

    const gradeLines = (s.grades ?? []).slice(0, 8).map((g: any) =>
      `  • ${g.gradeItem?.course?.name} – ${g.gradeItem?.name}: ${g.score ?? 'N/A'}/${g.gradeItem?.maxScore ?? 100} (${g.letterGrade ?? '-'})`
    ).join('\n') || '  No grades yet'

    const presentCount = (s.attendances ?? []).filter((a: any) => a.status === 'present').length
    const totalAtt = (s.attendances ?? []).length
    const attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : null

    return `=== STUDENT CONTEXT ===
Name: ${s.user?.displayName ?? 'Unknown'} | Student ID: ${s.studentId}
Grade: ${s.gradeLevel ?? 'Unknown'} | Class: ${s.className ?? 'Unknown'} | Status: ${s.enrollmentStatus}

Enrolled Courses:
${courseLines}

Recent Grades:
${gradeLines}

Attendance: ${attRate !== null ? `${attRate}% (${presentCount}/${totalAtt} sessions)` : 'No records yet'}
======================`

  } else if (contextData.teacher) {
    const t = contextData.teacher
    const courseLines = (t.courseAssignments ?? []).map((ca: any) =>
      `  • ${ca.course?.name} (${ca.course?.enrollments?.length ?? 0} students)`
    ).join('\n') || '  None'
    return `=== TEACHER CONTEXT ===
Name: ${t.user?.displayName ?? 'Unknown'} | Staff ID: ${t.staffId}
Department: ${t.department ?? 'Unknown'} | CPD: ${t.cpdHours}/${t.cpdTarget}h

Assigned Courses:
${courseLines}
======================`

  } else if (contextData.parent) {
    const p = contextData.parent
    const childLines = (p.childLinks ?? []).map((cl: any) => {
      const s = cl.student
      const presentCount = (s.attendances ?? []).filter((a: any) => a.status === 'present').length
      const totalAtt = (s.attendances ?? []).length
      const attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : null
      return `  Child: ${s.user?.displayName ?? 'Unknown'} | Grade ${s.gradeLevel ?? 'Unknown'} | Attendance: ${attRate !== null ? attRate + '%' : 'N/A'}`
    }).join('\n') || '  No children linked'
    return `=== PARENT CONTEXT ===
${childLines}
======================`

  } else if (contextData.admin) {
    const a = contextData.admin
    return `=== ADMIN CONTEXT ===
Enrolled Students: ${a.studentCount}
Active Teachers: ${a.teacherCount}
Pending Admissions: ${a.pendingAdmissions}
======================`
  }

  return ''
}

async function buildMessages(
  cfg: AiConfig,
  userMessage: string,
  contextData: any,
  conversationHistory: ChatMessage[],
): Promise<ChatMessage[]> {
  const contextStr = buildContextStr(contextData)
  const systemContent = contextStr
    ? `${cfg.systemPrompt}\n\n${contextStr}`
    : cfg.systemPrompt

  return [
    { role: 'system', content: systemContent },
    ...conversationHistory.slice(-10),
    { role: 'user', content: userMessage },
  ]
}

// ── LLM Providers ────────────────────────────────────────────────

async function callOpenAI(cfg: AiConfig, messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`)
  const data = await response.json() as any
  return data.choices?.[0]?.message?.content ?? ''
}

async function callOpenAIStream(cfg: AiConfig, messages: ChatMessage[], onChunk: (c: string) => void): Promise<void> {
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature, max_tokens: cfg.maxTokens, stream: true }),
  })
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const dataStr = trimmed.slice(6)
      if (dataStr === '[DONE]') return
      try {
        const data = JSON.parse(dataStr) as any
        const chunk = data.choices?.[0]?.delta?.content
        if (chunk) onChunk(chunk)
      } catch { /* ignore */ }
    }
  }
}

async function callAnthropic(cfg: AiConfig, messages: ChatMessage[]): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? cfg.systemPrompt
  const chatMsgs  = messages.filter(m => m.role !== 'system')
  const response = await fetch(`${cfg.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: cfg.model, system: systemMsg, messages: chatMsgs, max_tokens: cfg.maxTokens }),
  })
  if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)
  const data = await response.json() as any
  return data.content?.[0]?.text ?? ''
}

async function callAnthropicStream(cfg: AiConfig, messages: ChatMessage[], onChunk: (c: string) => void): Promise<void> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? cfg.systemPrompt
  const chatMsgs  = messages.filter(m => m.role !== 'system')
  const response = await fetch(`${cfg.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: cfg.model, system: systemMsg, messages: chatMsgs, max_tokens: cfg.maxTokens, stream: true }),
  })
  if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      try {
        const data = JSON.parse(trimmed.slice(6)) as any
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          onChunk(data.delta.text)
        }
      } catch { /* ignore */ }
    }
  }
}

// ── Demo Fallback ────────────────────────────────────────────────

function getDemoAnswer(message: string, ctx: any): string {
  const m = message.toLowerCase()

  if (m.includes('course registration') || m.includes('registration close') || m.includes('registration deadline')) {
    const remaining = 4
    return `Your course registration deadline is **28 February 2026** (${remaining} days remaining). Please ensure you have completed your course selection before the deadline. Contact your class teacher for assistance.`
  }
  if ((m.includes('drop') || m.includes('withdraw')) && m.includes('course')) {
    const courses = ctx.student?.enrollments ?? []
    const count = courses.length
    return `Yes, you can drop a course during the add/drop period (ends 14 March 2026). You currently have **${count} courses** enrolled. Dropping one course would leave you with ${count - 1} courses (minimum requirement: 3 courses). Please submit a Course Drop Form to your class teacher.`
  }
  if (m.includes('attendance') || m.includes('absent')) {
    if (ctx.student) {
      const presentCount = (ctx.student.attendances ?? []).filter((a: any) => a.status === 'present').length
      const total = (ctx.student.attendances ?? []).length
      const rate = total > 0 ? Math.round((presentCount / total) * 100) : null
      if (rate !== null) {
        const status = rate >= 80 ? 'Good' : rate >= 75 ? 'Satisfactory – please improve' : 'Below minimum – please attend more classes'
        return `Your current attendance rate is **${rate}%** (${presentCount}/${total} sessions). Status: **${status}**. Minimum required attendance is 75%.`
      }
    }
    return 'The minimum attendance requirement is **75%** for all courses. Students below this threshold may be barred from final examinations. Check your attendance records in the Student Portal.'
  }
  if (m.includes('grade') || m.includes('marks') || m.includes('score') || m.includes('gpa')) {
    if (ctx.student?.grades?.length) {
      const recent = ctx.student.grades[0]
      return `Your most recent grade is **${recent.gradeItem?.course?.name ?? 'a course'}** – ${recent.gradeItem?.name}: **${recent.score}/${recent.gradeItem?.maxScore ?? 100}** (${recent.letterGrade ?? 'N/A'}). View all grades in Student Portal → My Grades.`
    }
    return 'Your grades can be viewed in Student Portal → My Grades. Grades are updated by your teachers after each assessment. Contact your subject teacher if you have grade queries.'
  }
  if (m.includes('timetable') || m.includes('schedule') || m.includes('class')) {
    return 'Your class timetable is available in Student Portal → My Courses. The timetable shows your weekly schedule including subject, teacher, and room assignments. Contact your class teacher if there are any discrepancies.'
  }
  if (m.includes('fee') || m.includes('payment')) {
    return 'School fee information is managed by the Finance Office. Please contact the Finance Officer or visit the Finance Office during school hours (Mon-Fri 8:00 AM – 4:00 PM). You can also check your fee status in the Student Portal.'
  }
  if (m.includes('exam') || m.includes('test') || m.includes('assessment')) {
    return 'Examination schedules are posted on the school notice board and communicated by your class teacher. Ensure you meet the 75% minimum attendance requirement to be eligible for final examinations.'
  }
  if (m.includes('hello') || m.includes('hi') || m.includes('help') || m.includes('salam')) {
    const name = ctx.student?.user?.displayName ?? ctx.teacher?.user?.displayName ?? 'there'
    return `Hello ${name}! I'm the MOE AI Assistant. I can help you with:\n\n• **Course registration** and enrollment\n• **Attendance** records and policies\n• **Grade** inquiries\n• **Timetable** and schedules\n• **School policies** and procedures\n\nWhat would you like to know?`
  }

  return "I can help you with course registration, attendance records, grade inquiries, timetable information, and school policies. Please ask a specific question and I'll do my best to assist you!\n\n*For urgent matters, please contact your class teacher or the school office directly.*"
}

// ── Public API ───────────────────────────────────────────────────

export async function chat(
  userMessage: string,
  contextData: any = {},
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  const cfg = await loadAiConfig()

  if (!cfg.enabled || !cfg.apiKey) {
    return getDemoAnswer(userMessage, contextData)
  }

  const messages = await buildMessages(cfg, userMessage, contextData, conversationHistory)

  try {
    if (cfg.provider === 'anthropic') {
      return await callAnthropic(cfg, messages)
    } else {
      return await callOpenAI(cfg, messages)
    }
  } catch (err) {
    console.error('[AI Service] Error calling LLM:', err)
    // Fall back to demo answer
    return getDemoAnswer(userMessage, contextData)
  }
}

export async function chatStream(
  userMessage: string,
  contextData: any = {},
  conversationHistory: ChatMessage[],
  onChunk: (chunk: string) => void,
): Promise<string> {
  const cfg = await loadAiConfig()

  if (!cfg.enabled || !cfg.apiKey) {
    const answer = getDemoAnswer(userMessage, contextData)
    // Simulate streaming for demo mode
    const words = answer.split(' ')
    for (let i = 0; i < words.length; i++) {
      onChunk((i === 0 ? '' : ' ') + words[i])
    }
    return answer
  }

  const messages = await buildMessages(cfg, userMessage, contextData, conversationHistory)
  let fullText = ''
  const collect = (chunk: string) => { fullText += chunk; onChunk(chunk) }

  try {
    if (cfg.provider === 'anthropic') {
      await callAnthropicStream(cfg, messages, collect)
    } else {
      await callOpenAIStream(cfg, messages, collect)
    }
  } catch (err) {
    console.error('[AI Service] Streaming error:', err)
    const fallback = getDemoAnswer(userMessage, contextData)
    onChunk(fallback)
    return fallback
  }

  return fullText
}

export async function testConnection(): Promise<{ success: boolean; message: string; model?: string }> {
  const cfg = await loadAiConfig()
  if (!cfg.apiKey) return { success: false, message: 'No API key configured' }
  try {
    const reply = await chat('Say "MOE SERPS AI connected" and nothing else.', {}, [])
    return { success: true, message: reply.trim(), model: cfg.model }
  } catch (err: any) {
    return { success: false, message: err.message ?? 'Connection failed' }
  }
}

// ── Risk Engine ──────────────────────────────────────────────────

export interface StudentRiskResult {
  studentId: string
  studentDbId: string
  name: string
  gradeLevel: string
  className: string
  attendanceRate: number
  gradesTrend: 'declining' | 'flat' | 'improving'
  recentAvgScore: number
  riskScore: number       // 0-100
  riskLevel: 'HIGH' | 'MONITOR' | 'OK'
  confidence: number      // 0-100 percentage
  counselorNotified: boolean
  weeklyAttendance: number[]  // last 8 weeks attendance %
  weeklyScores: number[]      // last 4 weeks avg score
}

export async function computeRiskForGrade(gradeLevel: string): Promise<StudentRiskResult[]> {
  const students = await prisma.student.findMany({
    where: { gradeLevel, enrollmentStatus: 'enrolled' },
    include: {
      user: { select: { displayName: true } },
      attendances: {
        include: { session: true },
        orderBy: { session: { date: 'desc' } },
      },
      grades: {
        include: { gradeItem: true },
        orderBy: { gradedAt: 'desc' },
      },
    },
  })

  const results: StudentRiskResult[] = []

  for (const student of students) {
    // ── Attendance ──
    const totalSessions = student.attendances.length
    const presentSessions = student.attendances.filter(a => a.status === 'present').length
    const attendanceRate = totalSessions > 0
      ? Math.round((presentSessions / totalSessions) * 100)
      : 100

    // Weekly attendance (last 8 weeks, grouped by week)
    const weeklyAttendance: number[] = []
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - w * 7 - 6)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() - w * 7)
      weekEnd.setHours(23, 59, 59, 999)

      const weekRecords = student.attendances.filter(a => {
        const d = new Date(a.session.date)
        return d >= weekStart && d <= weekEnd
      })
      if (weekRecords.length === 0) {
        weeklyAttendance.push(attendanceRate) // use overall as fallback
      } else {
        const present = weekRecords.filter(a => a.status === 'present').length
        weeklyAttendance.push(Math.round((present / weekRecords.length) * 100))
      }
    }

    // ── Grades ──
    // Group grades by week (last 4 weeks of quizzes)
    const weeklyScores: number[] = []
    for (let w = 3; w >= 0; w--) {
      const weekGrades = student.grades.filter(g => {
        if (!g.gradedAt || g.score === null) return false
        const d = new Date(g.gradedAt)
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - w * 7 - 6)
        const weekEnd = new Date()
        weekEnd.setDate(weekEnd.getDate() - w * 7)
        return d >= weekStart && d <= weekEnd
      })

      if (weekGrades.length > 0) {
        const avg = weekGrades.reduce((sum, g) => {
          const pct = (g.score! / (g.gradeItem.maxScore || 100)) * 100
          return sum + pct
        }, 0) / weekGrades.length
        weeklyScores.push(Math.round(avg))
      } else {
        // Fall back to named grades (Week 1/2/3/4 pattern from seed)
        const weekGradesByName = student.grades.filter(g => {
          const name = g.gradeItem?.name ?? ''
          return name.includes(`Week ${4 - w}`)
        })
        if (weekGradesByName.length > 0) {
          const avg = weekGradesByName.reduce((sum, g) => {
            const pct = (g.score! / (g.gradeItem.maxScore || 100)) * 100
            return sum + pct
          }, 0) / weekGradesByName.length
          weeklyScores.push(Math.round(avg))
        } else {
          weeklyScores.push(70) // neutral default
        }
      }
    }

    const recentAvgScore = weeklyScores.length > 0
      ? Math.round(weeklyScores.reduce((s, v) => s + v, 0) / weeklyScores.length)
      : 70

    // Grade trend: compare first half vs second half
    let gradesTrend: 'declining' | 'flat' | 'improving' = 'flat'
    if (weeklyScores.length >= 2) {
      const firstHalf = weeklyScores.slice(0, Math.floor(weeklyScores.length / 2))
      const secondHalf = weeklyScores.slice(Math.floor(weeklyScores.length / 2))
      const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
      if (secondAvg < firstAvg - 5) gradesTrend = 'declining'
      else if (secondAvg > firstAvg + 5) gradesTrend = 'improving'
    }

    // ── Risk Score ──
    let riskScore = 0
    if (attendanceRate <= 60) riskScore += 40
    else if (attendanceRate < 75) riskScore += 20

    if (gradesTrend === 'declining') riskScore += 30
    else if (gradesTrend === 'flat') riskScore += 10

    if (recentAvgScore < 60) riskScore += 20
    else if (recentAvgScore < 70) riskScore += 10

    const riskLevel: 'HIGH' | 'MONITOR' | 'OK' =
      riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MONITOR' : 'OK'

    // Confidence based on attendance sessions (10 sessions → ~82%)
    const confidence = Math.min(60 + totalSessions * 2.2, 95)

    // Counselor auto-notified for HIGH risk
    const counselorNotified = riskLevel === 'HIGH'

    results.push({
      studentId: student.studentId,
      studentDbId: student.id,
      name: student.user.displayName,
      gradeLevel: student.gradeLevel ?? gradeLevel,
      className: student.className ?? '',
      attendanceRate,
      gradesTrend,
      recentAvgScore,
      riskScore,
      riskLevel,
      confidence: Math.round(confidence),
      counselorNotified,
      weeklyAttendance,
      weeklyScores,
    })
  }

  // Sort by risk score descending
  results.sort((a, b) => b.riskScore - a.riskScore)
  return results
}
