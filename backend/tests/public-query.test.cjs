const express = require('express');
const request = require('supertest');
const prisma = require('../src/models/prisma').default;
const productRoutes = require('../src/routes/product.routes').default;
const blogRoutes = require('../src/routes/blog.routes').default;
const { errorHandler } = require('../src/middlewares/errorHandler');
let queries;
function app() {
  const server = express();
  server.use('/products', productRoutes);
  server.use('/blog', blogRoutes);
  server.use(errorHandler);
  return server;
}
beforeEach(() => {
  queries = [];
  jest.spyOn(prisma.product, 'findMany').mockImplementation(async (query) => { queries.push(query); return []; });
  jest.spyOn(prisma.product, 'count').mockResolvedValue(0);
  jest.spyOn(prisma.product, 'findUnique').mockResolvedValue({ id: 1, categoryId: 2 });
  jest.spyOn(prisma.blogPost, 'findMany').mockImplementation(async (query) => { queries.push(query); return []; });
  jest.spyOn(prisma.blogPost, 'count').mockResolvedValue(0);
});
test.each(['limit=-1', 'limit=101', 'limit=1abc', 'page=0', 'page=-1', 'page=999999999999999999', 'minPrice=abc', 'minPrice=Infinity', 'minPrice=-1', 'minPrice=20&maxPrice=10', 'search[x]=hello', 'search=a&search=b', 'featured=invalid'])('invalid product query returns 400 before querying: %s', async (query) => {
  const response = await request(app()).get('/products?' + query);
  expect(response.status).toBe(400);
  expect(queries).toHaveLength(0);
});
test.each(['/products/by-category/2?limit=-1', '/products/1/related?limit=101', '/blog?limit=-1', '/blog?page=0'])('other public lists also reject invalid pagination: %s', async (url) => {
  const response = await request(app()).get(url);
  expect(response.status).toBe(400);
  expect(queries).toHaveLength(0);
});
test('valid pagination and prices preserve the listing response', async () => {
  const response = await request(app()).get('/products?page=2&limit=10&minPrice=1.5&maxPrice=20&featured=true');
  expect(response.status).toBe(200);
  expect(response.body.pagination).toEqual({ page: 2, limit: 10, total: 0, totalPages: 0 });
  expect(queries[0].skip).toBe(10);
  expect(queries[0].take).toBe(10);
  expect(queries[0].where).toMatchObject({ price: { gte: 1.5, lte: 20 }, isFeatured: true });
});

test('the shop default sorting option still lists products', async () => {
  const response = await request(app()).get('/products?page=1&limit=12&sort=default');
  expect(response.status).toBe(200);
  expect(queries[0].orderBy).toEqual({ createdAt: 'desc' });
});
