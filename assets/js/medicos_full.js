import {
  getFirestore, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const db = getFirestore();
const dom = {
  tbody: document.getElementById("tbody-medicos"),
  badge: document.getElementById("badgeTotal"),
  buscar: document.getElementById("txt-buscar"),
  estado: document.getElementById("sel-estado"),
  region: document.getElementById("sel-region"),
  kam: document.getElementById("sel-kam"),
  pageSel: document.getElementById("sel-page"),
  prev: document.getElementById("btn-prev"),
  next: document.getElementById("btn-next"),
  pagerInfo: document.getElementById("pager-info"),
  dlg: document.getElementById("dlg-form"),
  btnAbrir: document.getElementById("btn-abrir-form"),
  btnCancelar: document.getElementById("btn-cancelar"),
  btnGuardar: document.getElementById("btn-guardar-medico"),
  form: document.getElementById("form-medico"),
  csv: document.getElementById("btn-csv"),
  excel: document.getElementById("btn-excel"),
  refrescar: document.getElementById("btn-refrescar")
};

let data = [];            // datos en vivo desde Firestore
let filtered = [];        // datos filtrados
let page = 1;             // página actual

function setTotal(n){ if(dom.badge) dom.badge.textContent = `${n} médicos`; }

function fila(m){
  return `<tr>
    <td>${m.nombre||""}</td>
    <td>${m.telefono||""}</td>
    <td>${m.direccion||""}</td>
    <td>${m.hospital||""}</td>
    <td>${m.redSocial||"No clasificado"}</td>
    <td>${m.especialidad||""}</td>
    <td>${m.base||""}</td>
    <td>${m.estado||""}</td>
    <td>${m.region||""}</td>
    <td>${m.kam||""}</td>
    <td><button class="btn btnSeguimiento" data-id="${m.id}">+ Seguimiento</button></td>
  </tr>`;
}

function uniqueSorted(arr, key){
  return [...new Set(arr.map(x=>x[key]||"").filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
function fillFilters(){
  const estados = uniqueSorted(data, "estado");
  const regiones = uniqueSorted(data, "region");
  const kams    = uniqueSorted(data, "kam");
  dom.estado.innerHTML = `<option value="">Estado (todos)</option>` + estados.map(e=>`<option>${e}</option>`).join("");
  dom.region.innerHTML = `<option value="">Región (todas)</option>` + regiones.map(e=>`<option>${e}</option>`).join("");
  dom.kam.innerHTML    = `<option value="">KAM (todos)</option>` + kams.map(e=>`<option>${e}</option>`).join("");
}

function applyFilters(){
  const q = (dom.buscar.value||"").toLowerCase();
  const est = dom.estado.value||"";
  const reg = dom.region.value||"";
  const k   = dom.kam.value||"";
  filtered = data.filter(m=>{
    const text = `${m.nombre||""} ${m.hospital||""} ${m.especialidad||""}`.toLowerCase();
    if(q && !text.includes(q)) return false;
    if(est && (m.estado||"")!==est) return false;
    if(reg && (m.region||"")!==reg) return false;
    if(k && (m.kam||"")!==k) return false;
    return true;
  });
  page = 1;
  renderPage();
}

function renderPage(){
  const per = parseInt(dom.pageSel.value||"20",10);
  const total = filtered.length;
  let slice = filtered;
  let totalPages = 1;
  if(per<999999){
    totalPages = Math.max(1, Math.ceil(total/per));
    const start = (page-1)*per;
    slice = filtered.slice(start, start+per);
    dom.pagerInfo.textContent = `Mostrando ${slice.length ? (start+1) : 0}–${Math.min(start+slice.length,total)} de ${total} — Página ${page}/${totalPages}`;
  } else {
    dom.pagerInfo.textContent = `Mostrando ${total} — Página 1/1`;
  }
  dom.prev.disabled = page<=1;
  dom.next.disabled = page>=totalPages;
  dom.tbody.innerHTML = slice.map(fila).join("");
}

function toCSV(rows){
  const headers = ["nombre","telefono","direccion","hospital","redSocial","especialidad","base","estado","region","kam"];
  const escape = (v)=>`"${(v??"").toString().replace(/"/g,'""')}"`;
  const csv = [headers.map(h=>escape(h)).join(",")]
    .concat(rows.map(r=>headers.map(h=>escape(r[h])).join(",")))
    .join("\n");
  return csv;
}
function download(filename, content, mime="text/csv"){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// listeners UI
dom.buscar.addEventListener("input", applyFilters);
dom.estado.addEventListener("change", applyFilters);
dom.region.addEventListener("change", applyFilters);
dom.kam.addEventListener("change", applyFilters);
dom.pageSel.addEventListener("change", ()=>{ page=1; renderPage(); });
dom.prev.addEventListener("click", ()=>{ page=Math.max(1, page-1); renderPage(); });
dom.next.addEventListener("click", ()=>{ page=page+1; renderPage(); });
dom.csv.addEventListener("click", ()=>{
  const csv = toCSV(filtered);
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  download(`medicos_${ts}.csv`, csv, "text/csv;charset=utf-8");
});
dom.excel.addEventListener("click", ()=>{
  // export simple como CSV pero con extensión .xlsx para abrir en Excel
  const csv = toCSV(filtered);
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  download(`medicos_${ts}.xlsx`, csv, "text/csv;charset=utf-8");
});
dom.refrescar.addEventListener("click", ()=> location.reload());

// Alta de médico
dom.btnAbrir.addEventListener("click", ()=> dom.dlg.showModal());
dom.btnCancelar.addEventListener("click", (e)=>{ e.preventDefault(); dom.dlg.close(); });
dom.btnGuardar.addEventListener("click", async (e)=>{
  e.preventDefault();
  const get = (id)=>document.getElementById(id)?.value?.trim()||"";
  const m = {
    nombre: get("form-nombre") || "Sin nombre",
    telefono: get("form-telefono"),
    direccion: get("form-direccion"),
    hospital: get("form-hospital"),
    redSocial: get("form-redsocial"),
    especialidad: get("form-especialidad"),
    base: get("form-base"),
    estado: get("form-estado"),
    region: get("form-region"),
    kam: get("form-kam"),
    estatus: document.getElementById("form-estatus")?.value || "Contactado",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try{
    await addDoc(collection(db,"medicos"), m);
    alert("Médico guardado en Firestore ✅");
    dom.form?.reset();
    dom.dlg.close();
  }catch(e){
    console.error(e);
    alert("Error guardando en Firestore: " + (e.code || e.message));
  }
});

// Suscripción en vivo
(function listen(){
  const q = query(collection(db,"medicos"), orderBy("nombre"));
  onSnapshot(q, (snap) => {
    data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    setTotal(snap.size);
    fillFilters();
    applyFilters();
  }, (err) => {
    console.error("onSnapshot error:", err);
    alert("Error leyendo Firestore: " + (err.code || err.message));
  });
})();
