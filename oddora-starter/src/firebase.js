
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDyMR4MJVaYO3OnZFe0Y2To2_C6pNPR2sk",
  authDomain: "oddora-4afbe.firebaseapp.com",
  databaseURL: "https://oddora-4afbe-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "oddora-4afbe",
  storageBucket: "oddora-4afbe.firebasestorage.app",
  messagingSenderId: "627167840285",
  appId: "1:627167840285:web:d9718002a128abadbe5ef4",
  measurementId: "G-6JR2Q6EVN6"
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);
export const auth = getAuth(app);

export const signInPlayer = () => signInAnonymously(auth);
