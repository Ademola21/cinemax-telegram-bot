/**
 * AI Service - Cinemax AI Integration
 * Replaces Azure OpenAI and Google Gemini with our custom Cinemax AI
 */

import { Movie, SiteConfig } from "./types";
import { getSession } from "./storageService";
import CinemaxAIService, { AiChatResponse } from "../src/ai/services/CinemaxAIService";

// Initialize the Cinemax AI service
const cinemaxAI = CinemaxAIService.getInstance();

// Session management for chat memory
interface ChatSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
}

const activeSessions: Map<string, ChatSession> = new Map();

/**
 * Get or create a chat session for the user
 */
function getOrCreateChatSession(userId: string): string {
  const existingSession = activeSessions.get(userId);
  
  if (existingSession) {
    existingSession.lastActivity = new Date();
    return existingSession.sessionId;
  }
  
  // Create new session
  const sessionId = Math.random().toString(36).substr(2, 9);
  activeSessions.set(userId, {
    sessionId,
    userId,
    startTime: new Date(),
    lastActivity: new Date()
  });
  
  // Start session in Cinemax AI
  cinemaxAI.startChatSession(userId);
  
  console.log(`🎬 Started new chat session for user: ${userId}`);
  return sessionId;
}

/**
 * End chat session for user
 */
export function endChatSession(userId: string): void {
  const session = activeSessions.get(userId);
  if (session) {
    cinemaxAI.endChatSession(userId);
    activeSessions.delete(userId);
    console.log(`🔚 Ended chat session for user: ${userId}`);
  }
}

/**
 * Main chat function with conversation memory
 */
export const runChat = async (
  prompt: string, 
  movies: Movie[], 
  siteConfig: SiteConfig, 
  isAdmin: boolean = false
): Promise<AiChatResponse> => {
  if (!movies || movies.length === 0) {
    return { text: "I'm still loading our movie catalog. Please ask me again in a moment!" };
  }

  try {
    // Get current user session
    const session = getSession();
    const userId = session?.userId || 'anonymous';
    const sessionId = getOrCreateChatSession(userId);

    console.log(`🎬 Cinemax AI processing chat from user: ${userId}`);

    // Use Cinemax AI for chat
    const response = await cinemaxAI.runChat(
      prompt,
      movies,
      siteConfig,
      isAdmin,
      userId,
      sessionId
    );

    console.log('✅ Cinemax AI chat response generated');
    return response;

  } catch (error) {
    console.error('❌ Cinemax AI chat error:', error);
    return { 
      text: "I'm here to help you with Yorubacinemax! I can assist with movie recommendations, answer questions about Yoruba cinema, and help you navigate the platform. What would you like to know?" 
    };
  }
};

/**
 * Find movie by description using Cinemax AI
 */
export const findMovieByDescription = async (query: string, movies: Movie[]): Promise<Movie | null> => {
  try {
    console.log(`🔍 Cinemax AI searching for movie: "${query}"`);
    
    const foundMovie = await cinemaxAI.findMovieByDescription(query, movies);
    
    if (foundMovie) {
      console.log(`✅ Found movie: ${foundMovie.title}`);
    } else {
      console.log('❌ No matching movie found');
    }
    
    return foundMovie;

  } catch (error) {
    console.error('❌ Movie search error:', error);
    return null;
  }
};

/**
 * Get AI recommendations using Cinemax AI
 */
export const getAiRecommendations = async (currentMovie: Movie, movies: Movie[]): Promise<{ movieId: string, reason: string }[] | null> => {
  try {
    console.log(`🎯 Cinemax AI generating recommendations for: ${currentMovie.title}`);
    
    const recommendations = await cinemaxAI.getAiRecommendations(currentMovie, movies);
    
    if (recommendations) {
      console.log(`✅ Generated ${recommendations.length} recommendations`);
    } else {
      console.log('❌ No recommendations generated');
    }
    
    return recommendations;

  } catch (error) {
    console.error('❌ Recommendation error:', error);
    return null;
  }
};

/**
 * Get personalized recommendations using Cinemax AI
 */
export const getAiPersonalizedRecommendations = async (
  viewingHistory: {movieId: string, viewedAt: string}[], 
  movies: Movie[]
): Promise<{ movieId: string }[] | null> => {
  if (viewingHistory.length === 0) return null;
  
  try {
    const session = getSession();
    const userId = session?.userId || 'anonymous';
    
    console.log(`🎯 Cinemax AI generating personalized recommendations for user: ${userId}`);
    
    const recommendations = await cinemaxAI.getAiPersonalizedRecommendations(
      viewingHistory, 
      movies, 
      userId
    );
    
    if (recommendations) {
      console.log(`✅ Generated ${recommendations.length} personalized recommendations`);
    } else {
      console.log('❌ No personalized recommendations generated');
    }
    
    return recommendations;

  } catch (error) {
    console.error('❌ Personalized recommendation error:', error);
    return null;
  }
};

/**
 * Get support from Cinemax AI
 */
export const getAiSupport = async (helpTopic: string): Promise<string> => {
  try {
    const session = getSession();
    const userId = session?.userId || 'anonymous';
    
    console.log(`💬 Cinemax AI providing support for: ${helpTopic}`);
    
    const response = await cinemaxAI.getSupport(helpTopic, userId);
    
    console.log('✅ Support response generated');
    return response;

  } catch (error) {
    console.error('❌ Support error:', error);
    return "I'm here to help! Please let me know what specific assistance you need with Yorubacinemax.";
  }
};

/**
 * Generate creative content using Cinemax AI
 */
export const generateCreativeContent = async (topic: string, contentType: string): Promise<string> => {
  try {
    console.log(`🎨 Cinemax AI generating creative content: ${contentType} - ${topic}`);
    
    const content = await cinemaxAI.generateCreativeContent(topic, contentType);
    
    console.log('✅ Creative content generated');
    return content;

  } catch (error) {
    console.error('❌ Creative content error:', error);
    return "I'd love to help create something amazing for you! Let me try a different approach.";
  }
};

/**
 * Analyze movie using Cinemax AI
 */
export const analyzeMovie = async (movie: Movie): Promise<any> => {
  try {
    console.log(`📊 Cinemax AI analyzing movie: ${movie.title}`);
    
    const analysis = await cinemaxAI.analyzeMovie(movie);
    
    console.log('✅ Movie analysis completed');
    return analysis;

  } catch (error) {
    console.error('❌ Movie analysis error:', error);
    return null;
  }
};

/**
 * Generate movie metadata using Cinemax AI
 */
export const generateMovieMetadata = async (partialMovie: Partial<Movie>): Promise<Partial<Movie> | null> => {
  try {
    console.log('📝 Cinemax AI generating movie metadata...');
    
    const metadata = await cinemaxAI.generateMovieMetadata(partialMovie);
    
    console.log('✅ Movie metadata generated');
    return metadata;

  } catch (error) {
    console.error('❌ Metadata generation error:', error);
    return null;
  }
};

/**
 * Get analytics insights for admin (using Cinemax AI)
 */
export const getAnalyticsInsights = async (analyticsData: any, query: string): Promise<string> => {
  try {
    console.log(`📊 Cinemax AI providing analytics insights for: ${query}`);
    
    const insights = await cinemaxAI.getAnalyticsInsights(analyticsData, query);
    
    console.log('✅ Analytics insights generated');
    return insights;

  } catch (error) {
    console.error('❌ Analytics insights error:', error);
    return "I can help you understand the analytics data. What specific insights are you looking for?";
  }
};

/**
 * Health check for Cinemax AI
 */
export const checkAiHealth = async (): Promise<{ status: string, capabilities: string[] }> => {
  try {
    return await cinemaxAI.healthCheck();
  } catch (error) {
    console.error('❌ AI health check error:', error);
    return {
      status: 'unhealthy',
      capabilities: []
    };
  }
};

/**
 * Get chat session memory
 */
export const getChatMemory = async (userId: string): Promise<any> => {
  try {
    return await cinemaxAI.getChatSession(userId);
  } catch (error) {
    console.error('❌ Get chat memory error:', error);
    return null;
  }
};

// Export the Cinemax AI service instance for direct access if needed
export { cinemaxAI };

// Export types
export type { AiChatResponse };