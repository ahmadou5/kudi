import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Kudi API',
        description: 'Cross-border stablecoin payout & wallet API for Kudi',
        version: '0.1.0',
      },
      servers: [
        {
          url: 'http://localhost:4000',
          description: 'Development Server',
        },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });
};

export default fp(swaggerPlugin);
