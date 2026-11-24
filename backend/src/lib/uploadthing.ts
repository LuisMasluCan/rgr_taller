import { createHash } from 'node:crypto'
import { createRouteHandler, createUploadthing, type FileRouter, UploadThingError } from 'uploadthing/server'
import { prisma } from './prisma'
import { Role } from '../generated/prisma/client'

const sessionCookieName = 'rgr_admin_session'

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function getSessionTokenFromHeaders(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [name, ...parts] = cookie.trim().split('=')
    if (name === sessionCookieName) return parts.join('=') || null
  }
  return null
}

const f = createUploadthing()

export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 10,
    },
  })
    .middleware(async ({ req }) => {
      const cookie = req.headers.get('cookie')
      const token = getSessionTokenFromHeaders(cookie)
      if (!token) {
        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Inicia sesión como administrador para subir fotografías.',
        })
      }

      const tokenHash = hashSessionToken(token)
      const session = await prisma.authSession.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          expiresAt: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      })

      if (!session || session.expiresAt <= new Date() || session.user.role !== Role.ADMIN) {
        throw new UploadThingError({
          code: 'FORBIDDEN',
          message: 'Sesión no válida o expirada.',
        })
      }

      return { userId: session.user.id, userName: session.user.name }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.info(`[UploadThing] Fotografía subida por ${metadata.userName}: ${file.name} (${file.url})`)
      return { uploadedBy: metadata.userId, url: file.url, key: file.key, name: file.name }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter

const isDev = process.env.NODE_ENV !== 'production'

export const uploadthingHandler = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
    isDev,
    callbackUrl:
      process.env.UPLOADTHING_CALLBACK_URL ||
      (isDev ? `http://127.0.0.1:${process.env.API_PORT ?? 3001}/api/uploadthing` : undefined),
  },
})
