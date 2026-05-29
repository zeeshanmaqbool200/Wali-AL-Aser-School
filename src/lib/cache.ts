import localforage from 'localforage';

// Configure localforage for production-grade persistent storage
localforage.config({
  name: 'WaliUlAserApp',
  storeName: 'data_store',
  description: 'Persistent storage for student data and receipts'
});

// Memory cache for lightning fast access (tier 2)
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export const CACHE_KEYS = {
  USERS: 'users_list',
  FEES: 'fees_list',
  COURSES: 'courses_list',
  SETTINGS: 'institute_settings',
  PERMISSIONS: 'user_permissions',
  DASHBOARD_STATS: 'dashboard_stats',
  EXPENSES: 'expenses_list',
  ATTENDANCE: 'attendance_list',
  NOTIFS: 'notifications_cache'
};

interface CacheOptions {
  ttl?: number; // Time to live in ms (default: 24h for most things)
  persist?: boolean; // Whether to write to disk
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const cache = {
  /**
   * Set data in tiered cache (Memory + Persistent)
   */
  async set(key: string, data: any, options: CacheOptions = { persist: true }) {
    const entry = {
      data,
      timestamp: Date.now()
    };

    // 1. Update Memory Cache (Tier 1)
    memoryCache.set(key, entry);

    // 2. Update Persistent Storage (Tier 0) asynchronously
    if (options.persist !== false) {
      try {
        // We use localforage (IndexedDB) which is much more efficient than localStorage
        // and doesn't block the main thread or have the 5MB limit.
        await localforage.setItem(key, entry);
      } catch (e) {
        console.warn(`Cache persistence failed for ${key}:`, e);
        // If storage is full, clear old entries
        if (e && (e as any).name === 'QuotaExceededError') {
          this.purgeOld();
        }
      }
    }
  },

  /**
   * Get data from tiered cache (Memory -> Persistent)
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const ttl = options?.ttl || DEFAULT_TTL;

    // 1. Check Memory Cache first
    const memEntry = memoryCache.get(key);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < ttl) {
        return memEntry.data as T;
      }
      memoryCache.delete(key);
    }

    // 2. Check Persistent Storage
    try {
      const entry: any = await localforage.getItem(key);
      if (!entry) return null;

      // Check expiration
      if (Date.now() - entry.timestamp > ttl) {
        await localforage.removeItem(key);
        return null;
      }

      // Populate memory cache for next time
      memoryCache.set(key, entry);
      return entry.data as T;
    } catch (e) {
      console.error(`Cache retrieval failed for ${key}:`, e);
      return null;
    }
  },

  /**
   * Remove item from all tiers
   */
  async remove(key: string) {
    memoryCache.delete(key);
    await localforage.removeItem(key);
  },

  /**
   * Clear everything
   */
  async clear() {
    memoryCache.clear();
    await localforage.clear();
  },

  /**
   * Purge old entries to save space
   */
  async purgeOld() {
    const now = Date.now();
    try {
      const keys = await localforage.keys();
      for (const key of keys) {
        const entry: any = await localforage.getItem(key);
        if (entry && now - entry.timestamp > DEFAULT_TTL) {
          await localforage.removeItem(key);
          memoryCache.delete(key);
        }
      }
    } catch (e) {
      console.error('Purge failed:', e);
    }
  }
};
