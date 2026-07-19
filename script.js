/**
 * QR STUDIO — Premium QR Code Generator
 * Fully client-side, privacy-first QR code generation
 * Built with Vanilla JavaScript + QRCode.js
 */

(function() {
    'use strict';

    // ============================================
    // CONSTANTS & CONFIG
    // ============================================
    const STORAGE_KEYS = {
        HISTORY: 'qr_studio_history',
        THEME: 'qr_studio_theme',
        LAST_TYPE: 'qr_studio_last_type',
        COLORS: 'qr_studio_colors',
        SIZE: 'qr_studio_size',
        LOGO: 'qr_studio_logo'
    };

    const MAX_HISTORY = 100;
    const DEBOUNCE_DELAY = 300;

    const QR_TYPES = {
        url: { label: 'Website URL', icon: '&#127760;' },
        text: { label: 'Plain Text', icon: '&#128221;' },
        wifi: { label: 'WiFi Network', icon: '&#128246;' },
        phone: { label: 'Phone Number', icon: '&#128222;' },
        whatsapp: { label: 'WhatsApp', icon: '&#128172;' },
        email: { label: 'Email', icon: '&#9993;' },
        sms: { label: 'SMS', icon: '&#128488;' },
        location: { label: 'Location', icon: '&#128205;' },
        vcard: { label: 'vCard Contact', icon: '&#128100;' }
    };

    // ============================================
    // STATE
    // ============================================
    let state = {
        currentType: 'url',
        qrInstance: null,
        logoImage: null,
        isGenerating: false,
        history: [],
        theme: 'light',
        debounceTimer: null,
        qrCodeLoaded: false
    };

    // ============================================
    // DOM REFERENCES
    // ============================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        navLinks: $$('.nav-link, .mobile-nav-link, .footer-col a[data-page]'),
        pages: $$('.page'),
        themeToggle: $('#theme-toggle'),
        mobileThemeToggle: $('#mobile-theme-toggle'),
        mobileMenuBtn: $('.mobile-menu-btn'),
        mobileMenu: $('#mobile-menu'),
        mobileOverlay: $('#mobile-overlay'),
        mobileMenuClose: $('.mobile-menu-close'),
        typeGrid: $('#type-grid'),
        typeBtns: $$('.type-btn'),
        inputForms: $$('.form-group'),
        urlInput: $('#url-input'),
        textInput: $('#text-input'),
        textCharCount: $('#text-char-count'),
        wifiSsid: $('#wifi-ssid'),
        wifiPassword: $('#wifi-password'),
        wifiSecurity: () => document.querySelector('input[name="wifi-security"]:checked'),
        wifiHidden: $('#wifi-hidden'),
        phoneInput: $('#phone-input'),
        waPhone: $('#wa-phone'),
        waMessage: $('#wa-message'),
        emailAddress: $('#email-address'),
        emailSubject: $('#email-subject'),
        emailBody: $('#email-body'),
        smsPhone: $('#sms-phone'),
        smsBody: $('#sms-body'),
        locAddress: $('#loc-address'),
        vcardFirstname: $('#vcard-firstname'),
        vcardLastname: $('#vcard-lastname'),
        vcardPhone: $('#vcard-phone'),
        vcardEmail: $('#vcard-email'),
        vcardOrg: $('#vcard-org'),
        vcardTitle: $('#vcard-title'),
        vcardUrl: $('#vcard-url'),
        vcardAddress: $('#vcard-address'),
        qrSize: $('#qr-size'),
        qrFgColor: $('#qr-fg-color'),
        qrBgColor: $('#qr-bg-color'),
        fgColorValue: $('#fg-color-value'),
        bgColorValue: $('#bg-color-value'),
        logoDropzone: $('#logo-dropzone'),
        logoInput: $('#logo-input'),
        logoPlaceholder: $('#logo-placeholder'),
        logoPreview: $('#logo-preview'),
        logoPreviewImg: $('#logo-preview-img'),
        logoRemove: $('#logo-remove'),
        btnGenerate: $('#btn-generate'),
        btnClear: $('#btn-clear'),
        btnDownloadPng: $('#btn-download-png'),
        btnDownloadSvg: $('#btn-download-svg'),
        btnCopyImage: $('#btn-copy-image'),
        btnCopyData: $('#btn-copy-data'),
        btnPrint: $('#btn-print'),
        qrWrapper: $('#qr-wrapper'),
        qrLoading: $('#qr-loading'),
        qrcode: $('#qrcode'),
        qrLogoOverlay: $('#qr-logo-overlay'),
        qrTypeLabel: $('#qr-type-label'),
        qrDataPreview: $('#qr-data-preview'),
        historySearch: $('#history-search'),
        historyEmpty: $('#history-empty'),
        historyGrid: $('#history-grid'),
        btnClearAll: $('#btn-clear-all'),
        toastContainer: $('#toast-container')
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function showToast(message, type = 'info', duration = 3000) {
        const icons = { success: '&#10003;', error: '&#10007;', info: '&#9432;', warning: '&#9888;' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${escapeHtml(message)}</span>`;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function debounce(fn, delay) {
        return (...args) => {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => fn(...args), delay);
        };
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // ============================================
    // LOCAL STORAGE
    // ============================================
    function loadFromStorage(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) { return defaultValue; }
    }

    function saveToStorage(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (e) { showToast('Storage limit reached.', 'warning'); }
    }

    // ============================================
    // THEME MANAGEMENT
    // ============================================
    function initTheme() {
        const savedTheme = loadFromStorage(STORAGE_KEYS.THEME);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        state.theme = savedTheme || (prefersDark ? 'dark' : 'light');
        applyTheme(state.theme);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        state.theme = theme;
        saveToStorage(STORAGE_KEYS.THEME, theme);
    }

    function toggleTheme() {
        applyTheme(state.theme === 'light' ? 'dark' : 'light');
        showToast(`Switched to ${state.theme} mode`, 'info', 2000);
    }

    // ============================================
    // NAVIGATION
    // ============================================
    function navigateTo(pageId) {
        dom.pages.forEach(page => page.classList.remove('active'));
        const targetPage = $(`#page-${pageId}`);
        if (targetPage) { targetPage.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        dom.navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
        closeMobileMenu();
        if (pageId === 'history') renderHistory();
    }

    function openMobileMenu() {
        dom.mobileMenu.classList.add('open');
        dom.mobileOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        dom.mobileMenu.classList.remove('open');
        dom.mobileOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ============================================
    // QR DATA FORMATTING
    // ============================================
    function getQRData() {
        const type = state.currentType;
        let data = '';
        let preview = '';

        switch (type) {
            case 'url':
                data = dom.urlInput.value.trim();
                preview = data;
                break;
            case 'text':
                data = dom.textInput.value;
                preview = data.substring(0, 100);
                break;
            case 'wifi': {
                const ssid = dom.wifiSsid.value.trim();
                const password = dom.wifiPassword.value;
                const security = dom.wifiSecurity()?.value || 'WPA';
                const hidden = dom.wifiHidden.checked;
                if (!ssid) return { data: '', preview: '' };
                // WiFi QR spec: WIFI:T:<type>;S:<ssid>;P:<pass>;H:<bool>;
                let wifiStr = 'WIFI:T:' + security + ';S:' + ssid + ';';
                if (security !== 'nopass') {
                    wifiStr += 'P:' + password + ';';
                }
                wifiStr += 'H:' + hidden + ';';
                data = wifiStr;
                preview = 'Network: ' + ssid;
                break;
            }
            case 'phone':
                data = `tel:${dom.phoneInput.value.trim()}`;
                preview = dom.phoneInput.value.trim();
                break;
            case 'whatsapp': {
                const waNum = dom.waPhone.value.trim().replace(/\D/g, '');
                const waMsg = encodeURIComponent(dom.waMessage.value);
                if (!waNum) return { data: '', preview: '' };
                data = `https://wa.me/${waNum}${waMsg ? '?text=' + waMsg : ''}`;
                preview = `+${waNum}`;
                break;
            }
            case 'email': {
                const email = dom.emailAddress.value.trim();
                const subject = encodeURIComponent(dom.emailSubject.value);
                const body = encodeURIComponent(dom.emailBody.value);
                if (!email) return { data: '', preview: '' };
                let mailto = `mailto:${email}`;
                const params = [];
                if (subject) params.push('subject=' + subject);
                if (body) params.push('body=' + body);
                if (params.length) mailto += '?' + params.join('&');
                data = mailto;
                preview = email;
                break;
            }
            case 'sms': {
                const smsNum = dom.smsPhone.value.trim();
                const smsBody = encodeURIComponent(dom.smsBody.value);
                if (!smsNum) return { data: '', preview: '' };
                data = `sms:${smsNum}${smsBody ? '?body=' + smsBody : ''}`;
                preview = smsNum;
                break;
            }
            case 'location': {
                const address = dom.locAddress.value.trim();
                if (!address) return { data: '', preview: '' };
                data = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                preview = address;
                break;
            }
            case 'vcard': {
                const vFirst = dom.vcardFirstname.value.trim();
                const vLast = dom.vcardLastname.value.trim();
                const vFn = (vFirst + ' ' + vLast).trim();
                const vPhone = dom.vcardPhone.value.trim();
                const vEmail = dom.vcardEmail.value.trim();
                const vOrg = dom.vcardOrg.value.trim();
                const vTitle = dom.vcardTitle.value.trim();
                const vUrl = dom.vcardUrl.value.trim();
                const vAddr = dom.vcardAddress.value.trim();
                if (!vFn && !vPhone && !vEmail) return { data: '', preview: '' };
                // vCard 3.0 requires CRLF line endings per RFC 6350
                const crlf = '\r\n';
                let vcardData = 'BEGIN:VCARD' + crlf + 'VERSION:3.0' + crlf;
                if (vFn) {
                    vcardData += 'FN:' + vFn + crlf;
                    vcardData += 'N:' + vLast + ';' + vFirst + ';;;;' + crlf;
                }
                if (vPhone) vcardData += 'TEL:' + vPhone + crlf;
                if (vEmail) vcardData += 'EMAIL:' + vEmail + crlf;
                if (vOrg) vcardData += 'ORG:' + vOrg + crlf;
                if (vTitle) vcardData += 'TITLE:' + vTitle + crlf;
                if (vUrl) vcardData += 'URL:' + vUrl + crlf;
                if (vAddr) vcardData += 'ADR:;;' + vAddr + ';;;;' + crlf;
                vcardData += 'END:VCARD';
                data = vcardData;
                preview = vFn || vPhone || vEmail;
                break;
            }
        }
        return { data, preview };
    }

    // ============================================
    // QR CODE GENERATION (FIXED)
    // ============================================
    function validateInput() {
        const { data } = getQRData();
        if (!data) return false;
        if (state.currentType === 'url') {
            try { new URL(data); } catch {
                if (!data.startsWith('http://') && !data.startsWith('https://')) {
                    showToast('Please enter a valid URL starting with http:// or https://', 'warning');
                    return false;
                }
            }
        }
        if (state.currentType === 'email') {
            const email = dom.emailAddress.value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast('Please enter a valid email address', 'warning');
                return false;
            }
        }
        return true;
    }

    function generateQR() {
        const { data, preview } = getQRData();

        if (!data) {
            dom.qrTypeLabel.textContent = QR_TYPES[state.currentType].label;
            dom.qrDataPreview.textContent = 'Enter data to generate QR code';
            disableDownloadButtons();
            return;
        }

        if (!validateInput()) { disableDownloadButtons(); return; }

        // Check if QRCode library is loaded (EasyQRCodeJS uses QRCode.CorrectLevel too)
        if (typeof QRCode === 'undefined') {
            showToast('QR Code library is loading... Please wait a moment and try again.', 'warning');
            loadQRCodeLibrary();
            return;
        }

        state.isGenerating = true;
        dom.qrLoading.hidden = false;

        setTimeout(() => {
            try {
                const size = parseInt(dom.qrSize.value);
                const fgColor = dom.qrFgColor.value;
                const bgColor = dom.qrBgColor.value;

                dom.qrcode.innerHTML = '';

                // EasyQRCodeJS supports UTF-8/Arabic properly with correctLevel: 3 (H)
                state.qrInstance = new QRCode(dom.qrcode, {
                    text: data,
                    width: size,
                    height: size,
                    colorDark: fgColor,
                    colorLight: bgColor,
                    correctLevel: QRCode.CorrectLevel.H,
                    // Quiet zone handled by CSS wrapper, not library
                    // (library quietZone shrinks QR data area)
                    quietZone: 0,
                    // Logo settings - FIXED size in pixels
                    logo: state.logoImage || undefined,
                    logoWidth: state.logoImage ? 50 : undefined,
                    logoHeight: state.logoImage ? 50 : undefined,
                    logoMaxWidth: state.logoImage ? 60 : undefined,
                    logoMaxHeight: state.logoImage ? 60 : undefined,
                    logoBackgroundColor: '#ffffff',
                    logoBackgroundTransparent: false,
                    logoCornerRadius: 4,
                    crossOrigin: 'anonymous'
                });

                dom.qrTypeLabel.textContent = QR_TYPES[state.currentType].label;
                dom.qrDataPreview.textContent = preview;

                enableDownloadButtons();
                // Logo is now handled by EasyQRCodeJS, hide overlay
                dom.qrLogoOverlay.hidden = true;
                saveToHistory(data, preview, state.currentType);
                showToast('QR Code generated successfully!', 'success', 2000);

            } catch (error) {
                console.error('QR generation error:', error);
                showToast('Failed to generate QR code. Please try again.', 'error');
                disableDownloadButtons();
            } finally {
                state.isGenerating = false;
                dom.qrLoading.hidden = true;
            }
        }, 150);
    }

    const debouncedGenerateQR = debounce(generateQR, DEBOUNCE_DELAY);

    function updateLogoOverlay() {
        if (state.logoImage) {
            dom.qrLogoOverlay.src = state.logoImage;
            dom.qrLogoOverlay.hidden = false;
        } else {
            dom.qrLogoOverlay.hidden = true;
            dom.qrLogoOverlay.src = '';
        }
    }

    function disableDownloadButtons() {
        [dom.btnDownloadPng, dom.btnDownloadSvg, dom.btnCopyImage, dom.btnCopyData, dom.btnPrint].forEach(btn => {
            if (btn) btn.disabled = true;
        });
    }

    function enableDownloadButtons() {
        [dom.btnDownloadPng, dom.btnDownloadSvg, dom.btnCopyImage, dom.btnCopyData, dom.btnPrint].forEach(btn => {
            if (btn) btn.disabled = false;
        });
    }

    // ============================================
    // LOAD QR CODE LIBRARY (with fallback)
    // ============================================
    function loadQRCodeLibrary() {
        if (typeof QRCode !== 'undefined') {
            state.qrCodeLoaded = true;
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/easyqrcodejs@4.6.1/dist/easy.qrcode.min.js';
        script.onload = () => {
            state.qrCodeLoaded = true;
            console.log('EasyQRCodeJS loaded successfully - UTF-8/Arabic support enabled');
        };
        script.onerror = () => {
            console.error('Failed to load EasyQRCodeJS from CDN');
            showToast('Failed to load QR library. Please check your internet connection.', 'error', 5000);
        };
        document.head.appendChild(script);
    }

    // ============================================
    // DOWNLOAD & EXPORT
    // ============================================
    function getQRCanvas() {
        return dom.qrcode.querySelector('canvas');
    }

    function downloadPNG() {
        const canvas = getQRCanvas();
        if (!canvas) return;
        const size = parseInt(dom.qrSize.value);
        const bgColor = dom.qrBgColor.value;

        // Add quiet zone (4 modules ≈ 8-16px depending on QR version)
        // For reliable scanning, we add 10% padding on each side
        const padding = Math.max(16, Math.floor(size * 0.08));
        const exportSize = size + (padding * 2);

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportSize;
        exportCanvas.height = exportSize;
        const ctx = exportCanvas.getContext('2d');

        // Fill background (quiet zone color)
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, exportSize, exportSize);

        // Draw QR in center
        ctx.drawImage(canvas, padding, padding, size, size);

        const link = document.createElement('a');
        link.download = `qr-studio-${state.currentType}-${Date.now()}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
        showToast('PNG downloaded successfully!', 'success', 2000);
    }

    function downloadSVG() {
        const canvas = getQRCanvas();
        if (!canvas) return;
        const size = parseInt(dom.qrSize.value);
        const bgColor = dom.qrBgColor.value;

        // Add quiet zone padding
        const padding = Math.max(16, Math.floor(size * 0.08));
        const exportSize = size + (padding * 2);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', exportSize);
        svg.setAttribute('height', exportSize);
        svg.setAttribute('viewBox', `0 0 ${exportSize} ${exportSize}`);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', exportSize);
        bgRect.setAttribute('height', exportSize);
        bgRect.setAttribute('fill', bgColor);
        svg.appendChild(bgRect);

        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('x', padding);
        image.setAttribute('y', padding);
        image.setAttribute('width', size);
        image.setAttribute('height', size);
        image.setAttribute('href', canvas.toDataURL('image/png'));
        svg.appendChild(image);

        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `qr-studio-${state.currentType}-${Date.now()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast('SVG downloaded successfully!', 'success', 2000);
    }

    async function copyQRImage() {
        const canvas = getQRCanvas();
        if (!canvas) return;
        const size = parseInt(dom.qrSize.value);
        const bgColor = dom.qrBgColor.value;

        // Add quiet zone for copied image
        const padding = Math.max(16, Math.floor(size * 0.08));
        const exportSize = size + (padding * 2);

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportSize;
        exportCanvas.height = exportSize;
        const ctx = exportCanvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, exportSize, exportSize);
        ctx.drawImage(canvas, padding, padding, size, size);

        try {
            exportCanvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    showToast('QR image copied to clipboard!', 'success', 2000);
                } catch {
                    showToast('Copy failed. Try downloading instead.', 'error');
                }
            });
        } catch (error) {
            showToast('Failed to copy image.', 'error');
        }
    }

    function copyQRData() {
        const { data } = getQRData();
        if (!data) return;
        navigator.clipboard.writeText(data).then(() => {
            showToast('QR data copied to clipboard!', 'success', 2000);
        }).catch(() => showToast('Failed to copy data', 'error'));
    }

    function printQR() {
        const canvas = getQRCanvas();
        if (!canvas) return;
        const size = parseInt(dom.qrSize.value);
        const bgColor = dom.qrBgColor.value;

        // Add quiet zone for printing
        const padding = Math.max(16, Math.floor(size * 0.08));
        const exportSize = size + (padding * 2);

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportSize;
        exportCanvas.height = exportSize;
        const ctx = exportCanvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, exportSize, exportSize);
        ctx.drawImage(canvas, padding, padding, size, size);

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html><html><head><title>QR Code Print</title></head>
            <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;">
                <img src="${exportCanvas.toDataURL('image/png')}" style="max-width:80%;max-height:80%;" />
            </body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }

    // ============================================
    // LOGO MANAGEMENT (FIXED)
    // ============================================
    function handleLogoUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please upload a valid image file', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast('Image must be smaller than 2MB', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            state.logoImage = e.target.result;
            dom.logoPreviewImg.src = state.logoImage;
            dom.logoPreviewImg.onload = () => {
                dom.logoPlaceholder.hidden = true;
                dom.logoPreview.hidden = false;
            };
            saveToStorage(STORAGE_KEYS.LOGO, state.logoImage);
            updateLogoOverlay();
            showToast('Logo uploaded successfully!', 'success', 2000);
        };
        reader.readAsDataURL(file);
    }

    function removeLogo() {
        state.logoImage = null;
        dom.logoPreviewImg.src = '';
        dom.logoPlaceholder.hidden = false;
        dom.logoPreview.hidden = true;
        localStorage.removeItem(STORAGE_KEYS.LOGO);
        updateLogoOverlay();
        showToast('Logo removed', 'info', 2000);
    }

    // ============================================
    // HISTORY MANAGEMENT
    // ============================================
    function loadHistory() { state.history = loadFromStorage(STORAGE_KEYS.HISTORY, []); }

    function saveToHistory(data, preview, type) {
        const existingIndex = state.history.findIndex(h => h.data === data && h.type === type);
        if (existingIndex !== -1) {
            const item = state.history.splice(existingIndex, 1)[0];
            item.timestamp = new Date().toISOString();
            state.history.unshift(item);
        } else {
            state.history.unshift({
                id: generateId(), type, data,
                preview: preview.substring(0, 200),
                timestamp: new Date().toISOString(),
                fgColor: dom.qrFgColor.value,
                bgColor: dom.qrBgColor.value,
                size: dom.qrSize.value
            });
        }
        if (state.history.length > MAX_HISTORY) state.history = state.history.slice(0, MAX_HISTORY);
        saveToStorage(STORAGE_KEYS.HISTORY, state.history);
    }

    function renderHistory() {
        const searchTerm = dom.historySearch.value.toLowerCase();
        const filtered = state.history.filter(item =>
            item.preview.toLowerCase().includes(searchTerm) ||
            item.type.toLowerCase().includes(searchTerm)
        );
        if (filtered.length === 0) {
            dom.historyEmpty.hidden = false;
            dom.historyGrid.innerHTML = '';
            return;
        }
        dom.historyEmpty.hidden = true;
        dom.historyGrid.innerHTML = filtered.map(item => `
            <div class="history-item" data-id="${item.id}">
                <button class="history-item-delete" data-id="${item.id}" title="Delete">&times;</button>
                <div class="history-item-qr">
                    <img src="${generateHistoryQRImage(item)}" alt="QR Code" loading="lazy">
                </div>
                <div class="history-item-type">${QR_TYPES[item.type]?.label || item.type}</div>
                <div class="history-item-data">${escapeHtml(item.preview)}</div>
                <div class="history-item-date">${formatDate(item.timestamp)}</div>
                <div class="history-item-actions">
                    <button class="btn btn-download btn-history-download" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        PNG
                    </button>
                    <button class="btn btn-download btn-history-copy" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                    <button class="btn btn-download btn-history-regen" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        Regen
                    </button>
                </div>
            </div>
        `).join('');

        dom.historyGrid.querySelectorAll('.history-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); deleteHistoryItem(btn.dataset.id); });
        });
        dom.historyGrid.querySelectorAll('.btn-history-download').forEach(btn => {
            btn.addEventListener('click', () => downloadHistoryItem(btn.dataset.id));
        });
        dom.historyGrid.querySelectorAll('.btn-history-copy').forEach(btn => {
            btn.addEventListener('click', () => copyHistoryData(btn.dataset.id));
        });
        dom.historyGrid.querySelectorAll('.btn-history-regen').forEach(btn => {
            btn.addEventListener('click', () => regenerateHistoryItem(btn.dataset.id));
        });
    }

    function generateHistoryQRImage(item) {
        if (typeof QRCode === 'undefined') return '';
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);
        new QRCode(tempDiv, {
            text: item.data, width: 200, height: 200,
            colorDark: item.fgColor || '#0f172a',
            colorLight: item.bgColor || '#ffffff',
            correctLevel: QRCode.CorrectLevel.H,
            quietZone: 0
        });
        const canvas = tempDiv.querySelector('canvas');
        const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
        document.body.removeChild(tempDiv);
        return dataUrl;
    }

    function deleteHistoryItem(id) {
        state.history = state.history.filter(item => item.id !== id);
        saveToStorage(STORAGE_KEYS.HISTORY, state.history);
        renderHistory();
        showToast('Item deleted from history', 'info', 2000);
    }

    function clearAllHistory() {
        if (state.history.length === 0) return;
        if (confirm('Are you sure you want to delete all history? This cannot be undone.')) {
            state.history = [];
            saveToStorage(STORAGE_KEYS.HISTORY, []);
            renderHistory();
            showToast('All history cleared', 'info', 2000);
        }
    }

    function downloadHistoryItem(id) {
        const item = state.history.find(h => h.id === id);
        if (!item || typeof QRCode === 'undefined') return;
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);
        new QRCode(tempDiv, {
            text: item.data, width: parseInt(item.size) || 512, height: parseInt(item.size) || 512,
            colorDark: item.fgColor || '#0f172a',
            colorLight: item.bgColor || '#ffffff',
            correctLevel: QRCode.CorrectLevel.H,
            quietZone: 0
        });
        setTimeout(() => {
            const canvas = tempDiv.querySelector('canvas');
            if (canvas) {
                const link = document.createElement('a');
                link.download = `qr-studio-${item.type}-${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('Downloaded from history!', 'success', 2000);
            }
            document.body.removeChild(tempDiv);
        }, 100);
    }

    function copyHistoryData(id) {
        const item = state.history.find(h => h.id === id);
        if (!item) return;
        navigator.clipboard.writeText(item.data).then(() => {
            showToast('Data copied to clipboard!', 'success', 2000);
        });
    }

    function regenerateHistoryItem(id) {
        const item = state.history.find(h => h.id === id);
        if (!item) return;
        switchType(item.type);
        if (item.fgColor) { dom.qrFgColor.value = item.fgColor; dom.fgColorValue.textContent = item.fgColor; }
        if (item.bgColor) { dom.qrBgColor.value = item.bgColor; dom.bgColorValue.textContent = item.bgColor; }
        if (item.size) dom.qrSize.value = item.size;
        navigateTo('home');
        showToast('Restored from history. Please verify the data.', 'info', 3000);
    }

    // ============================================
    // TYPE SWITCHING
    // ============================================
    function switchType(type) {
        state.currentType = type;
        dom.typeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
        dom.inputForms.forEach(form => form.classList.toggle('active', form.dataset.form === type));
        dom.qrTypeLabel.textContent = QR_TYPES[type].label;
        saveToStorage(STORAGE_KEYS.LAST_TYPE, type);
        dom.qrcode.innerHTML = '';
        dom.qrDataPreview.textContent = 'Enter data to generate QR code';
        disableDownloadButtons();
    }

    // ============================================
    // FORM MANAGEMENT
    // ============================================
    function clearForm() {
        dom.urlInput.value = '';
        dom.textInput.value = '';
        dom.textCharCount.textContent = '0 characters';
        dom.wifiSsid.value = '';
        dom.wifiPassword.value = '';
        dom.wifiHidden.checked = false;
        document.querySelectorAll('input[name="wifi-security"]').forEach((r, i) => r.checked = i === 0);
        dom.phoneInput.value = '';
        dom.waPhone.value = '';
        dom.waMessage.value = '';
        dom.emailAddress.value = '';
        dom.emailSubject.value = '';
        dom.emailBody.value = '';
        dom.smsPhone.value = '';
        dom.smsBody.value = '';
        dom.locAddress.value = '';
        dom.vcardFirstname.value = '';
        dom.vcardLastname.value = '';
        dom.vcardPhone.value = '';
        dom.vcardEmail.value = '';
        dom.vcardOrg.value = '';
        dom.vcardTitle.value = '';
        dom.vcardUrl.value = '';
        dom.vcardAddress.value = '';
        dom.qrcode.innerHTML = '';
        dom.qrDataPreview.textContent = 'Enter data to generate QR code';
        disableDownloadButtons();
        showToast('Form cleared', 'info', 2000);
    }

    // ============================================
    // SETTINGS MANAGEMENT
    // ============================================
    function loadSettings() {
        const lastType = loadFromStorage(STORAGE_KEYS.LAST_TYPE, 'url');
        if (QR_TYPES[lastType]) switchType(lastType);
        const colors = loadFromStorage(STORAGE_KEYS.COLORS);
        if (colors) {
            if (colors.fg) { dom.qrFgColor.value = colors.fg; dom.fgColorValue.textContent = colors.fg; }
            if (colors.bg) { dom.qrBgColor.value = colors.bg; dom.bgColorValue.textContent = colors.bg; }
        }
        const size = loadFromStorage(STORAGE_KEYS.SIZE);
        if (size) dom.qrSize.value = size;
        const logo = loadFromStorage(STORAGE_KEYS.LOGO);
        if (logo) {
            state.logoImage = logo;
            dom.logoPreviewImg.src = logo;
            dom.logoPreviewImg.onload = () => {
                dom.logoPlaceholder.hidden = true;
                dom.logoPreview.hidden = false;
            };
        }
    }

    function saveColors() {
        saveToStorage(STORAGE_KEYS.COLORS, { fg: dom.qrFgColor.value, bg: dom.qrBgColor.value });
    }

    function saveSize() { saveToStorage(STORAGE_KEYS.SIZE, dom.qrSize.value); }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    function handleKeyboard(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault(); generateQR();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey) {
            e.preventDefault();
            if (!dom.btnDownloadPng.disabled) downloadPNG();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
            e.preventDefault();
            if (!dom.btnCopyImage.disabled) copyQRImage();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            if (!dom.btnPrint.disabled) printQR();
        }
        if (e.key === 'Escape') {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) { activeEl.blur(); return; }
            clearForm();
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function initEventListeners() {
        dom.navLinks.forEach(link => {
            link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(link.dataset.page); });
        });
        dom.themeToggle.addEventListener('click', toggleTheme);
        dom.mobileThemeToggle.addEventListener('click', toggleTheme);
        dom.mobileMenuBtn.addEventListener('click', openMobileMenu);
        dom.mobileMenuClose.addEventListener('click', closeMobileMenu);
        dom.mobileOverlay.addEventListener('click', closeMobileMenu);

        dom.typeBtns.forEach(btn => btn.addEventListener('click', () => switchType(btn.dataset.type)));

        const allInputs = [
            dom.urlInput, dom.textInput, dom.wifiSsid, dom.wifiPassword,
            dom.phoneInput, dom.waPhone, dom.waMessage,
            dom.emailAddress, dom.emailSubject, dom.emailBody,
            dom.smsPhone, dom.smsBody, dom.locAddress,
            dom.vcardFirstname, dom.vcardLastname, dom.vcardPhone,
            dom.vcardEmail, dom.vcardOrg, dom.vcardTitle,
            dom.vcardUrl, dom.vcardAddress
        ];
        allInputs.forEach(input => { if (input) input.addEventListener('input', debouncedGenerateQR); });

        document.querySelectorAll('input[name="wifi-security"]').forEach(radio => {
            radio.addEventListener('change', debouncedGenerateQR);
        });
        dom.wifiHidden.addEventListener('change', debouncedGenerateQR);

        dom.textInput.addEventListener('input', () => {
            dom.textCharCount.textContent = `${dom.textInput.value.length} characters`;
        });

        dom.qrFgColor.addEventListener('input', (e) => {
            dom.fgColorValue.textContent = e.target.value;
            saveColors();
            debouncedGenerateQR();
        });
        dom.qrBgColor.addEventListener('input', (e) => {
            dom.bgColorValue.textContent = e.target.value;
            saveColors();
            debouncedGenerateQR();
        });
        dom.qrSize.addEventListener('change', () => { saveSize(); debouncedGenerateQR(); });

        // Logo - FIXED: separate click handlers for dropzone and remove button
        dom.logoDropzone.addEventListener('click', (e) => {
            if (e.target.closest('#logo-remove')) return;
            dom.logoInput.click();
        });
        dom.logoInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleLogoUpload(e.target.files[0]);
        });
        dom.logoDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dom.logoDropzone.classList.add('drag-over');
        });
        dom.logoDropzone.addEventListener('dragleave', () => {
            dom.logoDropzone.classList.remove('drag-over');
        });
        dom.logoDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.logoDropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleLogoUpload(file);
        });
        dom.logoRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            removeLogo();
        });

        dom.btnGenerate.addEventListener('click', generateQR);
        dom.btnClear.addEventListener('click', clearForm);
        dom.btnDownloadPng.addEventListener('click', downloadPNG);
        dom.btnDownloadSvg.addEventListener('click', downloadSVG);
        dom.btnCopyImage.addEventListener('click', copyQRImage);
        dom.btnCopyData.addEventListener('click', copyQRData);
        dom.btnPrint.addEventListener('click', printQR);

        dom.historySearch.addEventListener('input', debounce(renderHistory, 200));
        dom.btnClearAll.addEventListener('click', clearAllHistory);

        document.addEventListener('keydown', handleKeyboard);

        document.addEventListener('dragover', (e) => {
            if (!e.target.closest('#logo-dropzone')) e.preventDefault();
        });
        document.addEventListener('drop', (e) => {
            if (!e.target.closest('#logo-dropzone')) e.preventDefault();
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        initTheme();
        loadHistory();
        loadSettings();
        initEventListeners();

        if (typeof QRCode === 'undefined') {
            console.warn('QRCode.js not loaded yet, attempting fallback...');
            loadQRCodeLibrary();
        } else {
            state.qrCodeLoaded = true;
        }

        dom.navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === 'home'));

        console.log('%c QR Studio ', 'background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; font-size: 20px; font-weight: bold; padding: 8px 16px; border-radius: 8px;');
        console.log('%c Premium QR Code Generator — 100% Client-Side ', 'color: #0ea5e9; font-size: 12px;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
