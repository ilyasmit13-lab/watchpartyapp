import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration provided by User
const firebaseConfig = {
    apiKey: "AIzaSyAgLp5wPhrPPJNZZ8jUsb9QhZDBs_SMHrY",
    authDomain: "enlyn-478c4.firebaseapp.com",
    projectId: "enlyn-478c4",
    storageBucket: "enlyn-478c4.firebasestorage.app",
    messagingSenderId: "238293026914",
    appId: "1:238293026914:web:207bff5e2a624fc559293b",
    measurementId: "G-PMKFT738E5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
// Note: In React Native, for Auth persistence, you might need extra configuration with AsyncStorage.
// For now, we use default behavior (which may default to memory in some RN environments).
export const auth = getAuth(app);
export const db = getFirestore(app);
