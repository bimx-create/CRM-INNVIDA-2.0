
// compat_followup_buttons.js — convierte cualquier botón "+ Seguimiento" en .btn-seg para abrir el modal
(function(){
  function upgrade(){
    const all = Array.from(document.querySelectorAll("button,.btn"));
    all.forEach(b=>{
      const label = (b.textContent||"").trim().toLowerCase();
      const hasId = !!(b.getAttribute("data-id") || (b.dataset && b.dataset.id));
      if(!hasId) return;
      if(label.includes("seguimiento") && !b.classList.contains("btn-seg")){
        b.classList.add("btn-seg");
      }
    });
  }
  upgrade();
  new MutationObserver(upgrade).observe(document.documentElement,{childList:true,subtree:true});
})();
