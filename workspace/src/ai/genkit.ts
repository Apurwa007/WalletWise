
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Ensure GOOGLE_API_KEY is loaded from .env
if (!process.env.GOOGLE_API_KEY) {
  console.warn(
    'CRITICAL: GOOGLE_API_KEY is not set in the environment variables. Genkit Google AI plugin will likely fail. Check your .env file.'
  );
} else if (process.env.GOOGLE_API_KEY === "YOUR_GOOGLE_AI_API_KEY" || process.env.GOOGLE_API_KEY.startsWith("AIzaSyYOUR_") ) {
  console.warn(
    'CRITICAL: GOOGLE_API_KEY in .env seems to be a placeholder value. Genkit Google AI plugin will fail. Please provide a valid API key.'
  );
}


export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY, // Explicitly pass the API key
    }),
  ],
  // Default model for ai.generate if not specified in the call
  // It's generally better to specify the model in the prompt definition itself
  // or ensure it's correctly passed during the ai.generate call.
  // model: 'googleai/gemini-pro',
});
