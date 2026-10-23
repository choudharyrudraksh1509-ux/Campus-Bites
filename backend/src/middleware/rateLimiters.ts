import { Request } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Determines whether rate limiting should be bypassed (e.g. during designated load simulation)
 */
const shouldSkipRateLimit = (req: Request): boolean => {
    return process.env.DISABLE_RATE_LIMIT === 'true' || req.headers['x-load-test'] === 'bypass';
};

/**
 * Strict limiter on authentication endpoints to prevent brute-force credential stuffing.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per 15 minutes per IP
    message: { error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
});

/**
 * Limiter on checkout and order placement to prevent automated order flooding.
 */
export const orderLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute per IP
    message: { error: 'Too many order requests in a short period. Please wait a moment.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
});

/**
 * Limiter on review submissions to prevent spam.
 */
export const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    message: { error: 'Too many reviews submitted. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
});

/**
 * General API request limiter.
 */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
});
