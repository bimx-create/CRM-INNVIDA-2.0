// patch_followup_runtime.js — convierte .btn-del en Seguimiento si aparecen
(function(){
  function convert(){
    document.querySelectorAll("button.btn-del").forEach(b=>{
      const id = b.getAttribute("data-del") || b.dataset.del;
      if(!id) return;
      const seg = document.createElement("button");
      seg.className = "btn btn-sm btn-primary btn-seg";
      seg.setAttribute("data-id", id);
      seg.textContent = "+ Seguimiento";
      b.replaceWith(seg);
    });
  }
  convert();
  new MutationObserver(convert).observe(document.body,{childList:true,subtree:true});
})();