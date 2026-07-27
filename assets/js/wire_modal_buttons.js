
import { attachSeguimientos } from "./seguimientos_firestore.js";

function findButtons() {
  return Array.from(document.querySelectorAll('[data-medico-id][data-action="seguimiento"]'));
}
function openModalFor(id) {
  window.__seg_docId = id;
  try { attachSeguimientos(id); } catch {}
}
function wire() {
  findButtons().forEach(btn => {
    if (btn.__wired) return;
    btn.__wired = true;
    btn.addEventListener('click', () => openModalFor(btn.getAttribute('data-medico-id')));
  });
}
const obs = new MutationObserver(wire);
obs.observe(document.body, { childList:true, subtree:true });
wire();
