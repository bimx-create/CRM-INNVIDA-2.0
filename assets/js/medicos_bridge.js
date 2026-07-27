
import { getFirestore, collection, collectionGroup, onSnapshot, query, orderBy, addDoc, serverTimestamp,
  doc, getDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const db = getFirestore();
const TBody = document.querySelector("#tbody-medicos") || document.querySelector("tbody");
const badge = document.querySelector("#badgeTotal") || document.querySelector("[data-total]");
const pageInfo = document.querySelector("#pageInfo");
const fEstado = document.querySelector("#fEstado");
const fRegion = document.querySelector("#fRegion");
const fKAM = document.querySelector("#fKAM");
const buscador = document.querySelector("#qMed") || document.querySelector("#buscador");
const fPageSize = document.querySelector("#fPageSize");
const btnPrev = document.querySelector("#btnPrev");
const btnNext = document.querySelector("#btnNext");
const btnCSV = document.querySelector("#btnCSV");
const btnExcel = document.querySelector("#btnExcel");
const btnRefrescar = document.querySelector("#btnRefrescar");

window.MEDICOS = window.MEDICOS || [];
let fuseList = []; // lista fusionada
let page = 1;

async function cargarBaseLocal(){
  try{
    const res = await fetch("medicos.json", {cache:"no-store"});
    if(!res.ok) throw 0;
    const data = await res.json();
    const normalizados = data.map(m => ({
      id: m.id || `loc-${crypto.randomUUID()}`,
      nombre: m.nombre || m.Nombre || "",
      telefono: m.telefono || m.Teléfono || "",
      direccion: m.direccion || m.Dirección || "",
      hospital: m.hospital || m.Hospital || "",
      redSocial: m.redSocial || m["Red Social"] || "No clasificado",
      especialidad: m.especialidad || m.Especialidad || "No clasificado",
      base: m.base || m.Base || "Sin seguro",
      estado: m.estado || m.Estado || "",
      region: m.region || m.Región || "",
      kam: m.kam || m["Gerente / KAM"] || "",
      estatus: m.estatus || m.Estatus || "",
      source: "local",
    }));
    window.MEDICOS = normalizados;
    render();
    hydrateFilters();
  }catch{ /* si no hay json, ok */ }
}

function hydrateFilters(){
  const estados = new Set(), regiones = new Set(), kams = new Set();
  fuseList.forEach(m => {
    if(m.estado) estados.add(m.estado);
    if(m.region) regiones.add(m.region);
    if(m.kam) kams.add(m.kam);
  });
  if (fEstado && fEstado.options.length === 1) estados.forEach(v=> fEstado.append(new Option(v,v)));
  if (fRegion && fRegion.options.length === 1) regiones.forEach(v=> fRegion.append(new Option(v,v)));
  if (fKAM && fKAM.options.length === 1) kams.forEach(v=> fKAM.append(new Option(v,v)));
}

function listenFirestore(){
  const q = query(collectionGroup(db,"medicos"), orderBy("createdAt","desc"));
  onSnapshot(q, (snap)=>{
    const fs = [];
    snap.forEach(d => {
      const m = d.data();
      fs.push({
        id: d.id,
        nombre: m.nombre || "",
        telefono: m.telefono || "",
        direccion: m.direccion || "",
        hospital: m.hospital || "",
        redSocial: m.redSocial || "No clasificado",
        especialidad: m.especialidad || "No clasificado",
        base: m.base || "Sin seguro",
        estado: m.estado || "",
        region: m.region || "",
        kam: m.kam || "",
        estatus: m.estatus || "",
        source: "fs",
      });
    });
    const key = x => (x.nombre||"")+"||"+(x.telefono||"");
    const map = new Map();
    (window.MEDICOS||[]).forEach(m => map.set(key(m), m));
    fs.forEach(m => map.set(key(m), m));
    fuseList = Array.from(map.values());
    render();
    hydrateFilters();
  }, console.error);
}


function getFiltered(){
  let list = fuseList.length ? fuseList : (window.MEDICOS||[]);
  const norm = (v) => (String(v||"").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  const qRaw = (buscador?.value||"").trim();
  const q = norm(qRaw);

  const est = (fEstado?.value||"").trim();
  const reg = (fRegion?.value||"").trim();
  const kam = (fKAM?.value||"").trim();

  if(q){
    list = list.filter(m => {
      const hay = [
        m.nombre, m.telefono, m.direccion, m.hospital,
        m.redSocial, m.especialidad, m.base, m.estado,
        m.region, m.kam, m.estatus
      ].some(v => norm(v).includes(q));
      return hay;
    });
  }
  if(est) list = list.filter(m=> String(m.estado||"")===est);
  if(reg) list = list.filter(m=> String(m.region||"")===reg);
  if(kam) list = list.filter(m=> String(m.kam||"")===kam);
  return list;
}


function render(){
  const list = getFiltered();
  const size = parseInt(fPageSize?.value||"20",10);
  const totalPages = Math.max(1, Math.ceil(list.length/size));
  page = Math.min(page, totalPages);
  const start = (page-1)*size;
  const slice = list.slice(start, start+size);
  if (TBody){
    TBody.innerHTML = slice.map(m => `
      <tr>
        <td>${m.nombre}</td>
        <td>${m.telefono||""}</td>
        <td>${m.direccion||""}</td>
        <td>${m.hospital||""}</td>
        <td>${m.redSocial||""}</td>
        <td>${m.especialidad||""}</td>
        <td>${m.base||""}</td>
        <td>${m.estado||""}</td>
        <td>${m.region||""}</td>
        <td>${m.kam||""}</td>
        <td><button class="btn-seg" data-id="${m.id||""}" data-nombre="${m.nombre||""}">+ Seguimiento</button></td>
      </tr>
    `).join("");
  }
  if (badge) badge.textContent = list.length;
  if (pageInfo) pageInfo.textContent = `Mostrando ${slice.length} de ${list.length} — Página ${page}/${totalPages}`;

  // enganchar seguimiento
  TBody?.querySelectorAll(".btn-seg").forEach(b=> b.onclick = openSegPanel);
}

function csvEscape(v){ return `"${String(v).replaceAll('"','""')}"`; }
function exportCSV(){
  const list = getFiltered();
  const head = ["Nombre","Teléfono","Dirección","Hospital","Red Social","Especialidad","Base","Estado","Región","KAM"];
  const rows = list.map(m=>[m.nombre,m.telefono,m.direccion,m.hospital,m.redSocial,m.especialidad,m.base,m.estado,m.region,m.kam].map(csvEscape).join(","));
  const csv = [head.join(","), ...rows].join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "medicos.csv";
  a.click();
}

window.guardarNuevoMedico = async function(datos){
  await addDoc(collection(db,"medicos"), {
    ...datos,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// Seguimiento: panel simple
const segPanel = document.getElementById("panelSeguimiento");
const segMedico = document.getElementById("segMedico");
const segEstado = document.getElementById("segEstado");
const segFecha  = document.getElementById("segFecha");
const segKAM    = document.getElementById("segKAM");
const segComentarios = document.getElementById("segComentarios");
const segHistList = document.getElementById("segHistList");
let currentId = null;
async function openSegPanel(e){
  currentId = e.currentTarget.dataset.id||null;
  segMedico.value = e.currentTarget.dataset.nombre||"";
  segHistList.innerHTML = "";
  segPanel.classList.remove("hidden");
  // cargar historial
  if(currentId){
    const dref = doc(db,"medicos",currentId);
    const d = await getDoc(dref);
    const data = d.exists() ? d.data() : {};
    const hist = data.seguimientos || [];
    hist.sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    hist.forEach(h=>{
      const li = document.createElement("li");
      const fecha = h.fecha ? new Date(h.fecha).toLocaleDateString() : "";
      li.textContent = `[${h.estado||""}] ${fecha} — ${h.kam||""} :: ${h.comentarios||""}`;
      segHistList.appendChild(li);
    });
  }
}
document.getElementById("segCancelar").onclick = ()=> segPanel.classList.add("hidden");
document.getElementById("segGuardar").onclick = async ()=>{
  if(!currentId){ alert("Sin id de médico"); return; }
  const dref = doc(db,"medicos",currentId);
  const snap = await getDoc(dref);
  if(!snap.exists()){
    alert("El médico no existe en Firestore (quizá fue local). Guarda primero el registro en FS.");
    return;
  }
  const data = snap.data();
  const seguimientos = data.seguimientos || [];
  seguimientos.push({
    estado: segEstado.value,
    fecha: segFecha.value || null,
    kam: segKAM.value || "",
    comentarios: segComentarios.value || "",
    createdAt: new Date().toISOString(),
  });
  await updateDoc(dref, {
    estatus: segEstado.value,
    kam: segKAM.value || data.kam || "",
    updatedAt: serverTimestamp(),
    seguimientos
  });
  alert("Seguimiento guardado");
  segPanel.classList.add("hidden");
};

// eventos
[buscador,fEstado,fRegion,fKAM,fPageSize].forEach(el=> el?.addEventListener("input", ()=>{ page=1; render(); }));
btnPrev?.addEventListener("click", ()=>{ page=Math.max(1, page-1); render(); });
btnNext?.addEventListener("click", ()=>{ page=page+1; render(); });
btnCSV?.addEventListener("click", exportCSV);
btnExcel?.addEventListener("click", exportCSV);
btnRefrescar?.addEventListener("click", render);

// start
await cargarBaseLocal();
listenFirestore();
