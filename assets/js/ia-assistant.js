// ia-assistant.js — Asistente IA con Groq (llama-3.1-8b-instant)
// Tiene acceso al contexto del CRM para responder sobre médicos, cotizaciones y seguimientos.

(function () {
  const GROQ_URL = '/api/groq';
  const MODEL    = 'llama-3.1-8b-instant';

  /* ── Obtener contexto CRM del estado global ─────────────────── */
  function getCRMContext() {
    try {
      const medicos   = window.MED_BASE   || [];
      const cots      = window.COT_BASE   || [];
      const kamActual = window.__kamSelected || 'Todos';

      const medFiltrados = kamActual !== 'Todos'
        ? medicos.filter(m => (m['GERENTE/KAM'] || m.kam || '').toUpperCase() === kamActual.toUpperCase())
        : medicos;

      const cotFiltradas = kamActual !== 'Todos'
        ? cots.filter(c => (c['KAM'] || '').toUpperCase() === kamActual.toUpperCase())
        : cots;

      const totalMed = medFiltrados.length;
      const totalCot = cotFiltradas.length;
      const pendientes  = cotFiltradas.filter(c => (c['STATUS'] || '').toUpperCase().includes('PENDIENTE')).length;
      const confirmadas = cotFiltradas.filter(c => (c['STATUS'] || '').toUpperCase().includes('CONFIRM')).length;

      const totalValor = cotFiltradas.reduce((s, c) => {
        const v = parseFloat((c['VALOR'] || '0').toString().replace(/[^0-9.]/g, ''));
        return s + (isNaN(v) ? 0 : v);
      }, 0);

      // Esquemas más frecuentes
      const esquemas = {};
      cotFiltradas.forEach(c => {
        const e = c['ESQUEMA'] || 'Sin esquema';
        esquemas[e] = (esquemas[e] || 0) + 1;
      });
      const topEsquemas = Object.entries(esquemas)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      // Estados con más médicos
      const estados = {};
      medFiltrados.forEach(m => {
        const e = m['Estado'] || m.estado || 'Desconocido';
        estados[e] = (estados[e] || 0) + 1;
      });
      const topEstados = Object.entries(estados)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      // KAMs disponibles
      const kams = [...new Set(medicos.map(m => m['GERENTE/KAM'] || m.kam || '').filter(Boolean))];

      return {
        kamActual,
        totalMed,
        totalCot,
        pendientes,
        confirmadas,
        totalValor: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalValor),
        topEsquemas,
        topEstados,
        kams: kams.join(', '),
        conversion: totalCot > 0 ? ((confirmadas / totalCot) * 100).toFixed(1) + '%' : '0%',
      };
    } catch (e) {
      return { error: 'No se pudo leer el contexto del CRM' };
    }
  }

  function buildSystemPrompt(ctx) {
    return `Eres el Asistente de IA del CRM INNVIDA, una empresa farmacéutica especializada en oncología en México.
Eres conciso, profesional y hablas siempre en español.
Tu rol es ayudar a los KAMs (Key Account Managers) a tomar decisiones sobre su cartera de médicos y cotizaciones.

CONTEXTO ACTUAL DEL CRM (datos en tiempo real):
- KAM seleccionado: ${ctx.kamActual}
- Total de médicos en cartera: ${ctx.totalMed}
- Total de cotizaciones: ${ctx.totalCot}
  - Pendientes: ${ctx.pendientes}
  - Confirmadas: ${ctx.confirmadas}
  - Tasa de conversión: ${ctx.conversion}
- Valor total del pipeline: ${ctx.totalValor}
- Esquemas más cotizados: ${ctx.topEsquemas}
- Estados con más médicos: ${ctx.topEstados}
- KAMs del equipo: ${ctx.kams}

Puedes:
1. Responder preguntas sobre los datos del CRM
2. Sugerir próximas acciones de seguimiento
3. Analizar el pipeline y dar recomendaciones
4. Ayudar a redactar notas de seguimiento
5. Comparar rendimiento entre KAMs (si tienes permisos de admin)

Siempre responde de forma breve (máximo 3-4 oraciones a menos que se pida más detalle).
Si no tienes información suficiente, dilo claramente.`;
  }

  /* ── Chat API call ───────────────────────────────────────────── */
  async function callGroq(messages) {
    const ctx = getCRMContext();
    const systemMsg = { role: 'system', content: buildSystemPrompt(ctx) };
    const payload = {
      model: MODEL,
      messages: [systemMsg, ...messages],
      max_tokens: 512,
      temperature: 0.7,
      stream: false,
    };

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '(Sin respuesta)';
  }

  /* ── Estado del chat ──────────────────────────────────────────── */
  const history = [];

  /* ── UI ───────────────────────────────────────────────────────── */
  function createUI() {
    // Botón flotante
    const floatBtn = document.createElement('button');
    floatBtn.id = 'aiFloatBtn';
    floatBtn.title = 'Asistente IA';
    floatBtn.innerHTML = '✦';
    document.body.appendChild(floatBtn);

    // Ventana de chat
    const chatWin = document.createElement('div');
    chatWin.id = 'aiChat';
    chatWin.innerHTML = `
      <div class="ai-chat-header">
        <div>
          <div class="ai-chat-title">✦ Asistente INNVIDA IA</div>
          <div class="ai-chat-sub">Powered by Groq · Llama 3.1</div>
        </div>
        <button class="ai-chat-close" id="aiChatClose">✕</button>
      </div>
      <div class="ai-chat-messages" id="aiChatMessages">
        <div class="ai-msg assistant">
          ¡Hola! Soy tu asistente de IA del CRM INNVIDA. Puedo ayudarte a analizar tu cartera, 
          sugerir acciones de seguimiento y responder preguntas sobre tus médicos y cotizaciones. ¿En qué te ayudo hoy?
        </div>
      </div>
      <div class="ai-chat-input">
        <input id="aiChatInput" type="text" placeholder="Escribe tu pregunta…" autocomplete="off">
        <button id="aiChatSend">➤</button>
      </div>
    `;
    document.body.appendChild(chatWin);

    /* Eventos */
    floatBtn.addEventListener('click', () => {
      chatWin.classList.toggle('open');
      if (chatWin.classList.contains('open')) {
        document.getElementById('aiChatInput')?.focus();
      }
    });

    document.getElementById('aiChatClose').addEventListener('click', () => {
      chatWin.classList.remove('open');
    });

    const sendBtn = document.getElementById('aiChatSend');
    const inputEl = document.getElementById('aiChatInput');

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';

      appendMessage('user', text);
      history.push({ role: 'user', content: text });

      const thinkingEl = appendMessage('thinking', 'Analizando tu CRM…');

      try {
        const reply = await callGroq(history.slice(-10)); // últimos 10 mensajes de contexto
        thinkingEl.remove();
        appendMessage('assistant', reply);
        history.push({ role: 'assistant', content: reply });
      } catch (e) {
        thinkingEl.remove();
        appendMessage('assistant', `❌ Error al conectar con la IA: ${e.message}`);
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function appendMessage(role, text) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return null;
    const el = document.createElement('div');
    el.className = `ai-msg ${role}`;
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  /* ── Inicializar ─────────────────────────────────────────────── */
  function init() {
    createUI();
    console.log('[IA] Asistente INNVIDA IA listo (Groq)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
