const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const sb = createClient(
  'https://rfqjyiudjmoiflhhlhrc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcWp5aXVkam1vaWZsaGhsaHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1OTg4MjksImV4cCI6MjA5MzE3NDgyOX0.Y1pEn6SXLPIlEP121nBtYsllSfuPe-bJk4cWbC-bsWE'
);

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || ''
});

const API_KEY = process.env.GROQ_API_KEY || '';
const PORT = process.env.PORT || 3000;

// ── EMAIL ──────────────────────────────────────────────
async function sendProConfirmationEmail(email) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.log('[EMAIL] Variables no configuradas, saltando envío.');
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });
    await transporter.sendMail({
      from: `"Planito" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Tu plan Planito Pro está activo ✓',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;background:#FFF0E8;margin:0;padding:40px 20px;">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #FFE0D4;">
  <div style="background:#FF6B35;padding:32px;text-align:center;">
    <h1 style="color:white;font-size:28px;margin:0;">Plan<span style="color:#FFD166;">ito</span></h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Tu plan Pro está activo</p>
  </div>
  <div style="padding:36px 32px;">
    <h2 style="color:#1A1A2E;font-size:22px;margin:0 0 16px;">¡Bienvenido a Planito Pro! ✓</h2>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin-bottom:24px;">Tu pago fue acreditado y tu cuenta ya tiene acceso ilimitado. Podés generar todos los lesson plans y actividades que necesites, sin límites.</p>
    <div style="background:#FFF3ED;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="color:#FF6B35;font-weight:bold;margin:0 0 12px;font-size:14px;">TU PLAN PRO INCLUYE:</p>
      <p style="color:#374151;margin:4px 0;font-size:14px;">✓ Lesson plans ilimitados</p>
      <p style="color:#374151;margin:4px 0;font-size:14px;">✓ Actividades ilimitadas</p>
      <p style="color:#374151;margin:4px 0;font-size:14px;">✓ Exportación en PDF y .doc</p>
      <p style="color:#374151;margin:4px 0;font-size:14px;">✓ Modificaciones ilimitadas por plan</p>
    </div>
    <a href="https://planito.onrender.com" style="display:block;background:#FF6B35;color:white;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;margin-bottom:24px;">Ir a Planito →</a>
    <p style="color:#9CA3AF;font-size:13px;line-height:1.6;">¿Alguna pregunta? Respondé este mail o escribinos a <a href="mailto:${process.env.GMAIL_USER}" style="color:#FF6B35;">${process.env.GMAIL_USER}</a></p>
  </div>
  <div style="background:#1A1A2E;padding:16px 32px;text-align:center;">
    <p style="color:#4a7a9a;font-size:11px;margin:0;">Planito by Aimino Digital · planito.onrender.com</p>
  </div>
</div>
</body></html>`
    });
    console.log(`[EMAIL] Confirmación Pro enviada a ${email}`);
  } catch (err) {
    console.log('[EMAIL] Error al enviar:', err.message);
  }
}
// ───────────────────────────────────────────────────────

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

  // HOME
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // LEGAL
  if (req.method === 'GET' && (req.url === '/legal' || req.url === '/legal/')) {
    const legal = fs.readFileSync(path.join(__dirname, 'legal.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(legal);
  }

  // FAVICON
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

  // GENERATE
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { userMessage, mode, userId } = JSON.parse(body);
        console.log(`[${new Date().toISOString()}] GENERACIÓN — modo: ${mode}`);

        let userRecord = null;
        if (userId) {
          const { data: user } = await sb.from('users').select('*').eq('id', userId).single();

          if (!user) {
            await sb.from('users').insert({ id: userId, plan: 'free', lesson_count: 0, activity_count: 0 });
            userRecord = { plan: 'free', lesson_count: 0, activity_count: 0 };
          } else {
            userRecord = user;
          }

          if (userRecord.plan === 'free') {
            if (mode === 'lesson' && userRecord.lesson_count >= 3) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'LIMIT_REACHED' }));
              return;
            }
            if (mode === 'activity' && userRecord.activity_count >= 3) {
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
              if (userId && userRecord) {
                const updateData = mode === 'lesson'
                  ? { lesson_count: (userRecord.lesson_count || 0) + 1 }
                  : { activity_count: (userRecord.activity_count || 0) + 1 };
                sb.from('users').update(updateData).eq('id', userId).then(({ error }) => {
                  if (error) console.log('Update error:', error);
                });
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
      console.log('Subscribe error:', err.message, err.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
  return;
}

  // SUBSCRIBE
  if (req.method === 'POST' && req.url === '/api/subscribe') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { userId, userEmail } = JSON.parse(body);
        const preference = new Preference(mp);
        const result = await preference.create({
          body: {
            items: [{ title: 'Planito Pro — Suscripción mensual', quantity: 1, unit_price: 500, currency_id: 'ARS' }],
            payer: { email: userEmail },
            back_urls: {
              success: 'https://planito.onrender.com?payment=success',
              failure: 'https://planito.onrender.com?payment=failure',
              pending: 'https://planito.onrender.com?payment=pending'
            },
            auto_return: 'approved',
            external_reference: userId,
            notification_url: 'https://planito.onrender.com/api/webhook'
          }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ checkoutUrl: result.init_point }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // WEBHOOK
  if (req.method === 'POST' && req.url === '/api/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (data.type === 'payment' && data.data?.id) {
          const { MercadoPagoConfig: MPConfig, Payment } = require('mercadopago');
          const mpClient = new MPConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
          const payment = new Payment(mpClient);
          const paymentData = await payment.get({ id: data.data.id });
          if (paymentData.status === 'approved') {
            const userId = paymentData.external_reference;
            const payerEmail = paymentData.payer?.email;
            const { data: existingUser } = await sb.from('users').select('plan').eq('id', userId).single();
            if (existingUser?.plan !== 'pro') {
              await sb.from('users').update({ plan: 'pro' }).eq('id', userId);
              console.log(`[PAGO APROBADO] Usuario ${userId} actualizado a Pro`);
              if (payerEmail) await sendProConfirmationEmail(payerEmail);
            } else {
              console.log(`[WEBHOOK] Usuario ${userId} ya era Pro, ignorando.`);
            }
          }
        }
        res.writeHead(200);
        res.end('OK');
      } catch (err) {
        console.log('Webhook error:', err.message);
        res.writeHead(200);
        res.end('OK');
      }
    });
    return;
  }

  // VERIFY PAYMENT — llamado desde el front al volver de MP
  if (req.method === 'POST' && req.url === '/api/verify-payment') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { paymentId, userId, userEmail } = JSON.parse(body);
        if (!paymentId || !userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Faltan parámetros' }));
          return;
        }
        const { MercadoPagoConfig: MPConfig, Payment } = require('mercadopago');
        const mpClient = new MPConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const payment = new Payment(mpClient);
        const paymentData = await payment.get({ id: paymentId });
        if (paymentData.status === 'approved' && paymentData.external_reference === userId) {
          const { data: existingUser } = await sb.from('users').select('plan').eq('id', userId).single();
          if (existingUser?.plan !== 'pro') {
            await sb.from('users').update({ plan: 'pro' }).eq('id', userId);
            const emailToSend = userEmail || paymentData.payer?.email;
            if (emailToSend) await sendProConfirmationEmail(emailToSend);
            console.log(`[VERIFY-PAYMENT] Usuario ${userId} actualizado a Pro vía back_url`);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, plan: 'pro' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, status: paymentData.status }));
        }
      } catch (err) {
        console.log('[VERIFY-PAYMENT] Error:', err.message);
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
