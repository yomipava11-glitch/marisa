/**
 * Offline Cache Utility
 * Stores and retrieves data from localStorage for offline access.
 * When online, data is fetched from Supabase and cached.
 * When offline, cached data is served to the user.
 */

const CACHE_PREFIX = 'gestiontask_cache_';
const CACHE_TIMESTAMP_SUFFIX = '_ts';

/**
 * Save data to the local cache.
 */
export function cacheSet<T>(key: string, data: T): void {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        localStorage.setItem(CACHE_PREFIX + key + CACHE_TIMESTAMP_SUFFIX, Date.now().toString());
    } catch (e) {
        console.warn('[OfflineCache] Failed to cache data for key:', key, e);
    }
}

/**
 * Retrieve data from the local cache.
 * Returns null if no cached data exists.
 */
export function cacheGet<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (raw) return JSON.parse(raw) as T;
    } catch (e) {
        console.warn('[OfflineCache] Failed to read cache for key:', key, e);
    }
    return null;
}

/**
 * Get the timestamp of the last cache update for a key.
 */
export function cacheTimestamp(key: string): number | null {
    const ts = localStorage.getItem(CACHE_PREFIX + key + CACHE_TIMESTAMP_SUFFIX);
    return ts ? parseInt(ts, 10) : null;
}

/**
 * Check if the device is currently online.
 */
export function isOnline(): boolean {
    return navigator.onLine;
}

/**
 * Format cache age for display (e.g., "il y a 5 min").
 */
export function formatCacheAge(key: string): string | null {
    const ts = cacheTimestamp(key);
    if (!ts) return null;

    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return `il y a ${diffSec}s`;
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)}h`;
    return `il y a ${Math.floor(diffSec / 86400)}j`;
}

/**
 * Clear all cached data.
 */
export function cacheClearAll(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}
