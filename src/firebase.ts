import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJcUUBDPz_eu4Hufp0ZELONJLdmU1aKVc",
  authDomain: "app-grao-e-sabor.firebaseapp.com",
  projectId: "app-grao-e-sabor",
  storageBucket: "app-grao-e-sabor.firebasestorage.app",
  messagingSenderId: "585040432923",
  appId: "1:585040432923:web:ea0c83e55b6c2863210dbe",
  measurementId: "G-7KF9Y2TQNC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
