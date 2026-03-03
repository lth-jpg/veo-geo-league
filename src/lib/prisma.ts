import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always reuse the cached singleton — in production this prevents a new
// PrismaClient (and its connection pool) from being created on every
// module evaluation, which would exhaust DB connections and RAM.
if (!globalForPrisma.prisma) {
  // Limit the connection pool to avoid OOM crashes on Railway's 512MB tier.
  // Prisma defaults to 10 connections which exhausts memory under restart loops.
  const rawUrl = process.env.DATABASE_URL ?? ''
  let dbUrl = rawUrl
  try {
    const u = new URL(rawUrl)
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '3')
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '10')
    dbUrl = u.toString()
  } catch { /* leave url as-is if it can't be parsed */ }

  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: { db: { url: dbUrl } },
  })
}

export const prisma = globalForPrisma.prisma
