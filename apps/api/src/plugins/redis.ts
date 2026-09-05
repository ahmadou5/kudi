import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redisUrl = process.env.REDIS_URL;
  const isRedisEnabled = process.env.ENABLE_REDIS === 'true';

  if (redisUrl && isRedisEnabled) {
    try {
      await fastify.register(fastifyRedis, {
        url: redisUrl,
        closeClient: true,
        connectTimeout: 1500,
        maxRetriesPerRequest: 1
      });
    } catch (err) {
      fastify.log.warn('⚠️ Local Redis server unreachable. Fastify Redis plugin skipped (operating in mock/in-memory mode).');
    }
  } else {
    fastify.log.warn('Redis plugin disabled/skipped. Operating in in-memory mode.');
  }
};

export default fp(redisPlugin);


