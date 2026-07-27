// pubmed-api.js — Integración con NCBI E-utilities (PubMed)
(function() {

  // Quita títulos médicos del nombre para mejorar la búsqueda
  function cleanDoctorName(name) {
    return name.replace(/Dr\.\s*|Dra\.\s*|MD|M\.D\.|PhD|Ph\.D\.|Lic\.\s*/ig, '').trim();
  }

  // Paso 1: ESearch — obtiene lista de PMIDs para un autor
  async function searchPubMed(authorName) {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(authorName)}[Author]&retmode=json&retmax=50&sort=date`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('ESearch falló');
    const data = await res.json();
    return data.esearchresult.idlist || [];
  }

  // Paso 2: ESummary — trae título, año, revista y autores de cada artículo
  async function fetchSummaries(pmids) {
    if (!pmids.length) return [];
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('ESummary falló');
    const data = await res.json();
    const result = data.result || {};
    return pmids.map(id => result[id]).filter(Boolean);
  }

  // Abre el modal y arranca la búsqueda
  window.openPubMedModal = async function(rawName) {
    const modal = document.getElementById('modalPubMed');
    if (!modal) return;

    // Reset UI
    document.getElementById('pmDocName').textContent  = rawName;
    document.getElementById('pmLoading').style.display = 'block';
    document.getElementById('pmError').style.display   = 'none';
    document.getElementById('pmTabs').style.display    = 'none';
    document.getElementById('tabAuthors').style.display  = 'none';
    document.getElementById('tabArticles').style.display = 'none';
    document.getElementById('pmAuthorsList').innerHTML   = '';
    document.getElementById('pmArticlesList').innerHTML  = '';
    modal.classList.add('open');

    try {
      const searchName = cleanDoctorName(rawName);

      // Buscar PMIDs
      let pmids = await searchPubMed(searchName);
      if (!pmids.length) {
        // Fallback: solo primer nombre + último apellido
        const parts = searchName.split(' ').filter(p => p.length > 1);
        const fallbackQuery = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : searchName;
        pmids = await searchPubMed(fallbackQuery);
      }

      if (!pmids.length) {
        document.getElementById('pmLoading').style.display = 'none';
        const el = document.getElementById('pmError');
        el.style.display = 'block';
        el.textContent = 'No se encontraron publicaciones científicas para este médico en PubMed.';
        return;
      }

      const articles = await fetchSummaries(pmids);
      if (!articles.length) {
        document.getElementById('pmLoading').style.display = 'none';
        const el = document.getElementById('pmError');
        el.style.display = 'block';
        el.textContent = 'Se encontraron IDs pero no se pudieron obtener los detalles de los artículos.';
        return;
      }

      // ── Contar coautores ──────────────────────────────────────────
      const coAuthors = {};
      const queryParts = searchName.toLowerCase().split(' ').filter(p => p.length > 2);

      articles.forEach(art => {
        (art.authors || []).forEach(a => {
          const n = a.name;
          if (!n) return;
          const isSelf = queryParts.some(part => n.toLowerCase().includes(part));
          if (!isSelf) coAuthors[n] = (coAuthors[n] || 0) + 1;
        });
      });

      const sortedAuthors = Object.entries(coAuthors).sort((a, b) => b[1] - a[1]).slice(0, 10);

      // ── Render Tab: Colaboradores ─────────────────────────────────
      document.getElementById('pmArticlesCount').textContent = articles.length;
      const maxCount = sortedAuthors.length ? sortedAuthors[0][1] : 1;
      document.getElementById('pmAuthorsList').innerHTML = sortedAuthors.length
        ? sortedAuthors.map(([name, count]) => {
            const pct = Math.max(8, (count / maxCount) * 100);
            return `
              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:11px 14px;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-weight:600;color:var(--text1);font-size:14px;">${name}</span>
                  <span class="badge badge-blue">${count} pub${count > 1 ? 's' : ''} juntas</span>
                </div>
                <div style="width:100%;height:5px;background:rgba(0,0,0,0.35);border-radius:4px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:var(--blue-light);border-radius:4px;transition:width 0.6s ease;"></div>
                </div>
              </div>`;
          }).join('')
        : `<div style="color:var(--text2);font-size:13px;text-align:center;padding:20px 0;">No se identificaron coautores externos.</div>`;

      // ── Render Tab: Publicaciones ─────────────────────────────────
      document.getElementById('pmArticlesList').innerHTML = articles.map(art => {
        const title    = art.title || 'Sin título';
        const journal  = art.source || '';
        const year     = art.pubdate ? art.pubdate.substring(0, 4) : '';
        const pmid     = art.uid || '';
        const authors  = (art.authors || []).map(a => a.name).filter(Boolean);
        // Excluir al propio médico de la lista de coautores de cada artículo
        const coAuthList = authors.filter(n => !queryParts.some(p => n.toLowerCase().includes(p)));
        const coAuthDisplay = coAuthList.length
          ? coAuthList.slice(0, 5).join(', ') + (coAuthList.length > 5 ? ` y ${coAuthList.length - 5} más…` : '')
          : 'Sin coautores registrados';

        return `
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
            <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" rel="noopener"
               style="font-size:14px;font-weight:600;color:var(--blue-light);text-decoration:none;line-height:1.45;display:block;">
              ${title}
            </a>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              ${year ? `<span class="badge badge-gray">${year}</span>` : ''}
              ${journal ? `<span style="font-size:12px;color:var(--text2);font-style:italic;">${journal}</span>` : ''}
            </div>
            <div style="font-size:12px;color:var(--text2);">
              <span style="color:var(--text1);font-weight:500;">Coautores:</span> ${coAuthDisplay}
            </div>
          </div>`;
      }).join('');

      // Mostrar tabs y activar "Colaboradores" por defecto
      document.getElementById('pmLoading').style.display = 'none';
      document.getElementById('pmTabs').style.display    = 'block';
      switchPmTab('authors');

    } catch (err) {
      console.error('[PubMed]', err);
      document.getElementById('pmLoading').style.display = 'none';
      const el = document.getElementById('pmError');
      el.style.display = 'block';
      el.textContent = 'Error de conexión con PubMed. Verifica tu internet e intenta de nuevo.';
    }
  };

})();
