import { useState, useEffect, useCallback, useRef } from 'react';
import { Movie } from '../services/types';

interface PaginatedResult {
  items: Movie[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface UsePaginatedMoviesOptions {
  page: number;
  limit?: number;
  category?: string;
  year?: number;
  search?: string;
  sortBy?: 'recent' | 'popular' | 'rating' | 'title';
  enablePrefetch?: boolean;
}

interface UsePaginatedMoviesResult {
  movies: Movie[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
  loading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

const cache = new Map<string, { data: PaginatedResult; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (options: UsePaginatedMoviesOptions): string => {
  const { page, limit = 20, category, year, search, sortBy = 'recent' } = options;
  return `${page}-${limit}-${category || 'all'}-${year || 'all'}-${search || 'none'}-${sortBy}`;
};

const fetchPaginatedMovies = async (options: UsePaginatedMoviesOptions): Promise<PaginatedResult> => {
  const cacheKey = getCacheKey(options);
  const now = Date.now();

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Build query string
  const params = new URLSearchParams();
  params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.category) params.append('category', options.category);
  if (options.year) params.append('year', options.year.toString());
  if (options.search) params.append('search', options.search);
  if (options.sortBy) params.append('sortBy', options.sortBy);

  const response = await fetch(`/api/movies/paginated?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch paginated movies');
  }

  const data: PaginatedResult = await response.json();
  
  // Cache the result
  cache.set(cacheKey, { data, timestamp: now });

  return data;
};

const prefetchAdjacentPages = async (options: UsePaginatedMoviesOptions) => {
  const { page } = options;

  // Prefetch next page
  if (page > 0) {
    fetchPaginatedMovies({ ...options, page: page + 1 }).catch(() => {});
  }

  // Prefetch previous page
  if (page > 1) {
    fetchPaginatedMovies({ ...options, page: page - 1 }).catch(() => {});
  }
};

export const usePaginatedMovies = (initialOptions: UsePaginatedMoviesOptions): UsePaginatedMoviesResult => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialOptions.page);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>();

  // Combine initial options with current page state
  const options = { ...initialOptions, page: currentPage };

  const loadMovies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchPaginatedMovies(options);
      
      setMovies(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setHasNext(result.hasNext);
      setHasPrev(result.hasPrev);

      // Prefetch adjacent pages after a short delay
      if (options.enablePrefetch !== false) {
        if (prefetchTimeoutRef.current) {
          clearTimeout(prefetchTimeoutRef.current);
        }
        prefetchTimeoutRef.current = setTimeout(() => {
          prefetchAdjacentPages(options);
        }, 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movies');
      console.error('Error loading paginated movies:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, initialOptions.limit, initialOptions.category, initialOptions.year, initialOptions.search, initialOptions.sortBy, initialOptions.enablePrefetch]);

  useEffect(() => {
    loadMovies();

    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, [loadMovies]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentPage(page);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNext) {
      goToPage(currentPage + 1);
    }
  }, [hasNext, currentPage, goToPage]);

  const prevPage = useCallback(() => {
    if (hasPrev) {
      goToPage(currentPage - 1);
    }
  }, [hasPrev, currentPage, goToPage]);

  return {
    movies,
    total,
    totalPages,
    currentPage,
    hasNext,
    hasPrev,
    loading,
    error,
    goToPage,
    nextPage,
    prevPage
  };
};
