import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env.JWT_SECRET || 'kudi-super-secret-jwt-key-change-in-production';
  await fastify.register(fastifyJwt, {
    secret,
  });
};

export default fp(jwtPlugin);
