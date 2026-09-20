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
        lazyConnect: true,
        maxRetriesPerRequest: 1
      });
      if (fastify.redis) {
        fastify.redis.on('error', (err: any) => {
          fastify.log.warn(`⚠️ Redis client warning: ${err?.message}`);
        });
      }
    } catch (err: any) {
      fastify.log.warn(`⚠️ Local Redis server unreachable (${err?.message}). Fastify Redis plugin skipped (operating in mock/in-memory mode).`);
    }
  } else {
    fastify.log.warn('Redis plugin disabled/skipped. Operating in in-memory mode.');
  }
};

export default fp(redisPlugin);


