// Privatebox Extension - Full AI-Powered Etsy Listing Creator
// State
let currentImage = null; // base64
let currentListing = null;
let listingHistory = []; // Array of saved listings
let settings = {
  openaiKey: '',
  geminiKey: '',
  exchangeRate: 38,
  visionModel: 'gpt-4o-mini',
  contentModel: 'gpt-4o-mini',
  mockupModel: 'gemini-2.5-flash-image',
  videoModel: 'veo-2.0-generate-001'
};

// DOM Elements
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const editSection = document.getElementById('editSection');
const historySection = document.getElementById('historySection');
const settingsSection = document.getElementById('settingsSection');
const historyList = document.getElementById('historyList');
const newListingBtn = document.getElementById('newListingBtn');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImage = document.getElementById('removeImage');
const browsePageBtn = document.getElementById('browsePageBtn');
const pageImagesPicker = document.getElementById('pageImagesPicker');
const pageImagesGrid = document.getElementById('pageImagesGrid');
const closePickerBtn = document.getElementById('closePickerBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

const loadingText = document.getElementById('loadingText');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

const mockupsGrid = document.getElementById('mockupsGrid');
const mockupPrompt = document.getElementById('mockupPrompt');
const titleInput = document.getElementById('titleInput');
const titleCount = document.getElementById('titleCount');
const titleLangBtn = document.getElementById('titleLangBtn');
const titleSyncBtn = document.getElementById('titleSyncBtn');
const descInput = document.getElementById('descInput');
const descLangBtn = document.getElementById('descLangBtn');
const descSyncBtn = document.getElementById('descSyncBtn');
const priceInput = document.getElementById('priceInput');
const usdPrice = document.getElementById('usdPrice');
const tagsInput = document.getElementById('tagsInput');
const tagCount = document.getElementById('tagCount');
const materialsInput = document.getElementById('materialsInput');

const settingsBtn = document.getElementById('settingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const openaiKeyInput = document.getElementById('openaiKey');
const geminiKeyInput = document.getElementById('geminiKey');
const exchangeRateInput = document.getElementById('exchangeRate');
const visionModelSelect = document.getElementById('visionModel');
const contentModelSelect = document.getElementById('contentModel');
const mockupModelSelect = document.getElementById('mockupModel');
const videoModelSelect = document.getElementById('videoModel');

const backBtn = document.getElementById('backBtn');
const fillFormBtn = document.getElementById('fillFormBtn');
const addMockupBtn = document.getElementById('addMockupBtn');

const statusText = document.getElementById('statusText');
const statusIndicator = document.getElementById('statusIndicator');

const historyBtn = document.getElementById('historyBtn');
const historyBadge = document.getElementById('historyBadge');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightbox = document.getElementById('closeLightbox');

// Initialize
async function init() {
  await loadSettings();
  await loadHistory();
  await loadState(); // Load persisted state
  setupEventListeners();
  checkApiKeys();

  // If there's history but no current work, show history
  if (listingHistory.length > 0 && !currentImage && !currentListing) {
    showSection(historySection);
    renderHistory();
  }
}

// Load persisted state
async function loadState() {
  const stored = await chrome.storage.local.get(['currentImage', 'currentListing']);
  if (stored.currentImage) {
    currentImage = stored.currentImage;
    previewImg.src = currentImage;
    dropZone.classList.add('hidden');
    imagePreview.classList.remove('hidden');
    analyzeBtn.classList.remove('hidden');
    browsePageBtn.classList.add('hidden');
  }
  if (stored.currentListing) {
    currentListing = stored.currentListing;
    populateEditForm();
    showSection(editSection);
  }
}

// Save state
async function saveState() {
  await chrome.storage.local.set({
    currentImage: currentImage,
    currentListing: currentListing
  });
}

// Load history
async function loadHistory() {
  const stored = await chrome.storage.local.get(['listingHistory']);
  listingHistory = stored.listingHistory || [];
  updateHistoryBadge();
}

// Save history
async function saveHistory() {
  await chrome.storage.local.set({ listingHistory: listingHistory });
  updateHistoryBadge();
}

// Add to history
async function addToHistory(listing) {
  const historyItem = {
    id: Date.now(),
    title: listing.title,
    title_tr: listing.title_tr,
    price: listing.price,
    mockups: listing.mockups || [],
    tags: listing.tags || [],
    materials: listing.materials || [],
    description: listing.description,
    description_tr: listing.description_tr,
    analysis: listing.analysis,
    createdAt: new Date().toISOString()
  };
  listingHistory.unshift(historyItem); // Add to beginning
  await saveHistory();
  renderHistory();
}

// Delete from history
async function deleteFromHistory(id) {
  listingHistory = listingHistory.filter(item => item.id !== id);
  await saveHistory();
  renderHistory();

  // If no more history, go to upload
  if (listingHistory.length === 0) {
    showSection(uploadSection);
  }
}

// Render history list
function renderHistory() {
  historyList.innerHTML = '';

  if (listingHistory.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No records yet</div>';
    return;
  }

  listingHistory.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const thumbSrc = item.mockups && item.mockups.length > 0
      ? `data:image/jpeg;base64,${item.mockups[0]}`
      : '';

    const date = new Date(item.createdAt).toLocaleDateString('tr-TR');

    div.innerHTML = `
      <div class="history-thumb">
        ${thumbSrc ? `<img src="${thumbSrc}" alt="Thumbnail">` : ''}
      </div>
      <div class="history-info">
        <div class="history-title">${item.title || 'Untitled'}</div>
        <div class="history-meta">${item.price} TL • ${item.mockups?.length || 0} mockup • ${date}</div>
        <div class="history-actions">
          <button class="history-btn history-btn-edit" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button class="history-btn history-btn-fill" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 13l4 4L19 7"/>
            </svg>
            Fill
          </button>
          <button class="history-btn history-btn-delete" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Delete
          </button>
        </div>
      </div>
    `;

    // Click on item (except buttons) to edit
    div.addEventListener('click', (e) => {
      if (!e.target.closest('.history-btn')) {
        loadFromHistory(item.id);
      }
    });
    // Edit button
    div.querySelector('.history-btn-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      loadFromHistory(item.id);
    });
    // Fill button
    div.querySelector('.history-btn-fill').addEventListener('click', (e) => {
      e.stopPropagation();
      fillFromHistory(item.id);
    });
    // Delete button
    div.querySelector('.history-btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFromHistory(item.id);
    });

    historyList.appendChild(div);
  });
}

// Load history item into edit form (for continuation)
async function loadFromHistory(id) {
  const item = listingHistory.find(h => h.id === id);
  if (!item) return;

  // Load into currentListing
  currentListing = {
    title: item.title,
    title_tr: item.title_tr,
    description: item.description,
    description_tr: item.description_tr,
    price: item.price,
    tags: item.tags,
    materials: item.materials,
    mockups: item.mockups,
    analysis: item.analysis,
    historyId: item.id // Track which history item this came from
  };

  // Persist state
  await saveState();

  // Show edit form
  populateEditForm();
  showSection(editSection);
  setStatus('Ready to edit', 'success');
}

// Fill form from history item (direct fill to Etsy)
async function fillFromHistory(id) {
  const item = listingHistory.find(h => h.id === id);
  if (!item) return;

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes('etsy.com')) {
    setStatus('Open Etsy page', 'error');
    return;
  }

  setStatus('Filling form...', 'loading');

  const listing = {
    title: item.title,
    title_tr: item.title_tr,
    description: item.description,
    description_tr: item.description_tr,
    price: item.price,
    tags: item.tags,
    materials: item.materials,
    mockups: item.mockups,
    analysis: item.analysis
  };

  try {
    // Check if content script is already loaded
    let isLoaded = false;
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      isLoaded = pingResponse?.success === true;
    } catch (e) {
      isLoaded = false;
    }

    // Only inject if not already loaded
    if (!isLoaded) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 500));
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      listing: listing
    });

    if (response?.success) {
      setStatus('Form filled!', 'success');
    } else {
      throw new Error(response?.error || 'Failed to fill form');
    }
  } catch (error) {
    console.error('Fill error:', error);
    setStatus('Error: ' + error.message, 'error');
  }
}

// Load settings from storage
async function loadSettings() {
  const stored = await chrome.storage.local.get([
    'openaiKey', 'geminiKey', 'exchangeRate',
    'visionModel', 'contentModel', 'mockupModel', 'videoModel'
  ]);
  settings.openaiKey = stored.openaiKey || '';
  settings.geminiKey = stored.geminiKey || '';
  settings.exchangeRate = stored.exchangeRate || 38;
  settings.visionModel = stored.visionModel || 'gpt-4o-mini';
  settings.contentModel = stored.contentModel || 'gpt-4o-mini';
  settings.mockupModel = stored.mockupModel || 'gemini-2.5-flash-image';
  settings.videoModel = stored.videoModel || 'veo-2.0-generate-001';
}

// Save settings
async function saveSettings() {
  settings.openaiKey = openaiKeyInput.value;
  settings.geminiKey = geminiKeyInput.value;
  settings.exchangeRate = parseFloat(exchangeRateInput.value) || 38;
  settings.visionModel = visionModelSelect.value;
  settings.contentModel = contentModelSelect.value;
  settings.mockupModel = mockupModelSelect.value;
  settings.videoModel = videoModelSelect.value;

  await chrome.storage.local.set({
    openaiKey: settings.openaiKey,
    geminiKey: settings.geminiKey,
    exchangeRate: settings.exchangeRate,
    visionModel: settings.visionModel,
    contentModel: settings.contentModel,
    mockupModel: settings.mockupModel,
    videoModel: settings.videoModel
  });

  showSection(uploadSection);
  checkApiKeys();
  setStatus('Settings saved', 'success');
}

// Check API keys
function checkApiKeys() {
  if (!settings.openaiKey || !settings.geminiKey) {
    setStatus('API keys missing - Check settings', 'error');
  } else {
    setStatus('Ready', 'success');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Drop zone
  dropZone.addEventListener('click', () => {
    const input = document.getElementById('fileInput');
    if (input) input.click();
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    // Check for files first (local images)
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
      return;
    }

    // Check for URLs (web images)
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await handleImageUrl(url);
      return;
    }

    // Check for HTML (sometimes images come as HTML)
    const html = e.dataTransfer.getData('text/html');
    if (html) {
      const match = html.match(/src=["']([^"']+)["']/);
      if (match && match[1]) {
        await handleImageUrl(match[1]);
      }
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });

  removeImage.addEventListener('click', resetUpload);
  analyzeBtn.addEventListener('click', startAnalysis);

  // Browse page images
  browsePageBtn.addEventListener('click', browsePageImages);
  closePickerBtn.addEventListener('click', () => {
    pageImagesPicker.classList.add('hidden');
  });

  // Settings
  settingsBtn.addEventListener('click', () => {
    openaiKeyInput.value = settings.openaiKey;
    geminiKeyInput.value = settings.geminiKey;
    exchangeRateInput.value = settings.exchangeRate;
    visionModelSelect.value = settings.visionModel;
    contentModelSelect.value = settings.contentModel;
    mockupModelSelect.value = settings.mockupModel;
    videoModelSelect.value = settings.videoModel;
    showSection(settingsSection);
  });
  saveSettingsBtn.addEventListener('click', saveSettings);
  cancelSettingsBtn.addEventListener('click', () => showSection(uploadSection));

  // Edit form
  titleInput.addEventListener('input', () => {
    titleCount.textContent = `${titleInput.value.length}/140`;
  });
  tagsInput.addEventListener('input', () => {
    const count = tagsInput.value.split(',').filter(t => t.trim()).length;
    tagCount.textContent = `${count}/13`;
  });
  priceInput.addEventListener('input', updateUsdPrice);

  // Language toggle for title - save current value before switching
  titleLangBtn.addEventListener('click', () => {
    const currentLang = titleLangBtn.dataset.lang;
    // Save current value before switching
    if (currentListing) {
      if (currentLang === 'en') {
        currentListing.title = titleInput.value;
      } else {
        currentListing.title_tr = titleInput.value;
      }
    }
    // Switch language
    if (currentLang === 'en') {
      titleLangBtn.dataset.lang = 'tr';
      titleLangBtn.textContent = '🇹🇷';
      titleInput.value = currentListing?.title_tr || '';
    } else {
      titleLangBtn.dataset.lang = 'en';
      titleLangBtn.textContent = '🇬🇧';
      titleInput.value = currentListing?.title || '';
    }
    titleCount.textContent = `${titleInput.value.length}/140`;
  });

  // Language toggle for description - save current value before switching
  descLangBtn.addEventListener('click', () => {
    const currentLang = descLangBtn.dataset.lang;
    // Save current value before switching
    if (currentListing) {
      if (currentLang === 'en') {
        currentListing.description = descInput.value;
      } else {
        currentListing.description_tr = descInput.value;
      }
    }
    // Switch language
    if (currentLang === 'en') {
      descLangBtn.dataset.lang = 'tr';
      descLangBtn.textContent = '🇹🇷';
      descInput.value = currentListing?.description_tr || '';
    } else {
      descLangBtn.dataset.lang = 'en';
      descLangBtn.textContent = '🇬🇧';
      descInput.value = currentListing?.description || '';
    }
  });

  // Sync button for title - translate to other language
  titleSyncBtn.addEventListener('click', () => syncTranslation('title'));

  // Sync button for description - translate to other language
  descSyncBtn.addEventListener('click', () => syncTranslation('description'));

  // Actions
  backBtn.addEventListener('click', resetUpload);
  fillFormBtn.addEventListener('click', fillEtsyForm);
  addMockupBtn.addEventListener('click', addSingleMockup);

  // Lightbox
  closeLightbox.addEventListener('click', () => closeLightboxModal());
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightboxModal();
  });

  // History
  newListingBtn.addEventListener('click', () => {
    resetUpload();
    showSection(uploadSection);
  });

  historyBtn.addEventListener('click', () => {
    renderHistory();
    showSection(historySection);
  });
}

// Update history badge
function updateHistoryBadge() {
  if (listingHistory.length > 0) {
    historyBadge.textContent = listingHistory.length;
    historyBadge.classList.remove('hidden');
  } else {
    historyBadge.classList.add('hidden');
  }
}

// Handle image file
function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    currentImage = e.target.result;
    previewImg.src = currentImage;
    dropZone.classList.add('hidden');
    imagePreview.classList.remove('hidden');
    analyzeBtn.classList.remove('hidden');
    browsePageBtn.classList.add('hidden');
    await saveState(); // Persist image
  };
  reader.readAsDataURL(file);
}

// Handle image URL (from web)
async function handleImageUrl(url) {
  try {
    // Show loading state
    dropZone.innerHTML = `
      <div class="drop-icon">
        <div class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></div>
      </div>
      <p class="drop-text">Loading image...</p>
      <p class="drop-subtext">${url.substring(0, 40)}...</p>
    `;

    // Fetch image via background script
    const result = await chrome.runtime.sendMessage({
      action: 'fetchImage',
      url: url
    });

    if (result.success) {
      currentImage = result.data;
      previewImg.src = currentImage;
      dropZone.classList.add('hidden');
      imagePreview.classList.remove('hidden');
      analyzeBtn.classList.remove('hidden');
      browsePageBtn.classList.add('hidden');
      await saveState();
    } else {
      throw new Error(result.error || 'Failed to load image');
    }
  } catch (error) {
    console.error('Error loading image URL:', error);
    alert('Failed to load image: ' + error.message);
    // Restore drop zone
    resetDropZone();
  }
}

// Reset drop zone to original state
function resetDropZone() {
  dropZone.innerHTML = `
    <div class="drop-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    </div>
    <p class="drop-text">Drag image here</p>
    <p class="drop-subtext">from web or computer</p>
    <input type="file" id="fileInput" accept="image/*" hidden>
  `;
  // Re-attach file input listener
  const newFileInput = document.getElementById('fileInput');
  newFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });
}

// Browse page images
async function browsePageImages() {
  pageImagesPicker.classList.remove('hidden');
  pageImagesGrid.innerHTML = '<div class="page-images-loading">Loading images...</div>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Ensure content script is loaded
    let isLoaded = false;
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      isLoaded = pingResponse?.success === true;
    } catch (e) {
      isLoaded = false;
    }

    if (!isLoaded) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 100));
    }

    // Get images from page
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageImages' });

    if (response.success && response.images.length > 0) {
      renderPageImages(response.images);
    } else {
      pageImagesGrid.innerHTML = '<div class="page-images-empty">No images found on this page</div>';
    }
  } catch (error) {
    console.error('Error browsing page images:', error);
    pageImagesGrid.innerHTML = '<div class="page-images-empty">Failed to get page images</div>';
  }
}

// Render page images in picker
function renderPageImages(images) {
  pageImagesGrid.innerHTML = '';

  images.forEach(img => {
    const div = document.createElement('div');
    div.className = 'page-image-item';
    div.innerHTML = `<img src="${img.src}" alt="${img.alt || ''}" loading="lazy">`;
    div.addEventListener('click', async () => {
      pageImagesPicker.classList.add('hidden');
      await handlePageImage(img.src);
    });
    pageImagesGrid.appendChild(div);
  });
}

// Handle image from current page (via content script or background)
async function handlePageImage(url) {
  try {
    // Show loading state
    dropZone.innerHTML = `
      <div class="drop-icon">
        <div class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></div>
      </div>
      <p class="drop-text">Loading image...</p>
    `;

    let result = null;

    // Try content script first
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      result = await chrome.tabs.sendMessage(tab.id, {
        action: 'fetchPageImage',
        url: url
      });
    } catch (e) {
      console.log('Content script method failed:', e.message);
    }

    // Fallback to background script
    if (!result || !result.success) {
      console.log('Trying background script method...');
      result = await chrome.runtime.sendMessage({
        action: 'fetchImage',
        url: url
      });
    }

    if (result && result.success) {
      currentImage = result.data;
      previewImg.src = currentImage;
      dropZone.classList.add('hidden');
      imagePreview.classList.remove('hidden');
      analyzeBtn.classList.remove('hidden');
      browsePageBtn.classList.add('hidden');
      await saveState();
    } else {
      throw new Error(result?.error || 'Resim yuklenemedi');
    }
  } catch (error) {
    console.error('Error loading page image:', error);
    alert('Failed to load image: ' + error.message);
    resetDropZone();
  }
}

// Reset upload
async function resetUpload() {
  currentImage = null;
  currentListing = null;
  fileInput.value = '';
  resetDropZone();
  dropZone.classList.remove('hidden');
  imagePreview.classList.add('hidden');
  analyzeBtn.classList.add('hidden');
  browsePageBtn.classList.remove('hidden');
  showSection(uploadSection);
  await chrome.storage.local.remove(['currentImage', 'currentListing']);
}

// Show section
function showSection(section) {
  [uploadSection, loadingSection, editSection, historySection, settingsSection].forEach(s => {
    s.classList.remove('active');
  });
  section.classList.add('active');
}

// Set status
function setStatus(text, type = 'success') {
  statusText.textContent = text;
  statusIndicator.className = 'status-indicator ' + (type === 'error' ? 'error' : type === 'loading' ? 'loading' : '');
}

// Update USD price
function updateUsdPrice() {
  const tl = parseFloat(priceInput.value) || 0;
  const usd = (tl / settings.exchangeRate).toFixed(2);
  usdPrice.value = `$${usd}`;
}

// Start analysis
async function startAnalysis() {
  if (!currentImage) return;

  if (!settings.openaiKey) {
    setStatus('OpenAI API key missing', 'error');
    showSection(settingsSection);
    return;
  }

  showSection(loadingSection);
  setStatus('Processing...', 'loading');

  try {
    // Step 1: Analyze image
    setStep(1, 'active');
    loadingText.textContent = 'Analyzing image...';

    const analysis = await chrome.runtime.sendMessage({
      action: 'analyzeImage',
      image: currentImage,
      apiKey: settings.openaiKey,
      model: settings.visionModel
    });

    if (!analysis.success) throw new Error(analysis.error);
    setStep(1, 'done');

    // Step 2: Generate content
    setStep(2, 'active');
    loadingText.textContent = 'Generating content...';

    const content = await chrome.runtime.sendMessage({
      action: 'generateContent',
      analysis: analysis.data,
      apiKey: settings.openaiKey,
      model: settings.contentModel
    });

    if (!content.success) throw new Error(content.error);
    setStep(2, 'done');

    // Step 3: Generate mockups
    setStep(3, 'active');
    loadingText.textContent = 'Creating mockups...';

    let mockups = [];
    if (settings.geminiKey) {
      const mockupResult = await chrome.runtime.sendMessage({
        action: 'generateMockups',
        image: currentImage,
        analysis: analysis.data,
        apiKey: settings.geminiKey,
        model: settings.mockupModel
      });

      if (mockupResult.success && mockupResult.data) {
        // Only take the first mockup
        mockups = mockupResult.data.slice(0, 1);
      }
    }
    setStep(3, 'done');

    // Store listing data
    currentListing = {
      ...content.data,
      analysis: analysis.data,
      mockups: mockups,
      originalImage: currentImage
    };

    // Persist state
    await saveState();

    // Show edit form
    populateEditForm();
    showSection(editSection);
    setStatus('Ready', 'success');

  } catch (error) {
    console.error('Analysis error:', error);
    setStatus('Error: ' + error.message, 'error');
    showSection(uploadSection);
  }
}

// Set loading step
function setStep(num, state) {
  const steps = [step1, step2, step3];
  steps.forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < num) s.classList.add('done');
    if (i + 1 === num) s.classList.add(state);
  });
}

// Populate edit form
function populateEditForm() {
  if (!currentListing) return;

  // Reset language badges to English
  titleLangBtn.dataset.lang = 'en';
  titleLangBtn.textContent = '🇬🇧';
  descLangBtn.dataset.lang = 'en';
  descLangBtn.textContent = '🇬🇧';

  titleInput.value = currentListing.title || '';
  titleCount.textContent = `${titleInput.value.length}/140`;

  descInput.value = currentListing.description || '';

  priceInput.value = currentListing.price || 2500;
  updateUsdPrice();

  tagsInput.value = (currentListing.tags || []).join(', ');
  tagCount.textContent = `${(currentListing.tags || []).length}/13`;

  materialsInput.value = (currentListing.materials || []).join(', ');

  renderMockups();
}

// Render mockups
function renderMockups() {
  mockupsGrid.innerHTML = '';

  // Add mockups only (no original image)
  if (currentListing?.mockups && currentListing.mockups.length > 0) {
    currentListing.mockups.forEach((mockup, i) => {
      const div = document.createElement('div');
      div.className = 'mockup-item';
      const imgSrc = `data:image/jpeg;base64,${mockup}`;

      // Check if video exists for this mockup
      const existingVideo = currentListing.videos?.find(v => v.mockupIndex === i);
      const hasVideo = !!existingVideo;

      div.innerHTML = `
        <img src="${imgSrc}" alt="Mockup ${i + 1}">
        <div class="mockup-actions">
          <button class="mockup-btn mockup-play ${hasVideo ? 'has-video' : ''}" data-index="${i}" title="${hasVideo ? 'Play Video' : 'Create Video'}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          <button class="mockup-btn mockup-delete" data-index="${i}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      `;

      // Show video indicator badge if video exists
      if (hasVideo) {
        const badge = document.createElement('div');
        badge.className = 'video-badge';
        badge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M8 5v14l11-7z"/></svg>`;
        div.appendChild(badge);
      }

      // Click to open lightbox
      div.querySelector('img').addEventListener('click', () => openLightbox(imgSrc));

      // Play button - play existing video or generate new
      div.querySelector('.mockup-play').addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasVideo) {
          openVideoLightbox(existingVideo.data);
        } else {
          generateVideoFromMockup(i, mockup);
        }
      });

      // Delete button
      div.querySelector('.mockup-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMockup(i);
      });
      mockupsGrid.appendChild(div);
    });
  } else {
    // No mockups - show placeholder text
    const placeholder = document.createElement('div');
    placeholder.className = 'mockups-placeholder';
    placeholder.textContent = 'No mockups - click + button';
    placeholder.style.cssText = 'grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 20px; font-size: 13px;';
    mockupsGrid.appendChild(placeholder);
  }
}

// Open lightbox for images
function openLightbox(src) {
  // Hide video if exists
  const videoEl = lightbox.querySelector('video');
  if (videoEl) {
    videoEl.pause();
    videoEl.style.display = 'none';
  }
  // Show image
  lightboxImg.style.display = 'block';
  lightboxImg.src = src;
  lightbox.classList.remove('hidden');
}

// Delete mockup
async function deleteMockup(index) {
  if (!currentListing?.mockups) return;
  currentListing.mockups.splice(index, 1);
  renderMockups();
  await saveState();
}

// Track which mockups are generating video
let generatingVideoIndexes = new Set();

// Generate video from mockup
async function generateVideoFromMockup(index, mockupBase64) {
  // Prevent double-click on same mockup
  if (generatingVideoIndexes.has(index)) {
    console.log('[Popup] Video already generating for this mockup');
    return;
  }

  if (!settings.geminiKey) {
    alert('Gemini API key missing! Add it in settings.');
    setStatus('Gemini API key missing', 'error');
    return;
  }

  console.log(`[Popup] Starting video generation for mockup ${index}...`);
  generatingVideoIndexes.add(index);
  setStatus('Creating video... (wait 1-2 minutes)', 'loading');

  // Show loading state on the mockup
  const mockupItems = mockupsGrid.querySelectorAll('.mockup-item');
  const targetItem = mockupItems[index];
  if (targetItem) {
    targetItem.classList.add('generating-video');
    // Add data attribute to persist state
    targetItem.dataset.generating = 'true';
  }

  try {
    console.log('[Popup] Sending video request to background...');

    const result = await chrome.runtime.sendMessage({
      action: 'generateVideo',
      image: mockupBase64,
      apiKey: settings.geminiKey,
      model: settings.videoModel
    });

    console.log('[Popup] Video result received:', result.success);

    if (result.success && result.data) {
      // Store video in listing
      if (!currentListing.videos) currentListing.videos = [];
      currentListing.videos.push({
        mockupIndex: index,
        data: result.data,
        createdAt: new Date().toISOString()
      });
      await saveState();

      // Re-render mockups to show video badge
      renderMockups();

      // Show video in lightbox
      openVideoLightbox(result.data);
      setStatus('Video created!', 'success');
    } else {
      const errorMsg = result.error || 'Failed to create video';
      console.error('[Popup] Video error:', errorMsg);
      alert('Video Error: ' + errorMsg);
      setStatus('Video error: ' + errorMsg, 'error');
    }
  } catch (error) {
    console.error('[Popup] Video generation error:', error);
    alert('Video Error: ' + error.message);
    setStatus('Video error: ' + error.message, 'error');
  } finally {
    generatingVideoIndexes.delete(index);
    if (targetItem) {
      targetItem.classList.remove('generating-video');
      delete targetItem.dataset.generating;
    }
  }
}

// Open video in lightbox
function openVideoLightbox(videoData) {
  // Handle both raw base64 and full data URL
  const videoSrc = videoData.startsWith('data:')
    ? videoData
    : `data:video/mp4;base64,${videoData}`;

  lightboxImg.style.display = 'none';

  // Create or get video element
  let videoEl = lightbox.querySelector('video');
  if (!videoEl) {
    videoEl = document.createElement('video');
    videoEl.id = 'lightboxVideo';
    videoEl.controls = true;
    videoEl.autoplay = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.style.cssText = 'max-width: 100%; max-height: 100%; border-radius: 8px;';
    lightbox.insertBefore(videoEl, lightbox.querySelector('.lightbox-close'));
  }

  videoEl.src = videoSrc;
  videoEl.style.display = 'block';
  lightbox.classList.remove('hidden');

  // Try to play
  videoEl.play().catch(e => console.log('Autoplay blocked:', e));
}

// Close lightbox modal (handles both image and video)
function closeLightboxModal() {
  const videoEl = lightbox.querySelector('video');
  if (videoEl) {
    videoEl.pause();
  }
  lightbox.classList.add('hidden');
}

// Flag to prevent double-click
let isGeneratingMockup = false;

// Add single mockup
async function addSingleMockup() {
  // Prevent double-click
  if (isGeneratingMockup) {
    console.log('[Popup] Already generating mockup, ignoring click');
    return;
  }

  if (!settings.geminiKey) {
    setStatus('Gemini API key missing', 'error');
    return;
  }

  if (!currentImage) {
    setStatus('Please upload an image first', 'error');
    return;
  }

  isGeneratingMockup = true;
  addMockupBtn.disabled = true;
  setStatus('Generating mockup...', 'loading');

  // Show skeleton
  const skeleton = document.createElement('div');
  skeleton.className = 'mockup-skeleton';
  mockupsGrid.appendChild(skeleton);

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'generateMockups',
      image: currentImage,
      analysis: currentListing?.analysis,
      apiKey: settings.geminiKey,
      model: settings.mockupModel,
      customPrompt: mockupPrompt.value.trim() || null,
      variation: currentListing?.mockups?.length || 0 // For variation
    });

    console.log('[Popup] Mockup result:', result.success, 'data length:', result.data?.length);
    if (result.success && result.data && result.data.length > 0) {
      if (!currentListing.mockups) currentListing.mockups = [];
      const beforeCount = currentListing.mockups.length;
      // Only take the first image
      currentListing.mockups.push(result.data[0]);
      console.log(`[Popup] Mockups: ${beforeCount} -> ${currentListing.mockups.length}`);
      renderMockups();
      await saveState();
      setStatus('Mockup added', 'success');
      mockupPrompt.value = ''; // Clear prompt after success
    } else {
      throw new Error(result.error || 'Failed to create mockup');
    }
  } catch (error) {
    console.error('Mockup error:', error);
    setStatus('Mockup error: ' + error.message, 'error');
    renderMockups(); // Re-render to remove skeleton
  } finally {
    isGeneratingMockup = false;
    addMockupBtn.disabled = false;
  }
}

// Sync translation - translate current text to other language
async function syncTranslation(type) {
  if (!settings.openaiKey) {
    setStatus('OpenAI API key missing', 'error');
    return;
  }

  const isTitle = type === 'title';
  const langBtn = isTitle ? titleLangBtn : descLangBtn;
  const syncBtn = isTitle ? titleSyncBtn : descSyncBtn;
  const input = isTitle ? titleInput : descInput;
  const currentLang = langBtn.dataset.lang;
  const currentText = input.value.trim();

  if (!currentText) {
    setStatus('No text to translate', 'error');
    return;
  }

  // Determine translation direction
  const fromLang = currentLang;
  const toLang = currentLang === 'en' ? 'tr' : 'en';

  setStatus(`Translating ${isTitle ? 'title' : 'description'}...`, 'loading');
  syncBtn.disabled = true;
  syncBtn.classList.add('syncing');

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'translateText',
      text: currentText,
      fromLang: fromLang,
      toLang: toLang,
      type: type,
      apiKey: settings.openaiKey,
      model: settings.contentModel
    });

    if (result.success) {
      // Save current text to current language
      if (currentListing) {
        if (isTitle) {
          if (fromLang === 'en') {
            currentListing.title = currentText;
            currentListing.title_tr = result.data;
          } else {
            currentListing.title_tr = currentText;
            currentListing.title = result.data;
          }
        } else {
          if (fromLang === 'en') {
            currentListing.description = currentText;
            currentListing.description_tr = result.data;
          } else {
            currentListing.description_tr = currentText;
            currentListing.description = result.data;
          }
        }
        await saveState();
      }
      setStatus('Translation completed', 'success');
    } else {
      throw new Error(result.error || 'Failed to translate');
    }
  } catch (error) {
    console.error('Translation error:', error);
    setStatus('Translation error: ' + error.message, 'error');
  } finally {
    syncBtn.disabled = false;
    syncBtn.classList.remove('syncing');
  }
}

// Fill Etsy form
async function fillEtsyForm() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes('etsy.com')) {
    setStatus('Open Etsy page', 'error');
    return;
  }

  setStatus('Filling form...', 'loading');

  // Prepare listing data - only mockups, no original image
  // Use currently displayed values (user may have edited them)
  const listing = {
    title: titleInput.value,
    description: descInput.value,
    price: parseFloat(priceInput.value) || 2500,
    tags: tagsInput.value.split(',').map(t => t.trim()).filter(t => t),
    materials: materialsInput.value.split(',').map(m => m.trim()).filter(m => m),
    mockups: currentListing?.mockups || [],
    videos: currentListing?.videos || [],
    analysis: currentListing?.analysis,
    // Store both language versions for history
    title_tr: currentListing?.title_tr,
    description_tr: currentListing?.description_tr
  };

  try {
    // Check if content script is already loaded
    let isLoaded = false;
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      isLoaded = pingResponse?.success === true;
    } catch (e) {
      isLoaded = false;
    }

    // Only inject if not already loaded
    if (!isLoaded) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 500));
    }

    // Send to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      listing: listing
    });

    if (response?.success) {
      setStatus('Form filled!', 'success');

      // Add to history
      await addToHistory(listing);

      // Clear current work
      currentImage = null;
      currentListing = null;
      await chrome.storage.local.remove(['currentImage', 'currentListing']);

      // Go to history
      showSection(historySection);
    } else {
      throw new Error(response?.error || 'Failed to fill form');
    }
  } catch (error) {
    console.error('Fill error:', error);
    setStatus('Error: ' + error.message, 'error');
  }
}

// Initialize on load
init();
