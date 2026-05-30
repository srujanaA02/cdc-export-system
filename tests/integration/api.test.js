jest.mock('../../src/services/exportService', () => ({
  runExport: jest.fn().mockResolvedValue()
}));

const request = require('supertest');
const app = require('../../src/app');

jest.setTimeout(30000);

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('timestamp is a valid ISO string', async () => {
    const res = await request(app).get('/health');
    expect(() => new Date(res.body.timestamp)).not.toThrow();
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});

describe('POST /exports/full', () => {
  it('returns 202 with correct shape', async () => {
    const res = await request(app)
      .post('/exports/full')
      .set('X-Consumer-ID', 'test-consumer-1');
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.status).toBe('started');
    expect(res.body.exportType).toBe('full');
    expect(res.body.outputFilename).toMatch(/^full_test-consumer-1_/);
  });

  it('returns 400 when X-Consumer-ID header is missing', async () => {
    const res = await request(app).post('/exports/full');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('jobId is a valid UUID', async () => {
    const res = await request(app)
      .post('/exports/full')
      .set('X-Consumer-ID', 'test-consumer-uuid');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(res.body.jobId).toMatch(uuidRegex);
  });
});

describe('POST /exports/incremental', () => {
  it('returns 202 with incremental exportType', async () => {
    const res = await request(app)
      .post('/exports/incremental')
      .set('X-Consumer-ID', 'test-consumer-2');
    expect(res.status).toBe(202);
    expect(res.body.exportType).toBe('incremental');
    expect(res.body.outputFilename).toMatch(/^incremental_/);
  });

  it('returns 400 without consumer ID', async () => {
    const res = await request(app).post('/exports/incremental');
    expect(res.status).toBe(400);
  });
});

describe('POST /exports/delta', () => {
  it('returns 202 with delta exportType', async () => {
    const res = await request(app)
      .post('/exports/delta')
      .set('X-Consumer-ID', 'test-consumer-3');
    expect(res.status).toBe(202);
    expect(res.body.exportType).toBe('delta');
    expect(res.body.outputFilename).toMatch(/^delta_/);
  });

  it('returns 400 without consumer ID', async () => {
    const res = await request(app).post('/exports/delta');
    expect(res.status).toBe(400);
  });
});

describe('GET /exports/watermark', () => {
  it('returns 404 for unknown consumer', async () => {
    const res = await request(app)
      .get('/exports/watermark')
      .set('X-Consumer-ID', `unknown-consumer-${Date.now()}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 without consumer ID', async () => {
    const res = await request(app).get('/exports/watermark');
    expect(res.status).toBe(400);
  });
});

afterAll(async () => {
  const pool = require('../../src/db');
  await pool.end();
});
