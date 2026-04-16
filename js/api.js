/* ═══════════════════════════════════════════════
   api.js — LLM & Image API calls
═══════════════════════════════════════════════ */

/**
 * Call the LLM API (OpenAI-compatible or Anthropic)
 * Returns the assistant message string
 */
async function callLLM(messages, { providerId, model, apiKey, onStream }) {
  const provider = LLM_PROVIDERS[providerId];
  if (!provider) throw new Error('Provider inconnu: ' + providerId);

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

  // ── OpenAI-compatible format (all other providers) ─
  const body = {
    model,
    messages,
    max_tokens: 2048,
    stream: useStream,
    temperature: 0.85
  };
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  if (useStream) return streamOpenAIResponse(res, onStream);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/* ─── STREAMING helpers ─────────────────────── */
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

  if (provider.dynamicModels) {
    // Just fetch the models list as a connectivity test
    const res = await fetch(provider.modelsUrl, {
      headers: provider.getHeaders(apiKey)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  // Send a minimal message
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
    .slice(0, 80); // limit for UX
}

/* ─── Generate image ────────────────────────── */
async function generateImage(prompt, { imgProviderId, imgModel, imgApiKey, llmApiKey }) {
  const prov = IMAGE_PROVIDERS[imgProviderId];
  if (!prov || imgProviderId === 'none') return null;
  const key = imgApiKey || llmApiKey;

  const swPrompt = `Epic Star Wars scene, cinematic lighting, highly detailed: ${prompt}`;

  // ── OpenRouter image (OpenAI-compatible) ─────
  if (imgProviderId === 'openrouter_img') {
    const res = await fetch(prov.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'Star Wars Interactive Story',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: imgModel, prompt: swPrompt, n: 1 })
    });
    if (!res.ok) throw new Error(`OpenRouter Image HTTP ${res.status}`);
    const data = await res.json();
    return data.data?.[0]?.url || (data.data?.[0]?.b64_json
      ? `data:image/png;base64,${data.data[0].b64_json}` : null);
  }

  if (imgProviderId === 'together_img') {
    const res = await fetch(prov.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: imgModel, prompt: swPrompt, n: 1, width: 896, height: 512 })
    });
    if (!res.ok) throw new Error(`Image API HTTP ${res.status}`);
    const data = await res.json();
    return data.data?.[0]?.url || data.data?.[0]?.b64_json
      ? `data:image/png;base64,${data.data[0].b64_json}`
      : null;
  }

  if (imgProviderId === 'openai_img') {
    const res = await fetch(prov.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: imgModel,
        prompt: swPrompt,
        n: 1, size: '1792x1024',
        response_format: 'url'
      })
    });
    if (!res.ok) throw new Error(`Image API HTTP ${res.status}`);
    const data = await res.json();
    return data.data?.[0]?.url || null;
  }

  // ── fal.ai ───────────────────────────────────
  if (imgProviderId === 'fal_img') {
    const res = await fetch(`${prov.endpoint}/${imgModel}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: swPrompt,
        image_size: 'landscape_16_9',
        num_inference_steps: 4,
        num_images: 1
      })
    });
    if (!res.ok) throw new Error(`fal.ai HTTP ${res.status}`);
    const data = await res.json();
    return data.images?.[0]?.url || null;
  }

  if (imgProviderId === 'stability') {
    const form = new FormData();
    form.append('prompt', swPrompt);
    form.append('output_format', 'webp');
    const res = await fetch(prov.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'image/*' },
      body: form
    });
    if (!res.ok) throw new Error(`Stability HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  return null;
}
