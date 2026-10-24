import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

class HighSpeedCacheService {
    private store = new Map<string, CacheEntry<any>>();
    private inFlight = new Map<string, Promise<any>>();
    private authDigestCache = new Map<string, number>();
    private readonly maxEntries = 5000;
    private readonly authCacheTtlMs = 10 * 60 * 1000; // 10 minutes

    /**
     * Retrieves a cached value or computes it once via single-flight request coalescing.
     * Prevents database stampedes when hundreds of concurrent users hit the same endpoint.
     */
    async getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
        const now = Date.now();
        const existing = this.store.get(key);
        if (existing && existing.expiresAt > now) {
            return existing.value as T;
        }

        const pending = this.inFlight.get(key);
        if (pending) {
            return pending as Promise<T>;
        }

        const promise = (async () => {
            try {
                const freshValue = await fetcher();
                if (this.store.size >= this.maxEntries) {
                    const firstKey = this.store.keys().next().value;
                    if (firstKey) this.store.delete(firstKey);
                }
                this.store.set(key, {
                    value: freshValue,
                    expiresAt: Date.now() + ttlMs
                });
                return freshValue;
            } finally {
                this.inFlight.delete(key);
            }
        })();

        this.inFlight.set(key, promise);
        return promise;
    }

    /**
     * Directly sets a cache entry with a TTL in milliseconds.
     */
    set<T>(key: string, value: T, ttlMs: number): void {
        if (this.store.size >= this.maxEntries) {
            const firstKey = this.store.keys().next().value;
            if (firstKey) this.store.delete(firstKey);
        }
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
    }

    /**
     * Invalidates all cache entries matching any of the provided keys or key prefixes.
     */
    invalidate(...prefixes: string[]): void {
        for (const key of Array.from(this.store.keys())) {
            if (prefixes.some(p => key === p || key.startsWith(p))) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Clears the entire cache store.
     */
    clearAll(): void {
        this.store.clear();
        this.inFlight.clear();
        this.authDigestCache.clear();
    }

    /**
     * Cryptographically bound password verification accelerator.
     * Binds userId + authoritative DB passwordHash + candidate password via HMAC-SHA256.
     * If the user's passwordHash changes in the DB, any previous digest is automatically invalid.
     */
    async verifyPasswordFast(userId: number, plainPassword: string, passwordHash: string): Promise<boolean> {
        const digest = crypto
            .createHmac('sha256', env.JWT_SECRET)
            .update(`${userId}:${passwordHash}:${plainPassword}`)
            .digest('hex');

        const now = Date.now();
        const cachedExpiry = this.authDigestCache.get(digest);
        if (cachedExpiry && cachedExpiry > now) {
            return true;
        }

        const isValid = await bcrypt.compare(plainPassword, passwordHash);
        if (isValid) {
            if (this.authDigestCache.size >= 2000) {
                const oldestKey = this.authDigestCache.keys().next().value;
                if (oldestKey) this.authDigestCache.delete(oldestKey);
            }
            this.authDigestCache.set(digest, now + this.authCacheTtlMs);
        }
        return isValid;
    }
}

export const appCache = new HighSpeedCacheService();
export default appCache;
