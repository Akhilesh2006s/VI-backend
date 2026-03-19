import dotenv from 'dotenv';

dotenv.config();

export const config = {
  mongoUri: process.env.MONGO_URI || 'mongodb+srv://amenity:forge2025@cluster0.eiramxt.mongodb.net/AFS?appName=Cluster0',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development'
};
