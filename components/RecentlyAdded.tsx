import React from 'react';
import { Link } from 'react-router-dom';
import { Movie } from '../services/types';
import { timeAgo } from '../utils/timeAgo';
import { ClockIcon } from './icons/Icons';

interface RecentlyAddedProps {
  movies: Movie[];
}

const RecentlyAdded: React.FC<RecentlyAddedProps> = ({ movies }) => {
  if (!movies || movies.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">Recently Added</h2>
        <p className="text-gray-400 mt-1">Latest movies added to our collection</p>
      </div>
      
      <div className="space-y-4">
        {movies.map((movie, index) => (
          <Link
            key={movie.id}
            to={`/movie/${movie.id}`}
            className="flex gap-4 bg-gray-800/40 rounded-lg overflow-hidden hover:bg-gray-800/60 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 group animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Small Movie Card - Left */}
            <div className="flex-shrink-0 w-24 sm:w-28 md:w-32 relative overflow-hidden">
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-poster.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-900/80"></div>
            </div>

            {/* Movie Details - Right */}
            <div className="flex-1 py-3 pr-4 flex flex-col justify-center min-w-0">
              <h3 className="text-lg md:text-xl font-bold text-white truncate group-hover:text-green-400 transition-colors">
                {movie.title}
              </h3>
              
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  <span className="text-green-400 font-medium">{timeAgo(movie.createdAt)}</span>
                </div>
                <span className="text-gray-600">&bull;</span>
                <span>{new Date(movie.releaseDate).getFullYear()}</span>
                {movie.rating && (
                  <>
                    <span className="text-gray-600">&bull;</span>
                    <span className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      {movie.rating.toFixed(1)}
                    </span>
                  </>
                )}
              </div>

              {movie.category && (
                <div className="mt-2">
                  <span className="inline-block px-2 py-1 text-xs font-semibold text-green-400 bg-green-400/10 rounded">
                    {movie.category}
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RecentlyAdded;
