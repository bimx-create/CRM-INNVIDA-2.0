// assets/js/resolve_docid_on_click.js
// Si el botón "+ Seguimiento" no trae data-id (o es inválido),
// busca el doc en Firestore por Nombre + Dirección y le inyecta el docId correcto.

(function () {
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(init);

  function q(sel){ return document.querySelector(sel); }
  function qs(el, sel){ return el ? el.querySelector(sel) : null; }

  function norm(s){
    if(!s) return "";
    return String(s).toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getRowData(btn){
    var tr = btn.closest("tr");
    if(!tr) return null;
    var tds = tr.querySelectorAll("td");
    if(tds.length < 3) return null;
    return {
      nombre: tds[0].textContent.trim(),
      direccion: tds[2].textContent.trim()
    };
  }

  function init(){
    if(!window.FIREBASE_CONFIG){ console.warn("[resolver] Sin FIREBASE_CONFIG"); return; }
    Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js")
    ]).then(function(mods){
      var appMod = mods[0], fs = mods[1];
      var app = (appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(window.FIREBASE_CONFIG));
      var db  = fs.getFirestore(app);

      document.addEventListener("click", function(ev){
        var btn = ev.target.closest(".btn-seg, .btnSeguimiento");
        if(!btn) return;

        var id = btn.getAttribute("data-id") || btn.dataset.id;
        if(id && id.length > 5) return; // ya trae docId válido

        var row = getRowData(btn);
        if(!row){ return; }

        // Intento 1: where exacto por nombre + direccion
        var col = fs.collection(db, "medicos");
        var qry = fs.query(col, fs.where("nombre", "==", row.nombre), fs.where("direccion", "==", row.direccion));

        fs.getDocs(qry).then(function(snap){
          var docId = null;
          snap.forEach(function(d){ if(!docId) docId = d.id; });
          if(!docId){
            // Intento 2: coincidencia por nombre solamente (primer resultado)
            return fs.getDocs(fs.query(col, fs.where("nombre", "==", row.nombre), fs.limit(1))).then(function(s2){
              s2.forEach(function(d){ if(!docId) docId = d.id; });
              return docId;
            });
          }
          return docId;
        }).then(function(docId){
          if(docId){
            btn.setAttribute("data-id", docId);
            btn.dataset.id = docId;
            // Disparar un click "falso" para que el adapter abra el panel con el id ya fijado
            setTimeout(function(){ btn.click(); }, 0);
          } else {
            alert("No encontré en Firestore un médico que coincida con:\n" + row.nombre + "\n" + row.direccion);
          }
        }).catch(function(e){
          console.error("[resolver] Error resolviendo docId:", e);
        });
      });
    });
  }
})();