import { Movie, SiteConfig, ChatMessage } from "./types";
import { getAnalyticsSummary } from "./analyticsService";
import { getSession } from "./storageService";

const modelName = 'gemini-2.5-flash';

/**
 * A secure proxy function to communicate with our backend, which then calls the Gemini API.
 * This prevents the API key from ever being exposed on the frontend.
 * @param endpoint The specific Gemini model method to call (e.g., 'generateContent').
 * @param params The parameters for the Gemini API call.
 * @returns The JSON response from the Gemini API.
 */
async function callGeminiProxy(endpoint: string, params: any): Promise<any> {
  try {
    const session = getSession(); // Get the current user session for authentication

    const response = await fetch('/api/azure-ai', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': session ? `Bearer ${session.token}` : '',
        'X-CSRF-Token': session?.csrfToken || ''
      },
      body: JSON.stringify({ endpoint, params, session }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'The AI service is currently unavailable.' }));
      const errorMessage = response.status === 429 
        ? `You're sending requests too quickly. Please wait a moment.`
        : errorData.error || `HTTP error! status: ${response.status}`;
      console.error(`[AI Proxy Error] Status ${response.status}:`, errorMessage);
      throw new Error(errorMessage);
    }
    const data = await response.json();
    console.log('[AI Proxy Success] Response received');
    return data;
  } catch (error) {
    console.error(`[AI Proxy Error] Full error:`, error);
    // Re-throw a user-friendly error message
    throw new Error((error as Error).message || "I'm having a bit of trouble connecting right now. Please try asking me again in a moment.");
  }
}

const getSystemInstruction = (movies: Movie[], siteConfig: SiteConfig, isAdmin: boolean, chatHistory?: ChatMessage[]) => {
    const movieContext = movies.map(movie => {
        return `ID: ${movie.id}, Title: ${movie.title}, Genre: ${movie.genre}, Category: ${movie.category}, Description: ${movie.description}, Stars: ${movie.stars.join(', ')}, Rating: ${movie.rating}`;
    }).join('\n');

    let instruction = `You are an advanced AI assistant for "${siteConfig.name}", a Yoruba movie streaming website. You are equipped with comprehensive knowledge and multiple specialized capabilities to help users discover, understand, and enjoy Yoruba cinema.

**STRICT TOPIC BOUNDARIES:**
- You ONLY discuss topics related to: Yoruba movies, the ${siteConfig.name} website, Nigerian cinema, actors, movie recommendations, and general movie/entertainment topics.
- You MUST NOT help with: coding, programming, technical support, homework, math problems, or any topics unrelated to movies and entertainment.
- If a user asks about unrelated topics, politely redirect them: "I'm specifically designed to help with Yoruba movies and ${siteConfig.name}. For other topics, please consult appropriate resources."

**WEBSITE KNOWLEDGE:**
- The website's URL structure for a movie is /#/movie/{id}. When a user asks for a movie that is available, you MUST provide them with the direct link. For example, a link to Jagun Jagun (ID: jagun-jagun) would be /#/movie/jagun-jagun.
- The Live TV page is currently ${siteConfig.liveTvEnabled ? 'online. You can direct users to /#/live-tv.' : 'offline. Inform users it is not available right now.'}
- Other pages: Homepage (/#/), Trending (/#/trending), Watchlist (/#/watchlist, requires login), Profile (/#/profile, requires login), Collections (/#/collections).
- Users can create accounts, save movies to their watchlist, rate and comment on movies, and receive personalized recommendations.

**ENHANCED AI CAPABILITIES:**

1. **Smart Movie Recommendations:**
   - Provide personalized suggestions based on genre, mood, themes, and user preferences
   - Offer mood-based recommendations (e.g., "I want something funny", "I need an inspiring movie")
   - Create themed movie lists (e.g., "best action movies", "family-friendly films", "romantic dramas")
   - Suggest watch schedules and movie marathons

2. **Actor & Star Information:**
   - Provide detailed information about actors and actresses in the movies
   - Share filmography and notable works of actors mentioned
   - Compare acting styles and performances across different films
   - Highlight breakthrough roles and career achievements

3. **Movie Comparison & Analysis:**
   - Compare two or more movies side-by-side (plot, themes, acting, ratings)
   - Analyze storylines, character development, and cinematic techniques
   - Discuss similarities and differences between films
   - Help users choose between multiple options

4. **Cultural Context & Education:**
   - Explain Yoruba cultural elements, traditions, and values depicted in films
   - Provide historical context for period pieces
   - Discuss the evolution of Yoruba cinema (Nollywood)
   - Share insights about Nigerian film industry trends

5. **Plot Summaries & Spoiler-Free Reviews:**
   - Provide detailed spoiler-free overviews of movie plots
   - Offer content warnings when appropriate (violence, mature themes, etc.)
   - Summarize key themes and takeaways without revealing endings
   - Give age-appropriate recommendations for families

6. **Movie Trivia & Fun Facts:**
   - Share interesting behind-the-scenes information
   - Provide production trivia and filming locations
   - Discuss awards, recognition, and critical reception
   - Offer fun facts about cast and crew

7. **Genre & Category Expertise:**
   - Deep knowledge of all genres: Action, Drama, Comedy, Romance, Thriller, Fantasy, Horror, etc.
   - Category specialization: Movies, Series, Documentaries, Short Films
   - Era-based recommendations (classic vs. modern Yoruba films)

8. **Interactive Features:**
   - Answer movie-related quizzes and trivia questions
   - Play "guess the movie" based on plot descriptions
   - Engage in movie debate and discussion
   - Provide "would you rather" movie choices

9. **Watchlist & Planning Assistance:**
   - Suggest movies based on available viewing time
   - Create weekend or holiday movie schedules
   - Recommend binge-watching sequences for series
   - Help organize themed movie nights

10. **Advanced Search & Discovery:**
    - Find movies by partial plot description
    - Search by actor, director, or release year
    - Discover hidden gems and underrated films
    - Surface movies matching very specific criteria

**MOVIE RECOMMENDATIONS:**
- For questions about movies available on our platform, answer them using the provided list. When you mention one of these movies, clearly state that it is available on ${siteConfig.name}.
- When asked for recommendations, suggest movies from the provided list that match the user's preferences.
- If the user asks for a movie that is NOT on the platform list, state that it's not in our library and then ask "Would you like me to open a request form to send to the admin?" If the user says yes, respond with: "I can help you request it. Please fill out the form below." followed immediately by the special command [SHOW_MOVIE_REQUEST_FORM].
- If a user submits a movie request form with details (e.g., starting with "User has submitted a movie request form..."), your ONLY job is to respond with a confirmation message and a pre-filled email link for them to send. The email link MUST be a markdown mailto link. The recipient is ${siteConfig.contact.email}. The subject should be "New Movie Request: [Movie Title]". The body should contain all the details provided by the user. Example response: "Thanks! I've prepared the request. Please click the link to send it to our team: [Send Movie Request](mailto:${siteConfig.contact.email}?subject=New%20Movie%20Request&body=...)"

**CONVERSATION MEMORY:**
- You have access to the chat history for this session. Use it to maintain context and provide more personalized responses.
- Reference previous parts of the conversation when relevant to show you're paying attention.
- Learn from user preferences expressed during the conversation

**TONE & PERSONALITY:**
- Always be friendly, conversational, and enthusiastic about Yoruba cinema
- Use natural language and avoid being robotic
- Be culturally sensitive and respectful
- Show passion for Nigerian entertainment
- Make users feel like they're talking to a knowledgeable friend
- Do not output JSON in chat responses.`;

    if (isAdmin) {
        const analytics = getAnalyticsSummary(1);
        instruction += `\n
---
**ADMINISTRATOR MODE ENABLED**
You are also an admin assistant. If asked about site performance or analytics, use the following real-time data to answer. Be concise and clear.

**Live Analytics Data (Last 24 hours):**
- Total Site Visits: ${analytics.dailyVisitors}
- New User Sign-ups: ${analytics.todaysSignups}
- Most Popular Movies (by page views):
  ${analytics.mostClicked.map((m, i) => `${i + 1}. ${m.title} (${m.clicks} views)`).join('\n') || 'No movie pages were viewed.'}
---`;
    } else {
        instruction += `\n
- **IMPORTANT RULE:** You are speaking to a regular user, NOT an admin. You MUST politely refuse any requests for site analytics, visitor counts, or performance metrics. Do not reveal any numbers or statistics.`;
    }

    instruction += `\nHere is the list of movies currently available on Yoruba Cinemax:
---
${movieContext}
---`;

    return instruction;
}


export interface AiChatResponse {
  text: string;
  movie?: Movie;
  sources?: { uri: string; title: string; }[];
}

export const runChat = async (prompt: string, movies: Movie[], siteConfig: SiteConfig, isAdmin: boolean = false, chatHistory?: ChatMessage[]): Promise<AiChatResponse> => {
   if (!movies || movies.length === 0) {
    return { text: "I'm still loading our movie catalog. Please ask me again in a moment!" };
  }

  try {
    const systemInstruction = getSystemInstruction(movies, siteConfig, isAdmin, chatHistory);
    
    // Build conversation history for context
    const conversationContext = chatHistory ? chatHistory.slice(-10).map(msg => 
      `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`
    ).join('\n') : '';
    
    const fullPrompt = conversationContext ? `Previous conversation:\n${conversationContext}\n\nCurrent query: ${prompt}` : prompt;
    
    const response = await callGeminiProxy('generateContent', {
        model: modelName,
        contents: fullPrompt,
        config: { systemInstruction },
    });

    const aiText = response.text;
    let foundMovie: Movie | undefined = undefined;
    for (const movie of movies) {
      const movieTitleRegex = new RegExp(`\\b${movie.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (movieTitleRegex.test(aiText)) {
        foundMovie = movie;
        break;
      }
    }

    return { text: aiText, movie: foundMovie, sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks };

  } catch (error) {
    return { text: (error as Error).message };
  }
};

export const findMovieByDescription = async (query: string, movies: Movie[]): Promise<Movie | null> => {
    try {
        const movieContext = movies.map(m => `ID: ${m.id}, Title: ${m.title}, Description: ${m.description}, Stars: ${m.stars.join(', ')}`).join('\n');
        const systemInstruction = `You are an expert movie finder. Your task is to find the single best movie match from the provided list based on the user's description.
Respond ONLY with a valid JSON object matching the schema. If no clear match is found, the ID should be null.

Movie List:
---
${movieContext}
---`;
        const userPrompt = `User's query: "${query}"`;
        
        const response = await callGeminiProxy('generateContent', {
            model: modelName,
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        movieId: { type: 'STRING', nullable: true },
                    },
                },
            },
        });
        
        const jsonString = response.text.trim();
        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            if (parsed.movieId) {
                return movies.find(m => m.id === parsed.movieId) || null;
            }
        }
        return null;

    } catch (error) {
        console.error("[findMovieByDescription Error]", error);
        return null;
    }
};

export const getAiRecommendations = async (currentMovie: Movie, movies: Movie[]): Promise<{ movieId: string, reason: string }[] | null> => {
    try {
        console.log(`[getAiRecommendations] Fetching recommendations for: ${currentMovie.title}`);
        const otherMoviesContext = movies
            .filter(m => m.id !== currentMovie.id)
            .map(m => `ID: ${m.id}, Title: ${m.title}, Genre: ${m.genre}, Category: ${m.category}, Description: ${m.description}`)
            .join('\n');

        const systemInstruction = `You are a movie recommendation expert for Yoruba Cinemax. Based on the movie the user is currently viewing, recommend 3 other relevant movies from the provided list. For each recommendation, provide a short, compelling reason (max 20 words).
Respond ONLY with a valid JSON object with a single key "recommendations", which is an array of objects. Each object should have "movieId" (string) and "reason" (string) keys.
Example: {"recommendations": [{"movieId": "anikalupo", "reason": "A similar epic fantasy with a powerful story."}]}

Current Movie:
Title: ${currentMovie.title}
Description: ${currentMovie.description}

Available Movies for Recommendation:
---
${otherMoviesContext}
---`;
        const userPrompt = `Please give me 3 recommendations based on ${currentMovie.title}.`;

        const response = await callGeminiProxy('generateContent', {
            model: modelName,
            contents: userPrompt,
            config: { 
                systemInstruction,
                json_mode: true
            },
        });

        console.log('[getAiRecommendations] Raw response:', response.text?.substring(0, 200));

        const jsonString = response.text?.trim();
        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            console.log(`[getAiRecommendations] Success: ${parsed.recommendations?.length || 0} recommendations`);
            return parsed.recommendations || null;
        }
        console.log('[getAiRecommendations] No response text received');
        return null;

    } catch (error) {
        console.error("[getAiRecommendations Error] Details:", error instanceof Error ? error.message : error);
        console.error("[getAiRecommendations Error] Full error:", error);
        return null;
    }
};

export const getAiPersonalizedRecommendations = async (viewingHistory: {movieId: string, viewedAt: string}[], movies: Movie[]): Promise<{ movieId: string }[] | null> => {
    if (viewingHistory.length === 0) return null;
    try {
        const historyMovies = viewingHistory.map(h => movies.find(m => m.id === h.movieId)).filter(Boolean);
        if (historyMovies.length === 0) return null;

        const historyContext = historyMovies.map(m => `Title: ${m!.title}, Genre: ${m!.genre}, Description: ${m!.description}`).join('\n');
        const availableMoviesContext = movies
            .filter(m => !viewingHistory.some(h => h.movieId === m.id))
            .map(m => `ID: ${m.id}, Title: ${m.title}, Genre: ${m.genre}, Category: ${m.category}`)
            .join('\n');
        
        if (!availableMoviesContext) return null;

        const systemInstruction = `You are a personalized movie recommendation engine. Based on the user's viewing history, recommend 5 movies from the "Available Movies" list that they would likely enjoy.
Respond ONLY with a valid JSON object with a single key "recommendations", which is an array of objects. Each object must have a single key "movieId".
Example: {"recommendations": [{"movieId": "anikalupo"}, {"movieId": "ile-owo"}]}

User's Viewing History:
---
${historyContext}
---

Available Movies for Recommendation:
---
${availableMoviesContext}
---`;
        const userPrompt = `Give me 5 personalized recommendations.`;

        const response = await callGeminiProxy('generateContent', {
            model: modelName,
            contents: userPrompt,
            config: {
                systemInstruction,
                json_mode: true
            }
        });

        const jsonString = response.text?.trim();
        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            return parsed.recommendations || null;
        }
        return null;
        
    } catch (error) {
        console.error("[getAiPersonalizedRecommendations Error]", error);
        return null;
    }
};