import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import config from '../config/index.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nurfia API',
      version: '1.0.0',
      description: 'Nurfia E-commerce API Documentation',
    },
    servers: [
      {
        url: config.env === 'production' ? 'https://web-nurfia.onrender.com' : `http://localhost:${config.port}`,
        description: config.env === 'production' ? 'Production Server' : 'Development Server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication & profile' },
      { name: 'Products', description: 'Product listing & search' },
      { name: 'Categories', description: 'Category management' },
      { name: 'Cart', description: 'Shopping cart' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Wishlist', description: 'Wishlist management' },
      { name: 'Compare', description: 'Product comparison' },
      { name: 'Addresses', description: 'Saved addresses' },
      { name: 'Payment', description: 'Payment processing' },
      { name: 'Banners', description: 'Banner management' },
      { name: 'Blog', description: 'Blog posts' },
      { name: 'Contact', description: 'Contact & newsletter' },
      { name: 'Settings', description: 'Site settings' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Chat', description: 'AI chat history' },
      { name: 'Upload', description: 'File upload' },
      { name: 'Admin', description: 'Admin panel endpoints' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Generate docs from source `.ts` during development and compiled `.js` in dist for production
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/server.ts',
    './dist/routes/*.js',
    './dist/controllers/*.js',
    './dist/server.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  if (config.env === 'production') {
    return;
  }

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  
  app.get('/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};
