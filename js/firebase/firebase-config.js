import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// A configuração web identifica o app; ela não autoriza acesso ao Firestore.
export const firebaseConfig = {
  apiKey: 'AIzaSyDtz1DWc_0JSJK0wNb1NEtFxB8nMoUFxgA',
  authDomain: 'planilha-professores.firebaseapp.com',
  projectId: 'planilha-professores',
  storageBucket: 'planilha-professores.firebasestorage.app',
  messagingSenderId: '173151553179',
  appId: '1:173151553179:web:107f08f5269d3a7a58283e'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

