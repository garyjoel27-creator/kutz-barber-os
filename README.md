# KUTZ // BARBER OS (`luminadesk`) — Plataforma Multi-Barbería & Agenda Táctil QR

Sistema operativo urbano y CRM 3D multi-tenant para barberías, desplegado en **Netlify Pro + Netlify Blobs** (`https://luminadesk-gary.netlify.app`).

---

## 💈 Acceso Directo Listo para José (`CM Salón D’ Campodónico`)

- **Portal Público de Reservas QR (Clientes)**:
  [`https://luminadesk-gary.netlify.app/r/joseh-barber`](https://luminadesk-gary.netlify.app/r/joseh-barber)
- **Panel Privado del Barbero (José)**:
  [`https://luminadesk-gary.netlify.app/?shop=joseh-barber`](https://luminadesk-gary.netlify.app/?shop=joseh-barber)
  - **PIN del Barbero**: `2023`
  - **Barbero Titular**: `José (Joseh_barber.style)` (`SILLÓN 1`)
  - **Dirección**: `Av. Alcalde Ginés de la Hoz, 2, Bajo Izq., 35500 Arrecife, Lanzarote`
  - **Teléfono / WhatsApp**: `689 014 014` (`+34 689 014 014`)
  - **Horario Configurado (Editable desde el panel en `🕒 Horario apertura`)**:
    - Lunes a Jueves: `10:00 – 18:00`
    - Viernes: `09:00 – 20:30`
    - Sábado: `09:00 – 15:00`
    - Domingo: `Cerrado`
  - **Catálogo Oficial**: 16 servicios y tarifas configurados con sus duraciones reales (`15m`, `30m`, `60m`, `90m`, `120m`).

---

## 🚀 Cómo Replicar o Dar de Alta Nuevas Barberías en 1 Minuto

La arquitectura es **100 % Multi-Tenant** y aislada por barbería (`kutz_${shopSlug}_{config,appointments,queue,clients}` en local y `shops/${shopSlug}/*` en Netlify Blobs):

1. Abre el **Panel Súper-Admin**:
   [`https://luminadesk-gary.netlify.app/admin`](https://luminadesk-gary.netlify.app/admin)
2. Introduce la **Clave Master de Súper-Admin** (`ADMIN_SECRET` / `kutz-superadmin-2026`).
3. Pulsa **"Dar de Alta Nueva Barbería"** (o **"Editar"** sobre cualquier barbería existente):
   - Define **Nombre**, **Slug URL** (`/r/nombre-barberia`), **PIN de 4 dígitos**, **Teléfono**, **Dirección**, **Barberos** y **Servicios con duración y precio**.
4. Al guardar:
   - Se crea la tienda **100 % limpia** (0 clientes demo falsos, 0 citas demo, caja a `0€` y sillones generados dinámicamente a partir de los barberos de esa tienda).
   - Su portal público queda activo al instante en `/r/<slug>`.
   - El panel privado del barbero queda disponible en `/?shop=<slug>` protegido con su PIN de 4 dígitos.

---

## 🛠️ Instalación, Tests y Despliegue Local / Clonación

```bash
# 1. Instalar dependencias
npm install

# 2. Análisis estático (Oxlint)
npx oxlint src netlify

# 3. Compilar bundle de producción PWA
npm run build

# 4. Ejecutar suite completa de tests (430 tests E2E y unitarios)
npm test

# 5. Ejecutar verificación móvil en Puppeteer (375x812 y 390x844)
node tests/puppeteer_mobile_pilar_verification.mjs

# 6. Desplegar a producción en Netlify
npx netlify deploy --prod --dir=dist --functions=netlify/functions --no-build
```
