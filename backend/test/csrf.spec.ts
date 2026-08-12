import { csrfProtection } from '../src/auth/csrf.middleware';

function run(request: Record<string, unknown>) {
  return new Promise<unknown>((resolve) => {
    csrfProtection(request as never, {} as never, (error?: unknown) =>
      resolve(error || null),
    );
  });
}

describe('csrfProtection', () => {
  beforeEach(() => {
    process.env.CORS_ORIGIN = 'https://hisaby.pro';
  });

  it('rejects cookie-authenticated mutations without a double-submit token', async () => {
    const error = await run({
      method: 'POST',
      originalUrl: '/api/invoices',
      headers: { origin: 'https://hisaby.pro' },
      cookies: { bhd_access: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeTruthy();
  });

  it('accepts a matching token from an allowed origin', async () => {
    const error = await run({
      method: 'POST',
      originalUrl: '/api/invoices',
      headers: {
        origin: 'https://hisaby.pro',
        'x-csrf-token': 'expected',
      },
      cookies: { bhd_access: 'jwt', bhd_csrf: 'expected' },
    });
    expect(error).toBeNull();
  });
});
