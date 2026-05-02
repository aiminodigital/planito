const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://rfqjyiudjmoiflhhlhrc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcWp5aXVkam1vaWZsaGhsaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1OTg4MjksImV4cCI6MjA5MzE3NDgyOX0.Y1pEn6SXLPIlEP121nBtYsllSfuPe-bJk4cWbC-bsWE'
);
const API_KEY = process.env.GROQ_API_KEY || '';
const PORT = process.env.PORT || 3000;
const CORDOBA_CONTEXT = `
MARCO CURRICULAR — LENGUA EXTRANJERA INGLÉS — PROVINCIA DE CÓRDOBA (curriculumcordoba.ar)
ENFOQUE: Perspectiva comunicativa e intercultural. Cuatro macro-habilidades: speaking, listening, reading, writing.
PRIMARIA: 1°-2°: rutinas, saludos, vocabulario básico. 3°-4°: intercambios simples, presente simple. 5°-6°: textos más extensos, past simple.
SECUNDARIA: Ciclo Básico (1°-3°): cuatro habilidades integradas, presente/pasado/futuro. Ciclo Orientado (4°-6°): autonomía comunicativa, textos argumentativos.
TERCIARIO: dominio avanzado, análisis lingüístico, didáctica. INSTITUTOS: Marco MCER A1-C2.`;

const LESSON_PROMPT = `Sos un asistente para docentes de inglés de Córdoba, Argentina. Generás planificaciones de clase detalladas y accionables, alineadas al diseño curricular de Córdoba.
${CORDOBA_CONTEXT}

NIVEL DE DETALLE OBLIGATORIO — leé con atención:
- "pasos": pasos numerados que describen la mecánica exacta de la actividad. Ej: "1. La docente escribe las palabras en el pizarrón. 2. Los alumnos recortan cada palabra. 3. Mezclan el orden y lo entregan a otro grupo. 4. El grupo receptor ordena las palabras para descubrir la norma."
- "lenguajeDocente": SOLO preguntas de contenido e instrucciones específicas al tema. Ej: "What do you do every morning?", "How do you say 'desayuno' in English?", "Raise your hand if you wake up before 7am." NO incluyas frases de elogio genéricas como "Great job!", "Well done!" o "Excellent!" — esas no van en este campo.
- "inicio.descripcion": qué hace y dice el docente para abrir la clase, cómo conecta con la clase anterior.
- "inicio.lenguajeDocente": preguntas concretas del warm-up directamente relacionadas con el tema de la clase.
- "cierre.descripcion": cómo el docente repasa y cierra, qué pregunta a los alumnos sobre lo aprendido.
- "cierre.anticipacion": qué se anticipa para la próxima clase.
- "habilidadesLinguisticas": descripción específica de cómo se trabaja cada macro-habilidad en esa clase puntual.
- "evaluacion.criterios": conductas observables. Ej: ["correcta formación de preguntas", "pronunciación durante Listen and Repeat", "participación en trabajo grupal"].
- "fundamentacion": 2-3 oraciones que expliquen por qué este tema es relevante para este nivel, qué habilidades comunicativas desarrolla y cómo se alinea al enfoque del DC Córdoba. No mencionar solo el DC — explicar el por qué pedagógico.

Respondé ÚNICAMENTE con JSON válido. Sin texto extra. Sin markdown. Solo el JSON puro con esta estructura exacta:
{"titulo":"string","nivelEducativo":"string","nivelIdioma":"string","tema":"string","institucion":"string","docente":"string","cursoAnio":"string","fecha":"string","fundamentacion":"string","contenidosCurriculares":"string","propositos":["string"],"dias":[{"numero":1,"titulo":"string","objetivo":"string","habilidadesLinguisticas":{"listening":"string","speaking":"string","reading":"string","writing":"string"},"inicio":{"duracion":0,"descripcion":"string","lenguajeDocente":["string"]},"actividades":[{"nombre":"string","duracion":0,"materiales":"string","descripcion":"string","pasos":["string"],"lenguajeDocente":["string"],"objetivo":"string"}],"cierre":{"duracion":0,"descripcion":"string","anticipacion":"string"},"evaluacion":{"criterios":["string"],"tipo":"string"}}],"recursos":"string","criteriosEvaluacion":["string"]}`;

const ACTIVITY_PROMPT = `Sos un asistente para docentes de inglés de Córdoba, Argentina. Generás actividades listas para usar en el aula, alineadas al DC de Córdoba.
${CORDOBA_CONTEXT}
Respondé ÚNICAMENTE con JSON válido. Sin texto extra. Sin markdown. Solo el JSON puro con esta estructura exacta:
{"titulo":"string","tipoActividad":"string","nivel":"string","tema":"string","objetivo":"string","tiempoEstimado":0,"instruccionesAlumnos":"string","instruccionesDocente":"string","items":[{"numero":1,"contenido":"string","opciones":["string"],"respuesta":"string"}],"extension":"string"}
IMPORTANTE: El campo "opciones" solo se usa para Multiple Choice. Para otros tipos, dejarlo como array vacío []. Generá entre 8 y 15 items según el tipo de actividad.`;

const server = http.createServer((req, res) => {

  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (req.method === 'GET' && req.url === '/favicon.svg') {
    try {
      const favicon = fs.readFileSync(path.join(__dirname, 'favicon.svg'));
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end(favicon);
    } catch (e) {
      res.writeHead(404);
      return res.end('favicon not found');
    }
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
  try {
    const { userMessage, mode, userId } = JSON.parse(body);
console.log(`[${new Date().toISOString()}] GENERACIÓN — modo: ${mode}`);

// Verificar usuario y límites
if (userId) {
  let { data: user } = await sb.from('users').select('*').eq('id', userId).single();
  
  if (!user) {
    // Primera vez — crear registro
    await sb.from('users').insert({ id: userId, plan: 'free', lesson_count: 0, activity_count: 0 });
    user = { plan: 'free', lesson_count: 0, activity_count: 0 };
  }

  if (user.plan === 'free') {
    if (mode === 'lesson' && user.lesson_count >= 3) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'LIMIT_REACHED' }));
      return;
    }
    if (mode === 'activity' && user.activity_count >= 3) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'LIMIT_REACHED' }));
      return;
    }
  }
}
        const systemPrompt = mode === 'activity' ? ACTIVITY_PROMPT : LESSON_PROMPT;

        const groqPayload = JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 8000,
          temperature: 0.7
        });

        const options = {
          hostname: 'api.groq.com',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Length': Buffer.byteLength(groqPayload)
          }
        };

        const apiReq = https.request(options, apiRes => {
          let data = '';
          apiRes.on('data', chunk => data += chunk);
          apiRes.on('end', () => {
            console.log('Groq status:', apiRes.statusCode);
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: parsed.error.message }));
              }
              const text = parsed.choices?.[0]?.message?.content;
              if (!text) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Sin respuesta del modelo.' }));
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ text }));
              // Incrementar contador
              if (userId) {
                const field = mode === 'lesson' ? 'lesson_count' : 'activity_count';
                const updateData = mode === 'lesson' 
  ? { lesson_count: (user.lesson_count || 0) + 1 }
  : { activity_count: (user.activity_count || 0) + 1 };
await sb.from('users').update(updateData).eq('id', userId);
              }
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Error: ' + e.message }));
            }
          });
        });

        apiReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        apiReq.write(groqPayload);
        apiReq.end();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n✅ Servidor corriendo en http://localhost:${PORT}\n`);
  console.log('   Abrí esa URL en tu navegador.');
  console.log('   Para detenerlo: Ctrl + C\n');
});
