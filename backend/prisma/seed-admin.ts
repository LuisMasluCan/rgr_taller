import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'node:path'
import { hash } from 'bcryptjs'
import { Role } from '../src/generated/prisma/client'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

async function main(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma.js')
  try {
    const email = 'admin@rgrtaller.pe'
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    })
    if (existingAdmin) {
      if (existingAdmin.role !== Role.ADMIN) {
        throw new Error('La cuenta existente no tiene rol ADMIN; no se modificó.')
      }
      console.info('La cuenta administradora ya existe; no se modificó.')
      return
    }

    const adminPassword = process.env.ADMIN_SEED_PASSWORD
    if (!adminPassword || adminPassword.length < 12) {
      throw new Error('Define ADMIN_SEED_PASSWORD con al menos 12 caracteres.')
    }

    const password = await hash(adminPassword, 12)
    await prisma.user.create({
      data: {
        name: 'Luis Maslucan',
        email,
        password,
        role: Role.ADMIN,
      },
    })

    console.info('Cuenta administradora configurada.')
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error: unknown) => {
    console.error('No se pudo configurar la cuenta administradora:', error)
    process.exitCode = 1
  })
