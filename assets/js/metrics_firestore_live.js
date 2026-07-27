
// metrics_firestore_live.js — Gráficos y mapa en vivo desde Firestore
(function(){
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(init);

  let db, fsMod, appMod;
  let chMes, chEstado, chSeg; // Chart.js instances
  let map, circles = [];
  let centroids = null;

  function monthKey(d){
    const y = d.getFullYear(); const m = (d.getMonth()+1).toString().padStart(2,"0");
    return `${y}-${m}`;
  }

  function ensureChart(ctxId, type, data, options){
    const el = document.getElementById(ctxId);
    if(!el) return null;
    const ctx = el.getContext("2d");
    if(!ctx) return null;
    if(ctx.__chart) { ctx.__chart.destroy(); }
    ctx.__chart = new Chart(ctx, { type, data, options: options||{ responsive:true, maintainAspectRatio:false } });
    return ctx.__chart;
  }

  function labelize(mapObj){
    const labels = Object.keys(mapObj);
    const values = labels.map(k=>mapObj[k]);
    return {labels, values};
  }

  function clearMap(){
    if(!map) return;
    circles.forEach(c=>c.remove());
    circles = [];
  }

  async function initMap(){
    const el = document.getElementById("mapaMX");
    if(!el) return;
    if(!map){
      map = L.map(el).setView([23.6345, -102.5528], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    }
    if(!centroids){
      try{
        const res = await fetch("mexico_state_centroids.json");
        centroids = await res.json();
      }catch(e){ console.warn("No centroids:", e); }
    }
  }

  function drawBubblesPorEstado(counts){
    if(!map) return;
    clearMap();
    if(!centroids) return;
    Object.entries(counts).forEach(([estado, n])=>{
      const c = centroids[estado] || centroids[estado?.toUpperCase?.()] || null;
      if(!c) return;
      const radius = Math.max(8000, Math.sqrt(n)*6000);
      const circle = L.circle([c.lat, c.lng], { radius, stroke:false, fillOpacity:0.35 });
      circle.addTo(map).bindPopup(`${estado}: ${n}`);
      circles.push(circle);
    });
  }

  function countBy(arr, keyFn){
    const m = Object.create(null);
    for(const x of arr){
      const k = keyFn(x);
      if(!k) continue;
      m[k] = (m[k]||0)+1;
    }
    return m;
  }

  function toDateAny(v){
    try{
      if(!v) return null;
      if(v.toDate) return v.toDate();
      if(v.toMillis) return new Date(v.toMillis());
      if(v instanceof Date) return v;
      if(typeof v === "number") return new Date(v);
      const t = Date.parse(v);
      return isNaN(t)?null:new Date(t);
    }catch{ return null; }
  }

  async function init(){
    try{
      [appMod, fsMod] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"),
      ]);
      const app = (window.firebaseApp) || appMod.initializeApp(window.FIREBASE_CONFIG);
      window.firebaseApp = app;
      db = (window.firebaseDb) || fsMod.getFirestore(app);
      window.firebaseDb = db;

      await initMap();

      // ---- Stream de MÉDICOS ----
      const qMed = fsMod.query(fsMod.collection(db,"medicos"));
      fsMod.onSnapshot(qMed, (snap)=>{
        const medicos = snap.docs.map(d=>({id:d.id, ...d.data()}));
        // 1) MAPA por Estado
        const countsEstado = countBy(medicos, (m)=> (m.Estado||m.estado||"").trim());
        drawBubblesPorEstado(countsEstado);
        // 2) BARRA por Estado
        const {labels:estados, values:vals} = labelize(countsEstado);
        chEstado = ensureChart("chartEstado","bar",{
          labels: estados,
          datasets: [{ label:"Médicos por Estado", data: vals }]
        });
        // 3) LÍNEA: Médicos nuevos por mes (últimos 12)
        const now = new Date();
        const last12 = [];
        for(let i=11;i>=0;i--){
          const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
          last12.push(monthKey(d));
        }
        const countsMes = Object.create(null);
        last12.forEach(k=>countsMes[k]=0);
        medicos.forEach(m=>{ const d = toDateAny(m.createdAt); if(!d) return; const k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1)); if(k in countsMes) countsMes[k]++; });
        const mesLabels = Object.keys(countsMes);
        const mesVals = mesLabels.map(k=>countsMes[k]);
        chMes = ensureChart("chartMes","line",{
          labels: mesLabels,
          datasets: [{ label:"Médicos nuevos", data: mesVals, tension:.25, fill:false }]
        });
      });

      // ---- Stream de SEGUIMIENTOS (collection group) ----
      try{
        const qSeg = fsMod.query(fsMod.collectionGroup(db,"seguimientos"));
        fsMod.onSnapshot(qSeg, (snap)=>{
          const rows = snap.docs.map(d=>d.data()||{});
          const counts = countBy(rows, r=>(r.estado||r.estatus||"").trim());
          const {labels, values} = labelize(counts);
          chSeg = ensureChart("chartStatus","bar",{
            labels, datasets: [{ label:"Seguimientos por estatus", data: values }]
          });
        });
      }catch(e){
        console.warn("Seguimientos (collectionGroup) no disponible:", e);
      }

    }catch(e){
      console.error("[metrics_firestore_live] error:", e);
    }
  }
})();
