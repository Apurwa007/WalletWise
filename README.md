# WalletWise - Smart Payment Optimization

WalletWise is a Next.js application designed to help users make smart payment choices by leveraging AI-powered recommendations. It features a checkout simulation, a user dashboard for tracking savings and financial goals, and a profile management page.

## Features

- **Smart Payment Recommendations:** AI suggests the best payment method based on cart total, purchase category, and available offers to maximize savings.
- **Checkout Simulation:** Users can input a cart total and category to see recommendations in action.
- **User Dashboard:** Visualizes monthly savings, progress towards financial goals, and recent transactions.
- **Profile Management:** Users can set financial goals and manage their saved payment methods.
- **Dynamic Offer Handling:** Incorporates mock bank offers and can be extended with real offer data.
- **Firestore Integration:** Stores user transactions for persistence and analysis.
- **Genkit for AI:** Utilizes Genkit for interacting with Google's Generative AI models.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** ShadCN UI
- **AI Integration:** Genkit (with Google AI)
- **Database:** Firebase Firestore
- **State Management:** React Hooks (useState, useMemo, useEffect, useActionState)

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js) or [Yarn](https://yarnpkg.com/)

## Getting Started

Follow these steps to set up and run the project locally:

### 1. Clone the Repository (or Download ZIP)

If you have downloaded a ZIP file, extract it to your desired directory. If you are cloning from a Git repository:

```bash
git clone <repository-url>
cd walletwise-project # Or your project's directory name
```

### 2. Set Up Environment Variables

This project requires environment variables for Firebase and Google AI (Genkit) to function correctly.

Create a `.env` file in the root of your project (e.g., alongside `package.json`). Copy the contents of `.env.example` (if one exists) or add the following variables, replacing the placeholder values with your actual credentials:

```env
# Google AI (Genkit)
GOOGLE_API_KEY=YOUR_GOOGLE_AI_API_KEY

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

**How to get these values:**

*   **`GOOGLE_API_KEY`**:
    *   Go to the [Google AI Studio](https://aistudio.google.com/app/apikey).
    *   Create or use an existing API key.
*   **Firebase Variables (`NEXT_PUBLIC_FIREBASE_...`)**:
    *   Go to your [Firebase Console](https://console.firebase.google.com/).
    *   Select your project (or create a new one).
    *   Go to **Project settings** (click the gear icon ⚙️ next to "Project Overview").
    *   Under the "General" tab, scroll down to "Your apps".
    *   If you haven't registered a web app, click the **</>** (web) icon to add one.
    *   The Firebase SDK setup snippet will contain your `firebaseConfig` object. Copy the corresponding values into your `.env` file.

**Important:** Restart your development server after creating or modifying the `.env` file for the changes to take effect.

### 3. Install Dependencies

Navigate to the project's root directory in your terminal and run one of the following commands, depending on your package manager:

Using npm:
```bash
npm install
```

Using Yarn:
```bash
yarn install
```

### 4. Set Up Firestore (Database)

This application uses Firebase Firestore to store transaction data.

1.  **Enable Firestore:**
    *   In your Firebase Console, go to **Firestore Database** (under the "Build" section).
    *   Click **Create database**.
    *   Choose **Start in test mode** for initial development (allows open reads/writes).
        *   **Security Warning:** For production, you **must** configure proper [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started).
    *   Select a Cloud Firestore location (choose one close to your users).
    *   Click **Enable**.

2.  **Required Firestore Index (if not automatically created by app usage):**
    The application's dashboard query for transactions requires a composite index. If you encounter an error message in your browser console or server logs mentioning a missing index when viewing the dashboard, Firebase will typically provide a direct link to create it.
    The index generally involves:
    *   Collection: `transactions`
    *   Fields: `userId` (Ascending), `createdAt` (Descending)
    You can create this manually in the Firestore console under `Indexes` -> `Composite` -> `Add Index`.

### 5. Run the Development Server

Once dependencies are installed and environment variables are set, you can start the Next.js development server:

Using npm:
```bash
npm run dev
```

Using Yarn:
```bash
yarn dev
```

This will typically start the application on `http://localhost:9002` (as per your `package.json` dev script). Open this URL in your browser to see the application.

### 6. Run Genkit Development Server (for AI features)

Genkit flows (like the smart payment suggestion) run in a separate development server. To enable AI features, you need to run this alongside your Next.js app.

Open a **new terminal window/tab**, navigate to the project root, and run:
```bash
npm run genkit:dev
```
Or, if you prefer watching for changes in your Genkit flows:
```bash
npm run genkit:watch
```

This will typically start the Genkit server (often on port 3400) and make the AI flows available for your Next.js application to call.

## Application Structure

-   `src/app/`: Contains the Next.js pages (App Router).
    -   `page.tsx`: Checkout page.
    -   `dashboard/page.tsx`: User dashboard.
    -   `profile/page.tsx`: User profile and settings.
-   `src/components/`: Shared React components.
    -   `ui/`: ShadCN UI components.
    -   `layout/`: Layout components like the header.
-   `src/lib/`: Core logic, types, mock data, and utility functions.
    -   `actions.ts`: Server Actions for form submissions and data mutations.
    -   `firebase.ts`: Firebase initialization.
    -   `mockData.ts`: Mock user profiles, payment methods, and offers.
    -   `types.ts`: TypeScript type definitions.
-   `src/ai/`: Genkit related files.
    -   `genkit.ts`: Genkit global configuration.
    -   `flows/`: Genkit flow definitions (e.g., `smart-payment-suggestion.ts`).
-   `public/`: Static assets.
-   `package.json`: Project dependencies and scripts.
-   `tailwind.config.ts`: Tailwind CSS configuration.
-   `next.config.ts`: Next.js configuration.

## Available Scripts

In the project directory, you can run:

-   `npm run dev` or `yarn dev`: Starts the Next.js development server (usually on port 9002).
-   `npm run genkit:dev` or `yarn genkit:dev`: Starts the Genkit development server.
-   `npm run genkit:watch` or `yarn genkit:watch`: Starts the Genkit development server with watch mode.
-   `npm run build` or `yarn build`: Builds the application for production.
-   `npm run start` or `yarn start`: Starts a production server (after building).
-   `npm run lint` or `yarn lint`: Lints the codebase using Next.js's built-in ESLint configuration.
-   `npm run typecheck` or `yarn typecheck`: Runs TypeScript type checking.

## Troubleshooting

-   **Environment Variables Not Loaded:** Ensure your `.env` file is in the project root and you've restarted the development server after changes.
-   **Firebase Errors:**
    -   Check that your Firebase project ID and API key in `.env` are correct.
    -   Ensure Firestore is enabled in your Firebase project and that security rules (for development) allow reads/writes.
    -   Look for console errors related to Firestore indexes and create them if prompted.
-   **Genkit Errors:**
    -   Ensure your `GOOGLE_API_KEY` is valid and correctly set in `.env`.
    -   Make sure the Genkit development server (`npm run genkit:dev`) is running in a separate terminal.
-   **Type Errors:** Run `npm run typecheck` to identify TypeScript issues.

Happy coding!