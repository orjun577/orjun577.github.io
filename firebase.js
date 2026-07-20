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
  apiKey: "AIzaSyDCp9emgYEFK9gh_XmwzgprbqVw2jg1bf0",
  authDomain: "orjun577.firebaseapp.com",
  projectId: "orjun577",
  storageBucket: "orjun577.firebasestorage.app",
  messagingSenderId: "997334790469",
  appId: "1:997334790469:web:16a84990457915044b8e2c",
  measurementId: "G-0HLR5SPVK8",
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
