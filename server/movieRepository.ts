import fs from 'fs';
import path from 'path';

export interface Movie {
  id: string;
  title: string;
  poster: string;
  downloadLink: string;
  genre: string;
  category: 'Drama' | 'Comedy' | 'Action' | 'Romance' | 'Thriller' | 'Epic';
  releaseDate: string;
  stars: string[];
  runtime: string;
  rating: number;
  description: string;
  popularity: number;
  createdAt: string;
  updatedAt: string;
  trailerId?: string;
  status?: 'coming-soon';
  seriesTitle?: string;
  partNumber?: number;
}

interface CachedResult<T> {
  data: T;
  timestamp: number;
}

export interface PaginatedResult {
  items: Movie[];
  total: number;
  page: number;
  limit: number;
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

class ServerMovieRepository {
  private moviesCache: CachedResult<Movie[]> | null = null;
  private paginatedCache: Map<string, CachedResult<PaginatedResult>> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly PAGINATED_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly MOVIES_PATH = path.join(process.cwd(), 'data', 'movies.json');

  /**
   * Get all movies with in-memory caching
   */
  private getAllMovies(): Movie[] {
    const now = Date.now();
    
    // Return cached if valid
    if (this.moviesCache && now - this.moviesCache.timestamp < this.CACHE_DURATION) {
      return this.moviesCache.data;
    }

    // Read fresh data from file
    if (!fs.existsSync(this.MOVIES_PATH)) {
      console.error('Movies file not found at:', this.MOVIES_PATH);
      return [];
    }

    const moviesData = fs.readFileSync(this.MOVIES_PATH, 'utf8');
    const movies: Movie[] = JSON.parse(moviesData);
    
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

    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(m => m.category === options.category);
    }

    if (options.year) {
      filtered = filtered.filter(m => {
        const movieYear = m.releaseDate ? new Date(m.releaseDate).getFullYear() : null;
        return movieYear === options.year;
      });
    }

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
  getPaginated(options: QueryOptions = {}): PaginatedResult {
    const { page = 1, limit = 20 } = options;
    const cacheKey = this.getCacheKey(options);
    const now = Date.now();

    // Check paginated cache
    const cached = this.paginatedCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.PAGINATED_CACHE_DURATION) {
      return cached.data;
    }

    // Get all movies and apply filters
    const allMovies = this.getAllMovies();
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
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    // Cache the result
    this.paginatedCache.set(cacheKey, { data: result, timestamp: now });

    return result;
  }

  /**
   * Invalidate all caches (call when movies are updated)
   */
  invalidateCache(): void {
    this.moviesCache = null;
    this.paginatedCache.clear();
  }

  /**
   * Get cache stats for monitoring
   */
  getCacheStats() {
    return {
      moviesCache: this.moviesCache ? 'valid' : 'empty',
      paginatedCacheSize: this.paginatedCache.size,
      cacheKeys: Array.from(this.paginatedCache.keys())
    };
  }
}

// Export singleton instance
export const serverMovieRepository = new ServerMovieRepository();
