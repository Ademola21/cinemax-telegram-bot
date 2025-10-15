# Cinemax AI Platform - Intelligent Movie Streaming Platform

A comprehensive Yoruba movie streaming platform powered by our custom **Cinemax AI** - an intelligent, culturally-aware AI system with personality, memory, and learning capabilities.

## 🚀 **Overview**

Cinemax AI Platform represents a breakthrough in AI-powered entertainment, featuring:
- **Custom Cinemax AI Engine** with personality and emotional intelligence
- **Cultural Intelligence** deeply understanding Yoruba cinema and traditions
- **Conversation Memory** for contextual, personalized interactions
- **Zero External Dependencies** - completely self-hosted AI services
- **Adaptive Learning** - improves with every user interaction

## 🏗️ **Architecture**

### **Cinemax AI Core**
- **Multi-layer Architecture**: Personality → Reasoning → Knowledge → Learning → Creativity
- **Memory System**: Maintains conversation context across sessions
- **Cultural Intelligence**: Specialized knowledge of Yoruba movies and Nollywood
- **Emotional Expression**: Responds with personality and empathy

### **Technology Stack**
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **AI Engine**: Custom Cinemax AI (no external dependencies)
- **Database**: File-based JSON with Prisma ORM
- **Video**: HLS.js for adaptive streaming
- **Bot**: Telegram Bot API for administration

## 🎬 **Features**

### **AI-Powered Features**
- **Intelligent Chat**: Conversational AI with memory and personality
- **Smart Recommendations**: Context-aware movie suggestions
- **Cultural Insights**: Deep understanding of Yoruba cinema traditions
- **Creative Content**: AI-generated movie descriptions and metadata
- **Natural Language Search**: Find movies using conversational queries

### **Platform Features**
- **Movie Streaming**: HLS video playback with seeking support
- **YouTube Integration**: Download functionality using yt-dlp-exec
- **User Management**: Authentication, watchlists, viewing history
- **Telegram Bot**: Complete admin interface for content management
- **Responsive Design**: Modern UI optimized for all devices

## 🛠️ **Development**

```bash
# Install dependencies
npm install

# Start development server (frontend + backend)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📱 **Environment Variables**

Create `.env` file with your configuration:

```env
# Telegram Bot (for admin features)  
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_ID=your_admin_id

# Azure Storage (for poster uploads - optional)
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_CONTAINER_NAME=media
CDN_BASE_URL=your_cdn_url

# YouTube API (for video metadata - optional)
YOUTUBE_API_KEY=your_youtube_api_key
```

**Note**: All core features work without external API keys. Cinemax AI is completely self-hosted.

## 🤖 **Cinemax AI Capabilities**

### **Personality & Intelligence**
- **Cultural Expert**: Deep knowledge of Yoruba cinema and traditions
- **Conversational Memory**: Remembers context across chat sessions
- **Emotional Intelligence**: Responds with empathy and personality
- **Learning System**: Improves responses based on user interactions

### **AI Services**
- **Chat Assistant**: Natural conversations about movies and cinema
- **Movie Recommendations**: Personalized suggestions based on preferences
- **Content Analysis**: Intelligent movie descriptions and metadata
- **Customer Support**: Help with platform navigation and features
- **Creative Generation**: Movie descriptions, summaries, and promotional content

### **Integration Points**
- **Web Chat**: AI popup for user assistance
- **Telegram Bot**: AI-powered admin assistance
- **Movie Manager**: AI-generated descriptions and metadata
- **API Endpoints**: `/api/cinemax-ai` for all AI services

## 🎯 **Key Components**

### **AI Core Files**
```
src/ai/
├── model/CinemaxAI.ts          # Core AI model with personality
├── services/CinemaxAIService.ts # AI service layer
└── memory/ChatMemorySystem.ts   # Conversation memory
```

### **Integration Files**
```
src/
├── services/aiService.ts       # Main AI service interface
├── components/AiChatPopup.tsx  # Web chat interface
└── app/api/cinemax-ai/route.ts # API endpoint
```

## 📊 **Benefits of Cinemax AI**

### **Technical Benefits**
- **Zero API Costs**: No external AI service fees
- **Privacy Control**: All data processed locally
- **Customizable**: Tailored specifically for Yoruba cinema
- **Scalable**: Handles growing user base without API limits

### **User Experience Benefits**
- **Cultural Relevance**: Understands Yoruba movie context and traditions
- **Consistent Personality**: Familiar, engaging AI assistant
- **Memory**: Remembers user preferences and conversation history
- **Learning**: Gets better with every interaction

## 🔧 **VPS Deployment**

For production deployment instructions, see `VPS-DEPLOYMENT.md`.

### **Production Requirements**
- Node.js 18+
- 2GB RAM minimum
- 10GB storage minimum
- No external AI API keys required

## 📄 **License**

ISC License - See LICENSE file for details.

---

**Built with ❤️ and Cinemax AI for Yoruba cinema enthusiasts**