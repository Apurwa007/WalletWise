
// @ts-nocheck
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let firestore: Firestore;

// Check for placeholder values and log warnings
let configWarningLogged = false;
let criticalConfigError = false;

// Check if critical Firebase config values are missing or are placeholders
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_") || firebaseConfig.apiKey === "") {
  console.error("CRITICAL ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing or a placeholder in .env. Firebase cannot be initialized.");
  criticalConfigError = true;
}
if (!firebaseConfig.projectId || firebaseConfig.projectId.startsWith("YOUR_") || firebaseConfig.projectId === "") {
  console.error("CRITICAL ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is missing or a placeholder in .env. Firebase cannot be initialized.");
  criticalConfigError = true;
}

// Log warnings for other non-critical but potentially problematic configurations
for (const [key, value] of Object.entries(firebaseConfig)) {
  if (value === undefined || value === "" || (typeof value === 'string' && (value.startsWith("YOUR_")))) {
    if (!configWarningLogged) {
      console.warn("Firebase configuration issue detected in src/lib/firebase.ts. Check your .env file:");
      configWarningLogged = true;
    }
    const envVarName = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    if (!(key === 'apiKey' && criticalConfigError) && !(key === 'projectId' && criticalConfigError)) { // Avoid double logging critical errors
        console.warn(`- ${key} (from env variable ${envVarName}) seems to be using a placeholder, is undefined, or empty: "${value}".`);
    }
  }
}

if (configWarningLogged && !criticalConfigError) {
  console.warn("Ensure your .env file (at the project root) is correctly set up and your Next.js server has been restarted after changes to .env.");
}


if (!getApps().length) {
  if (criticalConfigError) {
    // Error already logged, firestore will remain undefined and operations will fail.
    // Throwing here would stop the server, which might be too disruptive for some init flows.
    // Actions relying on Firebase will fail later, which is now handled with specific error messages.
  } else {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("CRITICAL ERROR: Firebase app initializeApp(firebaseConfig) failed. This is likely due to invalid or missing Firebase configuration. Detailed error:", e);
      criticalConfigError = true; // Mark as critical if initialization itself fails
    }
  }
} else {
  app = getApps()[0];
}

if (app && !criticalConfigError) {
  try {
    firestore = getFirestore(app);
  } catch (e) {
    console.error("CRITICAL ERROR: Failed to initialize Firestore (getFirestore(app)). This can happen if Firebase app initialization failed or if there are issues with the Firestore service itself. Detailed error:", e);
    // firestore will remain undefined, and actions will fail.
  }
} else {
    if (!criticalConfigError) { // If not already logged as a critical config error
        console.error("CRITICAL ERROR: Firebase app not properly initialized or critical config missing, Firestore cannot be initialized.");
    }
}

// Export even if undefined, so consuming modules don't break at import time,
// but they will break at runtime if they try to use an undefined firestore.
// The actions.ts file has checks for undefined firestore.
export { app, firestore };
