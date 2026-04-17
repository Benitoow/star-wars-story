/* ═══════════════════════════════════════════════
   api.js — LLM & Image API calls with fallback
══════════════════════════════════════════════ */

function ensureApiKey(providerId, apiKey, resource = 'IA') {
  if (providerId === 'none') return;

  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error(`Clé API manquante pour ${resource}. Renseignez votre clé avant de lancer l'histoire.`);
  }
}

/* ─── Call the LLM API ────────────────────────── */
async function callLLM(messages, { providerId, model, apiKey, onStream }) {
  const provider = LLM_PROVIDERS[providerId];
  if (!provider) throw new Error('Provider inconnu: ' + providerId);
  ensureApiKey(providerId, apiKey, 'le modèle texte');

  const headers = provider.getHeaders(apiKey);
  const useStream = typeof onStream === 'function';

  // ── Anthropic format ──────────────────────────────
  if (providerId === 'anthropic') {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs  = messages.filter(m => m.role !== 'system');
    const body = {
      model,
      max_tokens: 2048,
      stream: useStream,
      messages: userMsgs,
      ...(systemMsg ? { system: systemMsg.content } : {})
    };
    const res = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST', headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    if (useStream) return streamAnthropicResponse(res, onStream);
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  // ── OpenAI-compatible format ─
  const body = {
    model,
    messages,
    max_tokens: 2048,
    stream: useStream,
    temperature: 0.85,
    // Force JSON output — honored by OpenAI, OpenRouter (when the upstream supports it),
    // Groq, Together, DeepSeek, etc. Providers that don't recognize it simply ignore it.
    response_format: { type: 'json_object' }
  };
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[LLM error]', providerId, model, err);
    throw new Error(formatProviderError(err, res.status));
  }
  if (useStream) return streamOpenAIResponse(res, onStream);
  const data = await res.json();
  if (data?.error) {
    console.error('[LLM error 200]', providerId, model, data);
    throw new Error(formatProviderError(data, 200));
  }
  return data.choices?.[0]?.message?.content || '';
}

/* ─── Extract a useful error message from provider payloads ─── */
function formatProviderError(payload, status) {
  const err = payload?.error || payload || {};
  const base = err.message || payload?.message || `HTTP ${status}`;

  // OpenRouter puts upstream details in metadata
  const meta = err.metadata || payload?.metadata;
  if (meta) {
    const parts = [];
    if (meta.provider_name) parts.push(meta.provider_name);
    if (meta.raw) {
      try {
        const raw = typeof meta.raw === 'string' ? JSON.parse(meta.raw) : meta.raw;
        const detail = raw?.error?.message || raw?.message || (typeof meta.raw === 'string' ? meta.raw : '');
        if (detail) parts.push(String(detail).slice(0, 220));
      } catch {
        if (typeof meta.raw === 'string') parts.push(meta.raw.slice(0, 220));
      }
    }
    if (Array.isArray(meta.reasons) && meta.reasons.length) parts.push(meta.reasons.join(', '));
    if (parts.length) return `${base} — ${parts.join(' · ')}`;
  }

  return base;
}

/* ─── Streaming helpers ─────────────────────── */
async function streamOpenAIResponse(res, onChunk) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      const clean = line.replace(/^data: /, '').trim();
      if (!clean || clean === '[DONE]') continue;
      try {
        const json = JSON.parse(clean);
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) { full += delta; onChunk(delta, full); }
      } catch {}
    }
  }
  return full;
}

async function streamAnthropicResponse(res, onChunk) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const clean = line.slice(6).trim();
      try {
        const json = JSON.parse(clean);
        if (json.type === 'content_block_delta') {
          const delta = json.delta?.text || '';
          if (delta) { full += delta; onChunk(delta, full); }
        }
      } catch {}
    }
  }
  return full;
}

/* ─── Test API connection ───────────────────── */
async function testApiConnection(providerId, apiKey) {
  const provider = LLM_PROVIDERS[providerId];
  const model = provider.dynamicModels
    ? null
    : provider.models[0]?.id;

  ensureApiKey(providerId, apiKey, 'la connexion API');

  if (provider.dynamicModels) {
    const res = await fetch(provider.modelsUrl, {
      headers: provider.getHeaders(apiKey)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  await callLLM(
    [{ role: 'user', content: 'Say "OK" only.' }],
    { providerId, model, apiKey }
  );
  return true;
}

/* ─── Fetch OpenRouter models ───────────────── */
async function fetchOpenRouterModels(apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: LLM_PROVIDERS.openrouter.getHeaders(apiKey)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .filter(m => m.id)
    .map(m => ({
      id: m.id,
      name: m.name || m.id,
      desc: [
        m.context_length ? `${Math.round(m.context_length/1000)}k ctx` : '',
        m.pricing?.prompt ? `$${(parseFloat(m.pricing.prompt)*1e6).toFixed(2)}/M` : ''
      ].filter(Boolean).join(' · ')
    }))
    .slice(0, 80);
}

/* ─── Enhanced image generation with fallback ─── */
async function generateImage(prompt, { imgProviderId, imgModel, imgApiKey, llmApiKey }) {
  const prov = IMAGE_PROVIDERS[imgProviderId];
  if (!prov || imgProviderId === 'none') return null;
  const key = imgProviderId === 'openrouter_img'
    ? (imgApiKey || llmApiKey)
    : imgApiKey;

  ensureApiKey(imgProviderId, key, "la génération d'image");

  const swPrompt = `Epic Star Wars scene, cinematic lighting, highly detailed: ${prompt}`;

  try {
    return await tryImageProvider(imgProviderId, swPrompt, key, imgModel);
  } catch (e) {
    console.warn(`Image provider ${imgProviderId} failed:`, e.message);
    throw e;
  }
}

/* ─── Try a specific image provider ─────────── */
async function tryImageProvider(providerId, prompt, apiKey, imgModel = null) {
  const prov = IMAGE_PROVIDERS[providerId];
  if (!prov) return null;

  const timeout = 30000; // 30 second timeout

  // OpenRouter image — uses the dedicated images endpoint
  if (providerId === 'openrouter_img') {
    const model = imgModel || prov.models[0]?.id;

    const extractImageUrl = (data) => {
      const directUrl = data?.data?.[0]?.url || data?.data?.[0]?.image_url?.url || null;
      if (directUrl) return directUrl;

      const b64 = data?.data?.[0]?.b64_json || null;
      if (b64) return `data:image/png;base64,${b64}`;

      const msg = data?.choices?.[0]?.message || {};
      const imgEntry = Array.isArray(msg.images) ? msg.images[0] : null;
      const url = imgEntry?.image_url?.url || imgEntry?.url || null;
      if (url) return url;
      if (typeof msg.content === 'string') {
        const m = msg.content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
        if (m) return m[0];
      }
      return null;
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(prov.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-OpenRouter-Title': 'Star Wars Interactive Story',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: '1024x1024'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let err = {};
        if (raw) {
          try { err = JSON.parse(raw); } catch { err = { message: raw }; }
        }
        console.error('[OpenRouter Image error]', { model, status: res.status, err, raw });
        throw new Error(formatProviderError(err, res.status));
      }

      const data = await res.json();
      const url = extractImageUrl(data);
      if (url) return url;
      throw new Error('Aucune image renvoyée par OpenRouter');
    }

    catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // Together AI
  if (providerId === 'together_img') {
    const model = imgModel || prov.models[0]?.id;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(prov.endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, n: 1, width: 896, height: 512 }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Together AI HTTP ${res.status}`);
      const data = await res.json();
      return data.data?.[0]?.url || data.data?.[0]?.b64_json
        ? `data:image/png;base64,${data.data[0].b64_json}`
        : null;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // DALL-E
  if (providerId === 'openai_img') {
    const model = imgModel || prov.models[0]?.id;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(prov.endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          n: 1, size: '1792x1024',
          response_format: 'url'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`DALL-E HTTP ${res.status}`);
      const data = await res.json();
      return data.data?.[0]?.url || null;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // fal.ai
  if (providerId === 'fal_img') {
    const model = imgModel || prov.models[0]?.id;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${prov.endpoint}/${model}`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_size: 'landscape_16_9',
          num_inference_steps: 4,
          num_images: 1
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`fal.ai HTTP ${res.status}`);
      const data = await res.json();
      return data.images?.[0]?.url || null;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // Stability AI
  if (providerId === 'stability') {
    const model = imgModel || prov.models[0]?.id;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('output_format', 'webp');
      const res = await fetch(prov.endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
        body: form,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Stability HTTP ${res.status}`);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  return null;
}

/* ─── Retry image generation with exponential backoff ─── */
async function generateImageWithRetry(prompt, options, maxRetries = 3) {
  let lastError;

  function isRetryableImageError(error) {
    const message = String(error?.message || error || '');
    return !/401|403|CORS|blocked by CORS|Failed to fetch|Missing Authentication header/i.test(message);
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await generateImage(prompt, options);
      if (result) return result;

      // If result is null but no error, wait and retry
      lastError = new Error('No image returned');
    } catch (e) {
      lastError = e;
      if (!isRetryableImageError(e)) break;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError || new Error('Image generation failed after retries');
}

/* ─── Generate placeholder SVG for failed images ─── */
function generatePlaceholderSVG(text, factionColor) {
  const color = factionColor || '#FFE81F';
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a1a"/>
          <stop offset="100%" style="stop-color:#1a1a3a"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect fill="url(#bg)" width="800" height="400"/>
      <circle cx="400" cy="200" r="60" fill="none" stroke="${color}" stroke-width="2" opacity="0.5"/>
      <text x="400" y="195" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="14" opacity="0.8">STAR WARS</text>
      <text x="400" y="215" text-anchor="middle" fill="#888" font-family="sans-serif" font-size="11">${text}</text>
      <path d="M370 180 L400 150 L430 180" fill="none" stroke="${color}" stroke-width="2" filter="url(#glow)"/>
      <circle cx="400" cy="250" r="80" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="5,5" opacity="0.3"/>
    </svg>
  `)}`;
}
