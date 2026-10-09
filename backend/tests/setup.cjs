process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-regression-tests-only';
process.env.JWT_REFRESH_SECRET = 'isolated-regression-tests-only';
// Tests replace database/network boundaries; never connect to the real .env database.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
