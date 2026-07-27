
// refresh_on_guardado.js
(function(){
  document.addEventListener("medico:guardado", function(){
    var btn = Array.from(document.querySelectorAll("button, .btn")).find(b => (b.textContent||"").toLowerCase().includes("refrescar"));
    if(btn){ btn.click(); return; }
    if(typeof window.renderMedicos === "function"){ try{ window.renderMedicos(); return; }catch(_){ } }
    if(typeof window.reloadFirebaseMedicos === "function"){ try{ window.reloadFirebaseMedicos(); return; }catch(_){ } }
    try{ location.reload(); }catch(_){}
  });
})();
