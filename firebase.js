// firebase.js
// -----------------------------------------------------------------------------
// Single source of truth for Firebase setup. Replace firebaseConfig with the
// values from Firebase Console → Project settings → General → Your apps → SDK
// setup and configuration. Nothing else in the project needs to change.
// -----------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ⚠️ REPLACE THESE VALUES — see README.md "Connect Firebase"
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Offline caching so the public site still renders content that was
// already fetched once, even with a flaky connection.
enableIndexedDbPersistence(db).catch(() => {
  // Multiple tabs open, or unsupported browser — safe to ignore.
});

export { app, auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut };
