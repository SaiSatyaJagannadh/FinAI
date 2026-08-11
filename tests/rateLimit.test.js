const rateLimit = require('../server/rateLimit');

// Fake clock so the window test doesn't sleep.
let clock = 1000;
const mkRes = () => {
  const res = { code: null, body: null, headers: {} };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const hit = (limiter, ip = '1.2.3.4') => {
  const res = mkRes();
  let passed = false;
  limiter({ ip, headers: {} }, res, () => { passed = true; });
  return { passed, res };
};

describe('rateLimit', () => {
  beforeEach(() => { clock = 1000; });

  test('allows up to max, then 429s', () => {
    const limiter = rateLimit({ max: 3, windowMs: 60000, message: 'slow down', now: () => clock });
    expect([hit(limiter), hit(limiter), hit(limiter)].every((r) => r.passed)).toBe(true);

    const blocked = hit(limiter);
    expect(blocked.passed).toBe(false);
    expect(blocked.res.code).toBe(429);
    expect(blocked.res.body.message).toBe('slow down');
    expect(blocked.res.headers['Retry-After']).toBe(60);
  });

  test('window expires — caller is allowed again', () => {
    const limiter = rateLimit({ max: 1, windowMs: 60000, message: 'x', now: () => clock });
    expect(hit(limiter).passed).toBe(true);
    expect(hit(limiter).passed).toBe(false);
    clock += 60001;
    expect(hit(limiter).passed).toBe(true);
  });

  test('limits are per-IP, not global', () => {
    const limiter = rateLimit({ max: 1, windowMs: 60000, message: 'x', now: () => clock });
    expect(hit(limiter, '1.1.1.1').passed).toBe(true);
    expect(hit(limiter, '1.1.1.1').passed).toBe(false);
    expect(hit(limiter, '2.2.2.2').passed).toBe(true);
  });
});
