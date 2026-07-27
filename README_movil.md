
# CRM-PRAXIS — Modo móvil (GitHub Pages)

- Dominio autorizado: agrega tu dominio público en Firebase → Authentication → Settings → Authorized domains.
- Persistencia móvil: usamos `setPersistence(auth, inMemoryPersistence)` en `firebase_medicos.js` y `save_med_index.js` para que el login anónimo funcione en iOS/Incógnito/WebView.
- Aviso WebView: si se abre dentro de Instagram/FB/WhatsApp, se muestra una banda pidiendo abrir en Chrome/Safari.
