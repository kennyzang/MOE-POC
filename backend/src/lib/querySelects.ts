import type { Prisma } from '@prisma/client'

// Canonical user select shapes — use these instead of inline select objects.
// Choosing the wrong constant silently narrows the response; verify with tsc --noEmit.

export const USER_SELECT_NAME = {
  displayName: true,
} satisfies Prisma.UserSelect

export const USER_SELECT_BASIC = {
  id: true,
  displayName: true,
} satisfies Prisma.UserSelect

export const USER_SELECT_CONTACT = {
  id: true,
  displayName: true,
  email: true,
} satisfies Prisma.UserSelect

export const USER_SELECT_PROFILE = {
  id: true,
  displayName: true,
  email: true,
  avatar: true,
} satisfies Prisma.UserSelect

// Full public profile — matches the shape on Student/Teacher list & detail endpoints.
export const USER_SELECT_FULL = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  avatar: true,
  status: true,
} satisfies Prisma.UserSelect
