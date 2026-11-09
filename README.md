# RGR Taller

Aplicación para gestionar órdenes, facturación, clientes, vehículos e inventario. El frontend usa React, TypeScript, Vite y Tailwind CSS; la API de Node.js/TypeScript persiste el estado y las fotografías privadas en PostgreSQL (Neon) mediante Prisma. En producción, el frontend estático y la API se despliegan desde este mismo repositorio y proyecto de Vercel.

## Requisitos

- Node.js y npm.
- Copia `.env.example` a `.env` y configura `DATABASE_URL` (conexión pooled de Neon) y `DIRECT_URL` (conexión directa para migraciones) en la raíz.

No agregues las credenciales de Neon al repositorio ni las compartas. Si una clave de conexión se expuso, rótala desde Neon.

## Instalación y base de datos

```sh
npm ci
npm ci --prefix backend
npm run db:migrate:deploy --prefix backend
npm run build --prefix backend
```

Las migraciones crean las tablas `WorkshopState` (persistencia actual), `AuthSession` (sesiones) y `WorkshopPhoto` (fotografías de ingreso). Asegúrate de ejecutar `npm run db:migrate:deploy --prefix backend` al configurar la base y después de cada cambio de esquema; las fotos no se incluyen como base64 en cada sincronización del estado.

## Desarrollo

Desde la raíz, inicia la API y el frontend juntos en una sola terminal:

```sh
npm run dev
```

La aplicación se abre en `http://localhost:5173` (el puerto debe estar libre; Vite no cambia de puerto automáticamente).
Vite reenvía `/api` al servidor local en `127.0.0.1:3001`. Comprueba la conexión en `http://127.0.0.1:3001/api/health`.

## Persistencia y alcance actual

Por ahora, la API guarda las colecciones editadas por la interfaz como un snapshot JSONB versionado en `WorkshopState`. Si varios dispositivos guardan a la vez, la interfaz combina los cambios independientes y reintenta automáticamente; los registros se combinan por ID para conservar, por ejemplo, órdenes creadas en otra sesión. La interfaz muestra cuándo hay cambios en curso y advierte antes de salir si todavía no se guardaron. Las cuentas bancarias y categorías iniciales se leen de sus tablas relacionales; los cambios operativos de la interfaz todavía **no** se sincronizan con `Customer`, `Vehicle`, `ServiceOrder`, `Invoice` u otras tablas relacionales. La tabla normalizada no debe usarse aún como fuente de reportes externos.

El acceso está limitado a cuentas con rol `ADMIN`; no hay registro de usuarios y la interfaz ofrece una sola cuenta operativa por ahora. El servidor almacena sesiones opacas con hash en Neon y las entrega en una cookie `HttpOnly`, `SameSite=Strict`. Las fotografías se sirven solo a sesiones autenticadas y se guardan fuera del snapshot JSON.

En la pantalla de acceso, usa `admin@rgrtaller.pe` y la contraseña configurada inicialmente. No copies esa contraseña en chats ni la publiques. Para crear el primer administrador en una base vacía, usa el script `db:seed:admin`, que no agrega clientes ni datos de prueba. No ejecutes el seed general (`db:seed`) en producción porque incluye registros de demostración.

## Despliegue como proyecto Vercel Services

El repositorio raíz contiene dos servicios dentro de un solo proyecto de Vercel: `app` (Vite) y `backend` (Node). `vercel.json` configura la instalación y compilación independientes de cada servicio. Las rutas públicas `/api/*` llegan a `backend`; las demás llegan a `app`. `backend/src/vercel.bundle.cjs` es el entrypoint HTTP de Vercel e incluye el handler y sus dependencias empaquetadas; se mantiene en el repositorio porque Vercel valida el entrypoint antes de ejecutar el build. El backend conserva el prefijo `/api` en sus rutas. Ningún servicio necesita un binding para llamar al otro: el navegador usa las rutas públicas del mismo dominio.

1. En Neon, conserva la base de datos de este taller y obtén las conexiones pooled (`DATABASE_URL`) y directa (`DIRECT_URL`). No crees una base nueva si quieres conservar los datos existentes.
2. Desde la raíz, aplica las migraciones a esa base con `npm run db:migrate:deploy --prefix backend`. Este comando requiere las variables de `.env`; no imprime ni sube sus valores.
3. Si la base aún no tiene el administrador, define `ADMIN_SEED_PASSWORD` en `.env` y ejecuta una sola vez `npm run db:seed:admin --prefix backend`. Omite este paso si el usuario administrador ya existe.
4. En Vercel, importa el repositorio como **un solo proyecto con Application Preset `Services`** y deja **Root Directory** en `./` (raíz). No importes `app` ni `backend` como proyectos independientes. La definición de los servicios, sus builds y el enrutamiento está en `vercel.json`.
5. Añade `DATABASE_URL` y `DIRECT_URL` en **Environment Variables** para Production y Preview según corresponda. Estas variables del proyecto estarán disponibles para el servicio que las necesite. Para una base real, es más seguro no habilitar Preview o darle una base separada.
6. Despliega y comprueba `/api/health`, luego inicia sesión y verifica lectura/guardado de datos y carga de fotos.

Las variables de Vercel se configuran en el panel; `.env` permanece local y está ignorado por Git. No configures `ADMIN_SEED_PASSWORD` en Vercel: el seed de administrador se ejecuta manualmente una sola vez desde un entorno confiable.

## Validación

```sh
npm run lint
npm run build
npm run build --prefix backend
```
