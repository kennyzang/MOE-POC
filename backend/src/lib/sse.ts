import type { Response } from 'express'

// In-memory registry of active SSE clients per topic.
// Services import `broadcast` from here rather than from routes/events to avoid
// the routes → services direction in the dependency graph.

const clients = new Map<string, Set<Response>>()

export function getClients(topic: string): Set<Response> {
  if (!clients.has(topic)) clients.set(topic, new Set())
  return clients.get(topic)!
}

export function broadcast(topic: string, event: string, data: unknown): void {
  const subs = clients.get(topic)
  if (!subs || subs.size === 0) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of subs) {
    try {
      res.write(payload)
    } catch {
      subs.delete(res)
    }
  }
}
