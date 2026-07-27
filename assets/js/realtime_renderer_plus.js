
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
const db = getFirestore();
const $ = (s) => document.querySelector(s);
const tbody   = $("#tbody-medicos");
const qInput  = $("#qMed");
const fEstado = $("#fEstado");
const fRegion = $("#fRegion");
const fKAM    = $("#fKAM");
const sortSel = $("#sortOrder");
const pageInfo= $("#pageInfoMed");

let ALL = [];
let VIEW = [];

function tsToMillis(v){
  if(!v) return 0;
  if(v.toMillis) return v.toMillis();
  if(v.toDate) return v.toDate().getTime();
  if(v instanceof Date) return v.getTime();
  if(typeof v === "number") return v;
  const t = Date.parse(v); return isNaN(t)?0:t;
}
function tsToStr(v){
  const d = (v && v.toDate) ? v.toDate() : (v instanceof Date ? v : new Date(tsToMillis(v)));
  if(!d || isNaN(d)) return "";
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const norm = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function toRow(m) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${m.nombre || "-"}</td>
    <td>${m.telefono || "-"}</td>
    <td>${m.direccion || "-"}</td>
    <td>${m.hospital || "-"}</td>
    <td>${m.redSocial || "No clasificado"}</td>
    <td>${m.especialidad || "No clasificado"}</td>
    <td>${m.base || "Sin seguro"}</td>
    <td>${m.estado || "-"}</td>
    <td>${m.region || "-"}</td>
    <td>${m.kam || "-"}</td>
    <td><button class="btn ghost btnSeg" data-path="${m.__path || ""}" data-nombre="${m.nombre||""}">+ Seguimiento</button></td>
  `;
  return tr;
}

function paint(list) {
  if (!tbody) return;
  tbody.innerHTML = "";
  (list||[]).forEach(m => tbody.appendChild(toRow(m)));
  if (pageInfo) pageInfo.textContent = `Mostrando ${list.length} — Página 1/1`;
}

function applyFilters() {
  const q   = norm(qInput?.value || "");
  const est = (fEstado?.value || "").trim();
  const reg = (fRegion?.value || "").trim();
  const kam = (fKAM?.value || "").trim();

  let list = [...ALL];
  if (q) {
    list = list.filter(m =>
      [m.nombre, m.telefono, m.direccion, m.hospital,
       m.redSocial, m.especialidad, m.base, m.estado,
       m.region, m.kam, m.estatus].some(v => norm(v).includes(q))
    );
  }
  if (est && est !== "todos") list = list.filter(m => String(m.estado||"") === est);
  if (reg && reg !== "todas") list = list.filter(m => String(m.region||"") === reg);
  if (kam && kam !== "todos") list = list.filter(m => String(m.kam||"") === kam);

  
  // Ordenar por createdAt según selector
  const order = (sortSel?.value || "desc");
  list.sort((a,b)=>{
    const ta = tsToMillis(a.createdAt);
    const tb = tsToMillis(b.createdAt);
    return order === "asc" ? (ta - tb) : (tb - ta);
  });

  VIEW = list;
  paint(VIEW);
}

window.renderMedicos = function(docs) {
  ALL = Array.isArray(docs) ? docs.map(d => ({ ...d, __path: d.__path || d._path || d.path || d.refPath || "" })) : [];
  ALL.sort((a,b) => {
    const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : 0;
    const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  window.ALL_MEDICOS = ALL;
  applyFilters();
};

[qInput, fEstado, fRegion, fKAM].forEach(el => {
  el && el.addEventListener("input", applyFilters);
  el && el.addEventListener("change", applyFilters);
});
if (sortSel) { sortSel.addEventListener("change", applyFilters); }

function toCSV(rows) {
  const headers = ["nombre","telefono","direccion","hospital","redSocial","especialidad","base","estado","region","kam","FechaCreacion","UltimaActualizacion"];
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[\",;\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [headers.join(",")];
  for (const m of rows) {
    lines.push([m.nombre, m.telefono, m.direccion, m.hospital, m.redSocial, m.especialidad, m.base, m.estado, m.region, m.kam, tsToStr(m.createdAt), tsToStr(m.updatedAt || m.lastUpdatedAt)].map(esc).join(","));
  }
  return "\\ufeff" + lines.join("\\n");
}

function download(name, content, mime="text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 200);
}

function exportAllCSV(){ download(`medicos_${new Date().toISOString().slice(0,10)}.csv`, toCSV(window.ALL_MEDICOS||[])); }
function exportAllXLSX(){ download(`medicos_${new Date().toISOString().slice(0,10)}.xlsx`, toCSV(window.ALL_MEDICOS||[]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); }

document.querySelector("#btnCSV")?.addEventListener("click", exportAllCSV);
document.querySelector("#btnExcel")?.addEventListener("click", exportAllXLSX);

// Seguimiento
function ensureSegModal(){
  let modal = document.querySelector("#segModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "segModal";
  modal.style.cssText = "position:fixed;inset:0;display:none;background:rgba(0,0,0,.4);z-index:9999;";
  modal.innerHTML = `
    <div style="position:absolute;right:0;top:0;height:100%;width:420px;background:#0f2435;color:#fff;box-shadow:-2px 0 12px rgba(0,0,0,.3);display:flex;flex-direction:column;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.1)">
        <div style="font-weight:700" id="segTitle">Seguimiento</div>
        <div id="segSub" style="opacity:.7;font-size:.9em"></div>
      </div>
      <div style="padding:14px 20px;display:grid;gap:10px">
        <label>Estado
          <select id="segEstado" style="width:100%;padding:8px;border-radius:8px;background:#09202f;color:#fff;border:1px solid rgba(255,255,255,.1)">
            <option value="Contactado">Contactado</option>
            <option value="Cita programada">Cita programada</option>
            <option value="Negociación">Negociación</option>
            <option value="Cerrado">Cerrado</option>
            <option value="Sin respuesta">Sin respuesta</option>
          </select>
        </label>
        <label>Próxima acción / Fecha de visita
          <input id="segFecha" type="date" style="width:100%;padding:8px;border-radius:8px;background:#09202f;color:#fff;border:1px solid rgba(255,255,255,.1)"/>
        </label>
        <label>Comentarios
          <textarea id="segComentarios" rows="4" style="width:100%;padding:8px;border-radius:8px;background:#09202f;color:#fff;border:1px solid rgba(255,255,255,.1)"></textarea>
        </label>
        <label>KAM / Gerente
          <input id="segKAM" type="text" style="width:100%;padding:8px;border-radius:8px;background:#09202f;color:#fff;border:1px solid rgba(255,255,255,.1)"/>
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="segCancel" class="btn ghost">Cancelar</button>
          <button id="segSave" class="btn ghost">Guardar</button>
        </div>
      </div>
      <div style="flex:1;overflow:auto;border-top:1px solid rgba(255,255,255,.1)">
        <div id="segHist" style="padding:12px 20px;"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e)=> { if(e.target === modal) closeSeg(); });
  $("#segCancel").addEventListener("click", closeSeg);
  return modal;
}

let segUnsub = null;
let currentPath = "";
function openSeg(path, nombre){
  const modal = ensureSegModal();
  currentPath = path;
  $("#segTitle").textContent = `Seguimiento — ${nombre || ""}`;
  $("#segSub").textContent = path;
  modal.style.display = "block";

  segUnsub && segUnsub();
  const ref = collection(db, `${path}/seguimientos`);
  const qHist = query(ref, orderBy("createdAt","desc"));
  segUnsub = onSnapshot(qHist, (snap)=>{
    const box = $("#segHist");
    box.innerHTML = "";
    snap.forEach(d => {
      const s = d.data();
      const f = s.createdAt?.toDate ? s.createdAt.toDate() : null;
      const fecha = f ? f.toISOString().slice(0,10) : "";
      const el = document.createElement("div");
      el.style.cssText = "padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)";
      el.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center">
          <span style="width:8px;height:8px;border-radius:50%;display:inline-block;background:${badgeColor(s.estado)}"></span>
          <strong>${fecha}</strong> — ${esc(s.estado||"")}
        </div>
        <div style="opacity:.8;margin-top:4px">${esc(s.comentarios||"")}</div>
        <div style="opacity:.6;font-size:.85em;margin-top:2px">${esc(s.kam||"")}</div>`;
      box.appendChild(el);
    });
  });
}

function closeSeg(){
  const modal = $("#segModal");
  if (modal) modal.style.display = "none";
  segUnsub && segUnsub(); segUnsub = null;
}

function esc(s){ return String(s||"").replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function badgeColor(estado){
  switch((estado||"").toLowerCase()){
    case "contactado": return "#ffd24d";
    case "cita programada": return "#4dd2ff";
    case "negociación": return "#b48cff";
    case "cerrado": return "#5ee05e";
    default: return "#ff6b6b";
  }
}

async function saveSeg(){
  if(!currentPath) return;
  const estado = $("#segEstado")?.value || "Contactado";
  const fecha  = $("#segFecha")?.value || "";
  const comentarios = $("#segComentarios")?.value || "";
  const kam    = $("#segKAM")?.value || "";
  const ref = collection(db, `${currentPath}/seguimientos`);
  await addDoc(ref, {
    estado,
    comentarios,
    kam,
    nextDate: fecha ? new Date(fecha+"T00:00:00") : null,
    createdAt: serverTimestamp()
  });
  $("#segComentarios").value = "";
}

document.addEventListener("click", (e)=> {
  const btn = e.target.closest(".btnSeg");
  if (btn){
    const p = btn.getAttribute("data-path") || "";
    const nombre = btn.getAttribute("data-nombre") || "";
    openSeg(p, nombre);
  }
});
document.addEventListener("click", (e)=> { if (e.target && e.target.id === "segSave") saveSeg(); });
