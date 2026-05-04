import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'WaliUlAserApp',
  storeName: 'data_cache'
});

export const CACHE_KEYS = {
  USERS: 'users_list',
  FEES: 'fees_list',
  COURSES: 'courses_list',
  SETTINGS: 'institute_settings',
  PERMISSIONS: 'user_permissions',
  DASHBOARD_STATS: 'dashboard_stats'
};

interface CacheOptions {
  ttl?: number; // Time to live in ms
}

export const cache = {
  async set(key: string, data: any) {
    const entry = {
      data,
      timestamp: Date.now()
    };
    try {
      await localforage.setItem(key, entry);
    } catch (e) {
      console.error(`Cache set failed for ${key}:`, e);
    }
  },

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const entry: any = await localforage.getItem(key);
      if (!entry) return null;

      if (options?.ttl && Date.now() - entry.timestamp > options.ttl) {
        await localforage.removeItem(key);
        return null;
      }

      return entry.data as T;
    } catch (e) {
      console.error(`Cache get failed for ${key}:`, e);
      return null;
    }
  },

  async remove(key: string) {
    await localforage.removeItem(key);
  },

  async clear() {
    await localforage.clear();
  }
};
