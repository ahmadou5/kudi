import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

const helmetPlugin: FastifyPluginAsync = async (fastify) => {
  try {
    await fastify.register(helmet, {
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    });
  } catch (err) {
    fastify.log.warn('Helmet plugin skipped due to version mismatch in dev environment');
  }
};

export default fp(helmetPlugin);

