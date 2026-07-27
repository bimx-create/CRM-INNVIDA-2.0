
// Auto-generado: gráficos reales por KAM
(function(){

  const CSV_URL = "https://docs.google.com/spreadsheets/d/1d2EyqCi3hQzT1zW4Ay-em086J__R9EgNmRKM50z8QZQ/gviz/tq?tqx=out:csv&gid=1067864571"; // Hoja publicada
  const KAM_HEADER_NAMES = ["KAM","Gerente","GERENTE/KAM","Gerente/KAM","KAM "]; // tolerancia a variaciones
  
  function parseCSV(text) {
    // Simple CSV parser tolerante (sin comillas anidadas complejas)
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    return lines.map(line => {
      const out = [];
      let current = '';
      let inQuotes = false;
      for (let i=0;i<line.length;i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          out.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      out.push(current);
      return out.map(x => x.trim());
    });
  }

  async function loadData() {
    const res = await fetch(CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo leer la hoja de Google');
    const txt = await res.text();
    const rows = parseCSV(txt);
    if (!rows.length) return { headers: [], rows: [] };

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1).filter(r => r.some(c => c && c.length));
    return { headers, rows: dataRows };
  }

  function findKamIndex(headers) {
    const lower = headers.map(h => h.toLowerCase());
    for (let name of KAM_HEADER_NAMES) {
      const i = lower.indexOf(name.toLowerCase());
      if (i !== -1) return i;
    }
    // fallback: try column C (index 2)
    return 2 < headers.length ? 2 : -1;
  }

  function countByKam(rows, kamIndex) {
    const counts = new Map();
    for (const r of rows) {
      const key = (r[kamIndex] || '').toString().trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  function sortEntries(map) {
    return Array.from(map.entries()).sort((a,b) => b[1]-a[1]);
  }

  function ensureCanvas(id) {
    const el = document.getElementById(id);
    return el;
  }

  function renderBar(labels, values) {
    const ctx = ensureCanvas('kamBar').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Cotizaciones', data: values }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision:0 } }
        }
      }
    });
  }

  function renderTop(labels, values) {
    const ctx = ensureCanvas('kamTop').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Ranking', data: values }] },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision:0 } }
        }
      }
    });
  }

  function setTotal(n) {
    const el = document.getElementById('totalQuotes');
    if (el) el.textContent = n.toString();
  }

  async function main() {
    try {
      const {headers, rows} = await loadData();
      if (!headers.length) return;
      const kamIndex = findKamIndex(headers);
      if (kamIndex === -1) throw new Error('No se encontró la columna KAM');
      const counts = countByKam(rows, kamIndex);
      const sorted = sortEntries(counts);
      const labels = sorted.map(([k]) => k);
      const values = sorted.map(([,v]) => v);
      setTotal(rows.length);

      if (labels.length && ensureCanvas('kamBar')) renderBar(labels, values);
      if (labels.length && ensureCanvas('kamTop')) renderTop(labels, values);
    } catch (e) {
      console.error('KAM Metrics error:', e);
    }
  }

  // dispara cuando el DOM está listo
  if (document.readyState === 'complete' || document.readyState === 'interactive') main();
  else document.addEventListener('DOMContentLoaded', main);

})();
