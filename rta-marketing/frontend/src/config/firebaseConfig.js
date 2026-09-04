import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
const firebaseConfig = {
  apiKey: "AIzaSyDC7WICzP2-n_5ftJx8ppVes5w3ryzo8wk",
  authDomain: "rta-marketing.firebaseapp.com",
  projectId: "rta-marketing",
  storageBucket: "rta-marketing.appspot.com",
  messagingSenderId: "414063275337",
  appId: "1:414063275337:web:e024eeb9c12b7485f6be98",
};



const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = getFirestore(app);
export const storage = getStorage(app);
