import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env variables before validation
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be configured'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for Prisma connection'),
  DIRECT_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional().default('http://localhost:5173,http://localhost:3000'),
  DEMO_MODE: z.enum(['true', 'false']).default('false').optional(),
  AUTO_SEED: z.enum(['true', 'false']).default('false').optional(),
}).refine(data => {
  if (data.NODE_ENV === 'production' && data.JWT_SECRET.length < 32) {
    return false;
  }
  return true;
}, {
  message: 'In production, JWT_SECRET must be at least 32 characters long for cryptographic security',
  path: ['JWT_SECRET']
});

export const env = envSchema.parse(process.env);
