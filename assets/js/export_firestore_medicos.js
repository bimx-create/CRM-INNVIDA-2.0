
// export_firestore_medicos.js — Exporta base de médicos 100% desde Firestore
(function(){
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(init);

  async function init(){
    try{
      const appMod = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js");
      const fsMod  = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
      const app = (window.firebaseApp) || appMod.initializeApp(window.FIREBASE_CONFIG);
      window.firebaseApp = app;
      const db = (window.firebaseDb) || fsMod.getFirestore(app);
      window.firebaseDb = db;

      async function fetchAllMedicos(){
        const rows = [];
        const snap = await fsMod.getDocs(fsMod.collection(db, "medicos"));
        snap.forEach(d=>{
          const r = d.data() || {};
          rows.push({
            id: d.id,
            Nombre: r.Nombre || r.nombre || "",
            Telefono: r["Teléfono"] || r.Telefono || r.telefono || r.tel || "",
            Direccion: r.Dirección || r.Direccion || r.direccion || "",
            Hospital: r.Hospital || r.hospital || "",
            RedSocial: r["Red Social"] || r.redSocial || r.red || "",
            Especialidad: r.Especialidad || r.especialidad || "",
            Base: r.Base || r.base || "",
            Estado: r.Estado || r.estado || "",
            Region: r.Región || r.Region || r.region || "",
            KAM: r["GERENTE/KAM"] || r.KAM || r.kam || "",
            FechaCreacion: (r.createdAt && r.createdAt.toDate) ? r.createdAt.toDate().toISOString().slice(0,19).replace("T"," ") : (r.createdAt||""),
            UltimaActualizacion: (r.updatedAt && r.updatedAt.toDate) ? r.updatedAt.toDate().toISOString().slice(0,19).replace("T"," ") : (r.updatedAt||r.lastUpdatedAt||""),
            UltimoEstado: r.ultimoEstado || "",
            UltimoSeguimiento: r.ultimoSeguimiento ? (r.ultimoSeguimiento.toDate ? r.ultimoSeguimiento.toDate().toISOString().slice(0,19).replace("T"," ") : r.ultimoSeguimiento) : ""});
        });
        return rows;
      }

      function downloadCSV(filename, rows){
        if(!rows.length){ alert("Sin datos"); return; }
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(",")].concat(
          rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(","))
        ).join("\n");
        const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      function downloadXLSX(filename, rows){
        if(!rows.length){ alert("Sin datos"); return; }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Medicos");
        XLSX.writeFile(wb, filename);
      }

      async function handleCSV(ev){
        ev && ev.preventDefault();
        const rows = await fetchAllMedicos();
        downloadCSV("medicos_firestore.csv", rows);
      }
      async function handleXLSX(ev){
        ev && ev.preventDefault();
        const rows = await fetchAllMedicos();
        downloadXLSX("medicos_firestore.xlsx", rows);
      }

      const btnCSV = document.getElementById("downloadMedCSV");
      const btnXLSX= document.getElementById("downloadMedXLSX");
      if(btnCSV){ btnCSV.onclick = handleCSV; }
      if(btnXLSX){ btnXLSX.onclick = handleXLSX; }
    }catch(e){
      console.error("[export_firestore_medicos] error:", e);
    }
  }
})();
