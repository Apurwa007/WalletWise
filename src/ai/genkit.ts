
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Ensure GOOGLE_API_KEY is loaded from .env
if (!process.env.GOOGLE_API_KEY) {
  console.warn(
    'GOOGLE_API_KEY is not set in the environment variables. Genkit Google AI plugin may not work.'
  );
  // Optionally, you could throw an error here to prevent startup if the key is critical
  // throw new Error('Missing GOOGLE_API_KEY for Genkit Google AI plugin');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY, // Explicitly pass the API key
    }),
  ],
  // Default model for ai.generate if not specified in the call
  // model: 'googleai/gemini-pro', // Example: if you want a default text model
});
