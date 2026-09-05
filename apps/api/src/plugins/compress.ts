import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import compress from '@fastify/compress';

const compressPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(compress, {
    threshold: 1024,
  });
};

export default fp(compressPlugin);
