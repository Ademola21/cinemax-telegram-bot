/**
 * Chat Memory System - Manages conversation history and session memory
 */

import { ChatMessage } from '../model/CinemaxAI';

interface ChatSession {
  userId: string;
  sessionId: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
  userPreferences: any;
}

interface UserMemory {
  userId: string;
  totalSessions: number;
  averageSessionLength: number;
  commonTopics: string[];
  personalityInsights: any;
  lastSeen: Date;
}

export class ChatMemorySystem {
  private sessions: Map<string, ChatSession> = new Map();
  private userMemories: Map<string, UserMemory> = new Map();
  private maxSessionAge: number = 24 * 60 * 60 * 1000; // 24 hours
  private maxMessagesPerSession: number = 50;

  initialize(): void {
    // Load existing sessions from storage if needed
    this.cleanupOldSessions();
    setInterval(() => this.cleanupOldSessions(), 60 * 60 * 1000); // Cleanup every hour
  }

  async getConversationContext(userId: string, sessionId: string): Promise<ChatMessage[]> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const session = this.sessions.get(sessionKey);
    
    if (!session) {
      // Create new session
      const newSession: ChatSession = {
        userId,
        sessionId,
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        userPreferences: {}
      };
      this.sessions.set(sessionKey, newSession);
      return [];
    }

    // Update last activity
    session.lastActivity = new Date();
    
    // Return recent messages (last 20 for context)
    return session.messages.slice(-20);
  }

  async addToConversation(userId: string, sessionId: string, message: ChatMessage): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    let session = this.sessions.get(sessionKey);
    
    if (!session) {
      session = {
        userId,
        sessionId,
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        userPreferences: {}
      };
      this.sessions.set(sessionKey, session);
    }

    session.messages.push(message);
    session.lastActivity = new Date();

    // Limit messages per session
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages = session.messages.slice(-this.maxMessagesPerSession);
    }

    // Update user memory
    await this.updateUserMemory(userId, message);
  }

  async clearSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    this.sessions.delete(sessionKey);
  }

  async getConversationHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const session = this.sessions.get(sessionKey);
    return session ? session.messages : [];
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const userSessions: ChatSession[] = [];
    for (const [key, session] of this.sessions) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }
    return userSessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async updateUserPreferences(userId: string, preferences: any): Promise<void> {
    const userMemory = this.userMemories.get(userId) || {
      userId,
      totalSessions: 0,
      averageSessionLength: 0,
      commonTopics: [],
      personalityInsights: {},
      lastSeen: new Date()
    };

    userMemory.personalityInsights = { ...userMemory.personalityInsights, ...preferences };
    userMemory.lastSeen = new Date();
    this.userMemories.set(userId, userMemory);

    // Update all active sessions for this user
    for (const [key, session] of this.sessions) {
      if (session.userId === userId) {
        session.userPreferences = { ...session.userPreferences, ...preferences };
      }
    }
  }

  async getUserMemory(userId: string): Promise<UserMemory | null> {
    return this.userMemories.get(userId) || null;
  }

  private async updateUserMemory(userId: string, message: ChatMessage): Promise<void> {
    let userMemory = this.userMemories.get(userId);
    
    if (!userMemory) {
      userMemory = {
        userId,
        totalSessions: 0,
        averageSessionLength: 0,
        commonTopics: [],
        personalityInsights: {},
        lastSeen: new Date()
      };
      this.userMemories.set(userId, userMemory);
    }

    userMemory.lastSeen = new Date();

    // Extract topics from message (simple keyword extraction)
    if (message.text) {
      const topics = this.extractTopics(message.text);
      topics.forEach(topic => {
        if (!userMemory.commonTopics.includes(topic)) {
          userMemory.commonTopics.push(topic);
        }
      });
      
      // Keep only recent topics
      userMemory.commonTopics = userMemory.commonTopics.slice(-20);
    }
  }

  private extractTopics(text: string): string[] {
    const movieKeywords = ['movie', 'film', 'cinema', 'actor', 'actress', 'director', 'genre', 'yoruba', 'nollywood'];
    const generalKeywords = ['hello', 'hi', 'help', 'recommend', 'search', 'watch', 'like', 'good', 'bad'];
    
    const topics: string[] = [];
    const lowerText = text.toLowerCase();
    
    movieKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        topics.push(keyword);
      }
    });
    
    generalKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        topics.push(keyword);
      }
    });

    return topics;
  }

  private getSessionKey(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    const sessionsToDelete: string[] = [];
    
    for (const [key, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.maxSessionAge) {
        sessionsToDelete.push(key);
      }
    }
    
    sessionsToDelete.forEach(key => this.sessions.delete(key));
    
    if (sessionsToDelete.length > 0) {
      console.log(`[ChatMemory] Cleaned up ${sessionsToDelete.length} old sessions`);
    }
  }

  // Statistics and analytics
  getMemoryStats(): any {
    const totalSessions = this.sessions.size;
    const totalUsers = this.userMemories.size;
    const activeSessions = Array.from(this.sessions.values()).filter(
      session => Date.now() - session.lastActivity.getTime() < 60 * 60 * 1000 // Last hour
    ).length;

    return {
      totalSessions,
      totalUsers,
      activeSessions,
      averageMessagesPerSession: this.calculateAverageMessagesPerSession()
    };
  }

  private calculateAverageMessagesPerSession(): number {
    if (this.sessions.size === 0) return 0;
    
    const totalMessages = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.messages.length, 0);
    
    return totalMessages / this.sessions.size;
  }
}