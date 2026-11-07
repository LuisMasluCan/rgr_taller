import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { compare } from 'bcryptjs'
import { Prisma, Role } from '../generated/prisma/client'
import { prisma } from './prisma'

const frontendPort = Number(process.env.VITE_PORT ?? 5173)
const defaultOrigins = [
  `http://localhost:${frontendPort}`,
  `http://127.0.0.1:${frontendPort}`,
]
const allowedOrigins = new Set(
  [
    ...defaultOrigins,
    ...(process.env.API_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
)
const stateId = 'workshop'
const maximumBodyBytes = 4 * 1024 * 1024
const maximumPhotoRequestBytes = 4.25 * 1024 * 1024
const maximumPhotoBytes = 3 * 1024 * 1024
const sessionCookieName = 'rgr_admin_session'
const sessionLifetimeSeconds = 60 * 60 * 24 * 7
const loginWindowMilliseconds = 15 * 60 * 1000
const maximumLoginAttempts = 5
const loginAttempts = new Map<string, { count: number; windowStartedAt: number; lockedUntil: number }>()

type AuthenticatedUser = {
  id: string
  name: string
  email: string
  role: Role
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown): value is Prisma.InputJsonValue | null {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true
  }
  if (Array.isArray(value)) return value.every(isJsonValue)
  return isRecord(value) && Object.values(value).every(isJsonValue)
}

function isJsonObject(value: unknown): value is Prisma.InputJsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue)
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJsonBody(request: IncomingMessage, maximumBytes = maximumBodyBytes): Promise<unknown> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > maximumBytes) {
      throw Object.assign(new Error('Request body too large.'), { status: 413 })
    }
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw Object.assign(new Error('Invalid JSON body.'), { status: 400 })
  }
}

function getSessionToken(request: IncomingMessage): string | null {
  const cookies = request.headers.cookie?.split(';') ?? []
  for (const cookie of cookies) {
    const [name, ...parts] = cookie.trim().split('=')
    if (name === sessionCookieName) return parts.join('=') || null
  }
  return null
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function sessionCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${secure}`
}

function requestOriginAllowed(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const forwardedHost = request.headers['x-forwarded-host']
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? request.headers.host
  const forwardedProtocol = request.headers['x-forwarded-proto']
  const protocol = (Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol)
    ?.split(',')[0]
    ?.trim() ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const sameOrigin = host ? origin === `${protocol}://${host}` : false
  const allowed = !origin || allowedOrigins.has(origin) || sameOrigin
  if (!allowed) console.warn(`Rejected request from unconfigured origin: ${origin}`)
  return allowed
}

function loginAttemptState(request: IncomingMessage) {
  const client = request.socket.remoteAddress ?? 'unknown'
  const now = Date.now()
  let state = loginAttempts.get(client)
  if (!state || now - state.windowStartedAt >= loginWindowMilliseconds) {
    state = { count: 0, windowStartedAt: now, lockedUntil: 0 }
    loginAttempts.set(client, state)
  }
  return { client, state, now }
}

async function authenticatedUser(request: IncomingMessage): Promise<AuthenticatedUser | null> {
  const token = getSessionToken(request)
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  })
  if (!session) return null
  if (session.expiresAt <= new Date() || session.user.role !== Role.ADMIN) {
    await prisma.authSession.delete({ where: { id: session.id } })
    return null
  }
  return session.user
}

async function initialWorkshopData(): Promise<Prisma.InputJsonObject> {
  const [accounts, categories] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ])
  const accountTypes: Record<string, string> = {
    CASH_SOLES: 'Efectivo',
    CASH_USD: 'Efectivo',
    CREDIT_CARD: 'Tarjeta de crédito',
    DEBIT_CARD: 'Banco',
    TRANSFER: 'Banco',
    YAPE: 'Billetera',
    PLIN: 'Billetera',
  }
  return {
    appointments: [],
    clients: [],
    inventory: [],
    workshopAssets: [],
    workshopCategories: categories.map((category) => ({
      id: category.id,
      specialty: 'Mecánica General',
      category: category.name,
      description: '',
    })),
    bankAccounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      number: account.id,
      type: accountTypes[account.type] ?? 'Banco',
      initialBalance: Number(account.initialBalance),
      currentBalance: Number(account.currentBalance),
    })),
    bankMovements: {},
    orders: [],
    suppliers: [],
    cashRegister: null,
    closedSessions: [],
    settings: {
      name: 'RGR Taller',
      phone: '',
      email: '',
      address: '',
      lowStockThreshold: 5,
      notificationsEnabled: true,
    },
    activeProfile: 'Sin sesión',
  }
}

async function getOrCreateWorkshopState() {
  const existing = await prisma.workshopState.findUnique({ where: { id: stateId } })
  if (existing) return existing
  const data = await initialWorkshopData()
  try {
    return await prisma.workshopState.create({
      data: { id: stateId, data, version: 1 },
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      const concurrentState = await prisma.workshopState.findUnique({ where: { id: stateId } })
      if (concurrentState) return concurrentState
    }
    throw error
  }
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const origin = request.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (url.pathname === '/api/health' && request.method === 'GET') {
    try {
      await prisma.$queryRaw`SELECT 1`
      sendJson(response, 200, { status: 'ok', database: 'connected' })
    } catch (error) {
      console.error('Database health check failed:', error)
      sendJson(response, 503, { status: 'error', database: 'unavailable' })
    }
    return
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    if (!requestOriginAllowed(request)) {
      sendJson(response, 403, { error: 'Origen de solicitud no permitido.' })
      return
    }

    const { client, state, now } = loginAttemptState(request)
    if (state.lockedUntil > now) {
      sendJson(response, 429, { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' })
      return
    }

    let payload: unknown
    try {
      payload = await readJsonBody(request, 16 * 1024)
    } catch (error) {
      const status = isRecord(error) && typeof error.status === 'number' ? error.status : 400
      sendJson(response, status, { error: error instanceof Error ? error.message : 'Solicitud inválida.' })
      return
    }
    if (
      !isRecord(payload) ||
      typeof payload.email !== 'string' ||
      typeof payload.password !== 'string' ||
      !payload.email.trim() ||
      !payload.password
    ) {
      sendJson(response, 400, { error: 'Ingresa el correo y la contraseña del administrador.' })
      return
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: payload.email.trim().toLowerCase() },
      })
      const validPassword = user?.role === Role.ADMIN
        ? await compare(payload.password, user.password)
        : false
      if (!user || !validPassword || user.role !== Role.ADMIN) {
        state.count += 1
        if (state.count >= maximumLoginAttempts) {
          state.lockedUntil = now + loginWindowMilliseconds
          sendJson(response, 429, { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' })
          return
        }
        sendJson(response, 401, { error: 'Correo o contraseña incorrectos.' })
        return
      }

      loginAttempts.delete(client)
      await prisma.authSession.deleteMany({ where: { expiresAt: { lte: new Date() } } })
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000)
      await prisma.authSession.create({
        data: {
          tokenHash: hashSessionToken(token),
          userId: user.id,
          expiresAt,
        },
      })
      response.setHeader('Set-Cookie', sessionCookie(token, sessionLifetimeSeconds))
      sendJson(response, 200, {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      })
    } catch (error) {
      console.error('Unable to authenticate administrator:', error)
      sendJson(response, 503, { error: 'No se pudo iniciar sesión. Inténtalo nuevamente.' })
    }
    return
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    try {
      const user = await authenticatedUser(request)
      if (!user) {
        sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
        return
      }
      sendJson(response, 200, { user })
    } catch (error) {
      console.error('Unable to verify administrator session:', error)
      sendJson(response, 503, { error: 'No se pudo verificar la sesión.' })
    }
    return
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    if (!requestOriginAllowed(request)) {
      sendJson(response, 403, { error: 'Origen de solicitud no permitido.' })
      return
    }
    try {
      const token = getSessionToken(request)
      if (token) {
        await prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
      }
      response.setHeader('Set-Cookie', sessionCookie('', 0))
      sendJson(response, 200, { status: 'ok' })
    } catch (error) {
      console.error('Unable to end administrator session:', error)
      sendJson(response, 503, { error: 'No se pudo cerrar la sesión.' })
    }
    return
  }

  const photoMatch = url.pathname.match(/^\/api\/photos\/([0-9a-f-]{36})$/i)
  if (photoMatch && request.method === 'GET') {
    try {
      const user = await authenticatedUser(request)
      if (!user) {
        sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
        return
      }
      const photo = await prisma.workshopPhoto.findUnique({ where: { id: photoMatch[1] } })
      if (!photo) {
        sendJson(response, 404, { error: 'No se encontró la fotografía.' })
        return
      }
      response.writeHead(200, {
        'Content-Type': photo.contentType,
        'Content-Length': photo.data.byteLength,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end(photo.data)
    } catch (error) {
      console.error('Unable to load workshop photo:', error)
      sendJson(response, 503, { error: 'No se pudo cargar la fotografía.' })
    }
    return
  }

  if (url.pathname === '/api/photos' && request.method === 'POST') {
    if (!requestOriginAllowed(request)) {
      sendJson(response, 403, { error: 'Origen de solicitud no permitido.' })
      return
    }
    try {
      const user = await authenticatedUser(request)
      if (!user) {
        sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
        return
      }
    } catch (error) {
      console.error('Unable to verify photo upload session:', error)
      sendJson(response, 503, { error: 'No se pudo verificar la sesión.' })
      return
    }

    let payload: unknown
    try {
      payload = await readJsonBody(request, maximumPhotoRequestBytes)
    } catch (error) {
      const status = isRecord(error) && typeof error.status === 'number' ? error.status : 400
      sendJson(response, status, { error: error instanceof Error ? error.message : 'Solicitud inválida.' })
      return
    }
    if (!isRecord(payload) || typeof payload.name !== 'string' || typeof payload.dataUrl !== 'string') {
      sendJson(response, 400, { error: 'Se requiere el nombre y el contenido de la fotografía.' })
      return
    }

    const imageMatch = payload.dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/)
    if (!imageMatch) {
      sendJson(response, 400, { error: 'La fotografía debe estar en formato JPEG, PNG o WebP.' })
      return
    }
    const data = Buffer.from(imageMatch[2], 'base64')
    if (!data.length || data.byteLength > maximumPhotoBytes || data.toString('base64') !== imageMatch[2]) {
      sendJson(response, 413, { error: 'La fotografía supera el límite permitido de 3 MB.' })
      return
    }

    try {
      const id = randomUUID()
      await prisma.workshopPhoto.create({
        data: {
          id,
          name: payload.name.slice(0, 255),
          contentType: `image/${imageMatch[1]}`,
          data,
        },
      })
      sendJson(response, 201, { name: payload.name, dataUrl: `/api/photos/${id}` })
    } catch (error) {
      console.error('Unable to save workshop photo:', error)
      sendJson(response, 503, { error: 'No se pudo guardar la fotografía en Neon.' })
    }
    return
  }

  if (url.pathname === '/api/state' && request.method === 'GET') {
    try {
      const user = await authenticatedUser(request)
      if (!user) {
        sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
        return
      }
      const state = await getOrCreateWorkshopState()
      sendJson(response, 200, { data: state.data, version: state.version })
    } catch (error) {
      console.error('Unable to load persisted workshop data:', error)
      sendJson(response, 503, { error: 'No se pudieron cargar los datos de Neon.' })
    }
    return
  }

  if (url.pathname === '/api/state' && request.method === 'PUT') {
    if (!requestOriginAllowed(request)) {
      sendJson(response, 403, { error: 'Origen de solicitud no permitido.' })
      return
    }
    let payload: unknown
    try {
      payload = await readJsonBody(request)
    } catch (error) {
      const status = isRecord(error) && typeof error.status === 'number' ? error.status : 400
      sendJson(response, status, { error: error instanceof Error ? error.message : 'Invalid request.' })
      return
    }
    if (
      !isRecord(payload) ||
      !isJsonObject(payload.data) ||
      !Number.isInteger(payload.version) ||
      (payload.version as number) < 1
    ) {
      sendJson(response, 400, { error: 'Se requiere data y una version válida.' })
      return
    }

    try {
      const user = await authenticatedUser(request)
      if (!user) {
        sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
        return
      }
      const state = await getOrCreateWorkshopState()
      if (state.version !== payload.version) {
        sendJson(response, 409, {
          error: 'Los datos cambiaron en otra sesión. Recarga antes de guardar más cambios.',
          version: state.version,
        })
        return
      }
      const result = await prisma.workshopState.updateMany({
        where: { id: stateId, version: payload.version as number },
        data: { data: payload.data, version: { increment: 1 } },
      })
      if (result.count !== 1) {
        sendJson(response, 409, { error: 'Otra sesión guardó cambios. Recarga los datos antes de continuar.' })
        return
      }
      const updated = await prisma.workshopState.findUniqueOrThrow({ where: { id: stateId } })
      sendJson(response, 200, { version: updated.version, updatedAt: updated.updatedAt })
    } catch (error) {
      console.error('Unable to persist workshop data:', error)
      sendJson(response, 500, { error: 'No se pudieron guardar los cambios en Neon.' })
    }
    return
  }

  sendJson(response, 404, { error: 'Ruta no encontrada.' })
}
