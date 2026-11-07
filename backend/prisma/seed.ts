import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'node:path'
import { hash } from 'bcryptjs'
import { AccountType, Role } from '../src/generated/prisma/client'
import { prisma } from '../src/lib/prisma'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

async function main(): Promise<void> {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error('Define ADMIN_SEED_PASSWORD con al menos 8 caracteres antes de ejecutar el seed.')
  }

  const password = await hash(adminPassword, 12)

  await prisma.user.upsert({
    where: { email: 'admin@rgrtaller.pe' },
    update: {
      name: 'Luis Maslucan',
      password,
      role: Role.ADMIN,
    },
    create: {
      name: 'Luis Maslucan',
      email: 'admin@rgrtaller.pe',
      password,
      role: Role.ADMIN,
    },
  })

  const bankAccounts: Array<{ name: string; type: AccountType }> = [
    { name: 'Caja Efectivo Soles', type: AccountType.CASH_SOLES },
    { name: 'Caja Efectivo Dólares', type: AccountType.CASH_USD },
    { name: 'Tarjeta de Crédito Soles', type: AccountType.CREDIT_CARD },
    { name: 'Tarjeta de Débito Soles', type: AccountType.DEBIT_CARD },
    { name: 'Transferencia', type: AccountType.TRANSFER },
    { name: 'Yape', type: AccountType.YAPE },
    { name: 'Plin', type: AccountType.PLIN },
  ]

  for (const account of bankAccounts) {
    await prisma.bankAccount.upsert({
      where: { name: account.name },
      update: { type: account.type },
      create: {
        ...account,
        initialBalance: 0,
        currentBalance: 0,
      },
    })
  }

  for (const name of ['Frenos', 'Motor', 'Suspensión']) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  await prisma.vehicle.upsert({
    where: { plate: 'ABC-123' },
    update: {},
    create: {
      plate: 'ABC-123',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2020,
      color: 'Plata',
      mileage: 45000,
      customer: {
        create: {
          name: 'Cliente de Prueba Uno',
          documentType: 'DNI',
          documentNumber: '00000001',
          email: 'cliente1@example.com',
          phone: '999111222',
          address: 'Lima, Perú',
        },
      },
    },
  })

  await prisma.vehicle.upsert({
    where: { plate: 'XYZ-789' },
    update: {},
    create: {
      plate: 'XYZ-789',
      brand: 'Hyundai',
      model: 'Tucson',
      year: 2021,
      color: 'Blanco',
      mileage: 32000,
      customer: {
        create: {
          name: 'Cliente de Prueba Dos',
          documentType: 'DNI',
          documentNumber: '00000002',
          email: 'cliente2@example.com',
          phone: '999333444',
          address: 'Lima, Perú',
        },
      },
    },
  })

  console.info('Seed completado.')
}

main()
  .catch((error: unknown) => {
    console.error('Error al ejecutar el seed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
