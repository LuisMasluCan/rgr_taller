import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'node:path'
import { hash } from 'bcryptjs'
import { Role } from '../src/generated/prisma/client'
import { prisma } from '../src/lib/prisma'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

async function main(): Promise<void> {
  const password = process.env.ADMIN_SEED_PASSWORD
  if (!password || password.length < 8) {
    throw new Error('Define ADMIN_SEED_PASSWORD con al menos 8 caracteres en el .env raíz.')
  }

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@rgrtaller.pe' },
    select: { id: true, role: true },
  })
  if (!admin || admin.role !== Role.ADMIN) {
    throw new Error('No se encontró la cuenta ADMIN esperada; no se modificó ningún usuario.')
  }

  const passwordHash = await hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: admin.id },
      data: { password: passwordHash },
    }),
    prisma.authSession.deleteMany({ where: { userId: admin.id } }),
  ])
  console.info('Contraseña del administrador actualizada; sesiones anteriores revocadas.')
}

main()
  .catch((error: unknown) => {
    console.error('No se pudo actualizar la contraseña del administrador:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
