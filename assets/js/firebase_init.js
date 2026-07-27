// Firebase INIT + Auth (CDN v10.12.5) sin type=module
(async function() {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");

    window.firebaseConfig = {
      apiKey: "AIzaSyAyksNhyRX-7QnZSOF27txNU-_SeMoOGps",
      authDomain: "crm-innvida-76e2e.firebaseapp.com",
      projectId: "crm-innvida-76e2e",
      storageBucket: "crm-innvida-76e2e.firebasestorage.app",
      messagingSenderId: "865341286325",
      appId: "1:865341286325:web:9fe061fa3c2c7fea4e9bfc"
    };

    window.firebaseApp = initializeApp(window.firebaseConfig);
    window.firebaseDb = getFirestore(window.firebaseApp);
    const auth = getAuth(window.firebaseApp);
    signInAnonymously(auth).catch((e) => console.error("[auth] signInAnonymously:", e));
    onAuthStateChanged(auth, (user) => {
      console.log(user ? "[auth] listo (uid="+user.uid+")" : "[auth] sin sesión");
    });
  } catch(e) {
    console.error("[firebase_init] Error cargando módulos:", e);
  }
})();
