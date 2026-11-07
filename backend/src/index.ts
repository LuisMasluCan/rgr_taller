import 'dotenv/config'
import { prisma } from './lib/prisma'

async function main(): Promise<void> {
  const serviceOrders = await prisma.serviceOrder.findMany({
    include: {
      customer: true,
      vehicle: true,
    },
    orderBy: {
      receptionDate: 'desc',
    },
  })

  console.dir(serviceOrders, { depth: null })
}

main()
  .catch((error: unknown) => {
    console.error('No se pudo consultar las órdenes de servicio:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
