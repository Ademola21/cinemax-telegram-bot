import { Movie } from './types';
import { getAnalyticsSummary } from './analyticsService';

const TRENDING_CACHE_KEY = 'YC_TRENDING_CACHE';
const TRENDING_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

interface TrendingCache {
  movies: Movie[];
  timestamp: number;
}

interface CacheResult {
  cache: TrendingCache | null;
  isExpired: boolean;
}

const getTrendingCache = (): CacheResult => {
  try {
    const cached = localStorage.getItem(TRENDING_CACHE_KEY);
    if (!cached) return { cache: null, isExpired: false };
    
    const data: TrendingCache = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (less than 1 hour old)
    const isExpired = now - data.timestamp >= TRENDING_CACHE_DURATION;
    
    return { cache: data, isExpired };
  } catch (error) {
    console.error('Error reading trending cache:', error);
    return { cache: null, isExpired: false };
  }
};

const setTrendingCache = (movies: Movie[]) => {
  try {
    const cache: TrendingCache = {
      movies,
      timestamp: Date.now()
    };
    localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error setting trending cache:', error);
  }
};

/**
 * Calculate trending movies using a smart algorithm that combines:
 * - Recent user engagement (clicks from analytics)
 * - Movie popularity score
 * - Movie rating
 * - Recency (newer movies get a boost)
 */
export const calculateTrendingMovies = (movies: Movie[]): Movie[] => {
  if (!movies || movies.length === 0) return [];

  // Get recent analytics data
  const analytics = getAnalyticsSummary(1); // Last 24 hours
  const clickMap = new Map<string, number>();
  
  analytics.mostClicked.forEach(item => {
    const movie = movies.find(m => m.title === item.title);
    if (movie) {
      clickMap.set(movie.id, item.clicks);
    }
  });

  // Calculate trend scores
  const scoredMovies = movies.map(movie => {
    // Base score from popularity and rating
    const popularityScore = movie.popularity * 0.3;
    const ratingScore = movie.rating * 10 * 0.2;
    
    // Recency bonus (newer movies get higher scores)
    const daysSinceRelease = (Date.now() - new Date(movie.releaseDate).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 30 - daysSinceRelease) * 0.2;
    
    // Real engagement score (clicks in last 24 hours)
    const clicks = clickMap.get(movie.id) || 0;
    const engagementScore = clicks * 5; // Each click worth 5 points
    
    const trendScore = popularityScore + ratingScore + recencyScore + engagementScore;
    
    return {
      ...movie,
      trendScore,
      recentClicks: clicks
    };
  });

  // Sort by trend score and return top 10
  return scoredMovies
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 10);
};

/**
 * Get trending movies with smart caching:
 * - Returns cached trending movies if less than 1 hour old
 * - Recalculates and gradually updates if cache expired
 * - Keeps relevant movies and only swaps out a few for new trending ones
 */
export const getTrendingMovies = (movies: Movie[]): Movie[] => {
  if (!movies || movies.length === 0) return [];

  // Check cache first
  const { cache: cached, isExpired } = getTrendingCache();
  
  // If cache exists and is not expired, return it
  if (cached && !isExpired && cached.movies.length > 0) {
    console.log('Using cached trending movies');
    return cached.movies;
  }

  console.log('Calculating fresh trending movies...');
  
  // Calculate new trending list
  const freshTrending = calculateTrendingMovies(movies);
  
  // If we have expired cached data, do a gradual rotation
  if (cached && cached.movies.length > 0) {
    const oldMovies = cached.movies;
    const newMovies = freshTrending;
    
    // Find old movies that are still in top trending
    const stillTrending = oldMovies
      .filter(oldMovie => newMovies.some(newMovie => newMovie.id === oldMovie.id));
    
    // Find new trending movies that weren't in the old list
    const brandNew = newMovies
      .filter(newMovie => !oldMovies.some(oldMovie => oldMovie.id === newMovie.id));
    
    // Determine how many to keep and add to maintain 10 total
    let numToKeep: number;
    let numToAdd: number;
    
    if (stillTrending.length >= 7) {
      // Keep 7 old, add 3 new
      numToKeep = 7;
      numToAdd = 3;
    } else if (stillTrending.length === 6) {
      // Keep 6 old, add 4 new
      numToKeep = 6;
      numToAdd = 4;
    } else {
      // Keep what we have, fill the rest with new
      numToKeep = stillTrending.length;
      numToAdd = 10 - numToKeep;
    }
    
    const keptMovies = stillTrending.slice(0, numToKeep);
    const addedMovies = brandNew.slice(0, numToAdd);
    
    // Combine to create exactly 10 movies
    let rotatedTrending = [...keptMovies, ...addedMovies];
    
    // If we still don't have 10, fill with remaining movies from fresh list
    if (rotatedTrending.length < 10) {
      const fillMovies = newMovies
        .filter(m => !rotatedTrending.some(rm => rm.id === m.id))
        .slice(0, 10 - rotatedTrending.length);
      rotatedTrending = [...rotatedTrending, ...fillMovies];
    }
    
    setTrendingCache(rotatedTrending);
    return rotatedTrending;
  }
  
  // First time or no valid cache - use fresh calculation
  setTrendingCache(freshTrending);
  return freshTrending;
};
