// Privatebox Extension - Background Service Worker
// Handles all AI API calls (OpenAI, Gemini)
// VERSION 2.0 - Forces service worker refresh

console.log('[Privatebox] Background V2.0 loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request).then(sendResponse).catch(err => {
    console.error('Background error:', err);
    sendResponse({ success: false, error: err.message });
  });
  return true; // Keep channel open for async
});

async function handleMessage(request) {
  switch (request.action) {
    case 'analyzeImage':
      return await analyzeImage(request.image, request.apiKey, request.model);
    case 'generateContent':
      return await generateContent(request.analysis, request.apiKey, request.model);
    case 'generateMockups':
      return await generateMockups(request.image, request.analysis, request.apiKey, request.model, request.customPrompt, request.variation);
    case 'fetchImage':
      return await fetchImageAsBase64(request.url);
    case 'translateText':
      return await translateText(request.text, request.fromLang, request.toLang, request.type, request.apiKey, request.model);
    case 'generateVideo':
      return await generateVideo(request.image, request.apiKey, request.model);
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ==================== OpenAI Vision - Image Analysis ====================
async function analyzeImage(imageDataUrl, apiKey, model = 'gpt-4o-mini') {
  console.log(`[Background] Analyzing image with ${model}...`);

  const base64 = imageDataUrl.split(',')[1];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this handmade jewelry product image for an Etsy listing.

Return a JSON object with:
{
  "type": "necklace|bracelet|earrings|ring|anklet",
  "subtype": "specific type like pendant necklace, charm bracelet, drop earrings etc",
  "style": "boho|minimalist|vintage|modern|ethnic|beach|gothic|romantic",
  "technique": "beaded|wire-wrapped|macrame|woven|strung|miyuki|peyote|loom",
  "materials": ["list of visible materials - beads, crystals, stones, charms, etc - NO gold/silver"],
  "colors": {
    "primary": "main color",
    "secondary": ["other colors"]
  },
  "occasion": ["casual", "party", "wedding", "beach", "everyday", etc],
  "targetAudience": "women|men|unisex|teens",
  "uniqueFeatures": ["list of special features or details"],
  "estimatedSize": "small|medium|large or dimensions if visible"
}

IMPORTANT: This is costume/fashion jewelry. Do NOT mention gold, silver, or precious metals.
Focus on: beads, crystals, glass, stones, charms, pearls (faux), etc.`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: 'high'
            }
          }
        ]
      }],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  // Parse JSON from response
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

  try {
    const analysis = JSON.parse(jsonStr);
    console.log('[Background] Analysis complete:', analysis.type);
    return { success: true, data: analysis };
  } catch (e) {
    console.error('[Background] Failed to parse analysis:', e);
    return { success: false, error: 'Failed to parse analysis result' };
  }
}

// ==================== OpenAI Chat - Content Generation ====================
async function generateContent(analysis, apiKey, model = 'gpt-4o-mini') {
  console.log(`[Background] Generating content with ${model}...`);

  const prompt = `You are an expert ETSY SEO specialist for handmade BEADED fashion jewelry. Create a complete ETSY listing in BOTH English and Turkish.

⚠️ ETSY TITLE RULES (VERY IMPORTANT):
- Maximum 14 WORDS (not characters) - count carefully!
- Do NOT repeat "gift" - use it only ONCE or not at all
- Do NOT use generic phrases like "unique gift", "perfect gift", "great gift"
- Focus on PRODUCT DESCRIPTION, not occasions
- Use format: [Technique] [Product Type] [Key Feature] | [Style/Color] [Material]
- Example: "Miyuki Beaded Pendant Necklace | Boho Turquoise Crystal Jewelry"

IMPORTANT - Use specific jewelry terms:
- If technique is "miyuki" → use "Miyuki Bead" or "Miyuki Delica"
- If technique is "peyote" → use "Peyote Stitch"
- If technique is "loom" → use "Loom Beaded"
- Use subtype (e.g., "Pendant Necklace", "Drop Earrings", "Charm Bracelet")

Product Analysis:
${JSON.stringify(analysis, null, 2)}

⚠️ FORBIDDEN WORDS (NEVER use):
- "gold", "gold-plated", "gold tone", "golden", "14k", "18k"
- "silver", "sterling silver", "silver-plated", "925"
- Repetitive: "gift" more than once, "unique gift", "perfect gift"
✅ USE: "beaded", "crystal", "charm", "stone", "colorful", "glass beads", "faux pearls"

Generate a JSON object. CRITICAL: "title" and "description" MUST be in ENGLISH. "title_tr" and "description_tr" MUST be in TURKISH.

{
  "title": "(ENGLISH ONLY!) SEO title - MAX 14 WORDS! Example: Miyuki Beaded Pendant Necklace | Boho Turquoise Crystal Jewelry",
  "title_tr": "(TURKISH ONLY!) SEO title - MAX 14 WORDS! Example: Miyuki Boncuklu Kolye | Boho Turkuaz Kristal Takı",

  "description": "(ENGLISH ONLY!) Full description with formatting:\\n\\n✨ [Catchy opening]\\n\\n━━━━━━━━━━━━━━━━━━━━\\n\\n📿 FEATURES\\n• Feature 1\\n• Feature 2\\n\\n━━━━━━━━━━━━━━━━━━━━\\n\\n📏 DETAILS\\n• Size: [dimensions]\\n• Materials: [list]\\n\\n━━━━━━━━━━━━━━━━━━━━\\n\\n🎁 PERFECT FOR\\nValentine's Day • Mother's Day • Birthday\\n\\n━━━━━━━━━━━━━━━━━━━━\\n\\n💝 PACKAGING\\nComes in a beautiful gift box!\\n\\n━━━━━━━━━━━━━━━━━━━━\\n\\n🔔 CARE INSTRUCTIONS\\n• Keep away from water\\n• Store in jewelry box",

  "description_tr": "(TURKISH ONLY!) Same format but in Turkish. Headers: ÖZELLIKLER, DETAYLAR, MÜKEMMEL FIRSAT, PAKETLEME, BAKIM",

  "tags": ["13 English SEO tags"],
  "price": 2500,
  "materials": ["beads", "crystals"],
  "primaryColor": "main color",
  "secondaryColor": "secondary color or null"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an ETSY SEO expert for handmade BEADED fashion jewelry. NEVER use: gold, silver, sterling, precious metals. IMPORTANT: "title" and "description" fields MUST be in ENGLISH. "title_tr" and "description_tr" fields MUST be in TURKISH. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  // Parse JSON
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

  try {
    const listing = JSON.parse(jsonStr);
    console.log('[Background] Content generated:', listing.title?.slice(0, 50));
    return { success: true, data: listing };
  } catch (e) {
    console.error('[Background] Failed to parse content:', e);
    return { success: false, error: 'Failed to parse content result' };
  }
}

// ==================== Gemini - Mockup Generation ====================
async function generateMockups(imageDataUrl, analysis, apiKey, model = 'gemini-2.5-flash-image', customPrompt = null, variation = 0) {
  console.log(`[Background] Generating mockups with ${model}...`);

  const base64 = imageDataUrl.split(',')[1];
  const productType = analysis?.type || 'necklace';

  const modelType = productType.toLowerCase() === 'earrings' ? 'earring' :
                    productType.toLowerCase() === 'bracelets' ? 'bracelet' :
                    productType.toLowerCase() === 'rings' ? 'ring' :
                    productType.toLowerCase() === 'necklaces' ? 'necklace' :
                    productType.toLowerCase();

  const preserveInstruction = `CRITICAL: The jewelry in the output MUST be IDENTICAL to the reference image. Do NOT modify, simplify, or reinterpret the design. Keep every detail, bead, color, pattern, charm, and pendant EXACTLY as shown in the reference.`;

  const framingInstruction = `FRAMING: The JEWELRY must be the main focus and fill most of the frame. Crop tightly around the jewelry. If showing a model, crop the face - show only neck/chest area for necklaces, ear area for earrings. The product should be LARGE and CENTERED in the image.`;

  // Variation styles for different mockups
  const variations = [
    'Soft studio lighting, clean neutral background.',
    'Natural daylight, elegant marble surface.',
    'Warm golden hour lighting, bokeh background.',
    'Minimalist white background, professional product shot.',
    'Beach/ocean background, summer vibes.',
    'Wooden rustic table, cozy aesthetic.',
    'Luxury velvet display, high-end jewelry presentation.',
    'Garden/floral background, romantic mood.'
  ];

  const variationStyle = variations[variation % variations.length];

  let prompt;

  if (customPrompt) {
    // User provided custom prompt
    prompt = `${preserveInstruction}\n\n${framingInstruction}\n\nProfessional jewelry product photo: ${customPrompt}. Show the EXACT jewelry from the reference image. Jewelry must be large and prominent.`;
  } else {
    // Default prompts with variation - focus on jewelry, crop model's face
    const prompts = {
      necklace: `${preserveInstruction}\n\n${framingInstruction}\n\nProfessional jewelry product photo: Show the EXACT necklace on a woman's neck/chest area. CROP the image so face is NOT visible - show only from chin down to chest. The necklace must be LARGE, centered, and the main focus. ${variationStyle}`,
      earring: `${preserveInstruction}\n\n${framingInstruction}\n\nProfessional jewelry product photo: Close-up of woman's ear wearing the EXACT earrings. CROP tightly - show only ear and part of neck/jaw, not full face. Hair tucked behind ear. Earring must be LARGE and the main focus. ${variationStyle}`,
      bracelet: `${preserveInstruction}\n\n${framingInstruction}\n\nProfessional jewelry product photo: Close-up of elegant woman's wrist wearing the EXACT bracelet. The bracelet must be LARGE, sharp, and fill most of the frame. Graceful hand pose. ${variationStyle}`,
      ring: `${preserveInstruction}\n\n${framingInstruction}\n\nProfessional jewelry product photo: Close-up of elegant woman's hand wearing the EXACT ring. The ring must be LARGE, sharp, and the main focus. Manicured nails. ${variationStyle}`
    };
    prompt = prompts[modelType] || prompts.necklace;
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64
          }
        }
      ]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Background] Gemini error:', error);
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json();
    let image = null;
    let totalImagesInResponse = 0;

    // Count and only take the FIRST image from the response
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          totalImagesInResponse++;
          if (!image) {
            image = part.inlineData.data;
          }
        }
      }
    }

    console.log(`[Background] Gemini returned ${totalImagesInResponse} images, taking only 1`);

    if (image) {
      console.log('[Background] Returning exactly 1 mockup');
      return { success: true, data: [image] }; // Return as array with single item
    } else {
      console.log('[Background] No image generated');
      return { success: false, error: 'No image generated' };
    }

  } catch (error) {
    console.error('[Background] Mockup generation failed:', error);
    return { success: false, error: error.message };
  }
}

// ==================== OpenAI - Translation ====================
async function translateText(text, fromLang, toLang, type, apiKey, model = 'gpt-4o-mini') {
  console.log(`[Background] Translating ${type} from ${fromLang} to ${toLang}...`);

  const langNames = {
    en: 'English',
    tr: 'Turkish'
  };

  let systemPrompt = '';
  if (type === 'title') {
    systemPrompt = `You are a translator for Etsy product listings. Translate the following product title from ${langNames[fromLang]} to ${langNames[toLang]}.
Keep the same SEO-friendly format with | separators. Keep it under 140 characters.
IMPORTANT: This is costume/fashion jewelry - NEVER use words like gold, silver, sterling, precious metals. Use: beaded, crystal, charm, stone, etc.
Return ONLY the translated text, nothing else.`;
  } else {
    systemPrompt = `You are a translator for Etsy product listings. Translate the following product description from ${langNames[fromLang]} to ${langNames[toLang]}.
Keep the EXACT same formatting: emojis, line breaks, bullet points, section headers, dividers.
IMPORTANT: This is costume/fashion jewelry - NEVER use words like gold, silver, sterling, precious metals. Use: beaded, crystal, charm, stone, etc.
Return ONLY the translated text, nothing else.`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        max_tokens: type === 'title' ? 200 : 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const translated = data.choices[0]?.message?.content?.trim() || '';

    console.log(`[Background] Translation complete: ${translated.slice(0, 50)}...`);
    return { success: true, data: translated };

  } catch (error) {
    console.error('[Background] Translation failed:', error);
    return { success: false, error: error.message };
  }
}

// ==================== Google Veo - Video Generation ====================
async function generateVideo(imageBase64, apiKey, model = 'veo-2.0-generate-001') {
  console.log(`[Background] Generating video with ${model}...`);
  console.log(`[Background] API Key length: ${apiKey?.length || 0}`);
  console.log(`[Background] Image base64 length: ${imageBase64?.length || 0}`);

  // Clean base64 if it has data URL prefix
  const base64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  console.log(`[Background] Cleaned base64 length: ${base64?.length || 0}`);

  const prompt = `Create a smooth, elegant video animation of this jewelry product.
IMPORTANT:
- Keep the jewelry as the main focus throughout the entire video
- Use subtle, gentle camera movements (slow zoom in, slight rotation, or gentle pan)
- Add soft lighting effects that highlight the jewelry's details
- Keep the background simple and non-distracting
- The jewelry must remain sharp and in focus at all times
- Create a luxurious, high-end product video feel`;

  // Detect mime type from base64 or default to jpeg
  let mimeType = 'image/jpeg';
  if (imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
  }
  console.log(`[Background] Image mimeType: ${mimeType}`);

  const requestBody = {
    instances: [{
      prompt: prompt,
      image: {
        bytesBase64Encoded: base64,
        mimeType: mimeType
      }
    }],
    parameters: {
      aspectRatio: "9:16",
      sampleCount: 1,
      durationSeconds: 5,
      personGeneration: "dont_allow"
    }
  };

  // Veo API endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`;
  console.log(`[Background] Veo URL: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

  try {
    console.log('[Background] Starting video generation request...');

    // Start the long-running operation
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log(`[Background] Veo response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Background] Veo API error response:', errorText);

      // Try to parse error JSON
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.error?.message || errorJson.message || errorText;
        throw new Error(`Veo API: ${errorMessage}`);
      } catch (parseErr) {
        throw new Error(`Veo error ${response.status}: ${errorText.slice(0, 200)}`);
      }
    }

    const operation = await response.json();
    console.log('[Background] Video operation response:', JSON.stringify(operation).slice(0, 200));

    if (!operation.name) {
      console.error('[Background] No operation name in response:', operation);
      throw new Error('Veo API did not return an operation name');
    }

    console.log('[Background] Video operation started:', operation.name);

    // Poll for completion
    const operationName = operation.name;
    let result = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 sec intervals)

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
      attempts++;

      console.log(`[Background] Checking video status... attempt ${attempts}`);

      const statusResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
      );

      if (!statusResponse.ok) {
        console.error('[Background] Status check failed');
        continue;
      }

      const status = await statusResponse.json();

      if (status.done) {
        if (status.error) {
          throw new Error(status.error.message || 'Video generation failed');
        }
        result = status.response;
        break;
      }

      console.log(`[Background] Video still processing... ${status.metadata?.progress || 0}%`);
    }

    if (!result) {
      throw new Error('Video generation timed out');
    }

    // Extract video from result
    console.log('[Background] Full result:', JSON.stringify(result).slice(0, 1000));

    let videoUri = null;

    // The response structure is: generateVideoResponse.generatedSamples[0].video.uri
    if (result.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
      videoUri = result.generateVideoResponse.generatedSamples[0].video.uri;
      console.log('[Background] Found video URI at generateVideoResponse.generatedSamples[0].video.uri');
    }
    // Alternative: generatedVideos[0].video.uri
    else if (result.generatedVideos?.[0]?.video?.uri) {
      videoUri = result.generatedVideos[0].video.uri;
      console.log('[Background] Found video URI at generatedVideos[0].video.uri');
    }
    // Alternative: videos[0].uri
    else if (result.videos?.[0]?.uri) {
      videoUri = result.videos[0].uri;
      console.log('[Background] Found video URI at videos[0].uri');
    }

    if (!videoUri) {
      console.error('[Background] Could not find video URI in result:', Object.keys(result));
      throw new Error('No video URI in response. Keys: ' + Object.keys(result).join(', '));
    }

    console.log('[Background] Downloading video from URI...');

    // Download the video using the API key
    const videoResponse = await fetch(videoUri, {
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    console.log('[Background] Video downloaded, size:', videoBlob.size);

    // Convert to base64
    const videoData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read video'));
      reader.readAsDataURL(videoBlob);
    });

    console.log('[Background] Video converted to base64, length:', videoData.length);
    return { success: true, data: videoData };

  } catch (error) {
    console.error('[Background] Video generation failed:', error);
    return { success: false, error: error.message };
  }
}

// ==================== Fetch Image as Base64 ====================
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          success: true,
          data: reader.result,
          type: blob.type || 'image/jpeg',
          size: blob.size
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel on Etsy pages
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;

  if (tab.url.includes('etsy.com')) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'popup.html',
      enabled: true
    });
  }
});

console.log('[Privatebox] Background service worker loaded');
