import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import prisma from './db/prisma';
import apiRoutes from './routes';
import { ensureStallStaffSeeded } from './services/seedService';
import { startAutobookScheduler } from './services/autobookScheduler';
import { generalLimiter } from './middleware/rateLimiters';

const app = express();

// Security HTTP headers
app.use(helmet());

// Environment-based CORS allowlist
const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile clients, curl, health probes)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request payload size limiting to prevent denial-of-service
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Structured request-duration timing middleware for API performance monitoring
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        if (req.path.startsWith('/api') && !req.path.includes('/health')) {
            console.log(`[API_PERF] ${req.method} ${req.path} -> ${res.statusCode} (${durationMs.toFixed(2)} ms)`);
        }
    });
    next();
});

// Global rate limiter for API routes
app.use('/api', generalLimiter);

// Lightweight process liveness check
const livenessHandler = (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};

app.get('/health', livenessHandler);
app.get('/health/live', livenessHandler);
app.get('/api/health', livenessHandler);
app.get('/api/health/live', livenessHandler);

// Readiness check verifying database connectivity without leaking infrastructure details
const readinessHandler = async (_req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch {
        res.status(503).json({
            status: 'error',
            database: 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
};

app.get('/health/ready', readinessHandler);
app.get('/api/health/ready', readinessHandler);

// Mount application API routers
app.use('/api', apiRoutes);

// Centralized safe error handler (prevents information disclosure and stack traces)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.message === 'Blocked by CORS policy') {
        res.status(403).json({ error: 'CORS request rejected: Origin not allowed' });
        return;
    }

    if (err.type === 'entity.too.large') {
        res.status(413).json({ error: 'Payload too large. Maximum size is 50KB.' });
        return;
    }

    console.error('API Error:', err.message || err);

    const status = err.status || 500;
    const message = env.NODE_ENV === 'development'
        ? (err.message || 'Internal Server Error')
        : 'Internal server error';

    res.status(status).json({ error: message });
});

export default app;

// Start server when executed directly (not imported in tests)
if (process.env.NODE_ENV !== 'test' && !process.env.npm_lifecycle_event?.includes('test') && !process.argv.some(a => a.includes('test'))) {
    const PORT = env.PORT;
    app.listen(PORT, async () => {
        console.log(`Server is running on port ${PORT}`);
        try {
            await ensureStallStaffSeeded();
            startAutobookScheduler();
        } catch (err) {
            console.error('Failed to auto-seed stall staff on startup:', err);
        }
    });
}
