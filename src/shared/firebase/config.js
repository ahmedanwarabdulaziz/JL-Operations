// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCVZ-C2ezeuOhgHtCTQVi234Fhc4ZGX8Qs",
  authDomain: "jl-operation.firebaseapp.com",
  projectId: "jl-operation",
  storageBucket: "jl-operation.firebasestorage.app",
  messagingSenderId: "118256366160",
  appId: "1:118256366160:web:b44f0592501796c0ef1755"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Add scopes to get profile information and Gmail access
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.addScope('openid');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

// Add Gmail scopes for email sending and reading
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.compose');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify'); 