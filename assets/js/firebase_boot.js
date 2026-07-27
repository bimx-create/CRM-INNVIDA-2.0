
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyksNhyRX-7QnZSOF27txNU-_SeMoOGps",
  authDomain: "crm-innvida-76e2e.firebaseapp.com",
  projectId: "crm-innvida-76e2e",
  storageBucket: "crm-innvida-76e2e.appspot.com",
  messagingSenderId: "865341286325",
  appId: "1:865341286325:web:9fe061fa3c2c7fea4e9bfc"
};

if (!getApps().length) initializeApp(firebaseConfig);
window.DB = getFirestore();
