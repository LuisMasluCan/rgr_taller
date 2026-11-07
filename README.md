# RGR Taller

Aplicación para gestionar órdenes, facturación, clientes, vehículos e inventario. El frontend usa React, TypeScript, Vite y Tailwind CSS; la API local de Node.js/TypeScript persiste el estado de trabajo en PostgreSQL (Neon) mediante Prisma.

## Requisitos

- Node.js y npm.
- Variables `DATABASE_URL` (conexión pooled de Neon) y `DIRECT_URL` (conexión directa para migraciones) en `.env` en la raíz.

No agregues las credenciales de Neon al repositorio ni las compartas. Si una clave de conexión se expuso, rótala desde Neon.

## Instalación y base de datos

```sh
npm install
cd backend
npm install
npx prisma migrate dev
npm run build
cd ..
```

La migración `add_workshop_state` crea la tabla `WorkshopState` usada por la persistencia actual.

## Desarrollo

Desde la raíz, inicia la API y el frontend juntos en una sola terminal:

```sh
npm run dev
```

La aplicación se abre en `http://localhost:5173` (el puerto debe estar libre; Vite no cambia de puerto automáticamente).
Vite reenvía `/api` al servidor local en `127.0.0.1:3001`. Comprueba la conexión en `http://127.0.0.1:3001/api/health`.

## Persistencia y alcance actual

Por ahora, la API guarda las colecciones editadas por la interfaz como un snapshot JSONB versionado en `WorkshopState`. La interfaz muestra cuándo hay cambios en curso y advierte antes de salir si todavía no se guardaron. Las cuentas bancarias y categorías iniciales se leen de sus tablas relacionales; los cambios operativos de la interfaz todavía **no** se sincronizan con `Customer`, `Vehicle`, `ServiceOrder`, `Invoice` u otras tablas relacionales. La tabla normalizada no debe usarse aún como fuente de reportes externos.

El acceso está limitado a cuentas con rol `ADMIN`; no hay registro de usuarios y la interfaz ofrece una sola cuenta operativa por ahora. El seed prepara `admin@rgrtaller.pe` y toma su contraseña de `ADMIN_SEED_PASSWORD` en `.env`; el servidor almacena sesiones opacas con hash en Neon y las entrega en una cookie `HttpOnly`, `SameSite=Strict`. El servidor escucha solo en loopback. No lo expongas a internet ni a una red compartida. Las imágenes aún no usan un proveedor externo; evita guardar imágenes grandes en el snapshot (la API limita cada solicitud a 8 MB).

En la pantalla de acceso, usa `admin@rgrtaller.pe` y la contraseña definida en `ADMIN_SEED_PASSWORD` en el `.env` de la raíz. No copies esa contraseña en chats ni la publiques.

## Validación

```sh
npm run lint
npm run build
cd backend
npm run build
```
