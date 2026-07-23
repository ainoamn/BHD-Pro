export default () => {
  const isProd = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    database: {
      url: process.env.DATABASE_URL,
    },
    jwt: {
      // Dev-only fallbacks; production refuses to boot without strong secrets (assertProductionSecrets)
      secret:
        jwtSecret ||
        (isProd ? undefined : 'qootk-dev-secret-change-in-production-min-32-chars!!'),
      refreshSecret:
        refreshSecret ||
        (isProd ? undefined : 'qootk-dev-refresh-secret-change-in-production!!'),
      expiration: process.env.JWT_EXPIRATION || '15m',
      refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
    },
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
    },
  };
};
