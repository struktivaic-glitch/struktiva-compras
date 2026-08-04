import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { env } from '../config/env.js';

export default fp(async function authPlugin(app) {
  app.register(fastifyJwt, { secret: env.jwtSecret });

  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'No autenticado' });
    }
  });

  app.decorate('requireRole', function (...rolesPermitidos) {
    return async function (request, reply) {
      if (!rolesPermitidos.includes(request.user.rol)) {
        reply.code(403).send({ error: 'No tienes permiso para esta acción' });
      }
    };
  });
});
