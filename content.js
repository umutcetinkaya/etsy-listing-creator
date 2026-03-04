// Privatebox ETSY Filler - Content Script
// This script runs on ETSY listing pages and fills the form

// Prevent double loading
if (window.__privateboxLoaded) {
  console.log('[Privatebox] Content script already loaded, skipping');
} else {
  window.__privateboxLoaded = true;
  console.log('[Privatebox] Content script loaded');

  // Auto-close any dialogs on page load
  (function autoCloseDialogs() {
    const tryClose = () => {
      const specificBtn = document.querySelector('#use-dialog-e5794265-bb94-41b2-a050-87e7d62dbbbe > div.wt-dialog__header__container > div > button');
      if (specificBtn) {
        specificBtn.click();
        console.log('[Privatebox] Closed specific dialog');
        return;
      }
      const dialogCloseBtn = document.querySelector('.wt-dialog__header__container button[aria-label="Close"], .wt-dialog__header__container button.wt-dialog__close');
      if (dialogCloseBtn) {
        dialogCloseBtn.click();
        console.log('[Privatebox] Closed dialog');
      }
    };
    tryClose();
    setTimeout(tryClose, 500);
    setTimeout(tryClose, 1500);
  })();

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Privatebox] Received message:', request.action);

    if (request.action === 'ping') {
      sendResponse({ success: true, message: 'Content script is ready' });
      return false;
    }

    if (request.action === 'fillForm') {
      console.log('[Privatebox] Filling form with:', request.listing);
      fillEtsyForm(request.listing)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[Privatebox] Fill error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    if (request.action === 'getPageImages') {
      const images = getPageImages();
      console.log('[Privatebox] Found', images.length, 'images on page');
      sendResponse({ success: true, images: images });
      return false;
    }

    if (request.action === 'fetchPageImage') {
      fetchImageAsBase64(request.url)
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // async response
    }

    return false;
  });
}

// Fetch an image and convert to base64
async function fetchImageAsBase64(url) {
  try {
    // Try fetch first (works for same-origin and CORS-enabled images)
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ success: true, data: reader.result });
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.log('[Privatebox] Fetch failed, trying canvas method:', e.message);
  }

  // Fallback: use canvas (for images already loaded on page)
  return new Promise((resolve, reject) => {
    // Find the image element on the page
    const existingImg = document.querySelector(`img[src="${url}"]`) ||
                        document.querySelector(`img[src*="${url.split('/').pop()}"]`);

    if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = existingImg.naturalWidth;
        canvas.height = existingImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(existingImg, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({ success: true, data: dataUrl });
        return;
      } catch (e) {
        console.log('[Privatebox] Canvas from existing image failed:', e.message);
      }
    }

    // Last resort: load image fresh
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({ success: true, data: dataUrl });
      } catch (e) {
        reject(new Error('Canvas tainted - CORS restriction'));
      }
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

// Get all meaningful images from the current page
function getPageImages() {
  const images = [];
  const seen = new Set();
  const minSize = 80; // Minimum dimension to consider (filter out icons)

  // Get all img elements
  document.querySelectorAll('img').forEach(img => {
    // Skip if no src
    if (!img.src || img.src.startsWith('data:')) return;

    // Skip if already seen
    if (seen.has(img.src)) return;
    seen.add(img.src);

    // Check dimensions (if available)
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;

    // Skip small images (likely icons)
    if ((width > 0 && width < minSize) || (height > 0 && height < minSize)) return;

    // Get highest resolution version (for Etsy images)
    let src = img.src;
    // Etsy uses il_xxx format, try to get larger version
    if (src.includes('etsystatic.com')) {
      src = src.replace(/il_\d+x\d+/, 'il_794xN');
    }

    images.push({
      src: src,
      alt: img.alt || '',
      width: width,
      height: height
    });
  });

  // Also check for background images on product cards
  document.querySelectorAll('[style*="background-image"]').forEach(el => {
    const style = el.getAttribute('style');
    const match = style.match(/url\(["']?([^"')]+)["']?\)/);
    if (match && match[1] && !seen.has(match[1])) {
      seen.add(match[1]);
      let src = match[1];
      if (src.includes('etsystatic.com')) {
        src = src.replace(/il_\d+x\d+/, 'il_794xN');
      }
      images.push({
        src: src,
        alt: '',
        width: 0,
        height: 0
      });
    }
  });

  // Sort by size (larger images first) and limit to 50
  return images
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))
    .slice(0, 50);
}

async function fillEtsyForm(listing) {
  try {
    showNotification('Filling form...');
    await wait(500);

    // ===== IMAGES =====
    console.log('[Privatebox] Mockups:', listing.mockups?.length || 0);
    console.log('[Privatebox] Original image:', listing.originalImage ? 'YES' : 'NO');
    console.log('[Privatebox] Videos:', listing.videos?.length || 0);

    const imagesToUpload = [];

    if (listing.mockups && listing.mockups.length > 0) {
      listing.mockups.forEach((base64, i) => {
        imagesToUpload.push({
          base64: base64,
          filename: `mockup_${i + 1}.jpg`
        });
      });
    }

    if (listing.originalImage) {
      const base64 = listing.originalImage.split(',')[1] || listing.originalImage;
      imagesToUpload.push({
        base64: base64,
        filename: 'original.jpg'
      });
    }

    if (listing.mockup_images && listing.mockup_images.length > 0) {
      console.log('[Privatebox] Using legacy mockup_images format');
      await uploadImagesFromUrls(listing.mockup_images, listing.sku);
    } else if (listing.optimized_images && listing.optimized_images.length > 0) {
      console.log('[Privatebox] Using legacy optimized_images format');
      await uploadImagesFromUrls(listing.optimized_images, listing.sku);
    } else if (imagesToUpload.length > 0) {
      console.log(`[Privatebox] Uploading ${imagesToUpload.length} images (base64)`);
      await uploadBase64Images(imagesToUpload);
    } else {
      console.log('[Privatebox] No images to upload');
    }

    // ===== VIDEOS =====
    if (listing.videos && listing.videos.length > 0) {
      console.log(`[Privatebox] Uploading ${listing.videos.length} videos`);
      await uploadVideos(listing.videos);
    }

    // ===== TITLE =====
    const titleEl = document.getElementById('listing-title-input');
    if (titleEl && listing.title) {
      await setInputValue(titleEl, listing.title);
      console.log('[Privatebox] ✓ Title filled');
    }

    // ===== DESCRIPTION =====
    const descEl = document.getElementById('listing-description-textarea');
    if (descEl && listing.description) {
      await setInputValue(descEl, listing.description);
      console.log('[Privatebox] ✓ Description filled');
    }

    // ===== PRICE =====
    const priceEl = document.getElementById('listing-price-input');
    if (priceEl && listing.price) {
      await setInputValue(priceEl, listing.price.toString());
      console.log('[Privatebox] ✓ Price filled');
    }

    // ===== QUANTITY =====
    const qtyEl = document.getElementById('listing-quantity-input');
    if (qtyEl) {
      await setInputValue(qtyEl, listing.quantity?.toString() || '9');
      console.log('[Privatebox] ✓ Quantity filled');
    }

    // ===== SKU =====
    const skuEl = document.getElementById('listing-sku-input');
    if (skuEl && listing.sku) {
      await setInputValue(skuEl, listing.sku);
      console.log('[Privatebox] ✓ SKU filled');
    }

    // ===== CATEGORY =====
    const categoryType = listing.analysis?.type || listing.category;
    if (categoryType || listing.title) {
      await selectCategory(categoryType || 'jewelry', listing.title);
    }

    // ===== TAGS =====
    if (listing.tags && listing.tags.length > 0) {
      await fillTags(listing.tags);
    }

    // ===== MATERIALS =====
    const materials = listing.materials || listing.analysis?.materials;
    if (materials && materials.length > 0) {
      await fillMaterials(materials);
    }

    // ===== CORE DETAILS =====
    await fillCoreDetails();

    // ===== SHIPPING PROFILE =====
    await selectShippingProfile();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showSuccessOverlay();

  } catch (error) {
    console.error('[Privatebox] Error:', error);
    showNotification('Error: ' + error.message, 'error');
    throw error;
  }
}

async function uploadBase64Images(images) {
  if (!images || images.length === 0) return;

  showNotification(`Uploading ${images.length} images...`);

  const files = [];
  for (const img of images) {
    try {
      const byteCharacters = atob(img.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const file = new File([blob], img.filename, { type: 'image/jpeg' });
      files.push(file);
      console.log(`[Privatebox] Prepared: ${img.filename}`);
    } catch (err) {
      console.error(`[Privatebox] Error preparing image:`, err);
    }
  }

  if (files.length === 0) {
    console.warn('[Privatebox] No images could be prepared');
    return;
  }

  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));

  const fileInput = document.querySelector('input[type="file"]');
  if (fileInput) {
    try {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[Privatebox] ✓ ${files.length} images uploaded via file input`);
      await wait(1000);
      return;
    } catch (e) {
      console.log('[Privatebox] File input failed, trying drag-drop');
    }
  }

  const dropZone = document.querySelector('[data-drop-target="true"]') ||
                   document.querySelector('[class*="drag-drop"]') ||
                   document.querySelector('[class*="dropzone"]') ||
                   document.querySelector('[class*="photo-upload"]');

  if (dropZone) {
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer
    });
    dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
    dropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
    dropZone.dispatchEvent(dropEvent);
    console.log(`[Privatebox] ✓ ${files.length} images uploaded via drag-drop`);
    await wait(1000);
  } else {
    console.warn('[Privatebox] Could not find drop zone');
  }
}

// Upload videos to Etsy
async function uploadVideos(videos) {
  if (!videos || videos.length === 0) return;

  showNotification(`Uploading ${videos.length} video(s)...`);

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    try {
      // Extract base64 data
      let base64Data = video.data;
      let mimeType = 'video/mp4';

      if (base64Data.startsWith('data:')) {
        const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      // Convert to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let j = 0; j < byteCharacters.length; j++) {
        byteNumbers[j] = byteCharacters.charCodeAt(j);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const file = new File([blob], `video_${i + 1}.mp4`, { type: mimeType });

      console.log(`[Privatebox] Prepared video: video_${i + 1}.mp4, size: ${blob.size}`);

      // Find video upload input - Etsy has a separate video upload section
      const videoInput = document.querySelector('input[type="file"][accept*="video"]') ||
                         document.querySelector('input[type="file"][accept*="mp4"]') ||
                         document.querySelector('[data-video-upload] input[type="file"]');

      if (videoInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        videoInput.files = dataTransfer.files;
        videoInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[Privatebox] ✓ Video ${i + 1} uploaded via file input`);
        await wait(2000);
        continue;
      }

      // Try to find video drop zone
      const videoDropZone = document.querySelector('[class*="video-upload"]') ||
                            document.querySelector('[class*="video-drop"]') ||
                            document.querySelector('[data-video-upload]') ||
                            document.querySelector('[aria-label*="video"]');

      if (videoDropZone) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dataTransfer
        });
        videoDropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
        videoDropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
        videoDropZone.dispatchEvent(dropEvent);
        console.log(`[Privatebox] ✓ Video ${i + 1} uploaded via drag-drop`);
        await wait(2000);
        continue;
      }

      // Last resort: try any file input that might accept videos
      const anyFileInput = document.querySelectorAll('input[type="file"]');
      for (const input of anyFileInput) {
        const accept = input.getAttribute('accept') || '';
        if (accept.includes('video') || accept.includes('mp4') || accept === '*/*' || !accept) {
          try {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[Privatebox] ✓ Video ${i + 1} uploaded via generic file input`);
            await wait(2000);
            break;
          } catch (e) {
            continue;
          }
        }
      }
    } catch (err) {
      console.error(`[Privatebox] Error uploading video ${i + 1}:`, err);
    }
  }
}

async function uploadImagesFromUrls(imageUrls, sku) {
  if (!imageUrls || imageUrls.length === 0) return;

  const dropZone = document.querySelector('[data-drop-target="true"]') ||
                   document.querySelector('[class*="drag-drop"]') ||
                   document.querySelector('[class*="dropzone"]') ||
                   document.querySelector('[class*="photo-upload"]') ||
                   document.querySelector('[class*="image-upload"]') ||
                   document.querySelector('.wt-validation') ||
                   document.querySelector('[class*="listing-photo"]');

  if (!dropZone) {
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      if (div.textContent?.includes('Drag and drop') || div.textContent?.includes('drag and drop')) {
        const target = div.closest('[class*="upload"]') || div.parentElement || div;
        if (target) {
          await performDrop(target, imageUrls, sku);
          return;
        }
      }
    }
  }

  if (dropZone) {
    await performDrop(dropZone, imageUrls, sku);
  } else {
    console.warn('[Privatebox] Could not find image drop zone');
    showNotification('Could not find image upload area', 'error');
  }
}

async function performDrop(dropZone, imageUrls, sku) {
  const API_URL = 'http://localhost:3000';
  const files = [];

  showNotification(`Uploading ${imageUrls.length} images...`);

  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const filename = imageUrl.split('/').pop();
    const isMockup = imageUrl.includes('/mockups/');
    const fullUrl = isMockup
      ? `${API_URL}/uploads/${sku}/mockups/${filename}`
      : `${API_URL}/uploads/${sku}/${filename}`;

    try {
      console.log(`[Privatebox] Fetching image via background: ${fullUrl}`);
      const result = await chrome.runtime.sendMessage({
        action: 'fetchImage',
        url: fullUrl
      });

      if (!result.success) {
        console.warn(`[Privatebox] Failed to fetch ${fullUrl}: ${result.error}`);
        continue;
      }

      const response = await fetch(result.data);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: result.type });
      files.push(file);
      console.log(`[Privatebox] Prepared image: ${filename}`);
    } catch (err) {
      console.error(`[Privatebox] Error fetching image ${fullUrl}:`, err);
    }
  }

  if (files.length === 0) {
    console.warn('[Privatebox] No images could be loaded');
    return;
  }

  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));

  const fileInput = document.querySelector('input[type="file"]');
  if (fileInput) {
    try {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[Privatebox] ✓ ${files.length} images added via file input`);
      await wait(1000);
      return;
    } catch (e) {
      console.log('[Privatebox] File input approach failed, trying drag-drop');
    }
  }

  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer
  });

  dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dataTransfer }));
  await wait(100);
  dropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dataTransfer }));
  await wait(100);
  dropZone.dispatchEvent(dropEvent);

  console.log(`[Privatebox] ✓ ${files.length} images dropped`);
  await wait(2000);
}

async function selectCategory(categoryType, title = '') {
  const categoryInput = document.getElementById('category-field-search');
  if (!categoryInput) {
    console.warn('[Privatebox] Category input not found');
    return;
  }

  let searchTerm = categoryType;
  if (title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('pendant necklace')) searchTerm = 'pendant necklace';
    else if (titleLower.includes('charm necklace')) searchTerm = 'charm necklace';
    else if (titleLower.includes('beaded necklace')) searchTerm = 'beaded necklace';
    else if (titleLower.includes('chain necklace')) searchTerm = 'chain necklace';
    else if (titleLower.includes('choker')) searchTerm = 'choker';
    else if (titleLower.includes('bracelet')) searchTerm = 'bracelet';
    else if (titleLower.includes('earring')) searchTerm = 'earring';
    else if (titleLower.includes('ring')) searchTerm = 'ring';
  }

  console.log(`[Privatebox] Searching category: ${searchTerm}`);

  categoryInput.focus();
  await wait(200);
  await setInputValue(categoryInput, searchTerm);
  await wait(800);
  await wait(500);

  const dropdownItems = document.querySelectorAll('ul > div > li');

  if (dropdownItems.length > 0) {
    const firstItem = dropdownItems[0];
    console.log('[Privatebox] Found dropdown item:', firstItem.textContent?.slice(0, 50));
    firstItem.scrollIntoView({ behavior: 'instant', block: 'center' });
    await wait(100);
    firstItem.click();
    await wait(100);
    const clickableChild = firstItem.querySelector('button, a, div, span') || firstItem;
    clickableChild.click();
    console.log('[Privatebox] ✓ Category selected');
    await wait(500);
    return;
  }

  const altItems = document.querySelectorAll('li[class*="wt-"], [role="option"], [class*="suggestion"] li');
  if (altItems.length > 0) {
    altItems[0].click();
    console.log('[Privatebox] ✓ Category selected (alt)');
    await wait(500);
    return;
  }

  console.log('[Privatebox] Trying keyboard navigation for category');
  categoryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
  await wait(200);
  categoryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  console.log('[Privatebox] ✓ Category submitted via keyboard');
  await wait(500);
}

async function fillTags(tags) {
  const tagInput = document.getElementById('listing-tags-input');
  if (!tagInput) {
    console.warn('[Privatebox] Tags input not found');
    return;
  }

  const tagsToAdd = tags.slice(0, 13);

  for (const tag of tagsToAdd) {
    tagInput.focus();
    await wait(100);
    await setInputValue(tagInput, tag);
    await wait(100);
    tagInput.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    await wait(200);
  }

  console.log(`[Privatebox] ✓ ${tagsToAdd.length} tags filled`);
}

async function fillMaterials(materials) {
  const matInput = document.getElementById('listing-materials-input');
  if (!matInput) {
    console.warn('[Privatebox] Materials input not found');
    return;
  }

  const matsToAdd = materials.slice(0, 13);

  for (const mat of matsToAdd) {
    matInput.focus();
    await wait(100);
    await setInputValue(matInput, mat);
    await wait(100);
    matInput.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    await wait(200);
  }

  console.log(`[Privatebox] ✓ ${matsToAdd.length} materials filled`);
}

async function fillCoreDetails() {
  try {
    const coreDetailsBtn = document.querySelector('#field-coreDetails > div > div > button');
    if (!coreDetailsBtn) {
      console.log('[Privatebox] Core details button not found');
      return;
    }

    coreDetailsBtn.click();
    console.log('[Privatebox] Opened core details modal');
    await wait(1000);

    const whoMadeRadio = document.querySelector('input[name="whoMade"][type="radio"]');
    if (whoMadeRadio) {
      whoMadeRadio.click();
      console.log('[Privatebox] ✓ Selected "I did"');
      await wait(300);
    } else {
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent?.trim() === 'I did') {
          label.click();
          console.log('[Privatebox] ✓ Selected "I did" via label');
          break;
        }
      }
    }
    await wait(300);

    const isSupplyRadios = document.querySelectorAll('input[name="isSupply"][type="radio"]');
    for (const radio of isSupplyRadios) {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label?.textContent?.includes('finished product')) {
        radio.click();
        console.log('[Privatebox] ✓ Selected "A finished product"');
        break;
      }
    }
    await wait(300);

    const whenMadeSelect = document.querySelector('#when-made-select');
    if (whenMadeSelect) {
      whenMadeSelect.value = '2020_2026';
      whenMadeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[Privatebox] ✓ Selected when made: 2020 - 2026');
    }
    await wait(300);

    const howMadeRadios = document.querySelectorAll('input[name="howMade"][type="radio"]');
    for (const radio of howMadeRadios) {
      if (radio.value === 'assembled') {
        radio.click();
        console.log('[Privatebox] ✓ Selected "Assembled from purchased parts"');
        break;
      }
    }
    await wait(300);

    const whatToolsCheckbox = document.querySelector('input[name="whatTools"][type="checkbox"]');
    if (whatToolsCheckbox && !whatToolsCheckbox.checked) {
      whatToolsCheckbox.click();
      console.log('[Privatebox] ✓ Checked "Handheld or hand-guided tools"');
    }
    await wait(500);

    let saveBtn = null;
    const dialogFooters = document.querySelectorAll('.wt-dialog__footer__container button, [class*="dialog"] button.wt-btn--primary');
    for (const btn of dialogFooters) {
      if (btn.textContent?.includes('Save') || btn.textContent?.includes('Done') || btn.classList.contains('wt-btn--primary')) {
        saveBtn = btn;
        break;
      }
    }

    if (!saveBtn) {
      saveBtn = document.querySelector('.wt-dialog button.wt-btn--primary') ||
                document.querySelector('[role="dialog"] button.wt-btn--primary') ||
                document.querySelector('.wt-overlay button.wt-btn--primary');
    }

    if (saveBtn) {
      saveBtn.click();
      console.log('[Privatebox] ✓ Core details saved');
      await wait(500);
    } else {
      console.log('[Privatebox] Could not find save button for core details');
    }

  } catch (error) {
    console.error('[Privatebox] Error filling core details:', error);
  }
}

async function selectShippingProfile() {
  try {
    const shippingBtn = document.querySelector('#field-sourceShippingProfileId > div > button.wt-btn.wt-btn--secondary');
    if (!shippingBtn) {
      console.log('[Privatebox] Shipping profile button not found');
      return;
    }

    shippingBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
    await wait(300);

    shippingBtn.click();
    console.log('[Privatebox] Opened shipping profile modal');

    let profileBtn = null;
    for (let i = 0; i < 10; i++) {
      await wait(500);

      const overlay = document.querySelector('#shipping-profile-overlay');
      if (!overlay) {
        console.log(`[Privatebox] Waiting for overlay... attempt ${i + 1}`);
        continue;
      }

      profileBtn = document.querySelector('#shipping-profile-overlay > div > div.wt-overlay__main > ul > li > div > div > div > div.wt-display-flex-xs.wt-align-items-center > div:nth-child(1) > button');

      if (!profileBtn) {
        profileBtn = overlay.querySelector('ul li button') ||
                     overlay.querySelector('.wt-overlay__main button') ||
                     overlay.querySelector('button.wt-btn--small');
      }

      if (profileBtn) {
        console.log('[Privatebox] Found profile button');
        break;
      }

      console.log(`[Privatebox] Waiting for profile list... attempt ${i + 1}`);
    }

    if (profileBtn) {
      profileBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      await wait(200);
      profileBtn.click();
      console.log('[Privatebox] ✓ Shipping profile selected');
      await wait(500);
    } else {
      console.log('[Privatebox] Could not find shipping profile to select after 10 attempts');
    }
  } catch (error) {
    console.error('[Privatebox] Error selecting shipping profile:', error);
  }
}

async function setInputValue(element, value) {
  if (!element || value === undefined || value === null) return;

  element.focus();
  await wait(50);

  const prototype = element.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;

  const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (nativeValueSetter) {
    nativeValueSetter.call(element, '');
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(30);

  if (nativeValueSetter) {
    nativeValueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  await wait(50);
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

function showNotification(message, type = 'info') {
  const existing = document.getElementById('privatebox-notification');
  if (existing) existing.remove();

  const colors = {
    info: { bg: '#3b82f6', text: 'white' },
    success: { bg: '#10b981', text: 'white' },
    error: { bg: '#ef4444', text: 'white' }
  };

  const notification = document.createElement('div');
  notification.id = 'privatebox-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${colors[type].bg};
    color: ${colors[type].text};
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showSuccessOverlay() {
  const existing = document.getElementById('privatebox-success-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'privatebox-success-overlay';
  overlay.innerHTML = `
    <div class="privatebox-success-content">
      <div class="privatebox-success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2 class="privatebox-success-title">All Set!</h2>
      <p class="privatebox-success-subtitle">Form filled successfully</p>
      <div class="privatebox-success-badge">Etsy Listing</div>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'privatebox-success-style';
  style.textContent = `
    #privatebox-success-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999999;
      animation: privatebox-fadeIn 0.3s ease;
    }
    .privatebox-success-content {
      background: white;
      border-radius: 24px;
      padding: 48px 64px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: privatebox-scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .privatebox-success-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: privatebox-checkmark 0.6s ease 0.2s both;
    }
    .privatebox-success-icon svg {
      width: 40px;
      height: 40px;
      color: white;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: privatebox-draw 0.6s ease 0.4s forwards;
    }
    .privatebox-success-title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px 0;
    }
    .privatebox-success-subtitle {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      color: #6b7280;
      margin: 0 0 20px 0;
    }
    .privatebox-success-badge {
      display: inline-block;
      padding: 6px 16px;
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      border-radius: 20px;
      letter-spacing: 0.5px;
    }
    @keyframes privatebox-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes privatebox-scaleIn {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes privatebox-checkmark {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
    @keyframes privatebox-draw {
      to { stroke-dashoffset: 0; }
    }
    @keyframes privatebox-fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.animation = 'privatebox-fadeOut 0.3s ease forwards';
    setTimeout(() => {
      overlay.remove();
      style.remove();
    }, 300);
  }, 2500);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
