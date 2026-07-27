// removed medicos.json fetch
import { getFirestore, collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const db = getFirestore();
const col = collection(db, "medicos");

export async function importarDesdeJSON(url){
  const res = await fetch(url);
  const data = await res.json();
  if(!Array.isArray(data)){ alert("El JSON debe ser un arreglo de médicos"); return; }
  let ok=0, fail=0;
  for (const m of data){
    try{
      await addDoc(col, {
        ...m,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      ok++;
    }catch(e){
      console.error("Fail:", e, m); fail++;
    }
  }
  alert("Importación completa. OK: "+ok+" | Fallas: "+fail);
}
window.importarDesdeJSON = importarDesdeJSON;
