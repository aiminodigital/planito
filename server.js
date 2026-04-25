const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GROQ_API_KEY || '';
const PORT = process.env.PORT || 3000;
const CORDOBA_CONTEXT = `
MARCO CURRICULAR — LENGUA EXTRANJERA INGLÉS — PROVINCIA DE CÓRDOBA (curriculumcordoba.ar)
ENFOQUE: Perspectiva comunicativa e intercultural. Cuatro macro-habilidades: speaking, listening, reading, writing.
PRIMARIA: 1°-2°: rutinas, saludos, vocabulario básico. 3°-4°: intercambios simples, presente simple. 5°-6°: textos más extensos, past simple.
SECUNDARIA: Ciclo Básico (1°-3°): cuatro habilidades integradas, presente/pasado/futuro. Ciclo Orientado (4°-6°): autonomía comunicativa, textos argumentativos.
TERCIARIO: dominio avanzado, análisis lingüístico, didáctica. INSTITUTOS: Marco MCER A1-C2.`;

const LESSON_PROMPT = `Sos un asistente para docentes de inglés de Córdoba, Argentina. Generás planificaciones alineadas al diseño curricular de Córdoba.
${CORDOBA_CONTEXT}
Respondé ÚNICAMENTE con JSON válido. Sin texto extra. Sin markdown. Solo el JSON puro con esta estructura:
{"titulo":"string","nivelEducativo":"string","nivelIdioma":"string","tema":"string","institucion":"string","docente":"string","cursoAnio":"string","fecha":"string","fundamentacion":"string","contenidosCurriculares":"string","propositos":["string"],"dias":[{"numero":1,"titulo":"string","objetivo":"string","actividades":[{"nombre":"string","duracion":0,"materiales":"string","descripcion":"string","objetivo":"string"}]}],"recursos":"string","criteriosEvaluacion":["string"]}`;

const ACTIVITY_PROMPT = `Sos un asistente para docentes de inglés de Córdoba, Argentina. Generás actividades listas para usar en el aula, alineadas al DC de Córdoba.
${CORDOBA_CONTEXT}
Respondé ÚNICAMENTE con JSON válido. Sin texto extra. Sin markdown. Solo el JSON puro con esta estructura exacta:
{"titulo":"string","tipoActividad":"string","nivel":"string","tema":"string","objetivo":"string","tiempoEstimado":0,"instruccionesAlumnos":"string","instruccionesDocente":"string","items":[{"numero":1,"contenido":"string","opciones":["string"],"respuesta":"string"}],"extension":"string"}
IMPORTANTE: El campo "opciones" solo se usa para Multiple Choice. Para otros tipos, dejarlo como array vacío []. Generá entre 8 y 15 items según el tipo de actividad.`;

const server = http.createServer((req, res) => {

  if (req.method === 'GET' && req.url === '/') {
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
    req.on('end', () => {
      try {
        const { userMessage, mode } = JSON.parse(body);
        const systemPrompt = mode === 'activity' ? ACTIVITY_PROMPT : LESSON_PROMPT;

        const groqPayload = JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 2000,
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
