import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCCjV_gL65t2bKqdlu6ykXmzDjFlxuYqUU",
  authDomain: "volunteer-app-fb49d.firebaseapp.com",
  projectId: "volunteer-app-fb49d",
  storageBucket: "volunteer-app-fb49d.firebasestorage.app",
  messagingSenderId: "983301498363",
  appId: "1:983301498363:web:503b189dae9c4039b4175e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth }; // 명시적으로 db와 auth 내보내기