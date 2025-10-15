import { Movie } from './types';

interface CachedResult<T> {
  data: T;
  timestamp: number;
}

interface PaginatedResult {
  items: Movie[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface QueryOptions {
  page?: number;
  limit?: number;
  category?: string;
  year?: number;
  search?: string;
  sortBy?: 'recent' | 'popular' | 'rating' | 'title';
}

class MovieRepository {
  private moviesCache: CachedResult<Movie[]> | null = null;
  private indexedCache: Map<string, CachedResult<PaginatedResult>> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly PAGINATED_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  /**
   * Get all movies with caching
   */
  private async getAllMovies(): Promise<Movie[]> {
    const now = Date.now();
    
    // Return cached if valid
    if (this.moviesCache && now - this.moviesCache.timestamp < this.CACHE_DURATION) {
      return this.moviesCache.data;
    }

    // Fetch fresh data from API
    const response = await fetch('/api/movies');
    if (!response.ok) {
      throw new Error('Failed to fetch movies');
    }
    const movies: Movie[] = await response.json();
    this.moviesCache = { data: movies, timestamp: now };
    
    return movies;
  }

  /**
   * Generate cache key for query options
   */
  private getCacheKey(options: QueryOptions): string {
    const { page = 1, limit = 20, category, year, search, sortBy = 'recent' } = options;
    return `${page}-${limit}-${category || 'all'}-${year || 'all'}-${search || 'none'}-${sortBy}`;
  }

  /**
   * Filter movies based on query options
   */
  private filterMovies(movies: Movie[], options: QueryOptions): Movie[] {
    let filtered = [...movies];

    // Filter by category
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(m => m.category === options.category);
    }

    // Filter by year
    if (options.year) {
      filtered = filtered.filter(m => {
        const movieYear = m.releaseDate ? new Date(m.releaseDate).getFullYear() : null;
        return movieYear === options.year;
      });
    }

    // Filter by search
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.description?.toLowerCase().includes(searchLower) ||
        m.stars?.some(s => s.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }

  /**
   * Sort movies based on sort option
   */
  private sortMovies(movies: Movie[], sortBy: string = 'recent'): Movie[] {
    const sorted = [...movies];

    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => 
          new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime()
        );
      
      case 'popular':
        return sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      
      default:
        return sorted;
    }
  }

  /**
   * Get paginated movies with advanced caching
   */
  async getPaginated(options: QueryOptions = {}): Promise<PaginatedResult> {
    const { page = 1, limit = 20 } = options;
    const cacheKey = this.getCacheKey(options);
    const now = Date.now();

    // Check paginated cache
    const cached = this.indexedCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.PAGINATED_CACHE_DURATION) {
      return cached.data;
    }

    // Get all movies and apply filters
    const allMovies = await this.getAllMovies();
    const filtered = this.filterMovies(allMovies, options);
    const sorted = this.sortMovies(filtered, options.sortBy);

    // Calculate pagination
    const total = sorted.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const items = sorted.slice(start, start + limit);

    const result: PaginatedResult = {
      items,
      total,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    // Cache the result
    this.indexedCache.set(cacheKey, { data: result, timestamp: now });

    return result;
  }

  /**
   * Preload next and previous pages for smooth navigation
   */
  async preloadAdjacentPages(options: QueryOptions): Promise<void> {
    const { page = 1 } = options;
    
    // Preload next page
    if (page > 0) {
      this.getPaginated({ ...options, page: page + 1 }).catch(() => {});
    }
    
    // Preload previous page
    if (page > 1) {
      this.getPaginated({ ...options, page: page - 1 }).catch(() => {});
    }
  }

  /**
   * Invalidate all caches (call when movies are updated)
   */
  invalidateCache(): void {
    this.moviesCache = null;
    this.indexedCache.clear();
  }

  /**
   * Get cache stats for monitoring
   */
  getCacheStats() {
    return {
      moviesCache: this.moviesCache ? 'valid' : 'empty',
      paginatedCacheSize: this.indexedCache.size,
      cacheKeys: Array.from(this.indexedCache.keys())
    };
  }
}

// Export singleton instance
export const movieRepository = new MovieRepository();
