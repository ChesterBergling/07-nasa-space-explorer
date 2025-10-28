// =========================
// APOD gallery logic (uses classroom CDN dataset)
// =========================
// This file loads images from a local CDN dataset for the selected
// date range, renders a gallery of items (no duplicates), and
// shows a full photo with caption when the user clicks a gallery item.

// --- Configuration ---
// The API key provided by the user (use exactly as given)
// --- DOM nodes ---
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const typeFilter = document.getElementById('typeFilter');
const favoritesToggle = document.getElementById('favoritesToggle');
const getButton = document.getElementById('getButton');
const gallery = document.getElementById('gallery');

// --- Debug / status helpers ---
// Small visible status element so users can see fetch results or errors
function ensureStatusEl() {
	let s = document.getElementById('fetchStatus');
	if (!s) {
		s = document.createElement('div');
		s.id = 'fetchStatus';
		s.style.cssText = 'padding:8px 12px;font-size:14px;color:#333;max-width:900px;margin:0 auto 12px;';
		const container = document.querySelector('.container') || document.body;
		container.insertBefore(s, container.firstChild.nextSibling);
	}
	return s;
}

function displayStatus(text, isError = false) {
	const el = ensureStatusEl();
	el.textContent = text;
	el.style.color = isError ? '#b00020' : '#222';
	console[isError ? 'error' : 'log']('[APOD STATUS]', text);
}

// Global image load error logger (help locate 404s for thumbnails/full images)
window.addEventListener('error', (e) => {
	const t = e.target || e.srcElement;
	if (t && t.tagName === 'IMG') {
		console.error('Image failed to load:', t.src);
		displayStatus(`Image failed to load: ${t.src}`, true);
	}
}, true);

// Basic null-checks to avoid runtime errors if the DOM changes
if (!startInput || !endInput || !getButton || !gallery) {
	console.error('Required DOM elements missing: startDate, endDate, getButton, or gallery');
} else {
	// Call the setup function from dateRange.js to initialize the inputs
	setupDateInputs(startInput, endInput);
}

// --- App state ---
let CURRENT_ITEMS = []; // stored APOD items for filtering
const FAVORITES_KEY = 'apodFavorites';
let favorites = loadFavorites();
let PAGE_SIZE = 9; // default items per page
let currentPage = 1;
const paginationContainer = document.getElementById('pagination');
let TOTAL_PAGES = 1;

function goToPage(n) {
	const target = Math.max(1, Math.min(TOTAL_PAGES, n || 1));
	if (target === currentPage) return;
	currentPage = target;
	renderFilteredGallery();
}

function goPrev() {
	goToPage(currentPage - 1);
}

function goNext() {
	goToPage(currentPage + 1);
}

function loadFavorites() {
	try {
		const raw = localStorage.getItem(FAVORITES_KEY);
		if (!raw) return {};
		return JSON.parse(raw) || {};
	} catch (e) {
		return {};
	}
}

function saveFavorites() {
	try {
		localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
	} catch (e) {
		console.warn('Could not save favorites', e);
	}
}

function isFavorited(item) {
	return Boolean(item && item.date && favorites[item.date]);
}

function toggleFavorite(item, btn) {
	if (!item || !item.date) return;
	if (favorites[item.date]) {
		delete favorites[item.date];
		if (btn) btn.classList.remove('favorited');
	} else {
		favorites[item.date] = true;
		if (btn) btn.classList.add('favorited');
	}
	saveFavorites();
}

// --- Helpers ---
// Remove all children from an element
function clearElement(el) {
	while (el.firstChild) el.removeChild(el.firstChild);
}

// Create a simple message node (used for errors / empty state)
function createMessage(text) {
	const p = document.createElement('p');
	p.className = 'message';
	p.textContent = text;
	return p;
}

// Open a modal-like viewer showing the photo (or video) and caption
function openViewer(item) {
	// Create overlay
	const overlay = document.createElement('div');
	overlay.className = 'apod-overlay';
	overlay.style = `position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);z-index:9999;padding:20px;`;

	// Create content container
	const container = document.createElement('div');
	container.style = 'max-width:1000px;max-height:90vh;overflow:auto;background:#fff;padding:16px;border-radius:8px;';

	// Title and date
	const title = document.createElement('h2');
	title.textContent = `${item.title || 'APOD'} — ${item.date || ''}`;
	title.style.marginTop = '0';

	// Helper: pick a media URL (prefer hdurl)
	const mediaUrl = item.hdurl || item.url || '';

	// Media wrapper
	const mediaWrapper = document.createElement('div');
	mediaWrapper.style.marginBottom = '12px';

	// Simple helper to test for image file extension (wider set)
	function looksLikeImage(u) {
		return /\.(jpg|jpeg|png|gif|webp|bmp|tiff|tif|svg)(\?|$)/i.test(String(u));
	}

	// Try to render image when appropriate
	if (item.media_type === 'image' || looksLikeImage(mediaUrl)) {
		const img = document.createElement('img');
		img.src = mediaUrl;
		img.alt = item.title || 'APOD image';
		img.style = 'max-width:100%;height:auto;border-radius:4px;display:block;';
		// If image fails to load, show a fallback link
		img.addEventListener('error', () => {
			const fallback = document.createElement('div');
			fallback.innerHTML = `<p>Image failed to load. Open the source: <a href="${item.url || mediaUrl}" target="_blank" rel="noopener">${item.url || mediaUrl}</a></p>`;
			mediaWrapper.replaceChild(fallback, img);
		});
		mediaWrapper.appendChild(img);
	} else if (item.media_type === 'video' || /youtube\.com|youtu\.be|vimeo\.com/.test(mediaUrl)) {
		// Try to embed YouTube / Vimeo
		let embedSrc = '';
		if (/youtube\.com\/watch\?v=/.test(mediaUrl)) {
			embedSrc = mediaUrl.replace('watch?v=', 'embed/');
		} else if (/youtu\.be\//.test(mediaUrl)) {
			embedSrc = mediaUrl.replace('youtu.be/', 'www.youtube.com/embed/');
		} else if (/vimeo\.com\/.+/.test(mediaUrl)) {
			const m = mediaUrl.match(/vimeo\.com\/(\d+)/);
			if (m && m[1]) embedSrc = `https://player.vimeo.com/video/${m[1]}`;
		}
		if (embedSrc) {
			const iframe = document.createElement('iframe');
			iframe.src = embedSrc;
			iframe.width = '100%';
			iframe.height = '480';
			iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
			iframe.allowFullscreen = true;
			iframe.style = 'border:0;display:block;border-radius:4px;';
			mediaWrapper.appendChild(iframe);
		} else {
			mediaWrapper.innerHTML = `<p>Video content — <a href="${mediaUrl || item.url}" target="_blank" rel="noopener">Open in new tab</a></p>`;
		}
	} else {
		// Unknown type: show a safe link to the source
		const link = document.createElement('p');
		link.innerHTML = `<em>Open source page: <a href="${mediaUrl || item.url}" target="_blank" rel="noopener">${mediaUrl || item.url}</a></em>`;
		mediaWrapper.appendChild(link);
	}

	// Caption / explanation
	const caption = document.createElement('p');
	caption.textContent = item.explanation || '';
	caption.style.whiteSpace = 'pre-wrap';

	// Close button
	const closeBtn = document.createElement('button');
	closeBtn.textContent = 'Close';
	closeBtn.style = 'display:inline-block;margin-top:12px;padding:8px 12px;cursor:pointer;';
	closeBtn.addEventListener('click', () => {
		document.body.removeChild(overlay);
		window.removeEventListener('keydown', onKey);
	});

	container.appendChild(title);
	container.appendChild(mediaWrapper);
	container.appendChild(caption);
	container.appendChild(closeBtn);

	overlay.appendChild(container);

	// Close when clicking outside the container
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) {
			document.body.removeChild(overlay);
			window.removeEventListener('keydown', onKey);
		}
	});

	// Close on Escape
	function onKey(e) {
		if (e.key === 'Escape') {
			if (document.body.contains(overlay)) {
				document.body.removeChild(overlay);
				window.removeEventListener('keydown', onKey);
			}
		}
	}
	window.addEventListener('keydown', onKey);

	document.body.appendChild(overlay);
}

// --- Main fetch and render logic ---
async function fetchApod(startDate, endDate) {
	// Load data from the provided static CDN JSON and filter by date range.
	// This avoids calling the live NASA API and uses the classroom dataset.
	// Optionally enable cache-busting by setting CACHE_BUST = true below.
	const CACHE_BUST = false; // set true temporarily during dev to bypass CDN cache
	const endpointBase = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';
	const endpoint = CACHE_BUST ? `${endpointBase}?v=${Date.now()}` : endpointBase;

	// Use AbortController to protect against hung requests and handle empty responses (204)
	const controller = new AbortController();
	const timeoutMs = 12000; // 12s timeout
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	let res;
	try {
		res = await fetch(endpoint, { signal: controller.signal });
	} catch (err) {
		clearTimeout(timeoutId);
		// Re-throw with a clearer message for the caller/UI
		throw new Error(`Network error fetching data: ${err && err.name === 'AbortError' ? 'request aborted/timed out' : err.message}`);
	}
	clearTimeout(timeoutId);

	if (!res.ok) throw new Error(`Data fetch error: ${res.status} ${res.statusText}`);

	// Handle 204 No Content or truly empty bodies gracefully. Many APIs return 204 with no body.
	// Read text first so calling JSON.parse on an empty string is avoided.
	let data;
	if (res.status === 204) {
		data = [];
	} else {
		const text = await res.text();
		if (!text) {
			data = [];
		} else {
			try {
				data = JSON.parse(text);
			} catch (err) {
				throw new Error(`Invalid JSON response: ${err.message}`);
			}
		}
	}
	// Normalize shapes: data may be an array, a single object, or a date-keyed object
	let items = [];
	if (Array.isArray(data)) {
		items = data;
	} else if (data && typeof data === 'object') {
		// If it's an object keyed by date (common in some datasets), use the values
		items = Object.values(data);
	} else {
		items = [data];
	}

	// Helper to parse a date-only string (YYYY-MM-DD) into a Date at UTC midnight
	function parseDateOnly(s) {
		if (!s) return null;
		// Expecting 'YYYY-MM-DD' (ISO date). Split to avoid timezone shifts in some browsers.
		const parts = String(s).split('-').map((p) => Number(p));
		if (parts.length < 3) return new Date(s);
		const [y, m, d] = parts;
		// month is 0-based in Date.UTC
		return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
	}

	// If the caller provided a date range, filter the results to that range (inclusive)
	if (startDate || endDate) {
		const start = parseDateOnly(startDate);
		const end = parseDateOnly(endDate);
		return items.filter((it) => {
			if (!it || !it.date) return false;
			const d = parseDateOnly(it.date);
			if (!d || Number.isNaN(d.getTime())) return false;
			if (start && d < start) return false;
			if (end && d > end) return false;
			return true;
		});
	}

	return items;
}

function renderGallery(items) {
	// Store raw items and then render according to active filters
	CURRENT_ITEMS = Array.isArray(items) ? items.slice() : [];
	renderFilteredGallery();
}

function matchesType(item, type) {
	if (!type || type === 'all') return true;
	const text = `${item.title || ''} ${item.explanation || ''}`.toLowerCase();
	const keywords = {
		nebula: ['nebula', 'nebulae', 'pillars', 'emission', 'reflection', 'dark nebula'],
		galaxy: ['galaxy', 'andromeda', 'milky way', 'm31', 'm33', 'spiral', 'elliptical'],
		planet: ['planet', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'neptune', 'uranus', 'earth'],
		star: ['star', 'supernova', 'pulsar', 'sun', 'solar']
	};
	const list = keywords[type] || [];
	return list.some((kw) => text.includes(kw));
}

function renderFilteredGallery() {
	clearElement(gallery);

	if (!CURRENT_ITEMS || CURRENT_ITEMS.length === 0) {
		gallery.appendChild(createMessage('No images found for that date range.'));
		return;
	}

	// Remove duplicates by date (keep first occurrence)
	const byDate = new Map();
	for (const it of CURRENT_ITEMS) {
		if (!byDate.has(it.date)) byDate.set(it.date, it);
	}
	const uniqueItems = Array.from(byDate.values());

	const selectedType = (typeFilter && typeFilter.value) || 'all';
	const showFavoritesOnly = favoritesToggle && favoritesToggle.getAttribute('aria-pressed') === 'true';

	const grid = document.createElement('div');
	grid.className = 'apod-grid';

		const filtered = uniqueItems.filter((item) => {
		if (showFavoritesOnly && !isFavorited(item)) return false;
		if (!matchesType(item, selectedType)) return false;
		return true;
	});

	// Report how many items matched the active filters (useful for debugging)
	try {
		displayStatus(`${filtered.length} items matched filters (from ${uniqueItems.length} unique items)`);
	} catch (e) {
		// ignore if displayStatus isn't available
	}

	if (filtered.length === 0) {
		gallery.appendChild(createMessage('No images match the selected filter.'));
		return;
	}

			// Pagination: calculate pages and slice the items to show
			const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
			TOTAL_PAGES = totalPages;
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
		const startIdx = (currentPage - 1) * PAGE_SIZE;
		const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

		pageItems.forEach((item) => {
		const card = document.createElement('figure');
		card.className = 'apod-card';
		card.tabIndex = 0;

		// Thumbnail
		// Thumbnail — prefer hdurl, then url, then thumbnail_url (some videos provide thumbnail_url)
		const thumbSrc = item.hdurl || item.url || item.thumbnail_url || '';
		if (thumbSrc) {
			const img = document.createElement('img');
			img.src = thumbSrc;
			img.alt = item.title || item.date;
			card.appendChild(img);
			// If this is a video, add a small play indicator
			if (item.media_type === 'video') {
				const play = document.createElement('div');
				play.className = 'video-play-overlay';
				play.textContent = '▶';
				play.style = 'position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,0.42);color:#fff;padding:4px 8px;border-radius:4px;font-size:14px;';
				card.appendChild(play);
			}
		} else {
			const placeholder = document.createElement('div');
			placeholder.className = 'apod-placeholder';
			placeholder.textContent = item.media_type === 'video' ? 'Video' : 'Image';
			card.appendChild(placeholder);
		}

		// Favorite button (top-right)
		const favBtn = document.createElement('button');
		favBtn.className = 'favorite-btn';
		favBtn.title = 'Toggle favorite';
		favBtn.innerHTML = isFavorited(item) ? '♥' : '♡';
		if (isFavorited(item)) favBtn.classList.add('favorited');
		favBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			toggleFavorite(item, favBtn);
			favBtn.innerHTML = isFavorited(item) ? '♥' : '♡';
		});
		card.appendChild(favBtn);

		const figcaption = document.createElement('figcaption');
		figcaption.textContent = `${item.date} — ${item.title}`;
		card.appendChild(figcaption);

		card.addEventListener('click', () => openViewer(item));
		card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openViewer(item); });

		grid.appendChild(card);
	});

	gallery.appendChild(grid);
		renderPaginationControls(totalPages);
}

	function renderPaginationControls(totalPages) {
		if (!paginationContainer) return;
		clearElement(paginationContainer);

			// Previous button
			const prev = document.createElement('button');
			prev.id = 'prevPage';
			prev.textContent = '← Prev';
			prev.disabled = currentPage <= 1;
			prev.addEventListener('click', () => { goPrev(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
			paginationContainer.appendChild(prev);

		// Page select
		const select = document.createElement('select');
		select.setAttribute('aria-label', 'Select page');
		for (let i = 1; i <= totalPages; i++) {
			const opt = document.createElement('option');
			opt.value = i;
			opt.textContent = `Page ${i} of ${totalPages}`;
			if (i === currentPage) opt.selected = true;
			select.appendChild(opt);
		}
			select.addEventListener('change', () => {
				currentPage = Number(select.value);
				renderFilteredGallery();
				window.scrollTo({ top: 0, behavior: 'smooth' });
			});
		paginationContainer.appendChild(select);

		// Next button
			const next = document.createElement('button');
			next.id = 'nextPage';
			next.textContent = 'Next →';
			next.disabled = currentPage >= totalPages;
			next.addEventListener('click', () => { goNext(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
			paginationContainer.appendChild(next);
	}

// Attach event to the Get button
getButton.addEventListener('click', async () => {
	// Basic validation
	const start = startInput.value;
	const end = endInput.value;
	if (!start || !end) {
		clearElement(gallery);
		gallery.appendChild(createMessage('Please select both start and end dates.'));
		return;
	}

	// Show loading message
	clearElement(gallery);
	gallery.appendChild(createMessage('Loading images...'));

	try {
		const items = await fetchApod(start, end);
		// Sort by date descending so newer images show first
		items.sort((a, b) => new Date(b.date) - new Date(a.date));
		renderGallery(items);
	} catch (err) {
		clearElement(gallery);
		gallery.appendChild(createMessage(`Failed to load images: ${err.message}`));
		console.error(err);
	}
});

// Type filter change
if (typeFilter) {
	typeFilter.addEventListener('change', () => renderFilteredGallery());
}

// Favorites toggle
if (favoritesToggle) {
	favoritesToggle.addEventListener('click', (e) => {
		const pressed = favoritesToggle.getAttribute('aria-pressed') === 'true';
		favoritesToggle.setAttribute('aria-pressed', (!pressed).toString());
		// visually indicate active
		favoritesToggle.classList.toggle('active', !pressed);
		currentPage = 1;
		renderFilteredGallery();
	});
}

// Reset page when type filter changes
if (typeFilter) {
	typeFilter.addEventListener('change', () => { currentPage = 1; renderFilteredGallery(); });
}

// If static prev/next buttons are present in the DOM, attach handlers that use the same functions
const staticPrev = document.getElementById('prevPage');
const staticNext = document.getElementById('nextPage');
if (staticPrev) staticPrev.addEventListener('click', () => { goPrev(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
if (staticNext) staticNext.addEventListener('click', () => { goNext(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

// Optional: If the page has the placeholder and the inputs are pre-filled, auto-load
// (students often expect the default 9-day range to load on page open)
window.addEventListener('load', () => {
	if (startInput.value && endInput.value) {
		// Trigger the button click programmatically to fetch initial images
		// but do it after a short delay so the page finishes rendering
		setTimeout(() => getButton.click(), 250);
	}
});
