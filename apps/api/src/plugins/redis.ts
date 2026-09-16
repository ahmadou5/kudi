import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';
import { apiConfig } from '@kudi/config';

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redisUrl = apiConfig.REDIS_URL;
  const isRedisEnabled = apiConfig.ENABLE_REDIS === 'true';

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


