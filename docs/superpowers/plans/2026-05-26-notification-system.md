# Notification System (Stage F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app notification bell (Navbar) + email notifications (Office365 SMTP) that fire on 6 business events: attendance absence, grade published, admission status change, performance evaluation submitted, facility booking created, fee invoice created.

**Architecture:** A `notificationService.send()` utility writes a DB record then fire-and-forgets email via `emailService.sendEmail()` (nodemailer + Office365 SMTP). The frontend polls `/api/v1/notifications/unread-count` every 30 s and displays a Popover list on bell click.

**Tech Stack:** nodemailer (new), Prisma (existing `Notification` model), Ant Design `Badge`/`Popover`, Lucide `Bell`, Zustand, React Query via axios

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/src/services/emailService.ts` | nodemailer transport, `sendEmail()` |
| Create | `backend/src/services/notificationService.ts` | `send()` — DB write + async email |
| Create | `backend/src/routes/notifications.ts` | REST: list / unread-count / mark-read |
| Modify | `backend/src/index.ts` | register `/api/v1/notifications` |
| Modify | `backend/.env` | add SMTP_* vars |
| Modify | `backend/src/routes/attendance.ts` | hook absent → notify student + parent |
| Modify | `backend/src/routes/grades.ts` | hook grade upsert → notify student + parent |
| Modify | `backend/src/routes/admissions.ts` | hook status change → notify managers |
| Modify | `backend/src/routes/ems.ts` | hook eval submit → notify teacher + managers |
| Modify | `backend/src/routes/sms.ts` | hook facility book → notify booker |
| Modify | `backend/src/routes/finance.ts` | add POST /invoices + notify student + parent |
| Create | `pc/src/stores/notificationStore.ts` | Zustand: list, unreadCount, 30 s poll |
| Create | `pc/src/components/NotificationBell/index.tsx` | Bell + Badge + Popover |
| Modify | `pc/src/layouts/Navbar.tsx` | insert `<NotificationBell />` |
| Modify | `pc/src/locales/en.ts` | add `notifications.*` keys |
| Modify | `pc/src/locales/zh.ts` | Chinese translations |
| Modify | `pc/src/locales/ms.ts` | Malay translations |

---

## Task 1: Install nodemailer + add SMTP env vars

**Files:**
- Modify: `backend/package.json` (via npm install)
- Modify: `backend/.env`

- [ ] **Step 1: Install nodemailer in backend**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend
npm install nodemailer
npm install --save-dev @types/nodemailer
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Add SMTP vars to .env**

Append to `backend/.env`:

```
# Email (SMTP Office365)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=<your-smtp-user>
SMTP_PASS=<your-smtp-password>
SMTP_FROM=MOE SERPS <<your-smtp-user>>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add nodemailer dependency"
```

---

## Task 2: emailService.ts

**Files:**
- Create: `backend/src/services/emailService.ts`

- [ ] **Step 1: Create the file**

```typescript
// backend/src/services/emailService.ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.office365.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false, // TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
  },
})

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[emailService] SMTP credentials not configured, skipping email')
    return
  }
  if (!to) {
    console.warn('[emailService] No recipient email address, skipping')
    return
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/emailService.ts
git commit -m "feat(notifications): add emailService with Office365 SMTP"
```

---

## Task 3: notificationService.ts

**Files:**
- Create: `backend/src/services/notificationService.ts`

- [ ] **Step 1: Create the file**

```typescript
// backend/src/services/notificationService.ts
import prisma from '../lib/prisma'
import { sendEmail } from './emailService'

interface NotifyOptions {
  userId: string
  title: string
  message: string
  type?: 'info' | 'warning' | 'success' | 'error'
}

export async function send(opts: NotifyOptions): Promise<void> {
  const { userId, title, message, type = 'info' } = opts

  // 1. Write notification to DB (synchronous — we want this to persist)
  await prisma.notification.create({
    data: { userId, title, message, type },
  })

  // 2. Fire-and-forget email — look up user's email
  prisma.user
    .findUnique({ where: { id: userId }, select: { email: true } })
    .then(user => {
      if (user?.email) {
        return sendEmail(user.email, title, message)
      }
    })
    .catch(err => {
      console.error('[notificationService] Email send failed:', err)
    })
}

// Convenience: notify multiple users at once
export async function sendMany(userIds: string[], opts: Omit<NotifyOptions, 'userId'>): Promise<void> {
  await Promise.all(userIds.map(userId => send({ userId, ...opts })))
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/notificationService.ts
git commit -m "feat(notifications): add notificationService (DB write + async email)"
```

---

## Task 4: notifications route + register in index.ts

**Files:**
- Create: `backend/src/routes/notifications.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create notifications route**

```typescript
// backend/src/routes/notifications.ts
import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET / — list notifications for current user (newest first, max 50)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ success: true, data: notifications })
  } catch (error) {
    console.error('GET /notifications error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /unread-count — returns { count: number }
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, read: false },
    })
    res.json({ success: true, data: { count } })
  } catch (error) {
    console.error('GET /notifications/unread-count error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /:id/read — mark single notification as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.notification.findUnique({ where: { id } })
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ success: false, message: 'Notification not found' })
      return
    }
    const updated = await prisma.notification.update({ where: { id }, data: { read: true } })
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /notifications/:id/read error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /read-all — mark all notifications as read for current user
router.patch('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, read: false },
      data: { read: true },
    })
    res.json({ success: true })
  } catch (error) {
    console.error('PATCH /notifications/read-all error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
```

- [ ] **Step 2: Register route in index.ts**

In `backend/src/index.ts`, add after the existing imports:

```typescript
import notificationRoutes from './routes/notifications'
```

And after the existing `app.use('/api/v1/ai', aiRoutes)` line:

```typescript
app.use('/api/v1/notifications', notificationRoutes)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git add backend/src/routes/notifications.ts backend/src/index.ts
git commit -m "feat(notifications): add REST API for notifications"
```

---

## Task 5: Hook — attendance absence

**Files:**
- Modify: `backend/src/routes/attendance.ts`

The trigger is `POST /records` (batch upsert). When any record has `status === 'absent'`, notify the student and their parent(s).

- [ ] **Step 1: Add import at top of attendance.ts**

Add after existing imports:

```typescript
import { send } from '../services/notificationService'
```

- [ ] **Step 2: Add notification logic in POST /records handler**

After the `const upserted = await Promise.all(...)` block and before `res.json(...)`, add:

```typescript
      // Notify absent students and their parents
      const absentRecords = records.filter(r => r.status === 'absent')
      if (absentRecords.length > 0) {
        const absentStudentIds = absentRecords.map(r => r.studentId)
        const students = await prisma.student.findMany({
          where: { id: { in: absentStudentIds } },
          include: {
            user: { select: { id: true, displayName: true } },
            parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
          },
        })
        await Promise.all(
          students.flatMap(student => {
            const notifyIds = [student.userId, ...student.parentLinks.map(l => l.parent.user.id)]
            return notifyIds.map(uid =>
              send({
                userId: uid,
                title: 'Attendance Alert',
                message: `${student.user.displayName} was marked absent.`,
                type: 'warning',
              }),
            )
          }),
        )
      }
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git add backend/src/routes/attendance.ts
git commit -m "feat(notifications): notify on attendance absence"
```

---

## Task 6: Hook — grade published

**Files:**
- Modify: `backend/src/routes/grades.ts`

The trigger is `POST /` (upsert grade). Notify the student and their parent(s).

- [ ] **Step 1: Add import at top of grades.ts**

```typescript
import { send } from '../services/notificationService'
```

- [ ] **Step 2: Add notification logic in POST / handler**

After `res.json({ success: true, data: grade })`, before the closing `} catch`, add the notification **before** `res.json(...)` (replace the existing `res.json` line):

Find the POST / handler's `res.json({ success: true, data: grade })` line and replace the block with:

```typescript
      // Notify student and parents
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { id: true, displayName: true } },
          parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
        },
      })
      if (student) {
        const notifyIds = [student.userId, ...student.parentLinks.map(l => l.parent.user.id)]
        const itemName = grade.gradeItem?.name ?? 'an assessment'
        await Promise.all(
          notifyIds.map(uid =>
            send({
              userId: uid,
              title: 'Grade Published',
              message: `A grade has been recorded for ${student.user.displayName} on ${itemName}.`,
              type: 'info',
            }),
          ),
        )
      }

      res.json({ success: true, data: grade })
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/grades.ts
git commit -m "feat(notifications): notify on grade published"
```

---

## Task 7: Hook — admission status change

**Files:**
- Modify: `backend/src/routes/admissions.ts`

The trigger is `PATCH /:id/status`. Notify all users with role `manager`.

- [ ] **Step 1: Add import at top of admissions.ts**

```typescript
import { sendMany } from '../services/notificationService'
```

- [ ] **Step 2: Find the PATCH /:id/status handler**

After the admission is updated in the database (after the `prisma.admission.update(...)` call) and before `res.json(...)`, add:

```typescript
      // Notify all managers
      const managers = await prisma.user.findMany({
        where: { role: 'manager' },
        select: { id: true },
      })
      await sendMany(
        managers.map(m => m.id),
        {
          title: 'Admission Status Updated',
          message: `Application for ${updated.applicantName} changed to "${updated.status}".`,
          type: 'info',
        },
      )
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/admissions.ts
git commit -m "feat(notifications): notify managers on admission status change"
```

---

## Task 8: Hook — performance evaluation submitted

**Files:**
- Modify: `backend/src/routes/ems.ts`

The trigger is `PATCH /performance-evaluations/:id/submit`. After the DB update, notify the evaluated teacher + all managers.

- [ ] **Step 1: Add import at top of ems.ts**

```typescript
import { send, sendMany } from '../services/notificationService'
```

- [ ] **Step 2: Find the PATCH /:id/submit handler**

After `const updated = await prisma.performanceEvaluation.update(...)` and before `res.json(...)`, add:

```typescript
      // Notify evaluated teacher
      await send({
        userId: updated.teacher.user.id,
        title: 'Performance Evaluation Submitted',
        message: `Your performance evaluation for ${updated.academicYear} has been submitted for review.`,
        type: 'info',
      })
      // Notify managers
      const managers = await prisma.user.findMany({
        where: { role: 'manager' },
        select: { id: true },
      })
      await sendMany(
        managers.map(m => m.id),
        {
          title: 'Performance Evaluation Submitted',
          message: `Evaluation for ${updated.teacher.user.displayName} (${updated.academicYear}) has been submitted.`,
          type: 'info',
        },
      )
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/ems.ts
git commit -m "feat(notifications): notify on performance evaluation submission"
```

---

## Task 9: Hook — facility booking created

**Files:**
- Modify: `backend/src/routes/sms.ts`

The trigger is `POST /facilities/book`. Notify the booker (req.user).

- [ ] **Step 1: Add import at top of sms.ts**

```typescript
import { send } from '../services/notificationService'
```

- [ ] **Step 2: Find the POST /facilities/book handler**

Before `res.status(201).json({ success: true, data: booking })`, add:

```typescript
      // Notify booker
      await send({
        userId: req.user!.userId,
        title: 'Facility Booking Confirmed',
        message: `Your booking for ${facility.name} on ${date} (${startTime}–${endTime}) has been submitted.`,
        type: 'success',
      })
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/sms.ts
git commit -m "feat(notifications): notify on facility booking creation"
```

---

## Task 10: Add POST /finance/invoices + hook notification

**Files:**
- Modify: `backend/src/routes/finance.ts`

Finance has no invoice creation endpoint. Add `POST /invoices` and notify the student + their parents.

- [ ] **Step 1: Add imports at top of finance.ts**

```typescript
import { send } from '../services/notificationService'
```

- [ ] **Step 2: Add POST /invoices route**

Add before `export default router` in `backend/src/routes/finance.ts`:

```typescript
// POST /invoices — create a fee invoice and notify student + parents
router.post(
  '/invoices',
  authenticate,
  requireRole(...financeRoles),
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, semester, amount, dueDate, description } = req.body as {
        studentId: string
        semester?: string
        amount: number
        dueDate?: string
        description?: string
      }

      if (!studentId || amount === undefined) {
        res.status(400).json({ success: false, message: 'studentId and amount are required' })
        return
      }

      const invoice = await prisma.feeInvoice.create({
        data: {
          studentId,
          semester,
          amount: Number(amount),
          dueDate: dueDate ? new Date(dueDate) : undefined,
          description,
        },
      })

      // Notify student + parents
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { id: true, displayName: true } },
          parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
        },
      })
      if (student) {
        const notifyIds = [student.userId, ...student.parentLinks.map(l => l.parent.user.id)]
        await Promise.all(
          notifyIds.map(uid =>
            send({
              userId: uid,
              title: 'Fee Invoice Generated',
              message: `A fee invoice of BND ${amount.toFixed(2)} has been issued for ${student.user.displayName}${semester ? ` (${semester})` : ''}.`,
              type: 'warning',
            }),
          ),
        )
      }

      res.status(201).json({ success: true, data: invoice })
    } catch (error) {
      console.error('POST /finance/invoices error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/finance.ts
git commit -m "feat(notifications): POST /finance/invoices with student+parent notification"
```

---

## Task 11: i18n translations — notification keys

**Files:**
- Modify: `pc/src/locales/en.ts`
- Modify: `pc/src/locales/zh.ts`
- Modify: `pc/src/locales/ms.ts`

- [ ] **Step 1: Add keys to en.ts**

In the `notifications` section (add it as a new top-level key after `nav`):

```typescript
  notifications: {
    title: 'Notifications',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications',
    viewAll: 'View all',
    justNow: 'Just now',
    unread: 'unread',
  },
```

- [ ] **Step 2: Add keys to zh.ts**

```typescript
  notifications: {
    title: '通知',
    markAllRead: '全部标为已读',
    noNotifications: '暂无通知',
    viewAll: '查看全部',
    justNow: '刚刚',
    unread: '条未读',
  },
```

- [ ] **Step 3: Add keys to ms.ts**

```typescript
  notifications: {
    title: 'Pemberitahuan',
    markAllRead: 'Tandakan semua dibaca',
    noNotifications: 'Tiada pemberitahuan',
    viewAll: 'Lihat semua',
    justNow: 'Baru sahaja',
    unread: 'belum dibaca',
  },
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/pc && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git add pc/src/locales/
git commit -m "feat(notifications): add i18n keys for notification UI"
```

---

## Task 12: notificationStore.ts (Zustand + polling)

**Files:**
- Create: `pc/src/stores/notificationStore.ts`

- [ ] **Step 1: Create the file**

```typescript
// pc/src/stores/notificationStore.ts
import { create } from 'zustand'
import api from '@/lib/api'

interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  startPolling: () => () => void  // returns cleanup fn
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true })
    try {
      const res = await api.get<{ success: boolean; data: Notification[] }>('/notifications')
      set({ notifications: res.data.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ success: boolean; data: { count: number } }>('/notifications/unread-count')
      set({ unreadCount: res.data.data.count })
    } catch {
      // silently ignore polling errors
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      set(state => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch {
      // ignore
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all')
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      }))
    } catch {
      // ignore
    }
  },

  startPolling: () => {
    const { fetchUnreadCount } = get()
    fetchUnreadCount() // immediate first fetch
    const intervalId = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(intervalId)
  },
}))
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/pc && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git add pc/src/stores/notificationStore.ts
git commit -m "feat(notifications): add Zustand notificationStore with 30s polling"
```

---

## Task 13: NotificationBell component

**Files:**
- Create: `pc/src/components/NotificationBell/index.tsx`

- [ ] **Step 1: Create the component**

```typescript
// pc/src/components/NotificationBell/index.tsx
import { useEffect, useState } from 'react'
import { Badge, Popover, Button, List, Typography, Space, Tag } from 'antd'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@/stores/notificationStore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text } = Typography

const typeColor: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
}

const NotificationBell = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead, startPolling } =
    useNotificationStore()

  // Start polling on mount
  useEffect(() => {
    const stop = startPolling()
    return stop
  }, [startPolling])

  const handleOpen = (visible: boolean) => {
    setOpen(visible)
    if (visible) fetchNotifications()
  }

  const content = (
    <div style={{ width: 360 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0 12px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 4,
        }}
      >
        <Text strong>{t('notifications.title')}</Text>
        {unreadCount > 0 && (
          <Button size="small" type="link" onClick={() => markAllAsRead()}>
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      <List
        loading={loading}
        dataSource={notifications}
        locale={{ emptyText: t('notifications.noNotifications') }}
        style={{ maxHeight: 420, overflowY: 'auto' }}
        renderItem={item => (
          <List.Item
            style={{
              background: item.read ? 'transparent' : 'var(--color-primary-light, #e6f4ff)',
              padding: '10px 8px',
              borderRadius: 6,
              cursor: item.read ? 'default' : 'pointer',
              marginBottom: 2,
            }}
            onClick={() => {
              if (!item.read) markAsRead(item.id)
            }}
          >
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Space>
                <Tag color={typeColor[item.type] ?? 'blue'} style={{ margin: 0 }}>
                  {item.type}
                </Tag>
                <Text strong style={{ fontSize: 13 }}>
                  {item.title}
                </Text>
                {!item.read && (
                  <Badge color="blue" />
                )}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.message}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(item.createdAt).fromNow()}
              </Text>
            </Space>
          </List.Item>
        )}
      />
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpen}
      placement="bottomRight"
      arrow={false}
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{ padding: '8px 12px', width: 384 }}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<Bell size={18} />}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Badge>
    </Popover>
  )
}

export default NotificationBell
```

- [ ] **Step 2: Check dayjs is available**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/pc && grep -r "dayjs" package.json
```

If not present, install it:
```bash
npm install dayjs
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git add pc/src/components/NotificationBell/
git commit -m "feat(notifications): NotificationBell component (badge + popover)"
```

---

## Task 14: Update Navbar — insert NotificationBell

**Files:**
- Modify: `pc/src/layouts/Navbar.tsx`

- [ ] **Step 1: Add import**

In `pc/src/layouts/Navbar.tsx`, add after existing imports:

```typescript
import NotificationBell from '@/components/NotificationBell'
```

- [ ] **Step 2: Insert component in JSX**

Find the `<Space size={16}>` block and insert `<NotificationBell />` between the language `<Select>` and the user `<Dropdown>`:

Replace:
```tsx
      <Space size={16}>
        <Select
          ...
        />
        <Dropdown menu={dropdownItems} placement="bottomRight">
```

With:
```tsx
      <Space size={16}>
        <Select
          value={language}
          onChange={(val: Language) => setLanguage(val)}
          style={{ width: 130 }}
          size="small"
          suffixIcon={<Globe size={14} />}
          options={LANGUAGES.map(l => ({
            value: l.code,
            label: l.nativeLabel,
          }))}
        />
        <NotificationBell />
        <Dropdown menu={dropdownItems} placement="bottomRight">
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/pc && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git add pc/src/layouts/Navbar.tsx
git commit -m "feat(notifications): add NotificationBell to Navbar"
```

---

## Task 15: Full TypeScript + smoke test verification

- [ ] **Step 1: TypeScript check — backend**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: TypeScript check — frontend**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/pc && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Start backend + test unread-count endpoint**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/backend && npm run dev &
sleep 3
# Login to get a token, then:
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Demo@2026"}' | python3 -m json.tool
```

Copy the `token` from the response, then:

```bash
curl -s http://localhost:4000/api/v1/notifications/unread-count \
  -H "Authorization: Bearer <TOKEN>" | python3 -m json.tool
```

Expected: `{"success": true, "data": {"count": 0}}`

- [ ] **Step 4: Start frontend + visual check**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude/pc && npm run dev &
```

Open browser at `http://localhost:3000`, login as `admin / Demo@2026`.
Verify: Bell icon visible in Navbar, badge shows 0, clicking bell shows empty "No notifications" panel.

- [ ] **Step 5: Final commit + push**

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
git push origin master
git push github master
```

---

## Task 16: Dev log

- [ ] **Step 1: Create dev log entry**

Create `doc/dev-logs/260526-HHMM.md` with:
- Summary of Stage F implementation
- Files changed list
- Token estimate
- Verification steps taken

- [ ] **Step 2: Update doc/dev-logs/README.md index**

Add row for this session.

- [ ] **Step 3: Commit + push dev log**

```bash
git add doc/dev-logs/
git commit -m "docs: dev log 260526-HHMM — Stage F Notification System"
git push origin master
git push github master
```
