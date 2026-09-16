import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { apiConfig } from '@kudi/config';

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: apiConfig.JWT_SECRET || 'kudi-local-dev-jwt-secret',
  });
};

export default fp(jwtPlugin);
