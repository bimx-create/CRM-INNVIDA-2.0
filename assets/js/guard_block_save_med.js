// guard_block_save_med.js — evita que "Guardar médico" (Sheets) se dispare cuando el modal de seguimiento está abierto
(function(){
  document.addEventListener('click', function(e){
    function isModalOpen(){
      const m1=document.getElementById('modalBackdrop');
      const m2=document.getElementById('seguimientoModal');
      const el = m2||m1; if(!el) return false;
      const cs = window.getComputedStyle(el);
      return cs.display!=='none' && cs.visibility!=='hidden' && cs.opacity!=='0';
    }
    try{
      const md = document.getElementById('modalBackdrop');
      const modalOpen = isModalOpen();
      if(!modalOpen) return;
      const target = e.target;
      const isSaveMed = target.closest && target.closest('#btnSaveMed, #saveMed, button#btnSaveMed, button#saveMed');
      if(isSaveMed){
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }
    }catch(_){}
  }, true);
})();
// Prevent submits inside seguimiento modal
document.addEventListener('submit', function(e){
  try{
    const modal = document.getElementById('modalBackdrop') || document.getElementById('seguimientoModal');
    const cs = modal ? getComputedStyle(modal) : null;
    const open = modal && cs && cs.display!=='none' && cs.visibility!=='hidden' && cs.opacity!=='0';
    if(open){ e.preventDefault(); e.stopImmediatePropagation(); return false; }
  }catch(_){}
}, true);
