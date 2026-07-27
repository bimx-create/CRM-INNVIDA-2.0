// assets/js/link_rows_to_firestore.js
// Empareja filas de la tabla (Nombre + Dirección) con los docs reales de Firestore
// y pone el docId correcto en data-id del botón "+ Seguimiento".

(function () {
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(init);

  function norm(s){
    if(!s) return "";
    return String(s)
      .toLowerCase()
      .replace(/\s+/g," ")
      .replace(/[^\wáéíóúñü\s\.\-#]/g,"") // deja letras, números, tildes, guiones, # y puntos
      .trim();
  }

  function getCellText(tr, idx){
    var td = tr.querySelector("td:nth-child(" + idx + ")");
    return td ? td.textContent.trim() : "";
  }

  function linkRows(mapIds){
    var rows = document.querySelectorAll("table tbody tr");
    rows.forEach(function(tr){
      var nombre = getCellText(tr, 1);
      var direccion = getCellText(tr, 3);
      var key = norm(nombre) + "|" + norm(direccion);
      var id = mapIds.get(key);
      var btn = tr.querySelector(".btn-seg, .btnSeguimiento, button.btn-primary:last-child");
      if(btn && id){
        btn.setAttribute("data-id", id);
        btn.dataset.id = id;
        btn.disabled = false;
        btn.title = "Abrir seguimiento (Firestore)";
      }
    });
  }

  function observeRows(mapIds){
    var mo = new MutationObserver(function(){ linkRows(mapIds); });
    mo.observe(document.body, {childList:true, subtree:true});
    linkRows(mapIds);
  }

  function init(){
    if(!window.FIREBASE_CONFIG){ console.warn("[link_rows] Sin FIREBASE_CONFIG"); return; }
    Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js")
    ]).then(function(mods){
      var appMod = mods[0], fs = mods[1];
      var app = (appMod.getApps().length? appMod.getApps()[0] : appMod.initializeApp(window.FIREBASE_CONFIG));
      var db  = fs.getFirestore(app);

      // Carga todos los médicos una vez y arma el mapa
      var mapIds = new Map();
      fs.getDocs(fs.collection(db, "medicos")).then(function(snap){
        snap.forEach(function(d){
          var m = d.data() || {};
          var key = norm(m.nombre) + "|" + norm(m.direccion);
          if(key) mapIds.set(key, d.id);
        });
        observeRows(mapIds);
      }).catch(function(e){
        console.error("[link_rows] No pude leer 'medicos':", e);
      });
    }).catch(function(e){
      console.error("[link_rows] No pude cargar Firebase:", e);
    });
  }
})();