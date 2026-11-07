import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before initializing Prisma.')
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: 5_000,
    }),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
