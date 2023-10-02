// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDEskHPpC5wjnTdIbR0e832FU2v6yaUox0",
  authDomain: "house-marketplace-app-854e8.firebaseapp.com",
  projectId: "house-marketplace-app-854e8",
  storageBucket: "house-marketplace-app-854e8.appspot.com",
  messagingSenderId: "488525157106",
  appId: "1:488525157106:web:a96c617ca249ad75a9f66b",
};

// Initialize Firebase
initializeApp(firebaseConfig);

export const db = getFirestore();
