# Catálogo de Zapatillas

App web para llevar el catálogo personal de sneakers: agregar pares, subir fotos, filtrar por marca/estado, buscar, y ver el precio total retail vs. el precio total de reventa.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000. Sin ninguna configuración extra, los datos (y las fotos que subas) se guardan en archivos locales dentro de `data/` y `public/uploads/` — solo persisten en esta máquina, útil para desarrollar.

## Desplegar en Vercel con sincronización entre dispositivos

Para que el catálogo se vea igual desde el celular, la compu, etc., la app necesita un almacenamiento compartido: **Vercel Blob**.

1. Subí el proyecto a Vercel (importá este repo desde el dashboard de Vercel, o `vercel deploy` con la CLI).
2. En el proyecto ya desplegado, andá a la pestaña **Storage** → **Create Database** → **Blob** → conectalo al proyecto.
   Vercel agrega automáticamente la variable de entorno `BLOB_READ_WRITE_TOKEN` — no hace falta copiar nada a mano.
3. Volvé a desplegar (redeploy) el proyecto para que tome la variable nueva.

A partir de ahí, cada par que agregues y cada foto que subas queda guardado en Blob y se ve igual desde cualquier dispositivo que abra la URL de tu app.

Mientras `BLOB_READ_WRITE_TOKEN` no esté configurado, la app sigue funcionando pero avisa con un banner que el guardado es solo local a esa instancia del servidor (no sincroniza entre visitas/dispositivos).

## Estructura

- `app/page.tsx` — carga el catálogo en el servidor y renderiza `CatalogApp`.
- `components/CatalogApp.tsx` — estado de la UI: búsqueda, filtros, orden, modal.
- `app/api/items` — crear/listar pares; `app/api/items/[id]` — editar/eliminar; `app/api/upload` — subir fotos.
- `lib/store.ts` — capa de datos (Vercel Blob en producción, archivo local en desarrollo).
- `lib/seed-data.ts` — catálogo inicial con el que arranca la colección.
