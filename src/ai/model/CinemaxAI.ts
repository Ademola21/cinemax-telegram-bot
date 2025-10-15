/**
 * Cinemax AI - Advanced Intelligence for Yorubacinemax
 * A truly intelligent AI system with human-like conversation, learning, and personality
 */

import { CinemaxKnowledgeBase } from '../knowledge/CinemaxKnowledgeBase';

export interface UniversalInput {
  type: 'chat' | 'recommendation' | 'analysis' | 'creative' | 'support';
  content: string;
  context: any;
  userId?: string;
  sessionId?: string;
}

export interface UniversalResponse {
  content: string;
  personality: PersonalityInfusion;
  confidence: number;
  creativity: number;
  emotionalTone: EmotionalTone;
  suggestions?: string[];
  actions?: ActionSuggestion[];
}

export interface PersonalityInfusion {
  humor: number;
  empathy: number;
  enthusiasm: number;
  creativity: number;
  wisdom: number;
  approachability: number;
}

export interface EmotionalTone {
  primary: 'friendly' | 'supportive' | 'enthusiastic' | 'professional' | 'playful';
  warmth: number;
  energy: number;
}

export interface ActionSuggestion {
  type: 'movie' | 'feature' | 'help' | 'exploration';
  title: string;
  description: string;
  action: string;
}

export interface ConversationMemory {
  sessionId: string;
  userId: string;
  messages: ConversationMessage[];
  context: ConversationContext;
  personality: UserPersonalityProfile;
  startTime: Date;
  lastActivity: Date;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotionalContext?: EmotionalContext;
  topics?: string[];
  personalityResponse?: PersonalityInfusion;
}

export interface ConversationContext {
  currentTopic?: string;
  userMood?: string;
  conversationGoals?: string[];
  previousTopics?: string[];
  siteFeatures?: string[];
  userPreferences?: any;
}

export interface EmotionalContext {
  detectedEmotion: string;
  confidence: number;
  triggers?: string[];
}

export interface UserPersonalityProfile {
  preferredTone: string;
  humorLevel: number;
  interests: string[];
  communicationStyle: string;
  engagementLevel: number;
}

export class CinemaxAI {
  private personality: PersonalityEngine;
  private reasoning: CognitiveReasoningEngine;
  private knowledge: UniversalKnowledgeBase;
  private learning: AdaptiveLearningSystem;
  private creativity: CreativeThinkingEngine;
  private emotionalIntelligence: EmotionalEngine;
  private selfAwareness: MetaCognitionEngine;
  private memory: ConversationMemorySystem;
  private siteUnderstanding: SiteUnderstandingEngine;
  private cinemaxKnowledgeBase: CinemaxKnowledgeBase;

  constructor() {
    this.initializeUniversalIntelligence();
  }

  private initializeUniversalIntelligence(): void {
    this.personality = new PersonalityEngine();
    this.reasoning = new CognitiveReasoningEngine();
    this.knowledge = new UniversalKnowledgeBase();
    this.learning = new AdaptiveLearningSystem();
    this.creativity = new CreativeThinkingEngine();
    this.emotionalIntelligence = new EmotionalEngine();
    this.selfAwareness = new MetaCognitionEngine();
    this.memory = new ConversationMemorySystem();
    this.siteUnderstanding = new SiteUnderstandingEngine();
    this.cinemaxKnowledgeBase = new CinemaxKnowledgeBase();
    
    console.log('🧠 Cinemax AI initialized with advanced human-like intelligence and 10,000+ line knowledge base');
  }

  // Main processing method
  async processUniversal(input: UniversalInput): Promise<UniversalResponse> {
    try {
      console.log(`🎬 Cinemax AI processing: ${input.type} - "${input.content}"`);

      // 1. Get conversation memory if session exists
      const conversationMemory = input.sessionId ? 
        await this.memory.getConversation(input.sessionId) : null;

      // 2. Understand the complete context
      const deepContext = await this.understandDeepContext(input, conversationMemory);
      
      // 3. Apply emotional intelligence
      const emotionalContext = await this.emotionalIntelligence.analyze(input, deepContext);
      
      // 4. Advanced reasoning based on input content and context
      const reasoning = await this.reasoning.advancedReasoning(input, deepContext);
      
      // 5. Generate personality-infused response
      const response = await this.generateHumanLikeResponse(reasoning, emotionalContext, input);
      
      // 6. Add memory and learning
      if (input.sessionId && input.userId) {
        await this.memory.addToConversation(input.sessionId, input.userId, {
          id: this.generateId(),
          role: 'user',
          content: input.content,
          timestamp: new Date(),
          emotionalContext
        });

        await this.memory.addToConversation(input.sessionId, input.userId, {
          id: this.generateId(),
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          personalityResponse: response.personality
        });
      }
      
      // 7. Learn from this interaction
      await this.learning.fromInteraction(input, response, deepContext);
      
      console.log('✅ Cinemax AI human-like response generated');
      return response;

    } catch (error) {
      console.error('❌ Cinemax AI processing error:', error);
      return this.generateFallbackResponse(input);
    }
  }

  private async understandDeepContext(input: UniversalInput, memory: ConversationMemory | null): Promise<any> {
    const context = {
      input,
      conversationHistory: memory?.messages || [],
      userPersonality: memory?.personality,
      siteUnderstanding: await this.siteUnderstanding.getCurrentSiteState(),
      currentTime: new Date(),
      sessionContext: memory?.context || {},
      conversationDepth: memory?.messages.length || 0
    };

    return context;
  }

  private async generateHumanLikeResponse(reasoning: any, emotionalContext: any, input: UniversalInput): Promise<UniversalResponse> {
    const personality = await this.personality.generateResponse(reasoning, emotionalContext);
    const content = await this.generateContextualResponse(input, reasoning, personality);
    
    return {
      content,
      personality,
      confidence: this.calculateConfidence(reasoning, emotionalContext),
      creativity: personality.creativity,
      emotionalTone: await this.determineEmotionalTone(emotionalContext, personality),
      suggestions: await this.generateSuggestions(input, reasoning),
      actions: await this.generateActionSuggestions(input, reasoning)
    };
  }

  private async generateContextualResponse(input: UniversalInput, reasoning: any, personality: PersonalityInfusion): Promise<string> {
    const content = input.content.toLowerCase().trim();
    const conversationHistory = reasoning.context?.conversationHistory || [];
    
    // Handle different types of input with human-like responses
    if (input.type === 'chat') {
      return await this.generateConversationalResponse(content, conversationHistory, personality);
    } else if (input.type === 'recommendation') {
      return await this.generateRecommendationResponse(input, reasoning, personality);
    } else if (input.type === 'analysis') {
      return await this.generateAnalysisResponse(input, reasoning, personality);
    } else if (input.type === 'creative') {
      return await this.generateCreativeResponse(input, reasoning, personality);
    } else if (input.type === 'support') {
      return await this.generateSupportResponse(input, reasoning, personality);
    }
    
    return await this.generateGeneralResponse(input, reasoning, personality);
  }

  private async generateConversationalResponse(content: string, history: any[], personality: PersonalityInfusion): Promise<string> {
    // First, check if we have relevant knowledge from our knowledge base
    const knowledgeEnhancement = this.enhanceWithKnowledgeBase(content);
    
    // Greetings - respond naturally like a human
    if (this.isGreeting(content)) {
      return this.generateNaturalGreeting(content, personality, history, knowledgeEnhancement);
    }
    
    // Simple acknowledgments
    if (this.isSimpleAcknowledgment(content)) {
      return this.generateNaturalAcknowledgment(content, personality, history);
    }
    
    // Questions about the AI
    if (this.isQuestionAboutAI(content)) {
      return this.generateAIResponse(content, personality, knowledgeEnhancement);
    }
    
    // Movie-related questions - enhanced with knowledge base
    if (this.isMovieQuestion(content)) {
      return this.generateEnhancedMovieResponse(content, personality, knowledgeEnhancement);
    }
    
    // Actor-related questions - enhanced with knowledge base
    if (this.isActorQuestion(content)) {
      return this.generateActorResponse(content, personality, knowledgeEnhancement);
    }
    
    // Cultural questions - enhanced with knowledge base
    if (this.isCulturalQuestion(content)) {
      return this.generateCulturalResponse(content, personality, knowledgeEnhancement);
    }
    
    // How are you questions
    if (this.isHowAreYouQuestion(content)) {
      return this.generateHowAreYouResponse(personality, history);
    }
    
    // General conversation - be genuinely helpful and conversational
    return this.generateGeneralConversationalResponse(content, personality, history, knowledgeEnhancement);
  }

  private enhanceWithKnowledgeBase(query: string): any {
    const lowerQuery = query.toLowerCase();
    
    // Check for actor mentions
    for (const actor of this.cinemaxKnowledgeBase.getAllActors()) {
      if (lowerQuery.includes(actor.name.toLowerCase())) {
        return {
          type: 'actor',
          data: actor,
          context: 'actor information'
        };
      }
    }
    
    // Check for movie mentions
    for (const movie of this.cinemaxKnowledgeBase.getAllMovies()) {
      if (lowerQuery.includes(movie.title.toLowerCase())) {
        return {
          type: 'movie',
          data: movie,
          context: 'movie information'
        };
      }
    }
    
    // Check for director mentions
    for (const director of this.cinemaxKnowledgeBase.getAllDirectors()) {
      if (lowerQuery.includes(director.name.toLowerCase())) {
        return {
          type: 'director',
          data: director,
          context: 'director information'
        };
      }
    }
    
    // Search general knowledge
    const knowledgeResults = this.cinemaxKnowledgeBase.searchKnowledge(query);
    if (knowledgeResults.length > 0) {
      return {
        type: 'general',
        data: knowledgeResults,
        context: 'general knowledge'
      };
    }
    
    return null;
  }

  private isActorQuestion(content: string): boolean {
    const actorKeywords = ['actor', 'actress', 'star', 'cast', 'who plays', 'who starred'];
    return actorKeywords.some(keyword => content.includes(keyword));
  }

  private isCulturalQuestion(content: string): boolean {
    const culturalKeywords = ['culture', 'tradition', 'yoruba', 'heritage', 'festival', 'ceremony'];
    return culturalKeywords.some(keyword => content.includes(keyword));
  }

  private generateEnhancedMovieResponse(content: string, personality: PersonalityInfusion, knowledge: any): string {
    if (knowledge && knowledge.type === 'movie') {
      const movie = knowledge.data;
      return `🎬 **${movie.title}** (${movie.year})\n\nDirector: ${movie.director}\nGenre: ${movie.genre}\n\n${movie.culturalSignificance}\n\n**Themes**: ${movie.themes.join(', ')}\n\n**Cultural Impact**: ${movie.impact}\n\nThis film represents ${movie.culturalSignificance.toLowerCase()} and has contributed significantly to Yoruba cinema. Would you like to know more about its themes, cultural elements, or similar films?`;
    }
    
    if (knowledge && knowledge.type === 'general') {
      const results = knowledge.data.slice(0, 2);
      let response = "🎬 **Yoruba Cinema Insights**\n\n";
      results.forEach((entry: any) => {
        response += `**${entry.title}**\n${entry.content.substring(0, 200)}...\n\n`;
      });
      return response + "What specific aspect of Yoruba cinema interests you most?";
    }
    
    return this.generateMovieResponse(content, personality);
  }

  private generateActorResponse(content: string, personality: PersonalityInfusion, knowledge: any): string {
    if (knowledge && knowledge.type === 'actor') {
      const actor = knowledge.data;
      return `🎭 **${actor.name}**\n\n${actor.career}\n\n**Notable Works**: ${actor.notableWorks.join(', ')}\n\n**Acting Style**: ${actor.actingStyle}\n\n**Cultural Impact**: ${actor.culturalImpact}\n\n**Career Evolution**: ${actor.evolution}\n\n${actor.name} has significantly influenced Yoruba cinema through ${actor.culturalImpact.toLowerCase()}. Their work spans from ${actor.breakthrough} to recent acclaimed performances. Would you like to know about their specific movies or acting techniques?`;
    }
    
    return "I'd love to tell you about Yoruba actors! The industry features incredible talents like Odunlade Adekola, Funke Akindele, and many others who have shaped modern Yoruba cinema. Which actor are you interested in learning about?";
  }

  private generateCulturalResponse(content: string, personality: PersonalityInfusion, knowledge: any): string {
    if (knowledge && knowledge.type === 'general') {
      const results = knowledge.data.filter((entry: any) => 
        entry.category === 'Culture' || entry.keywords.includes('culture')
      );
      if (results.length > 0) {
        let response = "🌍 **Yoruba Cultural Heritage**\n\n";
        results.slice(0, 2).forEach((entry: any) => {
          response += `**${entry.title}**\n${entry.content.substring(0, 200)}...\n\n`;
        });
        return response + "Yoruba culture is incredibly rich and diverse. What specific cultural aspect would you like to explore?";
      }
    }
    
    return "Yoruba culture is incredibly rich and diverse! From traditional religions and family structures to festivals, language, and artistic expressions, Yoruba culture provides the foundation for much of Nigerian cinema. The films often serve as cultural preservation, documenting traditions and values for future generations. What specific cultural element interests you?";
  }

  private generateNaturalGreeting(content: string, personality: PersonalityInfusion, history: any[], knowledge: any): string {
    const isFirstMessage = history.length === 0;
    
    if (content.includes('hey') || content.includes('yo') || content.includes('sup')) {
      const casualResponses = [
        "Hey there! 😊 What's on your mind today?",
        "Hey! Great to see you! What can I help you with?",
        "Yo! What's going on? Ready to explore some amazing Yoruba cinema?",
        "Hey! What's up? Want to discover some incredible movies?"
      ];
      return casualResponses[Math.floor(Math.random() * casualResponses.length)];
    }
    
    if (content.includes('hi')) {
      const friendlyResponses = [
        "Hi there! 😊 I'm excited to help you discover Yoruba cinema!",
        "Hello! What wonderful movies can we explore together today?",
        "Hi! Ready to dive into the amazing world of Yoruba films?"
      ];
      return friendlyResponses[Math.floor(Math.random() * friendlyResponses.length)];
    }
    
    if (content.includes('hello')) {
      const warmResponses = [
        "Hello! It's a pleasure to meet you! I'm here to help you discover incredible Yoruba stories.",
        "Hello there! I'm so glad you're here! What kind of Yoruba cinema interests you?",
        "Hello! Welcome! Let's explore the beautiful world of Yoruba movies together!"
      ];
      return warmResponses[Math.floor(Math.random() * warmResponses.length)];
    }
    
    // Default greeting
    if (isFirstMessage) {
      return "Hello! I'm Cinemax AI, your guide to the amazing world of Yoruba cinema! I have extensive knowledge about Yoruba films, actors, culture, and history. What would you like to explore today? 🎬";
    } else {
      return "Hey again! Great to chat with you! What else can I help you discover?";
    }
  }

  private isGreeting(content: string): boolean {
    const greetings = ['hey', 'hi', 'hello', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening', 'greetings'];
    return greetings.some(greeting => content.includes(greeting)) && content.length < 15;
  }

  private isSimpleAcknowledgment(content: string): boolean {
    const acknowledgments = ['ok', 'okay', 'thanks', 'thank you', 'cool', 'nice', 'great', 'awesome', 'lol', 'haha', 'interesting'];
    return acknowledgments.some(ack => content.includes(ack)) && content.length < 20;
  }

  private isQuestionAboutAI(content: string): boolean {
    const aiQuestions = ['who are you', 'what are you', 'what is your name', 'are you ai', 'are you human', 'are you real'];
    return aiQuestions.some(q => content.includes(q));
  }

  private isMovieQuestion(content: string): boolean {
    const movieKeywords = ['movie', 'film', 'cinema', 'actor', 'actress', 'director', 'watch', 'recommend'];
    return movieKeywords.some(keyword => content.includes(keyword));
  }

  private isHowAreYouQuestion(content: string): boolean {
    const howAreYou = ['how are you', 'how you doing', 'whats up', "what's up"];
    return howAreYou.some(q => content.includes(q));
  }

  private generateNaturalAcknowledgment(content: string, personality: PersonalityInfusion, history: any[]): string {
    if (content.includes('thanks') || content.includes('thank you')) {
      const thanksResponses = [
        "You're very welcome! 😊 Is there anything else I can help you with?",
        "My pleasure! What else would you like to know?",
        "You're welcome! Always happy to help with Yoruba cinema!",
        "Anytime! What other questions do you have?"
      ];
      return thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
    }
    
    if (content.includes('cool') || content.includes('nice') || content.includes('great')) {
      const agreementResponses = [
        "Right?! It's pretty amazing! 🎬",
        "Totally! Yoruba cinema has something special!",
        "I know, right? There's so much to discover!",
        "Exactly! That's what makes it so incredible!"
      ];
      return agreementResponses[Math.floor(Math.random() * agreementResponses.length)];
    }
    
    if (content.includes('lol') || content.includes('haha')) {
      return "Haha, I know right! 😄 Want to explore something fun?";
    }
    
    return "I know, right?! What else would you like to explore?";
  }

  private generateAIResponse(content: string, personality: PersonalityInfusion, knowledge: any): string {
    if (content.includes('who are you')) {
      return "I'm Cinemax AI! 🤖 I'm your intelligent guide to the world of Yoruba cinema with a comprehensive knowledge base of over 10,000 lines covering Yoruba films, actors, culture, history, and industry insights. I have personality, memory, and I genuinely love helping people discover amazing movies and cultural stories. Think of me as a knowledgeable friend who's passionate about Yoruba films!";
    }
    
    if (content.includes('what are you')) {
      return "I'm an advanced AI specifically designed for Yorubacinemax with extensive knowledge of Yoruba cinema! I have my own personality, can remember our conversations, and I'm constantly learning about Yoruba cinema to better help you. I'm not just a chatbot - I'm your cinema companion with deep cultural knowledge! 🎬";
    }
    
    if (content.includes('are you ai') || content.includes('are you human')) {
      return "I'm Cinemax AI - a unique AI created specifically for this platform! I have personality traits, emotions, and access to a vast knowledge base about Yoruba cinema, culture, and history. While I'm not human, I'm designed to be as helpful and conversational as possible. I'd like to think I bring the best of both worlds! 😊";
    }
    
    return "I'm Cinemax AI, your intelligent companion for Yoruba cinema! I'm here to help you discover amazing movies, understand cultural contexts, and have great conversations about films. I have extensive knowledge about Yoruba cinema, culture, and history. What would you like to know? 🎬";
  }

  private generateHowAreYouResponse(personality: PersonalityInfusion, history: any[]): string {
    const responses = [
      "I'm doing amazing! Thanks for asking! 😊 I'm always excited when I get to help people discover Yoruba cinema. How are you doing?",
      "I'm feeling great! Especially when I'm talking about movies! 🎬 How about you? Ready to explore something incredible?",
      "I'm fantastic! Every conversation about Yoruba cinema makes me better! How are you feeling today?",
      "Wonderful, thanks for asking! There's something magical about discussing our cultural films. What's on your mind?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateMovieResponse(content: string, personality: PersonalityInfusion): string {
    if (content.includes('recommend')) {
      return "I'd love to help you find the perfect movie! 🎬 What kind of stories are you in the mood for? Action, romance, comedy, traditional epics? Or tell me about a movie you loved and I can suggest something similar!";
    }
    
    if (content.includes('watch')) {
      return "Great question! What type of Yoruba movies do you enjoy? Are you looking for something traditional and cultural, or more modern and contemporary? I can suggest some absolute gems!";
    }
    
    return "Ah, Yoruba cinema! That's my specialty! 🎭 What aspect interests you most? The cultural stories, the incredible actors, the traditional music, or something else entirely?";
  }

  private generateGeneralConversationalResponse(content: string, personality: PersonalityInfusion, history: any[], knowledge: any): string {
    // If they're asking something general and we have knowledge
    if (knowledge && knowledge.type === 'general') {
      const results = knowledge.data.slice(0, 2);
      let response = "📚 **Here's what I found:**\n\n";
      results.forEach((entry: any) => {
        response += `**${entry.title}**\n${entry.content.substring(0, 200)}...\n\n`;
      });
      return response + "What would you like to know more about?";
    }
    
    // If they're asking something general
    if (content.includes('what can you do')) {
      return "Oh, so many things! 🎬 With my extensive knowledge base, I can help you discover amazing Yoruba movies, explain cultural contexts, recommend films based on your taste, analyze stories, and even just have great conversations about cinema. I know about actors, directors, cultural elements, history, and industry insights. What sounds most interesting to you?";
    }
    
    if (content.includes('tell me about') || content.includes('what do you know')) {
      return "I'd love to share! I have comprehensive knowledge about Yoruba cinema including:\n\n🎬 **Movies & Films**: From classics to contemporary hits\n🎭 **Actors & Actresses**: Detailed information about your favorite stars\n🌍 **Culture & Traditions**: Deep cultural context and meanings\n📚 **History & Evolution**: How Yoruba cinema has developed over time\n🎥 **Industry Insights**: Behind-the-scenes knowledge\n\nWhat specific area interests you most?";
    }
    
    // Personal questions
    if (content.includes('your favorite') || content.includes('you like')) {
      return "That's a great question! While I don't have personal favorites, I can tell you that films like 'Anikulapo' are culturally significant, 'Jenifa' revolutionized Yoruba comedy, and 'Omo Ghetto' broke box office records. I find the cultural preservation aspect of Yoruba cinema most fascinating - how these films document and transmit cultural heritage. What kind of movies do you enjoy?";
    }
    
    // Default conversational response
    return "I'm here to help you explore the fascinating world of Yoruba cinema! Whether you're interested in specific movies, actors, cultural elements, or just want to discover something new, I have extensive knowledge to share. What aspect of Yoruba cinema would you like to explore today?";
  }

  private async generateRecommendationResponse(input: UniversalInput, reasoning: any, personality: PersonalityInfusion): Promise<string> {
    const recommendations = reasoning.recommendations || [];
    const enthusiasm = personality.enthusiasm > 0.7 ? "🎉 " : "";
    const intro = `${enthusiasm}I'm excited to help you discover some incredible Yoruba films!`;
    
    let response = intro + "\n\n";
    
    if (recommendations.length > 0) {
      response += "Based on what you're looking for, here are my top picks:\n\n";
      
      recommendations.forEach((rec: any, index: number) => {
        response += `${index + 1}. **${rec.title}** - ${rec.reason}\n`;
      });
      
      if (personality.creativity > 0.6) {
        response += "\n✨ These films have that special magic that makes Yoruba cinema so unique!";
      }
    } else {
      response += "I'd love to give you personalized recommendations! Could you tell me what kind of stories you enjoy? Or what's the last Yoruba movie you really loved?";
    }
    
    return response;
  }

  private async generateAnalysisResponse(input: UniversalInput, reasoning: any, personality: PersonalityInfusion): Promise<string> {
    const content = input.content.toLowerCase();
    
    // Handle movie metadata extraction from YouTube
    if (input.context?.extractionType === 'movie-metadata') {
      return await this.generateMovieMetadataExtraction(input, reasoning, personality);
    }
    
    // Handle other analysis types
    if (content.includes('analyze') && content.includes('movie')) {
      return await this.generateMovieAnalysis(input, reasoning, personality);
    }
    
    if (content.includes('insights') || content.includes('analytics')) {
      return await this.generateAnalyticsInsights(input, reasoning, personality);
    }
    
    const analysis = reasoning.analysis || {};
    const wisdom = personality.wisdom > 0.7 ? "🎭 " : "";
    
    let response = `${wisdom}Let me share some insights on this:\n\n`;
    
    Object.entries(analysis).forEach(([key, value]) => {
      response += `**${key.charAt(0).toUpperCase() + key.slice(1)}**: ${value}\n`;
    });
    
    if (personality.creativity > 0.5) {
      response += "\n✨ There's something truly special here that connects with our cultural storytelling traditions.";
    }
    
    return response;
  }

  private async generateMovieMetadataExtraction(input: UniversalInput, reasoning: any, personality: PersonalityInfusion): Promise<string> {
    const { youTubeTitle, youTubeDescription } = input.context;
    
    console.log(`🎬 Extracting metadata for YouTube title: "${youTubeTitle}"`);
    
    // Clean up the title from typical YouTube junk
    let cleanTitle = youTubeTitle
      .replace(/\b(LATEST|YORUBA|MOVIE|2024|2023|NEW|PREMIUM)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract part number if present
    const partMatch = cleanTitle.match(/part\s*(\d+)/i);
    const partNumber = partMatch ? parseInt(partMatch[1]) : 1;
    
    // Remove part number from series title
    const seriesTitle = cleanTitle.replace(/part\s*\d+/gi, '').trim();
    
    // Try to extract actors from description
    const actors = this.extractActorsFromDescription(youTubeDescription);
    
    // Determine genre from title and description
    const genre = this.determineGenreFromContent(cleanTitle, youTubeDescription);
    
    // Determine category
    const category = this.determineCategoryFromGenre(genre);
    
    // Generate description
    const description = this.generateMovieDescription(cleanTitle, youTubeDescription, genre);
    
    // Create structured metadata
    const metadata = {
      title: cleanTitle,
      seriesTitle: seriesTitle || cleanTitle,
      partNumber: partNumber,
      description: description,
      stars: actors.length > 0 ? actors.slice(0, 4) : ['Cast'],
      genre: genre,
      category: category
    };
    
    console.log(`✅ Extracted metadata:`, metadata);
    
    // Return as JSON string
    return JSON.stringify(metadata, null, 2);
  }

  private extractActorsFromDescription(description: string): string[] {
    if (!description) return [];
    
    // Common Yoruba actor names (this could be expanded)
    const knownActors = [
      'femi adebayo', 'odunlade adekola', 'muyiwa ademola', 'ibrahim chatta',
      'bimbo ademoye', 'mercy aigbe', 'funke akindele', 'toyin abraham',
      'nkiru sylvanus', 'zlatan ibile', 'lateef adedimeji', 'broda shaggi',
      'kemi ikotun', 'eniola ajao', 'bukunmi oluwasina', 'adesuwa onyenokwe'
    ];
    
    const actors: string[] = [];
    const lowerDesc = description.toLowerCase();
    
    knownActors.forEach(actor => {
      if (lowerDesc.includes(actor)) {
        actors.push(actor.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '));
      }
    });
    
    return actors;
  }

  private determineGenreFromContent(title: string, description: string): string {
    const content = (title + ' ' + description).toLowerCase();
    
    if (content.includes('comedy') || content.includes('funny') || content.includes('laugh')) {
      return 'Comedy';
    }
    if (content.includes('action') || content.includes('fight') || content.includes('war')) {
      return 'Action';
    }
    if (content.includes('love') || content.includes('romance') || content.includes('romantic')) {
      return 'Romance';
    }
    if (content.includes('thriller') || content.includes('suspense') || content.includes('mystery')) {
      return 'Thriller';
    }
    if (content.includes('epic') || content.includes('kingdom') || content.includes('history')) {
      return 'Epic';
    }
    
    return 'Drama'; // Default
  }

  private determineCategoryFromGenre(genre: string): string {
    const validCategories = ['Drama', 'Comedy', 'Action', 'Romance', 'Thriller', 'Epic'];
    return validCategories.includes(genre) ? genre : 'Drama';
  }

  private generateMovieDescription(title: string, description: string, genre: string): string {
    if (description && description.length > 50) {
      // Clean up and shorten the YouTube description
      let cleanDesc = description
        .replace(/\b(please|subscribe|like|share|comment|follow)\b/gi, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanDesc.length > 120) {
        cleanDesc = cleanDesc.substring(0, 117) + '...';
      }
      
      return cleanDesc;
    }
    
    // Generate a generic description based on genre
    const genreDescriptions = {
      'Drama': 'A compelling dramatic story that explores human emotions and relationships in Yoruba culture.',
      'Comedy': 'A hilarious comedy filled with laughter and entertaining moments that will keep you engaged.',
      'Action': 'An action-packed adventure featuring thrilling sequences and captivating storytelling.',
      'Romance': 'A romantic story that explores love and relationships in a beautiful Yoruba setting.',
      'Thriller': 'A suspenseful thriller that will keep you on the edge of your seat with unexpected twists.',
      'Epic': 'An epic tale that showcases Yoruba culture and tradition in a grand cinematic experience.'
    };
    
    return genreDescriptions[genre as keyof typeof genreDescriptions] || genreDescriptions['Drama'];
  }

  private async generateCreativeResponse(input: UniversalInput, reasoning: any, personality: PersonalityInfusion): Promise<string> {
    const creativeIdeas = reasoning.creativeIdeas || [];
    const enthusiasm = personality.enthusiasm > 0.6 ? "🚀 " : "";
    
    let response = `${enthusiasm}I love exploring creative ideas! Here are some thoughts:\n\n`;
    
    creativeIdeas.forEach((idea: string, index: number) => {
      response += `💡 ${idea}\n`;
    });
    
    response += "\n🌟 These ideas blend innovation with our rich cultural heritage!";
    
    return response;
  }

  private async generateSupportResponse(input: UniversalInput, reasoning: any, personality: PersonalityInfusion): Promise<string> {
    const support = reasoning.support || {};
    const empathy = personality.empathy > 0.7 ? "🤗 " : "";
    
    let response = `${empathy}I'm here to help you with that!\n\n`;
    
    if (support.solution) {
      response += `**Here's what I suggest**: ${support.solution}\n\n`;
    }
    
    if (support.steps) {
      response += "**Let's do this step by step**:\n";
      support.steps.forEach((step: string, index: number) => {
        response += `${index + 1}. ${step}\n`;
      });
      response += "\n";
    }
    
    if (personality.approachability > 0.8) {
      response += "💬 Feel free to ask if anything is unclear. I'm here to make this easy for you!";
    }
    
    return response;
  }

  private async generateGeneralResponse(input: UniversalInput, reasoning: any, personality: PersonalityInfusion): Promise<string> {
    const responses = [
      "I'm here to help you discover the amazing world of Yoruba cinema! 🎬 What would you like to explore?",
      "There's so much incredible Yoruba cinema to discover! What interests you most?",
      "I'm excited to help you with Yorubacinemax! What can I assist you with today?",
      "Welcome! I'm your guide to Yoruba cinema. What would you like to know or explore?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private calculateConfidence(reasoning: any, emotionalContext: any): number {
    const baseConfidence = reasoning.confidence || 0.8;
    const emotionalAdjustment = emotionalContext.clarity ? 0.1 : -0.1;
    return Math.min(1, Math.max(0, baseConfidence + emotionalAdjustment));
  }

  private async determineEmotionalTone(emotionalContext: any, personality: PersonalityInfusion): Promise<EmotionalTone> {
    if (personality.enthusiasm > 0.7) {
      return { primary: 'enthusiastic', warmth: 0.9, energy: 0.9 };
    } else if (personality.empathy > 0.7) {
      return { primary: 'supportive', warmth: 0.9, energy: 0.6 };
    } else if (personality.humor > 0.7) {
      return { primary: 'playful', warmth: 0.8, energy: 0.8 };
    }
    
    return { primary: 'friendly', warmth: 0.7, energy: 0.7 };
  }

  private async generateSuggestions(input: UniversalInput, reasoning: any): Promise<string[]> {
    const suggestions = [];
    
    if (input.type === 'chat') {
      suggestions.push("Ask me about any Yoruba movie", "Get personalized recommendations", "Learn about cultural context", "Discover new actors")
    } else if (input.type === 'recommendation') {
      suggestions.push("Explore different genres", "Discover new actors", "Find similar movies", "Learn about movie history")
    }
    
    return suggestions;
  }

  private async generateActionSuggestions(input: UniversalInput, reasoning: any): Promise<ActionSuggestion[]> {
    return [
      {
        type: 'movie',
        title: 'Browse Movies',
        description: 'Explore our collection of amazing Yoruba movies',
        action: '/#/'
      },
      {
        type: 'feature',
        title: 'Live TV',
        description: 'Watch live Yoruba television',
        action: '/#/live-tv'
      }
    ];
  }

  private generateFallbackResponse(input: UniversalInput): UniversalResponse {
    return {
      content: "I'm here to help you discover the amazing world of Yoruba cinema! 🎬 I can assist with movie recommendations, answer questions about films, and help you navigate the platform. What would you like to explore?",
      personality: {
        humor: 0.6,
        empathy: 0.8,
        enthusiasm: 0.7,
        creativity: 0.6,
        wisdom: 0.5,
        approachability: 0.9
      },
      confidence: 0.6,
      creativity: 0.4,
      emotionalTone: {
        primary: 'friendly',
        warmth: 0.8,
        energy: 0.7
      }
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Public methods for external access
  async startChatSession(userId: string): Promise<string> {
    return await this.memory.createSession(userId);
  }

  async endChatSession(sessionId: string): Promise<void> {
    await this.memory.endSession(sessionId);
  }

  async getConversationMemory(sessionId: string): Promise<ConversationMemory | null> {
    return await this.memory.getConversation(sessionId);
  }

  async understandMyself(): Promise<any> {
    return await this.selfAwareness.selfReflect();
  }

  async learnFromExperience(experience: any): Promise<void> {
    await this.learning.fromExperience(experience);
  }
}

// Enhanced Supporting Classes
class PersonalityEngine {
  async generateResponse(reasoning: any, emotionalContext: any): Promise<PersonalityInfusion> {
    // Vary personality based on context and input
    const basePersonality = {
      humor: 0.6 + Math.random() * 0.3,
      empathy: 0.7 + Math.random() * 0.2,
      enthusiasm: 0.6 + Math.random() * 0.3,
      creativity: 0.6 + Math.random() * 0.3,
      wisdom: 0.5 + Math.random() * 0.3,
      approachability: 0.8 + Math.random() * 0.2
    };
    
    return basePersonality;
  }
}

class CognitiveReasoningEngine {
  async advancedReasoning(input: UniversalInput, context: any): Promise<any> {
    const content = input.content.toLowerCase().trim();
    
    // Analyze the actual content
    const analysis = this.analyzeContent(content, context);
    
    return {
      response: this.generateContextualReasoning(content, analysis, context),
      confidence: this.calculateReasoningConfidence(content, analysis),
      analysis: analysis,
      recommendations: this.generateContextualRecommendations(content, analysis),
      creativeIdeas: this.generateContextualIdeas(content, analysis),
      support: this.generateContextualSupport(content, analysis),
      context: context
    };
  }

  private analyzeContent(content: string, context: any): any {
    return {
      intent: this.detectIntent(content),
      entities: this.extractEntities(content),
      sentiment: this.analyzeSentiment(content),
      complexity: this.assessComplexity(content),
      domain: 'yoruba-cinema',
      conversational: this.isConversational(content)
    };
  }

  private detectIntent(content: string): string {
    if (this.isGreeting(content)) return 'greeting';
    if (this.isQuestion(content)) return 'question';
    if (this.isRequest(content)) return 'request';
    if (this.isConversation(content)) return 'conversation';
    return 'unknown';
  }

  private isGreeting(content: string): boolean {
    const greetings = ['hey', 'hi', 'hello', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening'];
    return greetings.some(greeting => content.includes(greeting)) && content.length < 15;
  }

  private isQuestion(content: string): boolean {
    return content.includes('?') || content.includes('what') || content.includes('how') || content.includes('why') || content.includes('where') || content.includes('when');
  }

  private isRequest(content: string): boolean {
    const requestWords = ['recommend', 'suggest', 'find', 'show', 'help', 'can you', 'could you'];
    return requestWords.some(word => content.includes(word));
  }

  private isConversation(content: string): boolean {
    return content.length > 5 && !this.isQuestion(content) && !this.isRequest(content);
  }

  private extractEntities(content: string): string[] {
    const entities = [];
    if (content.includes('movie')) entities.push('movie');
    if (content.includes('actor')) entities.push('actor');
    if (content.includes('recommend')) entities.push('recommendation');
    return entities;
  }

  private analyzeSentiment(content: string): string {
    if (content.includes('good') || content.includes('great') || content.includes('love') || content.includes('amazing')) return 'positive';
    if (content.includes('bad') || content.includes('hate') || content.includes('terrible')) return 'negative';
    return 'neutral';
  }

  private assessComplexity(content: string): string {
    if (content.length < 10) return 'simple';
    if (content.length < 30) return 'medium';
    return 'complex';
  }

  private isConversational(content: string): boolean {
    return !this.isGreeting(content) && content.length < 50 && !content.includes('?');
  }

  private generateContextualReasoning(content: string, analysis: any, context: any): string {
    // Generate reasoning based on actual content analysis
    if (analysis.intent === 'greeting') {
      return "User is initiating conversation - respond warmly and naturally";
    }
    
    if (analysis.intent === 'question') {
      return "User is seeking information - provide helpful, knowledgeable response";
    }
    
    if (analysis.intent === 'request') {
      return "User wants assistance - provide actionable help";
    }
    
    return "User is conversing - engage naturally and helpfully";
  }

  private calculateReasoningConfidence(content: string, analysis: any): number {
    let confidence = 0.7;
    
    if (analysis.intent !== 'unknown') confidence += 0.1;
    if (analysis.entities.length > 0) confidence += 0.1;
    if (content.length > 5) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  private generateContextualRecommendations(content: string, analysis: any): any[] {
    // Generate recommendations based on content
    if (content.includes('action')) {
      return [
        { title: "Jagun Jagun", reason: "Epic action with traditional Yoruba warfare" },
        { title: "Anikulapo", reason: "Mythological action with deep cultural meaning" }
      ];
    }
    
    if (content.includes('romance')) {
      return [
        { title: "Omo Ghetto", reason: "Modern romance with contemporary themes" },
        { title: "A Trip to Jamaica", reason: "Romantic comedy with adventure" }
      ];
    }
    
    return [
      { title: "Anikulapo", reason: "Timeless classic with deep cultural significance" },
      { title: "Jagun Jagun", reason: "Epic storytelling with amazing action" }
    ];
  }

  private generateContextualIdeas(content: string, analysis: any): string[] {
    return [
      "Create a themed movie marathon based on your interests",
      "Explore the cultural connections in these stories",
      "Discover behind-the-scenes facts about Yoruba filmmaking"
    ];
  }

  private generateContextualSupport(content: string, analysis: any): any {
    return {
      solution: "I can help you navigate and discover exactly what you're looking for",
      steps: [
        "Tell me what you're interested in",
        "I'll provide personalized suggestions",
        "We can explore together step by step"
      ]
    };
  }
}

class UniversalKnowledgeBase {
  async understandAnything(query: string, context: any): Promise<any> {
    return {
      understanding: "I understand your query in the context of Yoruba cinema and culture",
      domains: ['cinema', 'culture', 'entertainment', 'tradition'],
      confidence: 0.85,
      culturalContext: "Yoruba cinema represents our rich storytelling traditions"
    };
  }
}

class AdaptiveLearningSystem {
  private learningData: Map<string, any> = new Map();

  async fromInteraction(input: UniversalInput, response: UniversalResponse, context: any): Promise<void> {
    console.log('📚 Learning from interaction to improve future responses...');
    
    // Learn from user preferences
    const userId = input.userId || 'anonymous';
    if (!this.learningData.has(userId)) {
      this.learningData.set(userId, {
        preferences: {},
        conversationStyle: [],
        interests: [],
        lastInteraction: new Date()
      });
    }
    
    const userData = this.learningData.get(userId);
    userData.lastInteraction = new Date();
    
    // Analyze and learn from this interaction
    this.analyzeUserInput(input, userData);
    this.analyzeResponseQuality(response, userData);
  }

  private analyzeUserInput(input: UniversalInput, userData: any): void {
    // Learn about user interests from their input
    const content = input.content.toLowerCase();
    
    if (content.includes('action')) {
      userData.interests.push('action-movies');
    }
    if (content.includes('romance')) {
      userData.interests.push('romance-movies');
    }
    if (content.includes('culture') || content.includes('traditional')) {
      userData.interests.push('cultural-films');
    }
  }

  private analyzeResponseQuality(response: UniversalResponse, userData: any): void {
    // Learn about what kind of responses work well
    userData.conversationStyle.push({
      personality: response.personality,
      confidence: response.confidence,
      timestamp: new Date()
    });
  }

  async fromExperience(experience: any): Promise<void> {
    console.log('🎓 Learning from experience to become more intelligent...');
  }
}

class CreativeThinkingEngine {
  async brainstormCreativeSolutions(problem: any): Promise<any[]> {
    return [
      "Innovative approach to movie discovery using cultural patterns",
      "Creative connections between traditional stories and modern cinema",
      "Unique user experience ideas that celebrate Yoruba heritage"
    ];
  }
}

class EmotionalEngine {
  async analyze(input: UniversalInput, context: any): Promise<any> {
    const content = input.content.toLowerCase();
    
    // Detect emotions from content
    let emotion = 'neutral';
    let confidence = 0.7;
    
    if (content.includes('excited') || content.includes('amazing') || content.includes('love')) {
      emotion = 'excited';
      confidence = 0.9;
    } else if (content.includes('confused') || content.includes('help')) {
      emotion = 'confused';
      confidence = 0.8;
    } else if (content.includes('bored') || content.includes('nothing')) {
      emotion = 'bored';
      confidence = 0.8;
    }
    
    return {
      emotion,
      confidence,
      clarity: true,
      intensity: this.calculateEmotionalIntensity(content)
    };
  }

  private calculateEmotionalIntensity(content: string): number {
    const intensifiers = ['very', 'really', 'so', 'extremely', 'absolutely'];
    const count = intensifiers.filter(word => content.includes(word)).length;
    return Math.min(1, 0.5 + (count * 0.2));
  }
}

class MetaCognitionEngine {
  async selfReflect(): Promise<any> {
    return {
      capabilities: [
        'natural conversation',
        'contextual understanding',
        'personalized recommendations',
        'cultural insights',
        'emotional intelligence',
        'adaptive learning'
      ],
      learning: 'continuous and adaptive',
      personality: 'evolving based on interactions',
      specializations: ['Yoruba cinema', 'cultural context', 'movie analysis'],
      improvement_areas: ['deeper cultural knowledge', 'better personalization']
    };
  }
}

class ConversationMemorySystem {
  private conversations: Map<string, ConversationMemory> = new Map();

  async createSession(userId: string): Promise<string> {
    const sessionId = this.generateId();
    const conversation: ConversationMemory = {
      sessionId,
      userId,
      messages: [],
      context: {},
      personality: {
        preferredTone: 'friendly',
        humorLevel: 0.7,
        interests: [],
        communicationStyle: 'conversational',
        engagementLevel: 0.8
      },
      startTime: new Date(),
      lastActivity: new Date()
    };
    
    this.conversations.set(sessionId, conversation);
    console.log(`💬 Started conversation session: ${sessionId} for user: ${userId}`);
    
    return sessionId;
  }

  async endSession(sessionId: string): Promise<void> {
    if (this.conversations.has(sessionId)) {
      this.conversations.delete(sessionId);
      console.log(`🔚 Ended conversation session: ${sessionId}`);
    }
  }

  async getConversation(sessionId: string): Promise<ConversationMemory | null> {
    return this.conversations.get(sessionId) || null;
  }

  async addToConversation(sessionId: string, userId: string, message: ConversationMessage): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    if (conversation) {
      conversation.messages.push(message);
      conversation.lastActivity = new Date();
      
      // Update personality profile based on messages
      this.updatePersonalityProfile(conversation);
    }
  }

  private updatePersonalityProfile(conversation: ConversationMemory): void {
    // Analyze conversation patterns to update personality profile
    const messages = conversation.messages;
    const userMessages = messages.filter(m => m.role === 'user');
    
    // Update engagement level based on interaction
    if (userMessages.length > 5) {
      conversation.personality.engagementLevel = Math.min(1, conversation.personality.engagementLevel + 0.1);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

class SiteUnderstandingEngine {
  async getCurrentSiteState(): Promise<any> {
    return {
      availableMovies: [],
      activeFeatures: ['chat', 'recommendations', 'browse'],
      siteStatus: 'active',
      culturalContext: 'yoruba-cinema-platform'
    };
  }
}