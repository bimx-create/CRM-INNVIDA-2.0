import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
const firebaseConfig = {
  apiKey: "AIzaSyAyksNhyRX-7QnZSOF27txNU-_SeMoOGps",
  authDomain: "crm-innvida-76e2e.firebaseapp.com",
  projectId: "crm-innvida-76e2e",
  storageBucket: "crm-innvida-76e2e.firebasestorage.app",
  messagingSenderId: "865341286325",
  appId: "1:865341286325:web:9fe061fa3c2c7fea4e9bfc"
};
initializeApp(firebaseConfig);

// Navegación de tabs (simple)
const tabs = document.querySelectorAll(".tab");
tabs.forEach(t => t.addEventListener("click", () => {
  tabs.forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  const pane = t.dataset.tab;
  document.querySelectorAll(".tabpane").forEach(p=>p.classList.remove("active"));
  document.getElementById(`tab-${pane}`).classList.add("active");
}));
console.log("Firebase listo");
