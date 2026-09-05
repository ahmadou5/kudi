import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../lib/prisma';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('prisma', prisma);
};

export default fp(prismaPlugin);
