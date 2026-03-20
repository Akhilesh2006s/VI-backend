import dotenv from 'dotenv';

dotenv.config();

export const config = {
  mongoUri: process.env.MONGO_URI || 'mongodb+srv://amenity:forge2025@cluster0.eiramxt.mongodb.net/AFS?appName=Cluster0',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
  cashfreeAppId: process.env.CASHFREE_APP_ID || '',
  cashfreeSecretKey: process.env.CASHFREE_SECRET_KEY || '',
  cashfreeEnvironment: process.env.CASHFREE_ENVIRONMENT || 'production',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8080,https://vi.vallunex.com,https://vi.vallunex.com/login')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
};
