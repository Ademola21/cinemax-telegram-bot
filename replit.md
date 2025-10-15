# Overview

Yoruba Cinemax is a full-stack movie streaming platform dedicated to Yoruba cinema, featuring a React TypeScript frontend and a Node.js/Express backend. It integrates AI-powered features and Telegram bot administration, offering users movie browsing, streaming, personalized recommendations, watchlists, comments, and a YouTube downloader. The platform aims to provide a comprehensive and engaging experience for Yoruba movie enthusiasts.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 19.1.1 with TypeScript
- **Routing**: React Router DOM v7 (hash-based)
- **State Management**: Context API
- **Styling**: Tailwind CSS via CDN
- **Build System**: ESBuild
- **Performance**: Dynamic imports for lazy loading, lazy image loading with IntersectionObserver, client-side prefetching for smooth pagination

## Backend Architecture
- **Server**: Express.js (serves API and static files)
- **Data Storage**: JSON files for persistence (e.g., `movies.json`, `users.json`)
- **Authentication**: Session-based with bcrypt password hashing
- **API Structure**: RESTful
- **Security**: CSRF protection, comprehensive security headers, rate limiting, input sanitization, atomic file writes, production error handling
- **Performance Optimization**: In-memory caching with MovieRepository for fast paginated queries

## Data Storage Solutions
- **Primary Storage**: JSON files in the `/data` directory for all application data (movies, users, watchlists, comments, site config, collections, viewing history).
- **Integrity**: Atomic operations using temporary file writes and rename to prevent data corruption.

## Authentication and Authorization
- **User Management**: Email/password authentication with role-based access.
- **Session Handling**: Server-side session store with cryptographically secure tokens (32-byte random).
- **Password Security**: bcrypt hashing with 12 salt rounds (UPDATED: 2025-10-06).
- **Session Binding**: IP address and User-Agent validation to prevent session hijacking.
- **Session Lifecycle**: 3-day expiration with rolling expiry on activity, automatic cleanup of expired sessions.

## AI Integration Architecture
- **Primary AI Service**: Azure OpenAI (GPT-4 deployment).
- **AI Features**: Natural language search, personalized recommendations, chat assistant, metadata generation.
- **Resilience**: Graceful degradation on AI service unavailability.
- **Cost Management**: Per-user AI request throttling.

## Video Streaming
- **Protocol**: HLS (HTTP Live Streaming) for adaptive playback.
- **Video Sourcing**: YouTube integration via yt-dlp and FFmpeg.
- **Audio Encoding**: TV-compatible HE-AAC (AAC LC SBR) at 30kbps, 44.1kHz stereo, using libfdk_aac for universal device compatibility.
- **Content Delivery**: Direct video serving with proper media headers.
- **Processing**: Automatic video+audio merging with optimal codec selection via FFmpeg.

## Live TV Streaming System
- **Client-Side Streaming**: No server CPU/memory usage - all processing happens in the browser
- **Dual Player Support**: 
  - YouTube videos via iframe embed (uses YouTube's CDN)
  - HLS streams (.m3u8) via HLS.js for external sources
- **Real-Time Updates**: Auto-polling every 3 seconds for live state synchronization
- **Stream Management**: Queue system, default source configuration, skip/stop controls
- **Data Persistence**: JSON-based storage in `data/liveTv.json` with atomic writes
- **Telegram Control**: Full admin control via bot commands (Go Live, Queue, Skip, Stop, Manage Sources)

## Admin System
- **Interface**: Telegram Bot for comprehensive administrative tasks.
- **Bot Features**: Movie CRUD, user management, site configuration, automated content discovery, AI-powered content suggestions, analytics.
- **Security**: Admin-only access via Telegram user ID validation.

## Performance Optimization System
- **Server-Side Caching**: MovieRepository with 5-10 minute in-memory cache for paginated queries
- **Client-Side Prefetching**: Automatic preload of adjacent pages (next/previous) for instant navigation
- **Lazy Image Loading**: IntersectionObserver-based lazy loading with loading spinners and placeholder backgrounds
- **Paginated API**: `/api/movies/paginated` endpoint with filter, search, and sort capabilities
- **Cache Management**: Automatic cache invalidation on data updates, smart cache key generation
- **Trending System**: Hourly refresh with gradual rotation (keeps 6-7 relevant movies, adds 3-4 new ones)

## Security Architecture (UPDATED: 2025-10-06)
- **Password Hashing**: bcrypt with 12 salt rounds (industry-standard, resistant to GPU attacks)
- **CSRF Protection**: Token-based validation for all state-changing operations (POST/PUT/DELETE)
- **Security Headers**: 
  - Content-Security-Policy (CSP) to prevent XSS attacks
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: SAMEORIGIN
  - Referrer-Policy: strict-origin-when-cross-origin
  - Strict-Transport-Security (HSTS) on HTTPS
  - Permissions-Policy for privacy
- **Session Security**:
  - Server-side session store with constant-time token comparison
  - AES-256-GCM encryption at rest for session data
  - Session binding to IP address and User-Agent
  - Automatic revocation on security violations
  - 3-day expiration with rolling expiry
- **Error Handling**: Production mode masks stack traces and sensitive information
- **Rate Limiting**: Per-user request throttling (20 requests/minute)
- **Input Sanitization**: HTML entity encoding for user-generated content

# External Dependencies

## Core Services
- **Azure OpenAI**: AI capabilities.
- **YouTube Data API v3**: Movie metadata and discovery.
- **Telegram Bot API**: Admin interface and notifications.

## Third-party APIs
- **Cobalt YouTube Downloader**: Proxied YouTube video download service (`https://co.wuk.sh/api/json`).
- **Picsum Photos**: Placeholder images.
- **Test Streams (Mux)**: Demo HLS content.

## CDN Dependencies
- **Tailwind CSS**: Styling framework.
- **HLS.js**: Video streaming library.
- **React/React-DOM**: Core framework.
- **Google Fonts**: Inter font family.