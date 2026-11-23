import { createServer } from 'node:http'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

async function startServer(): Promise<void> {
  const { handleRequest } = await import('./lib/http-handler.js')
  const port = Number(process.env.API_PORT ?? 3001)
  const host = process.env.API_HOST ?? '127.0.0.1'
  const server = createServer(handleRequest)

  server.listen(port, host, () => {
    console.info(`RGR Taller API listening at http://${host}:${port}`)
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close(() => {
        process.exit(0)
      })
    })
  }
}

void startServer().catch((error: unknown) => {
  console.error('Unable to start RGR Taller API:', error)
  process.exitCode = 1
})
