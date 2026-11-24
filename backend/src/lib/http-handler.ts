import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { compare } from 'bcryptjs'
import { ItemType, Prisma, Role } from '../generated/prisma/client'
import { prisma } from './prisma'
import { hasUploadthingToken, uploadthingHandler } from './uploadthing'
import { getRelationalWorkshopData, saveRelationalWorkshopData } from './workshop-state'

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
const maximumBodyBytes = 4 * 1024 * 1024
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

function nodeRequestToWebRequest(req: IncomingMessage, url: URL): Request {
  const method = req.method ?? 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }

  const body = hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined

  return new Request(url, {
    method,
    headers,
    body,
    // @ts-ignore Node.js requires duplex: 'half' when body is a stream
    duplex: 'half',
  })
}

async function sendWebResponse(res: ServerResponse, webResponse: Response): Promise<void> {
  res.statusCode = webResponse.status
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  if (!webResponse.body) {
    res.end()
    return
  }

  const reader = webResponse.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  } finally {
    res.end()
  }
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? 'GET'
  const origin = request.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-uploadthing-version, x-uploadthing-package, x-uploadthing-fe-package',
    )
    response.setHeader('Access-Control-Allow-Credentials', 'true')
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
      sendJson(response, 200, {
        status: 'ok',
        database: 'connected',
        uploadthingTokenConfigured: hasUploadthingToken(),
      })
    } catch (error) {
      console.error('Database health check failed:', error)
      sendJson(response, 503, { status: 'error', database: 'unavailable' })
    }
    return
  }

  if (url.pathname === '/api/uploadthing' || url.pathname.startsWith('/api/uploadthing/')) {
    try {
      const webRequest = nodeRequestToWebRequest(request, url)
      const webResponse = await uploadthingHandler(webRequest)
      await sendWebResponse(response, webResponse)
    } catch (error) {
      console.error('Error procesando solicitud de UploadThing:', error)
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Error en el servidor de UploadThing.',
      })
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

  if (url.pathname === '/api/inventory' && method === 'GET') {
      try {
        const user = await authenticatedUser(request)
        if (!user) {
          sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
          return
        }
        const items = await prisma.item.findMany({
          where: { isActive: true },
          include: { category: true },
          orderBy: { name: 'asc' },
        })
        const itemNames: Record<ItemType, string> = {
          LABOR: 'Mano de Obra',
          PART: 'Repuesto',
          SUPPLY: 'Insumo',
          EXTERNAL_SERVICE: 'Servicio Compuesto',
        }
        sendJson(response, 200, {
          items: items.map((item) => {
            const legacy = isRecord(item.legacyData) ? item.legacyData : {}
            return {
              ...legacy,
              id: item.id,
              description: item.name,
              reference: item.sku ?? '',
              cost: Number(item.cost),
              price: Number(item.price),
              taxRate: Number(item.taxRate),
              stock: Number(item.stock),
              type: typeof legacy.type === 'string' ? legacy.type : itemNames[item.type],
              category: item.category?.name ?? (typeof legacy.category === 'string' ? legacy.category : ''),
              unit: item.unit,
              details: item.description ?? (typeof legacy.details === 'string' ? legacy.details : ''),
            }
          }),
        })
      } catch (error) {
        console.error('Unable to load inventory:', error)
        sendJson(response, 503, { error: 'No se pudo cargar el inventario.' })
      }
      return
    }

    if (url.pathname === '/api/inventory' && ['POST', 'PUT'].includes(method)) {
      if (!requestOriginAllowed(request)) {
        sendJson(response, 403, { error: 'Origen de solicitud no permitido.' })
        return
      }
      let payload: unknown
      try {
        payload = await readJsonBody(request)
      } catch (error) {
        const status = isRecord(error) && typeof error.status === 'number' ? error.status : 400
        sendJson(response, status, { error: error instanceof Error ? error.message : 'Solicitud inválida.' })
        return
      }
      if (!isRecord(payload) || !isRecord(payload.item)) {
        sendJson(response, 400, { error: 'Se requiere el ítem que se va a guardar.' })
        return
      }
      const item = payload.item
      const id = typeof item.id === 'string' ? item.id.trim().toUpperCase() : ''
      const description = typeof item.description === 'string' ? item.description.trim() : ''
      if (!id || !description) {
        sendJson(response, 400, { error: 'El código y el nombre del ítem son obligatorios.' })
        return
      }
      try {
        const user = await authenticatedUser(request)
        if (!user) {
          sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
          return
        }
        const typeLabels: Record<string, ItemType> = {
          'Mano de Obra': ItemType.LABOR,
          'Mano de obra': ItemType.LABOR,
          Repuesto: ItemType.PART,
          Insumo: ItemType.SUPPLY,
          'Servicio Compuesto': ItemType.EXTERNAL_SERVICE,
          Adicional: ItemType.EXTERNAL_SERVICE,
        }
        const typeName = typeof item.type === 'string' ? item.type : 'Repuesto'
        const categoryName = typeof item.category === 'string' ? item.category.trim() : ''
        let categoryId: string | null = null
        if (categoryName) {
          const category = await prisma.category.upsert({
            where: { name: categoryName },
            create: { name: categoryName },
            update: {},
          })
          categoryId = category.id
        }
        const numberValue = (value: unknown, fallback = 0) =>
          typeof value === 'number' && Number.isFinite(value) ? value : fallback
        const components = Array.isArray(item.components)
          ? item.components
              .filter(isRecord)
              .map((component) => ({
                itemId: typeof component.itemId === 'string' ? component.itemId : '',
                quantity: numberValue(component.quantity, 1),
              }))
          : []
        const legacyData: Prisma.InputJsonObject = {
          type: typeName,
          specialty: typeof item.specialty === 'string' ? item.specialty : '',
          category: categoryName,
          brand: typeof item.brand === 'string' ? item.brand : '',
          marginPercent: numberValue(item.marginPercent),
          location: typeof item.location === 'string' ? item.location : '',
          ...(typeof item.laborHours === 'number' ? { laborHours: item.laborHours } : {}),
          ...(typeof item.complexity === 'string' ? { complexity: item.complexity } : {}),
          components,
        }
        const data = {
          name: description,
          type: typeLabels[typeName] ?? ItemType.EXTERNAL_SERVICE,
          sku: typeof item.reference === 'string' && item.reference.trim() ? item.reference.trim().toUpperCase() : null,
          description: typeof item.details === 'string' ? item.details.trim() : null,
          unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'Unidad (und)',
          cost: new Prisma.Decimal(numberValue(item.cost)),
          price: new Prisma.Decimal(numberValue(item.price)),
          taxRate: new Prisma.Decimal(numberValue(item.taxRate)),
          stock: typeName === 'Mano de Obra' || typeName === 'Servicio Compuesto'
            ? new Prisma.Decimal(999)
            : new Prisma.Decimal(numberValue(item.stock)),
          categoryId,
          legacyData,
          isActive: true,
        }
        const saved = await (method === 'POST'
          ? prisma.item.create({ data: { id, ...data }, include: { category: true } })
          : prisma.item.update({ where: { id }, data, include: { category: true } }))
        sendJson(response, method === 'POST' ? 201 : 200, {
          item: {
            ...legacyData,
            id: saved.id,
            description: saved.name,
            reference: saved.sku ?? '',
            cost: Number(saved.cost),
            price: Number(saved.price),
            taxRate: Number(saved.taxRate),
            stock: Number(saved.stock),
            category: saved.category?.name ?? categoryName,
            unit: saved.unit,
            details: saved.description ?? '',
          },
        })
      } catch (error) {
        console.error('Unable to persist inventory item:', error)
        if (isRecord(error) && error.code === 'P2002') {
          sendJson(response, 409, { error: 'Ya existe un ítem con ese código o referencia.' })
          return
        }
        sendJson(response, 503, { error: 'No se pudo guardar el ítem en Neon.' })
      }
      return
    }

    const inventoryDeleteMatch = url.pathname.match(/^\/api\/inventory\/(.+)$/)
    if (inventoryDeleteMatch && method === 'DELETE') {
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
        await prisma.item.delete({ where: { id: decodeURIComponent(inventoryDeleteMatch[1]) } })
        sendJson(response, 200, { id: decodeURIComponent(inventoryDeleteMatch[1]) })
      } catch (error) {
        console.error('Unable to delete inventory item:', error)
        if (isRecord(error) && (error.code === 'P2003' || error.code === 'P2025')) {
          sendJson(response, error.code === 'P2003' ? 409 : 404, {
            error: error.code === 'P2003'
              ? 'El ítem está relacionado con órdenes o cotizaciones y no puede eliminarse.'
              : 'No se encontró el ítem.',
          })
          return
        }
        sendJson(response, 503, { error: 'No se pudo eliminar el ítem en Neon.' })
      }
      return
    }

  if (url.pathname === '/api/photos' || url.pathname.startsWith('/api/photos/')) {
    sendJson(response, 410, {
      error: 'Las fotografías ahora se almacenan exclusivamente en UploadThing.',
    })
    return
  }

  if (url.pathname === '/api/state' && request.method === 'GET') {
    try {
      const user = await authenticatedUser(request)
      if (!user) {
        sendJson(response, 401, { error: 'Inicia sesión para continuar.' })
        return
      }
      const state = await getRelationalWorkshopData()
      sendJson(response, 200, state)
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
      const result = await saveRelationalWorkshopData(
        payload.data,
        payload.version as number,
        user.id,
      )
      if (!result) {
        const latest = await getRelationalWorkshopData()
        sendJson(response, 409, {
          error: 'Hay cambios de otro dispositivo; conserva esta pestaña mientras se sincronizan.',
          version: latest.version,
        })
        return
      }
      sendJson(response, 200, { version: result.version, updatedAt: new Date().toISOString() })
    } catch (error) {
      console.error('Unable to persist workshop data:', error)
      const status = isRecord(error) && typeof error.status === 'number' ? error.status : 500
      sendJson(response, status, {
        error: status === 400 && error instanceof Error ? error.message : 'No se pudieron guardar los cambios en Neon.',
      })
    }
    return
  }

  sendJson(response, 404, { error: 'Ruta no encontrada.' })
}
