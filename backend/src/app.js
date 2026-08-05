import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { env } from './config/env.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './modules/auth/routes.js';
import catalogoRoutes from './modules/catalogo/routes.js';
import requisicionesRoutes from './modules/requisiciones/routes.js';
import proveedoresRoutes from './modules/proveedores/routes.js';
import cotizacionesRoutes from './modules/cotizaciones/routes.js';
import ordenesCompraRoutes from './modules/ordenesCompra/routes.js';
import entradasAlmacenRoutes from './modules/almacen/entradas.js';
import salidasAlmacenRoutes from './modules/almacen/salidas.js';
import facturasRoutes from './modules/facturas/routes.js';
import pagosRoutes from './modules/pagos/routes.js';
import expedienteRoutes from './modules/expediente/routes.js';
import reportesRoutes from './modules/reportes/routes.js';
import explosionInsumosRoutes from './modules/importaciones/explosionInsumos.js';
import usuariosRoutes from './modules/usuarios/routes.js';
import firmasRoutes from './modules/firmas/routes.js';
import notificacionesRoutes from './modules/notificaciones/routes.js';
import telegramRoutes from './modules/telegram/routes.js';
import trabajadoresRoutes from './modules/trabajadores/routes.js';
import asistenciaRoutes from './modules/asistencia/routes.js';
import incidenciasRoutes from './modules/incidencias/routes.js';
import pagosPersonalRoutes from './modules/pagosPersonal/routes.js';
import configuracionJornadaRoutes from './modules/configuracionJornada/routes.js';
import { uploadsDir } from './lib/storage.js';

export async function buildApp() {
  const app = Fastify({ logger: env.nodeEnv === 'development' });

  await app.register(cors, { origin: env.corsOrigin });
  await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } });
  await app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/' });
  await app.register(authPlugin);

  app.setErrorHandler((err, request, reply) => {
    request.log.error(err);
    const statusCode = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    const mensaje = statusCode < 500 ? err.message : 'Ocurrió un error inesperado. Intenta de nuevo en unos momentos.';
    reply.code(statusCode).send({ error: mensaje });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes);
  await app.register(catalogoRoutes);
  await app.register(requisicionesRoutes);
  await app.register(proveedoresRoutes);
  await app.register(cotizacionesRoutes);
  await app.register(ordenesCompraRoutes);
  await app.register(entradasAlmacenRoutes);
  await app.register(salidasAlmacenRoutes);
  await app.register(facturasRoutes);
  await app.register(pagosRoutes);
  await app.register(expedienteRoutes);
  await app.register(reportesRoutes);
  await app.register(explosionInsumosRoutes);
  await app.register(usuariosRoutes);
  await app.register(firmasRoutes);
  await app.register(notificacionesRoutes);
  await app.register(telegramRoutes);
  await app.register(trabajadoresRoutes);
  await app.register(asistenciaRoutes);
  await app.register(incidenciasRoutes);
  await app.register(pagosPersonalRoutes);
  await app.register(configuracionJornadaRoutes);

  return app;
}
