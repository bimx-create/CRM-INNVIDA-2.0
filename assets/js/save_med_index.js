
// save_med_index.js — v4 (content applied)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
  import { setPersistence, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
(function(){
  function $(id){ return document.getElementById(id); }
  function val(id){ const el=$(id); return (el && el.value) ? String(el.value).trim() : ""; }
  function slug(s){ return (s||"").toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$|_/g,''); }
  function toast(msg, type){
    let box = document.getElementById("__toastBox");
    if(!box){ box = document.createElement("div"); box.id="__toastBox"; box.style.cssText="position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;z-index:99999"; document.body.appendChild(box); }
    const el=document.createElement("div"); el.textContent=msg; el.style.cssText="padding:10px 14px;border-radius:10px;background:"+(type==="error"?"#7f1d1d":"#065f46")+";color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.4);font:14px/1.2 system-ui"; box.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; el.style.transition="all .3s"; }, 2200); setTimeout(()=>{ el.remove(); }, 2600);
  }
  let app, db, auth;
  function ensure(){
    app = getApps()[0] || (window.FIREBASE_CONFIG && initializeApp(window.FIREBASE_CONFIG));
    auth = getAuth(); try{ signInAnonymously(auth).catch(()=>{}); }catch(_){}
    onAuthStateChanged(auth, u => console.log("[save_med:v4] auth:", u && u.uid));
    db = getFirestore();
  }
  async function save(){
    ensure();
    const payload = {
      nombre: val("m_nombre"), telefono: val("m_tel"), direccion: val("m_dir"),
      hospital: val("m_hosp"), redSocial: val("m_red"), especialidad: val("m_esp"),
      estado: val("m_estado"), region: val("m_region"), kam: val("m_kam"), base: val("m_base"),
      estatus: (document.getElementById("m_estatus")?.value || "Contactado"),
      createdAt: serverTimestamp(), createdBy: (auth.currentUser && auth.currentUser.uid) || null,
    };
    if(!payload.nombre){ toast("⚠️ Nombre es obligatorio","error"); return; }
    const id = slug((payload.nombre||"")+" "+(payload.direccion||""));
    console.log("[save_med:v4] setDoc medicos/", id, payload);
    await setDoc(doc(db,"medicos", id), payload, { merge:true });
    try{
      const seg = { medico: payload.nombre, estado: payload.estatus || "Contactado", comentario: "Alta inicial desde panel", kam: payload.kam || "", proxima: "", createdAt: serverTimestamp() };
      await addDoc(collection(db,"medicos", id, "seguimientos"), seg);
      console.log("[save_med:v4] seguimiento inicial OK");
    }catch(e){ console.warn("[save_med:v4] no se pudo crear seguimiento inicial:", e); }
    const btn=document.getElementById("btnSaveMed"); if(btn){ const old=btn.textContent; btn.textContent="Guardado ✓"; setTimeout(()=> btn.textContent=old||"Guardar médico", 1400); }
    toast("Médico guardado en Firestore","ok");
    ["m_nombre","m_tel","m_dir","m_hosp","m_red","m_esp","m_estado","m_region","m_kam","m_base"].forEach(i=>{ const el=$(i); if(el) el.value=""; });
    document.dispatchEvent(new CustomEvent("medico:guardado", { detail: { id, payload } })); return id;
  }
  window.__saveMed = () => save().catch(e=>{ console.error(e); toast("❌ No se pudo guardar: "+(e?.message||e),"error"); });
  document.addEventListener("click", (e)=>{
    const b = e.target.closest("#btnSaveMed, button"); if(!b) return;
    const txt = (b.textContent||"").toLowerCase(); if(b.id==="btnSaveMed" || txt.includes("guardar médico") || txt.includes("guardar medico")){ e.preventDefault(); window.__saveMed(); }
  });
  console.log("[save_med:v4] listo");
})();
