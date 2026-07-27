// Hook the "Refrescar" button to force network fetch
(function(){
  function tryHook(){
    const btn = Array.from(document.querySelectorAll("button,.btn"))
      .find(b => ((b.textContent||"").trim().toLowerCase() === "refrescar"));
    if(btn && !btn.__hooked){
      btn.__hooked = true;
      btn.addEventListener("click", function(ev){
        ev.preventDefault();
        if (window.forceMedicosFromServer) {
          window.forceMedicosFromServer();
        } else {
          location.reload();
        }
      }, { capture:true });
    }
  }
  const mo = new MutationObserver(tryHook);
  mo.observe(document.documentElement, { childList:true, subtree:true });
  tryHook();
})();
