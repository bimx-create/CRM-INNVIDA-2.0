// kam-report-ia.js - Generación de Reportes PDF con IA para KAMs

(function() {
  // La API key ya NO está aquí. Se lee desde Vercel Environment Variables
  // a través del proxy seguro en /api/groq
  const GROQ_URL = '/api/groq';

  let currentReportMetrics = null;

  function getMetricsForKam(kamName) {
    const medicos = window.MED_BASE || [];
    const cots = window.COT_BASE || [];
    
    let medsFiltered = medicos;
    let cotsFiltered = cots;

    if (kamName !== 'Todos') {
      const norm = (k) => k ? k.trim().toUpperCase() : '';
      medsFiltered = medicos.filter(m => norm(m['GERENTE/KAM'] || m.kam) === norm(kamName));
      cotsFiltered = cots.filter(c => norm(c['KAM']) === norm(kamName));
    }

    const totalCots = cotsFiltered.length;
    const ganadas = cotsFiltered.filter(c => (c['STATUS']||'').toUpperCase().includes('CONFIRM')).length;
    const perdidas = cotsFiltered.filter(c => (c['STATUS']||'').toUpperCase().includes('CANCEL')).length;
    const conversion = totalCots > 0 ? ((ganadas / totalCots) * 100).toFixed(1) + '%' : '0%';

    let valorTotal = 0;
    cotsFiltered.forEach(c => {
      const v = parseFloat((c['VALOR']||'0').toString().replace(/[^0-9.]/g, ''));
      if (!isNaN(v)) valorTotal += v;
    });

    const valorStr = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valorTotal);

    // Esquemas más vendidos
    const esquemas = {};
    cotsFiltered.forEach(c => {
      const e = c['ESQUEMA'] || 'Otro';
      esquemas[e] = (esquemas[e] || 0) + 1;
    });
    const topEsquemas = Object.entries(esquemas).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]).join(', ');

    return {
      kam: kamName,
      medicos: medsFiltered.length,
      cotizaciones: totalCots,
      ganadas,
      perdidas,
      conversion,
      valorTotal: valorStr,
      topEsquemas: topEsquemas || 'Ninguno'
    };
  }

  async function fetchIAReport(metrics) {
    const prompt = `Actúa como un Director Comercial (Sales Manager) de la empresa farmacéutica INNVIDA.
Escribe un reporte ejecutivo de desempeño (máximo 4 párrafos) para el gerente/KAM: ${metrics.kam}.

Métricas actuales del KAM:
- Médicos en cartera: ${metrics.medicos}
- Cotizaciones realizadas: ${metrics.cotizaciones}
- Cotizaciones ganadas/confirmadas: ${metrics.ganadas}
- Tasa de conversión: ${metrics.conversion}
- Valor del Pipeline: ${metrics.valorTotal}
- Esquemas más vendidos: ${metrics.topEsquemas}

Estructura requerida del reporte:
1. Resumen ejecutivo de su desempeño actual.
2. Fortalezas observadas basadas en los números.
3. Áreas de oportunidad.
4. 2 sugerencias de crecimiento o mejora de sus capacidades comerciales / prospección.

No uses saludos, solo el contenido del reporte de manera directa y profesional. No incluyas comillas.`;

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Authorization la maneja el proxy en /api/groq (Vercel Env Variables)
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 800
      })
    });

    if (!res.ok) throw new Error('Error al conectar con la IA');
    const data = await res.json();
    return data.choices[0].message.content.trim();
  }

  function generatePDF(metrics, aiText) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageW = doc.internal.pageSize.getWidth();
    let cursorY = 20;

    // Header
    doc.setFillColor(10, 110, 189); // primary color
    doc.rect(0, 0, pageW, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("CRM INNVIDA", 20, 25);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte de Desempeño Ejecutivo", 20, 33);
    
    cursorY = 50;
    
    // Info KAM
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`KAM Evaluado: ${metrics.kam}`, 20, cursorY);
    cursorY += 8;
    
    const today = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha del reporte: ${today}`, 20, cursorY);
    cursorY += 15;

    // Métricas
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("1. Resumen de Métricas (Pipeline)", 20, cursorY);
    cursorY += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const mLines = [
      `• Médicos en Cartera: ${metrics.medicos}`,
      `• Cotizaciones Activas/Totales: ${metrics.cotizaciones}`,
      `• Cierres Ganados: ${metrics.ganadas} (Tasa: ${metrics.conversion})`,
      `• Valor Total Pipeline: ${metrics.valorTotal}`,
      `• Esquemas Principales: ${metrics.topEsquemas}`
    ];
    
    mLines.forEach(line => {
      doc.text(line, 25, cursorY);
      cursorY += 7;
    });

    cursorY += 10;

    // Análisis IA
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("2. Análisis de Desempeño y Áreas de Mejora", 20, cursorY);
    cursorY += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    // El texto de la IA puede ser largo, hay que wrappearlo
    const splitText = doc.splitTextToSize(aiText, pageW - 40);
    
    // Imprimir texto con paginación
    splitText.forEach(line => {
      if (cursorY > 270) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(line, 20, cursorY);
      cursorY += 6; // line height
    });

    // Pie de página
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Documento generado por CRM INNVIDA Pro", 20, 290);

    const safeName = metrics.kam.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Reporte_Desempeno_KAM_${safeName}.pdf`);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnGenerate = document.getElementById('generateReportIA');
    if (btnGenerate) {
      btnGenerate.addEventListener('click', async () => {
        // Checar si jsPDF está disponible
        if (!window.jspdf) {
          Swal.fire('Error', 'La librería PDF aún no ha cargado, intenta en unos segundos.', 'error');
          return;
        }

        const kamSelected = window.__kamSelected || 'Todos';

        Swal.fire({
          title: 'Analizando Desempeño...',
          html: 'La Inteligencia Artificial está evaluando las métricas de <b>' + kamSelected + '</b> y escribiendo el reporte.<br><br>Por favor, espera.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        try {
          const metrics = getMetricsForKam(kamSelected);
          currentReportMetrics = metrics; // Guardamos para la descarga posterior
          
          const aiAnalysis = await fetchIAReport(metrics);
          
          // Cerrar loading y abrir modal de edición
          Swal.close();
          
          document.getElementById('reporteModalSubtitle').innerHTML = `Desempeño de: <strong>${kamSelected}</strong>`;
          document.getElementById('reporteIAContent').value = aiAnalysis;
          document.getElementById('modalReporteIA').style.display = 'flex';
          
        } catch (error) {
          console.error(error);
          Swal.fire('Error', 'Hubo un problema al generar el reporte con IA.', 'error');
        }
      });
    }
    
    // Evento del botón para descargar el PDF ya editado
    const btnDownload = document.getElementById('btnDownloadReportPDF');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        if (!currentReportMetrics) return;
        
        const finalContent = document.getElementById('reporteIAContent').value;
        generatePDF(currentReportMetrics, finalContent);
        
        document.getElementById('modalReporteIA').style.display = 'none';
        Swal.fire({
          icon: 'success',
          title: '¡Descargado!',
          text: 'Tu reporte PDF ha sido generado exitosamente.',
          timer: 2000,
          showConfirmButton: false
        });
      });
    }
  });

})();
