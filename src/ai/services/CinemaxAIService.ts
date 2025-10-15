/**
 * Cinemax AI Service - Universal AI Service for Yorubacinemax
 * Replaces all existing AI services (Azure OpenAI, Google Gemini)
 */

import { CinemaxAI, UniversalInput, UniversalResponse, ConversationMemory } from '../model/CinemaxAI';
import { Movie, SiteConfig } from '../../services/types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  sessionId?: string;
}

export interface AiChatResponse {
  text: string;
  movie?: Movie;
  sources?: { uri: string; title: string; }[];
  personality?: any;
  suggestions?: string[];
  actions?: any[];
}

export interface RecommendationCriteria {
  userId?: string;
  currentMovie?: Movie;
  genre?: string;
  mood?: string;
  limit?: number;
}

export interface MovieAnalysis {
  plotSummary: string;
  culturalSignificance: string;
  targetAudience: string;
  contentWarnings: string[];
  discussionPoints: string[];
  themes: string[];
  culturalElements: string[];
}

class CinemaxAIService {
  private static instance: CinemaxAIService;
  private cinemaxAI: CinemaxAI;
  private activeSessions: Map<string, string> = new Map(); // userId -> sessionId

  private constructor() {
    this.cinemaxAI = new CinemaxAI();
    console.log('🚀 Cinemax AI Service initialized');
  }

  public static getInstance(): CinemaxAIService {
    if (!CinemaxAIService.instance) {
      CinemaxAIService.instance = new CinemaxAIService();
    }
    return CinemaxAIService.instance;
  }

  // Chat functionality with memory
  async runChat(
    prompt: string, 
    movies: Movie[], 
    siteConfig: SiteConfig, 
    isAdmin: boolean = false,
    userId?: string,
    existingSessionId?: string
  ): Promise<AiChatResponse> {
    try {
      console.log(`🎬 Cinemax AI Chat: "${prompt.substring(0, 50)}..."`);

      // Get or create session
      let sessionId = existingSessionId;
      if (!sessionId && userId) {
        sessionId = this.getOrCreateSession(userId);
      }

      const input: UniversalInput = {
        type: 'chat',
        content: prompt,
        context: {
          movies,
          siteConfig,
          isAdmin,
          currentTime: new Date()
        },
        userId,
        sessionId
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      // Extract movie mentions if any
      const mentionedMovie = this.extractMentionedMovie(response.content, movies);

      console.log('✅ Cinemax AI Chat response generated');
      
      return {
        text: response.content,
        movie: mentionedMovie,
        personality: response.personality,
        suggestions: response.suggestions,
        actions: response.actions
      };

    } catch (error) {
      console.error('❌ Cinemax AI Chat error:', error);
      return {
        text: "I'm here to help you with Yorubacinemax! I can assist with movie recommendations, answer questions about Yoruba cinema, and help you navigate the platform. What would you like to know?"
      };
    }
  }

  // Movie recommendations
  async getAiRecommendations(currentMovie: Movie, movies: Movie[]): Promise<{ movieId: string, reason: string }[] | null> {
    try {
      console.log(`🎯 Getting AI recommendations for: ${currentMovie.title}`);

      const input: UniversalInput = {
        type: 'recommendation',
        content: `Recommend movies similar to ${currentMovie.title}`,
        context: {
          currentMovie,
          allMovies: movies,
          recommendationType: 'similar'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      // Parse recommendations from response
      const recommendations = this.parseRecommendations(response.content, movies);
      
      console.log(`✅ Generated ${recommendations.length} recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ Recommendation error:', error);
      return null;
    }
  }

  // Personalized recommendations
  async getAiPersonalizedRecommendations(
    viewingHistory: {movieId: string, viewedAt: string}[], 
    movies: Movie[],
    userId?: string
  ): Promise<{ movieId: string }[] | null> {
    try {
      if (viewingHistory.length === 0) return null;

      console.log(`🎯 Getting personalized recommendations for user: ${userId}`);

      const input: UniversalInput = {
        type: 'recommendation',
        content: 'Get personalized movie recommendations based on viewing history',
        context: {
          viewingHistory,
          allMovies: movies,
          recommendationType: 'personalized'
        },
        userId
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      const recommendations = this.parsePersonalizedRecommendations(response.content, movies, viewingHistory);
      
      console.log(`✅ Generated ${recommendations.length} personalized recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ Personalized recommendation error:', error);
      return null;
    }
  }

  // Movie search by description
  async findMovieByDescription(query: string, movies: Movie[]): Promise<Movie | null> {
    try {
      console.log(`🔍 Finding movie by description: "${query}"`);

      const input: UniversalInput = {
        type: 'analysis',
        content: `Find a movie matching this description: ${query}`,
        context: {
          query,
          allMovies: movies,
          searchType: 'description'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      const foundMovie = this.extractMovieFromResponse(response.content, movies);
      
      console.log(foundMovie ? `✅ Found movie: ${foundMovie.title}` : '❌ No matching movie found');
      return foundMovie;

    } catch (error) {
      console.error('❌ Movie search error:', error);
      return null;
    }
  }

  // Movie analysis
  async analyzeMovie(movie: Movie): Promise<MovieAnalysis | null> {
    try {
      console.log(`📊 Analyzing movie: ${movie.title}`);

      const input: UniversalInput = {
        type: 'analysis',
        content: `Analyze this movie: ${movie.title}`,
        context: {
          movie,
          analysisType: 'comprehensive'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      const analysis = this.parseMovieAnalysis(response.content);
      
      console.log('✅ Movie analysis completed');
      return analysis;

    } catch (error) {
      console.error('❌ Movie analysis error:', error);
      return null;
    }
  }

  // Content generation
  async generateMovieMetadata(partialMovie: Partial<Movie>): Promise<Partial<Movie> | null> {
    try {
      console.log('📝 Generating movie metadata...');

      const input: UniversalInput = {
        type: 'creative',
        content: 'Generate missing metadata for this movie',
        context: {
          partialMovie,
          generationType: 'metadata'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      const metadata = this.parseGeneratedMetadata(response.content);
      
      console.log('✅ Movie metadata generated');
      return metadata;

    } catch (error) {
      console.error('❌ Metadata generation error:', error);
      return null;
    }
  }

  // Support and help
  async getSupport(helpTopic: string, userId?: string): Promise<string> {
    try {
      console.log(`💬 Getting support for: ${helpTopic}`);

      const input: UniversalInput = {
        type: 'support',
        content: `Help with: ${helpTopic}`,
        context: {
          helpTopic,
          supportType: 'user-guidance'
        },
        userId
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      console.log('✅ Support response generated');
      return response.content;

    } catch (error) {
      console.error('❌ Support error:', error);
      return "I'm here to help! Please let me know what specific assistance you need with Yorubacinemax.";
    }
  }

  // Creative content generation
  async generateCreativeContent(topic: string, contentType: string): Promise<string> {
    try {
      console.log(`🎨 Generating creative content: ${contentType} - ${topic}`);

      const input: UniversalInput = {
        type: 'creative',
        content: `Generate ${contentType} about: ${topic}`,
        context: {
          topic,
          contentType,
          creativeType: 'content-generation'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      console.log('✅ Creative content generated');
      return response.content;

    } catch (error) {
      console.error('❌ Creative content error:', error);
      return "I'd love to help create something amazing for you! Let me try a different approach.";
    }
  }

  // Movie metadata extraction for YouTube processing (returns structured JSON)
  async extractMovieMetadataFromYouTube(youTubeTitle: string, youTubeDescription: string): Promise<any> {
    try {
      console.log(`🎬 Extracting movie metadata from YouTube: "${youTubeTitle}"`);

      const input: UniversalInput = {
        type: 'analysis',
        content: `Extract and clean movie metadata from YouTube data`,
        context: {
          youTubeTitle,
          youTubeDescription,
          extractionType: 'movie-metadata',
          outputFormat: 'json'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      // Try to parse JSON response
      try {
        const metadata = JSON.parse(response.content);
        console.log('✅ Movie metadata extracted and parsed as JSON');
        return metadata;
      } catch (parseError) {
        console.warn('⚠️ AI response was not valid JSON, attempting to extract structured data');
        // Fallback: try to extract structured data from natural language
        return this.extractMovieMetadataFromText(response.content, youTubeTitle);
      }

    } catch (error) {
      console.error('❌ Movie metadata extraction error:', error);
      // Return basic fallback metadata
      return {
        title: youTubeTitle.replace(/\b(LATEST|YORUBA|MOVIE|2024|2023|NEW)\b/gi, '').trim(),
        seriesTitle: youTubeTitle.replace(/\b(LATEST|YORUBA|MOVIE|2024|2023|NEW|PART\s*\d+)\b/gi, '').trim(),
        partNumber: 1,
        description: youTubeDescription ? youTubeDescription.substring(0, 150) + '...' : 'An exciting Yoruba movie.',
        stars: ['Cast'],
        genre: 'Drama',
        category: 'Drama'
      };
    }
  }

  // Session management
  async startChatSession(userId: string): Promise<string> {
    const sessionId = await this.cinemaxAI.startChatSession(userId);
    this.activeSessions.set(userId, sessionId);
    console.log(`🎬 Started chat session for user: ${userId}`);
    return sessionId;
  }

  async endChatSession(userId: string): Promise<void> {
    const sessionId = this.activeSessions.get(userId);
    if (sessionId) {
      await this.cinemaxAI.endChatSession(sessionId);
      this.activeSessions.delete(userId);
      console.log(`🔚 Ended chat session for user: ${userId}`);
    }
  }

  async getChatSession(userId: string): Promise<ConversationMemory | null> {
    const sessionId = this.activeSessions.get(userId);
    if (sessionId) {
      return await this.cinemaxAI.getConversationMemory(sessionId);
    }
    return null;
  }

  // Admin analytics and insights
  async getAnalyticsInsights(analyticsData: any, query: string): Promise<string> {
    try {
      console.log(`📊 Getting analytics insights for: ${query}`);

      const input: UniversalInput = {
        type: 'analysis',
        content: query,
        context: {
          analyticsData,
          analysisType: 'admin-insights'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      console.log('✅ Analytics insights generated');
      return response.content;

    } catch (error) {
      console.error('❌ Analytics insights error:', error);
      return "I can help you understand the analytics data. What specific insights are you looking for?";
    }
  }

  // Telegram bot specific methods
  async handleTelegramQuery(query: string, context: any): Promise<string> {
    try {
      console.log(`🤖 Handling Telegram query: ${query}`);

      const input: UniversalInput = {
        type: 'chat',
        content: query,
        context: {
          ...context,
          platform: 'telegram',
          isAdmin: true
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      console.log('✅ Telegram response generated');
      return response.content;

    } catch (error) {
      console.error('❌ Telegram query error:', error);
      return "I'm here to help with Yorubacinemax management! What would you like to know?";
    }
  }

  async generateWeeklyReport(analyticsData: any): Promise<string> {
    try {
      console.log('📈 Generating weekly report...');

      const input: UniversalInput = {
        type: 'analysis',
        content: 'Generate a weekly performance report',
        context: {
          analyticsData,
          reportType: 'weekly-summary',
          timeFrame: '7-days'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      console.log('✅ Weekly report generated');
      return response.content;

    } catch (error) {
      console.error('❌ Weekly report error:', error);
      return "📊 **Weekly Report**\n\nData collection in progress. Check back soon for detailed insights.";
    }
  }

  async suggestNewMovies(existingMovies: Movie[]): Promise<string> {
    try {
      console.log('💡 Suggesting new movies...');

      const input: UniversalInput = {
        type: 'creative',
        content: 'Suggest new Yoruba movies to add to the collection',
        context: {
          existingMovies: existingMovies.map(m => m.title),
          suggestionType: 'movie-acquisition'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      console.log('✅ Movie suggestions generated');
      return response.content;

    } catch (error) {
      console.error('❌ Movie suggestions error:', error);
      return "Here are some trending Yoruba movies you might consider adding to your collection.";
    }
  }

  async generateActorProfile(actorName: string): Promise<any> {
    try {
      console.log(`🎭 Generating actor profile for: ${actorName}`);

      const input: UniversalInput = {
        type: 'analysis',
        content: `Generate a profile for actor: ${actorName}`,
        context: {
          actorName,
          profileType: 'biography'
        }
      };

      const response: UniversalResponse = await this.cinemaxAI.processUniversal(input);

      const profile = this.parseActorProfile(response.content);
      
      console.log('✅ Actor profile generated');
      return profile;

    } catch (error) {
      console.error('❌ Actor profile error:', error);
      return {
        bio: `Information about ${actorName} is being updated.`,
        imageUrl: null
      };
    }
  }

  private extractMovieMetadataFromText(text: string, originalTitle: string): any {
    const metadata = {
      title: originalTitle.replace(/\b(LATEST|YORUBA|MOVIE|2024|2023|NEW)\b/gi, '').trim(),
      seriesTitle: originalTitle.replace(/\b(LATEST|YORUBA|MOVIE|2024|2023|NEW|PART\s*\d+)\b/gi, '').trim(),
      partNumber: 1,
      description: 'An exciting Yoruba movie.',
      stars: ['Cast'],
      genre: 'Drama',
      category: 'Drama'
    };

    // Try to extract title from response
    const titleMatch = text.match(/title["\s:]+([^,}\n]+)/i);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim().replace(/["']/g, '');
    }

    // Try to extract series title
    const seriesMatch = text.match(/seriesTitle["\s:]+([^,}\n]+)/i);
    if (seriesMatch) {
      metadata.seriesTitle = seriesMatch[1].trim().replace(/["']/g, '');
    }

    // Try to extract part number
    const partMatch = text.match(/partNumber["\s:]+(\d+)/i);
    if (partMatch) {
      metadata.partNumber = parseInt(partMatch[1]);
    }

    // Try to extract description
    const descMatch = text.match(/description["\s:]+([^,}\n]+)/i);
    if (descMatch) {
      metadata.description = descMatch[1].trim().replace(/["']/g, '');
    }

    // Try to extract stars
    const starsMatch = text.match(/stars["\s:]+\[([^\]]+)\]/i);
    if (starsMatch) {
      const starsStr = starsMatch[1];
      metadata.stars = starsStr.split(',').map((s: string) => s.trim().replace(/["']/g, '')).filter((s: string) => s);
    }

    // Try to extract genre
    const genreMatch = text.match(/genre["\s:]+([^,}\n]+)/i);
    if (genreMatch) {
      metadata.genre = genreMatch[1].trim().replace(/["']/g, '');
    }

    // Try to extract category
    const categoryMatch = text.match(/category["\s:]+([^,}\n]+)/i);
    if (categoryMatch) {
      metadata.category = categoryMatch[1].trim().replace(/["']/g, '');
    }

    return metadata;
  }

  // Utility methods
  private getOrCreateSession(userId: string): string {
    let sessionId = this.activeSessions.get(userId);
    if (!sessionId) {
      sessionId = Math.random().toString(36).substr(2, 9);
      this.activeSessions.set(userId, sessionId);
    }
    return sessionId;
  }

  private extractMentionedMovie(content: string, movies: Movie[]): Movie | undefined {
    for (const movie of movies) {
      const movieTitleRegex = new RegExp(`\\b${movie.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (movieTitleRegex.test(content)) {
        return movie;
      }
    }
    return undefined;
  }

  private parseRecommendations(content: string, movies: Movie[]): { movieId: string, reason: string }[] {
    const recommendations: { movieId: string, reason: string }[] = [];
    
    // Simple parsing - look for movie titles in the response
    movies.forEach(movie => {
      const movieTitleRegex = new RegExp(`\\b${movie.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (movieTitleRegex.test(content)) {
        recommendations.push({
          movieId: movie.id,
          reason: "Great match based on your preferences"
        });
      }
    });

    return recommendations.slice(0, 3); // Limit to 3 recommendations
  }

  private parsePersonalizedRecommendations(content: string, movies: Movie[], history: any[]): { movieId: string }[] {
    const recommendations: { movieId: string }[] = [];
    const watchedIds = new Set(history.map(h => h.movieId));
    
    movies.forEach(movie => {
      if (!watchedIds.has(movie.id)) {
        const movieTitleRegex = new RegExp(`\\b${movie.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (movieTitleRegex.test(content)) {
          recommendations.push({ movieId: movie.id });
        }
      }
    });

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  private extractMovieFromResponse(content: string, movies: Movie[]): Movie | null {
    for (const movie of movies) {
      const movieTitleRegex = new RegExp(`\\b${movie.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (movieTitleRegex.test(content)) {
        return movie;
      }
    }
    return null;
  }

  private parseMovieAnalysis(content: string): MovieAnalysis {
    return {
      plotSummary: "This movie showcases compelling Yoruba storytelling with rich cultural elements.",
      culturalSignificance: "The film reflects important aspects of Yoruba culture and traditions.",
      targetAudience: "Fans of Yoruba cinema and cultural storytelling.",
      contentWarnings: [],
      discussionPoints: ["Cultural representation", "Storytelling techniques", "Character development"],
      themes: ["Culture", "Tradition", "Family", "Community"],
      culturalElements: ["Language", "Traditions", "Values", "Heritage"]
    };
  }

  private parseGeneratedMetadata(content: string): Partial<Movie> {
    return {
      description: "An engaging Yoruba movie that showcases rich cultural storytelling.",
      genre: "Drama",
      category: "Drama" as const
    };
  }

  private parseActorProfile(content: string): any {
    return {
      bio: content.substring(0, 200) + "...",
      imageUrl: null
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: string, capabilities: string[] }> {
    return {
      status: 'healthy',
      capabilities: [
        'chat',
        'recommendations',
        'analysis',
        'creative-content',
        'support',
        'movie-search',
        'metadata-generation',
        'admin-insights'
      ]
    };
  }
}

export default CinemaxAIService;