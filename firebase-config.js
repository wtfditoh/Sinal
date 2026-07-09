// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// 1. Vá em https://console.firebase.google.com
// 2. Crie um projeto novo (ex: "sinal-midia")
// 3. Ative: Authentication (método Email/Senha) + Firestore Database
// 4. Em "Configurações do projeto" > "Seus apps" > Web (</>),
//    copie o firebaseConfig e cole abaixo no lugar do placeholder.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDe7wqIfMB0BVFzs1yXPrSXK0Iq98BPDb0",
  authDomain: "sinall.firebaseapp.com",
  projectId: "sinall",
  storageBucket: "sinall.firebasestorage.app",
  messagingSenderId: "811815756526",
  appId: "1:811815756526:web:baabfe914a5af625ee09ff",
  measurementId: "G-HCRWB0FBV4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Domínio interno usado para transformar "nome de usuário" em e-mail
// do Firebase Auth (o usuário nunca vê isso, só digita o nome).
export const AUTH_DOMAIN_SUFFIX = "@sinal.app";
