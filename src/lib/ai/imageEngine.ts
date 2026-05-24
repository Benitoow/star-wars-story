import { recordDiagnosticEvent } from '$lib/utils/logger';

export interface ImageGenerationConfig {
  providerId: string;
  model: string;
  apiKey?: string;
  textApiKey?: string;
}

/**
 * Télécharge une image depuis une URL externe et la convertit en Base64.
 * En cas d'échec (ex: restrictions CORS), renvoie gracieusement l'URL d'origine.
 */
export async function convertUrlToBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Le résultat du lecteur n\'est pas une chaîne.'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`[Base64 Conversion failed] Gracefully falling back to original URL. Reason:`, error);
    return url;
  }
}

/**
 * Appelle le provider d'image choisi pour générer une illustration.
 * Renvoie une chaîne Base64 (data:image/...) ou une URL directe.
 */
export async function callImageModel(prompt: string, config: ImageGenerationConfig): Promise<string> {
  const providerId = config.providerId;
  const model = config.model || '';

  if (providerId === 'none' || !providerId) {
    throw new Error("Aucun fournisseur d'images n'est configuré.");
  }

  // Clé d'API avec fallback pour OpenRouter
  const rawKey = providerId === 'openrouter_img'
    ? (config.apiKey || config.textApiKey || '')
    : (config.apiKey || '');
  const apiKey = rawKey.trim();

  if (!apiKey) {
    const providerName = providerId === 'openrouter_img' ? 'OpenRouter Images' : providerId === 'fal_img' ? 'fal.ai' : providerId === 'openai_img' ? 'OpenAI' : 'Stability AI';
    throw new Error(`Clé API manquante pour ${providerName}. Veuillez la renseigner dans les Paramètres.`);
  }

  const timeoutMs = 45000; // 45 secondes de délai d'attente
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  recordDiagnosticEvent({
    level: 'info',
    category: 'image-generation',
    stage: 'request-init',
    message: `Lancement de la génération d'image via ${providerId} (${model})`,
    providerId,
    model,
    validation: 'passed',
    meta: { promptLength: prompt.length }
  });

  try {
    let resultUrl = '';

    // ─── 1. OpenRouter Images ──────────────────────────
    if (providerId === 'openrouter_img') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
          'X-Title': 'Star Wars Story Manager'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          modalities: ['image']
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      const data = await res.json() as any;

      // Parsing très robuste du format OpenRouter (supportant à la fois le completions et l'images/generations)
      const directUrl = data?.data?.[0]?.url || data?.data?.[0]?.image_url?.url || null;
      if (directUrl) {
        resultUrl = directUrl;
      } else {
        const b64 = data?.data?.[0]?.b64_json || null;
        if (b64) {
          resultUrl = `data:image/png;base64,${b64}`;
        } else {
          const msg = data?.choices?.[0]?.message || {};
          const imgEntry = Array.isArray(msg.images) ? msg.images[0] : null;
          const url = imgEntry?.image_url?.url || imgEntry?.url || null;
          if (url) {
            resultUrl = url;
          } else if (typeof msg.content === 'string') {
            const match = msg.content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
            if (match) resultUrl = match[0];
          }
        }
      }

      if (!resultUrl) {
        throw new Error("Aucune image renvoyée dans la réponse d'OpenRouter Images.");
      }
    }

    // ─── 2. fal.ai ──────────────────────────────────────
    else if (providerId === 'fal_img') {
      const res = await fetch(`https://queue.fal.run/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          image_size: 'square',
          num_inference_steps: 4,
          num_images: 1
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      const data = await res.json() as any;
      const url = data.images?.[0]?.url || null;
      if (!url) throw new Error("Aucune image renvoyée par fal.ai.");
      resultUrl = url;
    }

    // ─── 3. OpenAI Images (DALL-E) ──────────────────────
    else if (providerId === 'openai_img') {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'url'
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      const data = await res.json() as any;
      const url = data.data?.[0]?.url || null;
      if (!url) throw new Error("Aucune image renvoyée par OpenAI.");
      resultUrl = url;
    }

    // ─── 4. Stability AI ───────────────────────────────
    else if (providerId === 'stability') {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('output_format', 'webp');
      
      const endpoint = model === 'core' 
        ? 'https://api.stability.ai/v2beta/stable-image/generate/core'
        : 'https://api.stability.ai/v2beta/stable-image/generate/ultra';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'image/*'
        },
        body: form,
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      resultUrl = `data:image/webp;base64,${base64}`;
    }

    else {
      throw new Error(`Provider d'images non supporté: ${providerId}`);
    }

    // Conversion en Base64 pour persistance éternelle
    const finalBase64 = await convertUrlToBase64(resultUrl);

    recordDiagnosticEvent({
      level: 'info',
      category: 'image-generation',
      stage: 'request-complete',
      message: `Portrait généré avec succès (${finalBase64.startsWith('data:') ? 'Base64' : 'URL'})`,
      providerId,
      model,
      validation: 'passed'
    });

    return finalBase64;

  } catch (error: any) {
    const isAbort = error?.name === 'AbortError' || /timeout|abort/i.test(error?.message || '');
    const message = isAbort ? "Délai d'attente dépassé (45s)." : (error?.message || 'Erreur inconnue');

    recordDiagnosticEvent({
      level: 'error',
      category: 'image-generation',
      stage: 'request-failed',
      message: `Échec de la génération d'image : ${message}`,
      providerId,
      model,
      validation: 'failed'
    });

    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
}
