import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

const isClientGeneration = process.argv.includes('generate')
const datasourceUrl = process.env.DIRECT_URL || (
  isClientGeneration
    ? 'postgresql://localhost:5432/rgr_taller?schema=public'
    : undefined
)

if (!datasourceUrl) {
  throw new Error('DIRECT_URL must be set for Prisma database commands.')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: datasourceUrl,
  },
})
