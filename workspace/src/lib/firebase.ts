
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

let app: FirebaseApp | undefined = undefined;
let firestore: Firestore | undefined = undefined;

let criticalConfigError = false;

// Check for missing or placeholder Firebase config values
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_") || firebaseConfig.apiKey === "") {
  console.error("CRITICAL ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing or a placeholder in .env. Firebase cannot be initialized.");
  criticalConfigError = true;
}
if (!firebaseConfig.projectId || firebaseConfig.projectId.startsWith("YOUR_") || firebaseConfig.projectId === "") {
  console.error("CRITICAL ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is missing or a placeholder in .env. Firebase cannot be initialized.");
  criticalConfigError = true;
}

// Log warnings for other non-critical but potentially problematic configurations
if (!criticalConfigError) {
  let configWarningLogged = false;
  for (const [key, value] of Object.entries(firebaseConfig)) {
    if (value === undefined || value === "" || (typeof value === 'string' && value.startsWith("YOUR_"))) {
      if (!configWarningLogged) {
        console.warn("Firebase configuration issue detected in src/lib/firebase.ts. Check your .env file:");
        configWarningLogged = true;
      }
      const envVarName = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
      // Avoid double logging critical errors already handled above
      if (!((key === 'apiKey' || key === 'projectId') && criticalConfigError)) {
          console.warn(`- ${key} (from env variable ${envVarName}) seems to be using a placeholder, is undefined, or empty: "${String(value)}".`);
      }
    }
  }
  if (configWarningLogged) {
    console.warn("Ensure your .env file (at the project root) is correctly set up and your Next.js server has been restarted after changes to .env.");
  }
}


if (!criticalConfigError) {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("CRITICAL ERROR: Firebase app initializeApp(firebaseConfig) failed. This is likely due to invalid or missing Firebase configuration. Detailed error:", e);
      criticalConfigError = true; // Mark as critical if initialization itself fails
    }
  } else {
    app = getApps()[0];
  }

  if (app) { // Check if app was successfully initialized
    try {
      firestore = getFirestore(app);
    } catch (e) {
      console.error("CRITICAL ERROR: Failed to initialize Firestore (getFirestore(app)). This can happen if Firebase app initialization failed or if there are issues with the Firestore service itself. Detailed error:", e);
      // firestore will remain undefined, and actions will fail.
    }
  } else if (!criticalConfigError) { // If app is not initialized and not due to prior critical config error
     console.error("CRITICAL ERROR: Firebase app not properly initialized, Firestore cannot be initialized.");
  }
} else {
    console.error("CRITICAL ERROR: Due to missing or placeholder API Key or Project ID, Firebase initialization was skipped. Firestore will not be available.");
}

// Export even if undefined, so consuming modules don't break at import time,
// but they will break at runtime if they try to use an undefined firestore.
// The actions.ts file has checks for undefined firestore.
export { app, firestore };
