/**
 * =========================================================================
 * pasaDatos - CONTRATO OFICIAL DE PARÁMETROS URL
 * Impulsado por prolijo.ar
 * =========================================================================
 * REGLA DE RETROCOMPATIBILIDAD PERPETUA:
 * Estas claves se graban en códigos QR físicos ya impresos en miles de
 * mostradores de comercios en Argentina. NUNCA deben renombrarse, eliminarse
 * ni modificarse su semántica en futuros commits.
 *
 * Si algún parámetro falta en la URL, la interfaz se degrada con elegancia
 * ocultando ese campo sin tirar errores en consola.
 *
 * DICCIONARIO OFICIAL:
 * 'n'   : Nombre del Comercio / Profesional (Requerido)
 * 'r'   : Rubro o Subtítulo corto (Opcional)
 * 'a'   : Alias de CBU / CVU (Requerido)
 * 'c'   : CBU o CVU numérico de 22 dígitos (Opcional)
 * 't'   : Nombre del Titular de la Cuenta (Requerido)
 * 'u'   : CUIT / CUIL del Titular (Opcional, formato XX-XXXXXXXX-X)
 * 'b'   : Banco o Billetera de destino (Requerido)
 * 'w'   : WhatsApp para comprobantes (Opcional, normalizado '549...')
 * 'p'   : Mensaje o Promo destacada (Opcional)
 * 'th'  : Color de Acento / Tema ('blue'|'emerald'|'violet'|'slate'|'orange'|HEX)
 * 'edit': Forzar Modo Creador / Edición ('1')
 * =========================================================================
 */

// Paleta de temas predeterminados
const PRESET_THEMES = {
  blue: { hex: '#2563EB', name: 'Azul' },
  emerald: { hex: '#059669', name: 'Esmeralda' },
  violet: { hex: '#7C3AED', name: 'Violeta' },
  slate: { hex: '#0F172A', name: 'Negro' },
  orange: { hex: '#EA580C', name: 'Naranja' }
};
const ALLOWED_THEMES = Object.keys(PRESET_THEMES);

// Constantes de Rate Limit y LocalStorage
const UPDATE_COOLDOWN_MS = 60000; // 60 segundos (1 minuto)
const STORAGE_CONFIG_KEY = 'pasadatos_config';
const STORAGE_LAST_UPDATE_KEY = 'pasadatos_last_qr_update';

// Estado Predeterminado de Ejemplo
const DEFAULT_STATE = {
  n: 'Café & Deli Martínez',
  r: 'Cafetería de Especialidad & Pastelería',
  a: 'CAFE.MARTINEZ.MP',
  c: '0000003100085492348571',
  t: 'Gonzalo Agustín Martínez',
  u: '20-38495821-3',
  b: 'Mercado Pago',
  w: '1134859201',
  p: '',
  th: 'blue'
};

let appState = { ...DEFAULT_STATE };
let isCreatorMode = true;
let currentPreviewTab = 'poster'; // 'poster' o 'mobile'
let updateCooldownTimer = null;
let selectedPrintFormat = 'a5'; // 'a5' o 'a4'

// =========================================================================
// FUNCIONES DE SEGURIDAD, COLOR Y SANITIZACIÓN (PENTEST & DEFENSE-IN-DEPTH)
// =========================================================================

/**
 * Parsea un color en formato HEX (#RGB, #RRGGBB, RGB, RRGGBB) o RGB a componentes { r, g, b, hex }
 */
function parseColor(input) {
  if (!input) return null;
  const str = String(input).trim();

  // Hex (#FFF o #FFFFFF o FFF o FFFFFF)
  const hexMatch = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      hex: '#' + hex.toUpperCase()
    };
  }

  // RGB: rgb(r, g, b)
  const rgbMatch = str.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10));
    const g = Math.min(255, parseInt(rgbMatch[2], 10));
    const b = Math.min(255, parseInt(rgbMatch[3], 10));
    const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return { r, g, b, hex: '#' + toHex(r) + toHex(g) + toHex(b) };
  }

  return null;
}

/**
 * Valida y sanitiza el tema visual. Permite nombres predefinidos o colores HEX válidos
 */
function sanitizeTheme(theme) {
  if (typeof theme !== 'string') return 'blue';
  const clean = theme.trim();
  if (ALLOWED_THEMES.includes(clean.toLowerCase())) {
    return clean.toLowerCase();
  }
  const parsed = parseColor(clean);
  if (parsed) {
    return parsed.hex.slice(1); // Guarda hex sin '#' en URL/estado
  }
  return 'blue';
}

/**
 * Aplica dinámicamente el tema visual (preset o color HEX/RGB libre) sobre un elemento
 */
function applyThemeColor(element, themeValue) {
  if (!element) return;
  const theme = sanitizeTheme(themeValue);

  if (ALLOWED_THEMES.includes(theme)) {
    element.setAttribute('data-theme', theme);
    element.style.removeProperty('--theme-primary');
    element.style.removeProperty('--theme-dark');
    element.style.removeProperty('--theme-light');
    element.style.removeProperty('--theme-border');
    element.style.removeProperty('--theme-gradient');
    element.style.removeProperty('--theme-badge-bg');
    element.style.removeProperty('--theme-badge-text');
    element.style.removeProperty('--theme-ring');
    return;
  }

  const parsed = parseColor(theme);
  if (!parsed) {
    element.setAttribute('data-theme', 'blue');
    return;
  }

  const { r, g, b, hex } = parsed;
  const darkR = Math.round(r * 0.7);
  const darkG = Math.round(g * 0.7);
  const darkB = Math.round(b * 0.7);
  const darkHex = `rgb(${darkR}, ${darkG}, ${darkB})`;

  const lightR = Math.round(r + (255 - r) * 0.93);
  const lightG = Math.round(g + (255 - g) * 0.93);
  const lightB = Math.round(b + (255 - b) * 0.93);
  const lightHex = `rgb(${lightR}, ${lightG}, ${lightB})`;

  const borderR = Math.round(r + (255 - r) * 0.75);
  const borderG = Math.round(g + (255 - g) * 0.75);
  const borderB = Math.round(b + (255 - b) * 0.75);
  const borderHex = `rgb(${borderR}, ${borderG}, ${borderB})`;

  const gradient = `linear-gradient(135deg, ${darkHex} 0%, ${hex} 50%, rgb(${Math.min(255, r + 25)}, ${Math.min(255, g + 25)}, ${Math.min(255, b + 25)}) 100%)`;

  element.removeAttribute('data-theme');
  element.style.setProperty('--theme-primary', hex);
  element.style.setProperty('--theme-dark', darkHex);
  element.style.setProperty('--theme-light', lightHex);
  element.style.setProperty('--theme-border', borderHex);
  element.style.setProperty('--theme-gradient', gradient);
  element.style.setProperty('--theme-badge-bg', lightHex);
  element.style.setProperty('--theme-badge-text', darkHex);
  element.style.setProperty('--theme-ring', `rgba(${r}, ${g}, ${b}, 0.25)`);
}

/**
 * Sanitiza cadenas de texto libre eliminando caracteres de control y limitando longitud
 */
function sanitizeInput(val, maxLength = 100) {
  if (val === null || val === undefined) return '';
  const str = String(val)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
  return str.slice(0, maxLength);
}

/**
 * Limpia y normaliza el Alias (letras mayúsculas, números, puntos y guiones, máx 30 caracteres)
 */
function sanitizeAlias(value) {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 30);
}

/**
 * Valida que un número de WhatsApp normalizado tenga un formato seguro para wa.me
 */
function isValidWhatsApp(num) {
  return typeof num === 'string' && /^549\d{8,12}$/.test(num);
}

/**
 * Normaliza número de teléfono de Argentina al formato internacional '549...'
 */
function normalizeArgentinaWhatsApp(input) {
  if (!input) return '';
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('549')) return digits.slice(0, 15);
  if (digits.startsWith('54')) {
    let rest = digits.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (rest.startsWith('9')) return ('54' + rest).slice(0, 15);
    return ('549' + rest).slice(0, 15);
  }
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (digits.startsWith('11') && digits.length >= 10 && digits.slice(2, 4) === '15') {
    digits = '11' + digits.slice(4);
  } else if (digits.length >= 11 && digits.slice(3, 5) === '15') {
    digits = digits.slice(0, 3) + digits.slice(5);
  } else if (digits.length >= 12 && digits.slice(4, 6) === '15') {
    digits = digits.slice(0, 4) + digits.slice(6);
  } else if (digits.startsWith('15') && digits.length === 9) {
    digits = digits.slice(2);
  }

  return ('549' + digits).slice(0, 15);
}

/**
 * Formatea número telefónico para visualización amigable en Argentina
 */
function formatWhatsAppDisplay(raw) {
  const norm = normalizeArgentinaWhatsApp(raw);
  if (!norm || norm.length < 11) return raw || '';
  const withoutCountry = norm.slice(3);
  if (withoutCountry.startsWith('11')) {
    return `+54 9 11 ${withoutCountry.slice(2, 6)}-${withoutCountry.slice(6)}`;
  }
  return `+54 9 ${withoutCountry.slice(0, 3)} ${withoutCountry.slice(3, 6)}-${withoutCountry.slice(6)}`;
}

/**
 * Formatea CUIT/CUIL a 'XX-XXXXXXXX-X'
 */
function formatCUIT(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
}

/**
 * Construye la URL corta para compartir o codificar en el QR
 */
function buildShareUrl(state) {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const params = new URLSearchParams();

  if (state.n && state.n.trim()) params.set('n', state.n.trim().slice(0, 80));
  if (state.r && state.r.trim()) params.set('r', state.r.trim().slice(0, 80));
  if (state.a && state.a.trim()) params.set('a', sanitizeAlias(state.a));
  if (state.c) {
    const cleanCbu = state.c.replace(/\D/g, '').slice(0, 22);
    if (cleanCbu) params.set('c', cleanCbu);
  }
  if (state.t && state.t.trim()) params.set('t', state.t.trim().slice(0, 80));
  if (state.u) {
    const cleanCuit = state.u.trim().slice(0, 13);
    if (cleanCuit) params.set('u', cleanCuit);
  }
  if (state.b && state.b.trim()) params.set('b', state.b.trim().slice(0, 40));
  if (state.w) {
    const cleanWa = normalizeArgentinaWhatsApp(state.w);
    if (cleanWa) params.set('w', cleanWa);
  }
  if (state.p && state.p.trim()) params.set('p', state.p.trim().slice(0, 120));
  if (state.th && state.th !== 'blue') params.set('th', sanitizeTheme(state.th));

  return `${origin}${pathname}?${params.toString()}`;
}

/**
 * Muestra un Toast estilizado en pantalla de forma 100% segura contra XSS
 */
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type === 'success' ? 'success' : 'info'}`;
  
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', type === 'success' ? 'check-circle' : 'info');
  icon.className = 'w-5 h-5 flex-shrink-0';

  const textSpan = document.createElement('span');
  textSpan.textContent = String(message);

  toast.appendChild(icon);
  toast.appendChild(textSpan);
  container.appendChild(toast);

  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/**
 * Copia texto al portapapeles con fallback y vibración háptica
 */
async function copyToClipboard(text, successMessage = 'Copiado al portapapeles') {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(50);
    } catch (e) {
      // Ignorar si el navegador no permite vibración
    }
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showToast(successMessage, 'success');
    return true;
  } catch (err) {
    console.error('Error al copiar:', err);
    showToast('No se pudo copiar automáticamente', 'info');
    return false;
  }
}

/**
 * Genera el DataURL del código QR en alta nitidez con QRious
 */
function generateQRDataURL(url, size = 600) {
  if (typeof QRious === 'undefined') {
    console.warn('QRious no disponible');
    return '';
  }
  const qr = new QRious({
    value: url,
    size: size,
    level: 'M'
  });
  return qr.toDataURL('image/png');
}

/**
 * Actualiza el código QR en la vista de cartel (Modo Creador)
 */
function updateQRCode() {
  const shareUrl = buildShareUrl(appState);
  const qrDataUrl = generateQRDataURL(shareUrl, 600);

  const container = document.getElementById('printable-poster');
  const posterImg = container ? container.querySelector('#poster-qr-img') : document.getElementById('poster-qr-img');
  if (posterImg && qrDataUrl) {
    posterImg.src = qrDataUrl;
  }
}

/**
 * Sincroniza el elemento para impresión física (@media print) evitando colisión de IDs
 */
function syncPrintStage(format = selectedPrintFormat) {
  const printStage = document.getElementById('print-stage');
  const posterElem = document.getElementById('printable-poster');
  if (!printStage || !posterElem) return;

  printStage.innerHTML = '';
  const clone = posterElem.cloneNode(true);
  clone.id = 'printable-poster-print-clone';
  // Renombrar IDs internos para evitar colisiones con el DOM visible
  clone.querySelectorAll('[id]').forEach((el) => {
    el.id = 'print-clone-' + el.id;
  });
  printStage.appendChild(clone);

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Limpia el print-stage y remueve clases de impresión temporales
 */
function clearPrintStage() {
  const printStage = document.getElementById('print-stage');
  if (printStage) printStage.innerHTML = '';
  document.body.classList.remove('print-format-a5', 'print-format-a4');
  const dynamicStyle = document.getElementById('dynamic-print-page-style');
  if (dynamicStyle) dynamicStyle.remove();
}

/**
 * Carga el estado desde localStorage o mantiene defaults
 */
function loadStateFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      appState = {
        n: sanitizeInput(parsed.n || DEFAULT_STATE.n, 80),
        r: sanitizeInput(parsed.r || DEFAULT_STATE.r, 80),
        a: sanitizeAlias(parsed.a || DEFAULT_STATE.a),
        c: String(parsed.c || DEFAULT_STATE.c).replace(/\D/g, '').slice(0, 22),
        t: sanitizeInput(parsed.t || DEFAULT_STATE.t, 80),
        u: formatCUIT(parsed.u || DEFAULT_STATE.u),
        b: sanitizeInput(parsed.b || DEFAULT_STATE.b, 40),
        w: sanitizeInput(parsed.w || DEFAULT_STATE.w, 25),
        p: sanitizeInput(parsed.p || DEFAULT_STATE.p, 120),
        th: sanitizeTheme(parsed.th || DEFAULT_STATE.th)
      };
      return;
    }
  } catch (e) {
    console.warn('Error leyendo localStorage:', e);
  }
  appState = { ...DEFAULT_STATE };
}

/**
 * Guarda el estado en localStorage
 */
function saveStateToStorage() {
  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn('Error guardando en localStorage:', e);
  }
}

/**
 * Carga el estado a partir de los query parameters en la URL con validación estricta
 */
function loadStateFromParams(params) {
  if (params.has('n')) appState.n = sanitizeInput(params.get('n'), 80);
  if (params.has('r')) appState.r = sanitizeInput(params.get('r'), 80);
  if (params.has('a')) appState.a = sanitizeAlias(params.get('a'));
  if (params.has('c')) appState.c = (params.get('c') || '').replace(/\D/g, '').slice(0, 22);
  if (params.has('t')) appState.t = sanitizeInput(params.get('t'), 80);
  if (params.has('u')) appState.u = formatCUIT(params.get('u'));
  if (params.has('b')) appState.b = sanitizeInput(params.get('b'), 40);
  if (params.has('w')) appState.w = sanitizeInput(params.get('w'), 25);
  if (params.has('p')) appState.p = sanitizeInput(params.get('p'), 120);
  if (params.has('th')) appState.th = sanitizeTheme(params.get('th'));
}

/**
 * Rellena los campos del formulario en Modo Creador
 */
function populateFormFields() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('input-name', appState.n);
  setVal('input-rubro', appState.r);
  setVal('input-alias', appState.a);
  setVal('input-cbu', appState.c);
  setVal('input-titular', appState.t);
  setVal('input-cuit', appState.u);
  setVal('input-banco', appState.b);
  setVal('input-whatsapp', appState.w);
  setVal('input-promo', appState.p);
  if (appState.p && appState.p.trim().length > 0) {
    updatePromoModeUI('calc');
  } else {
    updatePromoModeUI('simple');
  }

  // Sincronizar colores en controles
  const colorPicker = document.getElementById('input-theme-color-picker');
  const customColorInput = document.getElementById('input-custom-color-text');

  if (ALLOWED_THEMES.includes(appState.th)) {
    document.querySelectorAll('.theme-option').forEach(btn => {
      const theme = btn.getAttribute('data-theme-value');
      if (theme === appState.th) {
        btn.classList.add('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
      } else {
        btn.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
      }
    });
    const presetHex = PRESET_THEMES[appState.th].hex;
    if (colorPicker) colorPicker.value = presetHex;
    if (customColorInput) customColorInput.value = presetHex;
  } else {
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
    });
    const parsed = parseColor(appState.th);
    if (parsed) {
      if (colorPicker) colorPicker.value = parsed.hex;
      if (customColorInput) customColorInput.value = parsed.hex;
    }
  }

  updateCbuValidationBadge();
  updateWhatsAppHint();
}

/**
 * Indicador visual para la longitud del CBU/CVU
 */
function updateCbuValidationBadge() {
  const badge = document.getElementById('cbu-validation-badge');
  if (!badge) return;
  const digits = (appState.c || '').replace(/\D/g, '');
  if (!digits) {
    badge.textContent = '';
    badge.className = 'text-xs text-slate-400 mt-1';
    return;
  }
  if (digits.length === 22) {
    badge.textContent = '✓ CBU/CVU válido (22 dígitos)';
    badge.className = 'text-xs font-semibold text-emerald-600 mt-1';
  } else {
    badge.textContent = `Ingresaste ${digits.length} de 22 dígitos requeridos`;
    badge.className = 'text-xs font-medium text-amber-600 mt-1';
  }
}

/**
 * Indicador visual para el formato de WhatsApp
 */
function updateWhatsAppHint() {
  const hint = document.getElementById('whatsapp-preview-hint');
  if (!hint) return;
  if (!appState.w) {
    hint.textContent = 'Ej: 11 2345-6789 o 3624000000 (lo formateamos automáticamente)';
    hint.className = 'text-xs text-slate-400 mt-1';
    return;
  }
  const formatted = formatWhatsAppDisplay(appState.w);
  hint.textContent = `Enlace internacional: ${formatted}`;
  hint.className = 'text-xs font-medium text-emerald-600 mt-1';
}

/**
 * Renderiza la Vista Previa del Cartel Imprimible (Modo Creador)
 */
function renderPosterPreview() {
  const container = document.getElementById('printable-poster');
  if (!container) return;

  // Aplicar tema (preset o color libre HEX/RGB)
  applyThemeColor(container, appState.th);

  const nameEl = container.querySelector('#poster-name');
  if (nameEl) nameEl.textContent = appState.n || 'Nombre de tu Comercio';

  const rubroEl = container.querySelector('#poster-rubro');
  if (rubroEl) {
    if (appState.r && appState.r.trim()) {
      rubroEl.textContent = appState.r.trim();
      rubroEl.classList.remove('hidden');
    } else {
      rubroEl.classList.add('hidden');
    }
  }

  const aliasEl = container.querySelector('#poster-alias');
  if (aliasEl) aliasEl.textContent = appState.a || 'TU.ALIAS.AQUI';

  const bancoEl = container.querySelector('#poster-banco');
  if (bancoEl) bancoEl.textContent = appState.b || 'Tu Banco o Billetera';

  const titularEl = container.querySelector('#poster-titular');
  if (titularEl) titularEl.textContent = appState.t || 'Nombre del Titular';

  const cuitWrapper = container.querySelector('#poster-cuit-wrapper');
  const cuitEl = container.querySelector('#poster-cuit');
  if (cuitWrapper && cuitEl) {
    if (appState.u && appState.u.trim()) {
      cuitEl.textContent = appState.u.trim();
      cuitWrapper.classList.remove('hidden');
    } else {
      cuitWrapper.classList.add('hidden');
    }
  }

  const cbuWrapper = container.querySelector('#poster-cbu-wrapper');
  const cbuEl = container.querySelector('#poster-cbu');
  if (cbuWrapper && cbuEl) {
    if (appState.c && appState.c.trim()) {
      cbuEl.textContent = appState.c.trim();
      cbuWrapper.classList.remove('hidden');
    } else {
      cbuWrapper.classList.add('hidden');
    }
  }

  // Promo en Cartel: Solo se muestra si fue cargada
  const hasPromo = Boolean(appState.p && appState.p.trim().length > 0);
  const promoWrapper = container.querySelector('#poster-promo-wrapper');
  const promoEl = container.querySelector('#poster-promo');
  if (promoWrapper && promoEl) {
    if (hasPromo) {
      promoEl.textContent = appState.p.trim();
      promoWrapper.classList.remove('hidden');
    } else {
      promoWrapper.classList.add('hidden');
    }
  }
}

/**
 * Renderiza la Maqueta de Celular del Cliente en el Modo Creador
 */
function renderMobileMockupPreview() {
  const container = document.getElementById('mobile-preview-container');
  if (!container) return;

  applyThemeColor(container, appState.th);

  const mName = container.querySelector('#mockup-name');
  if (mName) mName.textContent = appState.n || 'Tu Comercio';

  const mRubro = container.querySelector('#mockup-rubro');
  if (mRubro) {
    if (appState.r && appState.r.trim()) {
      mRubro.textContent = appState.r.trim();
      mRubro.classList.remove('hidden');
    } else {
      mRubro.classList.add('hidden');
    }
  }

  const mBanco = container.querySelector('#mockup-banco');
  if (mBanco) mBanco.textContent = appState.b || 'Billetera Digital';

  const mAlias = container.querySelector('#mockup-alias');
  if (mAlias) mAlias.textContent = appState.a || 'TU.ALIAS';

  const mTitular = container.querySelector('#mockup-titular');
  if (mTitular) mTitular.textContent = appState.t || 'Titular de la Cuenta';

  const mCuitRow = container.querySelector('#mockup-cuit-row');
  const mCuit = container.querySelector('#mockup-cuit');
  if (mCuitRow && mCuit) {
    if (appState.u && appState.u.trim()) {
      mCuit.textContent = appState.u.trim();
      mCuitRow.classList.remove('hidden');
    } else {
      mCuitRow.classList.add('hidden');
    }
  }

  const mCbuRow = container.querySelector('#mockup-cbu-row');
  const mCbu = container.querySelector('#mockup-cbu');
  if (mCbuRow && mCbu) {
    if (appState.c && appState.c.trim()) {
      mCbu.textContent = appState.c.trim();
      mCbuRow.classList.remove('hidden');
    } else {
      mCbuRow.classList.add('hidden');
    }
  }

  // Promo en Maqueta: Solo se muestra si fue cargada
  const hasPromo = Boolean(appState.p && appState.p.trim().length > 0);
  const mPromoRow = container.querySelector('#mockup-promo-row');
  const mPromo = container.querySelector('#mockup-promo');
  if (mPromoRow && mPromo) {
    if (hasPromo) {
      mPromo.textContent = appState.p.trim();
      mPromoRow.classList.remove('hidden');
    } else {
      mPromoRow.classList.add('hidden');
    }
  }

  const mWaBtn = container.querySelector('#mockup-wa-btn');
  if (mWaBtn) {
    if (appState.w && appState.w.trim()) {
      mWaBtn.classList.remove('hidden');
    } else {
      mWaBtn.classList.add('hidden');
    }
  }
}

/**
 * Renderiza la VISTA 2: MODO CLIENTE (Pantalla de Cobro Rápido)
 * Condicional estricto: Si NO hay promo, se ocultan tanto la promo como la calculadora del ticket.
 */
function renderClientView() {
  const clientRoot = document.getElementById('client-view');
  if (!clientRoot) return;

  applyThemeColor(clientRoot, appState.th);

  const cName = document.getElementById('client-name');
  if (cName) cName.textContent = appState.n || 'Comercio';

  const cRubro = document.getElementById('client-rubro');
  if (cRubro) {
    if (appState.r && appState.r.trim()) {
      cRubro.textContent = appState.r.trim();
      cRubro.classList.remove('hidden');
    } else {
      cRubro.classList.add('hidden');
    }
  }

  const cBancoBadge = document.getElementById('client-banco-badge');
  if (cBancoBadge) cBancoBadge.textContent = appState.b || 'Transferencia Bancaria';

  const cAlias = document.getElementById('client-alias-display');
  if (cAlias) cAlias.textContent = appState.a || 'NO CONFIGURADO';

  const cTitular = document.getElementById('client-titular');
  if (cTitular) cTitular.textContent = appState.t || '-';

  const cBanco = document.getElementById('client-banco');
  if (cBanco) cBanco.textContent = appState.b || '-';

  // CUIT
  const cCuitRow = document.getElementById('client-cuit-row');
  const cCuit = document.getElementById('client-cuit');
  if (cCuitRow && cCuit) {
    if (appState.u && appState.u.trim()) {
      cCuit.textContent = appState.u.trim();
      cCuitRow.classList.remove('hidden');
    } else {
      cCuitRow.classList.add('hidden');
    }
  }

  // CBU
  const cCbuRow = document.getElementById('client-cbu-row');
  const cCbu = document.getElementById('client-cbu');
  if (cCbuRow && cCbu) {
    if (appState.c && appState.c.trim()) {
      cCbu.textContent = appState.c.trim();
      cCbuRow.classList.remove('hidden');
    } else {
      cCbuRow.classList.add('hidden');
    }
  }

  // REGLA CRÍTICA DE NEGOCIO:
  // Si no se pone mensaje o promo destacada, no aparece ese recuadro ni la calculadora del ticket.
  const hasPromo = Boolean(appState.p && appState.p.trim().length > 0);
  const clientPromoCalcSection = document.getElementById('client-promo-calc-section');
  const cPromoBanner = document.getElementById('client-promo-banner');
  const cPromoText = document.getElementById('client-promo-text');

  if (clientPromoCalcSection) {
    if (hasPromo) {
      clientPromoCalcSection.classList.remove('hidden');
      if (cPromoBanner) cPromoBanner.classList.remove('hidden');
      if (cPromoText) cPromoText.textContent = appState.p.trim();
      initClientCalculator();
    } else {
      clientPromoCalcSection.classList.add('hidden');
      if (cPromoBanner) cPromoBanner.classList.add('hidden');
    }
  }

  // Botón de WhatsApp con validación estricta de formato telefónico
  const cWaSection = document.getElementById('client-wa-section');
  const cWaLink = document.getElementById('client-wa-btn');
  if (cWaSection && cWaLink) {
    const normWa = normalizeArgentinaWhatsApp(appState.w);
    if (normWa && isValidWhatsApp(normWa)) {
      const storeName = appState.n ? appState.n.trim() : 'el local';
      const textMsg = `¡Hola! Te envío el comprobante de transferencia para *${storeName}*.`;
      cWaLink.href = `https://wa.me/${normWa}?text=${encodeURIComponent(textMsg)}`;
      cWaSection.classList.remove('hidden');
    } else {
      cWaSection.classList.add('hidden');
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Calculadora interactiva rápida para el cliente (descuento y copiado de monto)
 * Protegida contra valores negativos, infinitos o no numéricos.
 */
function initClientCalculator() {
  const calcAmountInput = document.getElementById('client-calc-amount');
  const calcDiscountPill = document.getElementById('client-calc-discount-pill');
  const calcFinalTotal = document.getElementById('client-calc-final');
  const calcCopyBtn = document.getElementById('client-calc-copy-btn');
  if (!calcAmountInput || !calcFinalTotal) return;

  let promoDiscountPercent = 0;
  if (appState.p) {
    const match = appState.p.match(/(\d{1,2})\s*%/);
    if (match && match[1]) {
      const parsedPct = parseInt(match[1], 10);
      if (parsedPct > 0 && parsedPct <= 100) {
        promoDiscountPercent = parsedPct;
      }
    }
  }

  if (promoDiscountPercent > 0 && calcDiscountPill) {
    calcDiscountPill.textContent = `Promo aplicada: ${promoDiscountPercent}% OFF`;
    calcDiscountPill.classList.remove('hidden');
  } else if (calcDiscountPill) {
    calcDiscountPill.classList.add('hidden');
  }

  const updateCalculator = () => {
    const rawVal = parseFloat(calcAmountInput.value);
    if (isNaN(rawVal) || !isFinite(rawVal) || rawVal <= 0) {
      calcFinalTotal.textContent = '$0';
      return;
    }
    const val = Math.min(100000000000, Math.max(0, rawVal));
    let total = val;
    if (promoDiscountPercent > 0) {
      total = val - (val * (promoDiscountPercent / 100));
    }
    calcFinalTotal.textContent = `$${Math.round(total).toLocaleString('es-AR')}`;
  };

  calcAmountInput.oninput = updateCalculator;

  if (calcCopyBtn) {
    calcCopyBtn.onclick = () => {
      const rawVal = parseFloat(calcAmountInput.value);
      if (isNaN(rawVal) || !isFinite(rawVal) || rawVal <= 0) {
        showToast('Ingresá un monto para copiar', 'info');
        return;
      }
      const val = Math.min(100000000000, Math.max(0, rawVal));
      let total = val;
      if (promoDiscountPercent > 0) {
        total = Math.round(val - (val * (promoDiscountPercent / 100)));
      }
      copyToClipboard(total.toString(), `Monto $${total.toLocaleString('es-AR')} copiado`);
    };
  }
}

/**
 * Maneja el clic en el BOTÓN GIGANTE DE COPIAR ALIAS (Modo Cliente)
 */
function handleClientCopyAlias() {
  const btn = document.getElementById('client-copy-alias-btn');
  const btnText = document.getElementById('client-copy-alias-text');
  const btnSub = document.getElementById('client-copy-alias-sub');
  const btnIcon = document.getElementById('client-copy-alias-icon');
  if (!btn || !btnText) return;

  copyToClipboard(appState.a, '¡Alias copiado! Abrí tu billetera y pegalo');

  btn.classList.remove('bg-theme-primary', 'hover:brightness-110');
  btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'scale-[1.02]');
  btnText.textContent = '¡ALIAS COPIADO!';
  if (btnSub) btnSub.textContent = 'Abrí tu billetera o banco y pegalo';
  if (btnIcon) btnIcon.setAttribute('data-lucide', 'check');

  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'scale-[1.02]');
    btn.classList.add('bg-theme-primary', 'hover:brightness-110');
    btnText.textContent = 'COPIAR ALIAS';
    if (btnSub) btnSub.textContent = 'Tocá acá para copiar y pegar en tu banco';
    if (btnIcon) btnIcon.setAttribute('data-lucide', 'copy');
    if (window.lucide) window.lucide.createIcons();
  }, 2500);
}

/**
 * Conmuta entre las pestañas de vista previa en Modo Creador
 */
function switchPreviewTab(tab) {
  currentPreviewTab = tab;
  const tabPosterBtn = document.getElementById('tab-btn-poster');
  const tabMobileBtn = document.getElementById('tab-btn-mobile');
  const posterView = document.getElementById('preview-view-poster');
  const mobileView = document.getElementById('preview-view-mobile');

  if (tab === 'poster') {
    tabPosterBtn.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
    tabPosterBtn.classList.remove('text-slate-600');
    tabMobileBtn.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
    tabMobileBtn.classList.add('text-slate-600');

    posterView.classList.remove('hidden');
    mobileView.classList.add('hidden');
    renderPosterPreview();
  } else {
    tabMobileBtn.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
    tabMobileBtn.classList.remove('text-slate-600');
    tabPosterBtn.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
    tabPosterBtn.classList.add('text-slate-600');

    posterView.classList.add('hidden');
    mobileView.classList.remove('hidden');
    renderMobileMockupPreview();
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Modifica el formato activo de impresión / imagen (A5 o A4)
 */
function setPrintFormat(format) {
  if (format !== 'a4' && format !== 'a5') return;
  selectedPrintFormat = format;

  const btnA5 = document.getElementById('format-btn-a5');
  const btnA4 = document.getElementById('format-btn-a4');
  const printLabel = document.getElementById('btn-print-pdf-label');
  const printSub = document.getElementById('btn-print-pdf-sub');
  const imgLabel = document.getElementById('btn-download-image-label');
  const imgSub = document.getElementById('btn-download-image-sub');

  if (format === 'a5') {
    if (btnA5) {
      btnA5.className = 'format-pill flex-1 py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all bg-white text-slate-900 shadow-xs';
    }
    if (btnA4) {
      btnA4.className = 'format-pill flex-1 py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-slate-600 hover:text-slate-900';
    }
    if (printLabel) printLabel.textContent = 'Imprimir / PDF (A5)';
    if (printSub) printSub.textContent = 'Acrílico Mostrador (14.8×21 cm)';
    if (imgLabel) imgLabel.textContent = 'Descargar Imagen (A5 HD)';
    if (imgSub) imgSub.textContent = 'Acrílico Mostrador (14.8×21 cm)';
  } else {
    if (btnA4) {
      btnA4.className = 'format-pill flex-1 py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all bg-white text-slate-900 shadow-xs';
    }
    if (btnA5) {
      btnA5.className = 'format-pill flex-1 py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-slate-600 hover:text-slate-900';
    }
    if (printLabel) printLabel.textContent = 'Imprimir / PDF (A4)';
    if (printSub) printSub.textContent = 'Vidriera / Pared (21×29.7 cm)';
    if (imgLabel) imgLabel.textContent = 'Descargar Imagen (A4 HD)';
    if (imgSub) imgSub.textContent = 'Vidriera / Pared (21×29.7 cm)';
  }
}

/**
 * Disparador nativo de Impresión de Cartel (soporta formato A5 o A4)
 */
function printPoster(format = selectedPrintFormat) {
  const effectiveFormat = (format === 'a4' || format === 'a5') ? format : selectedPrintFormat;

  // Asignar clase de formato al body para activar las reglas CSS @media print
  document.body.classList.remove('print-format-a5', 'print-format-a4');
  document.body.classList.add(`print-format-${effectiveFormat}`);

  // Inyectar regla @page dinámica para tamaño y margen de página
  let dynamicStyle = document.getElementById('dynamic-print-page-style');
  if (!dynamicStyle) {
    dynamicStyle = document.createElement('style');
    dynamicStyle.id = 'dynamic-print-page-style';
    document.head.appendChild(dynamicStyle);
  }
  const pageSize = effectiveFormat === 'a5' ? '148mm 210mm' : '210mm 297mm';
  dynamicStyle.textContent = `@page { size: ${pageSize}; margin: 0 !important; }`;

  // Sincronizar el nodo de impresión clonado
  syncPrintStage(effectiveFormat);

  // Limpieza posterior al diálogo de impresión
  const cleanup = () => {
    clearPrintStage();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 4000); // Fallback por si el navegador no dispara afterprint

  window.print();
}

/**
 * Descarga del Cartel como imagen PNG en alta definición mediante html2canvas
 */
async function downloadPosterImage(format = selectedPrintFormat) {
  if (typeof html2canvas === 'undefined') {
    showToast('html2canvas no está cargado', 'info');
    return;
  }

  const posterElem = document.getElementById('printable-poster');
  const downloadBtn = document.getElementById('btn-download-image') || document.getElementById('btn-download-png');
  if (!posterElem) return;

  const originalBtnHTML = downloadBtn ? downloadBtn.innerHTML : '';
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Generando imagen HD...</span>
    `;
  }

  try {
    const effectiveFormat = (format === 'a4' || format === 'a5') ? format : selectedPrintFormat;
    const scale = effectiveFormat === 'a4' ? 3 : 2.5;

    const canvas = await html2canvas(posterElem, {
      scale: scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const safeName = (appState.n || 'comercio')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const fileName = `cartel-pasadatos-${safeName}-${effectiveFormat}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();

    const formatLabel = effectiveFormat === 'a4' ? 'A4 (Vidriera / Pared)' : 'A5 (Acrílico Mostrador)';
    showToast(`✓ Imagen ${formatLabel} descargada en alta definición`, 'success');
  } catch (err) {
    console.error('Error al exportar PNG:', err);
    showToast('No se pudo generar la imagen', 'info');
  } finally {
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = originalBtnHTML;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// Alias de retrocompatibilidad
const downloadPosterPNG = downloadPosterImage;

/**
 * Copia el link de cobro al portapapeles
 */
function copyPaymentLink() {
  const url = buildShareUrl(appState);
  copyToClipboard(url, '¡Link de cobro copiado! Compartilo por chat o redes.');
}

/**
 * Abre WhatsApp con el enlace de cobro listo para enviar
 */
function shareOnWhatsApp() {
  const url = buildShareUrl(appState);
  const msg = `¡Hola! Te paso nuestros datos de transferencia y contacto directo para pagar rápido:\n\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}

// =========================================================================
// SISTEMA DE RATE LIMITING PARA EL BOTÓN DE ACTUALIZAR (1 VEZ POR MINUTO)
// =========================================================================

/**
 * Inicializa el estado del temporizador de cooldown desde localStorage
 */
function initUpdateCooldown() {
  const btn = document.getElementById('btn-update-qr');
  const btnText = document.getElementById('btn-update-qr-text');
  const statusContainer = document.getElementById('update-qr-status');
  if (!btn || !btnText) return;

  const lastUpdateStr = localStorage.getItem(STORAGE_LAST_UPDATE_KEY);
  if (!lastUpdateStr) {
    btn.disabled = false;
    btnText.textContent = 'Actualizar Datos y QR';
    return;
  }

  const lastUpdate = parseInt(lastUpdateStr, 10);
  const now = Date.now();
  const elapsed = now - lastUpdate;

  if (elapsed >= 0 && elapsed < UPDATE_COOLDOWN_MS) {
    const remainingSec = Math.ceil((UPDATE_COOLDOWN_MS - elapsed) / 1000);
    setUpdateCooldown(remainingSec);
  } else {
    btn.disabled = false;
    btnText.textContent = 'Actualizar Datos y QR';
    if (statusContainer) {
      statusContainer.innerHTML = '<i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i><span>Permite actualizar hasta 1 vez por minuto</span>';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

/**
 * Activa la cuenta regresiva visual y deshabilita el botón de actualizar
 */
function setUpdateCooldown(remainingSeconds) {
  const btn = document.getElementById('btn-update-qr');
  const btnText = document.getElementById('btn-update-qr-text');
  const statusContainer = document.getElementById('update-qr-status');
  if (!btn || !btnText) return;

  btn.disabled = true;
  if (updateCooldownTimer) clearInterval(updateCooldownTimer);

  let secondsLeft = remainingSeconds;

  const renderTimerState = () => {
    btnText.textContent = `Esperá ${secondsLeft}s...`;
    if (statusContainer) {
      statusContainer.innerHTML = `<i data-lucide="hourglass" class="w-3.5 h-3.5 text-amber-500 animate-spin"></i><span class="text-amber-700 font-semibold">Próxima actualización en ${secondsLeft}s</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  };

  renderTimerState();

  updateCooldownTimer = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(updateCooldownTimer);
      updateCooldownTimer = null;
      btn.disabled = false;
      btnText.textContent = 'Actualizar Datos y QR';
      if (statusContainer) {
        statusContainer.innerHTML = '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-500"></i><span class="text-emerald-700 font-medium">Listo para actualizar</span>';
        if (window.lucide) window.lucide.createIcons();
      }
    } else {
      renderTimerState();
    }
  }, 1000);
}

/**
 * Recoge los valores actuales de los inputs del formulario
 */
function collectFormValues() {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  appState.n = sanitizeInput(getVal('input-name'), 80);
  appState.r = sanitizeInput(getVal('input-rubro'), 80);
  appState.a = sanitizeAlias(getVal('input-alias'));
  appState.c = getVal('input-cbu').replace(/\D/g, '').slice(0, 22);
  appState.t = sanitizeInput(getVal('input-titular'), 80);
  appState.u = formatCUIT(getVal('input-cuit'));
  appState.b = sanitizeInput(getVal('input-banco'), 40);
  appState.w = sanitizeInput(getVal('input-whatsapp'), 25);

  // Promo: Si el contenedor de promo está visible, tomar el valor; sino, vacío (Modo Simple)
  const promoContainer = document.getElementById('promo-input-container');
  if (promoContainer && !promoContainer.classList.contains('hidden')) {
    appState.p = sanitizeInput(getVal('input-promo'), 120);
  } else {
    appState.p = '';
  }

  // Tema visual: priorizar preset si tiene ring-4 activo; si no, color personalizado
  const activePreset = document.querySelector('.theme-option.ring-4');
  if (activePreset) {
    appState.th = sanitizeTheme(activePreset.getAttribute('data-theme-value'));
  } else {
    const customColorInput = document.getElementById('input-custom-color-text');
    if (customColorInput && customColorInput.value.trim()) {
      const parsed = parseColor(customColorInput.value.trim());
      if (parsed) {
        appState.th = parsed.hex.slice(1);
      }
    }
  }
}

/**
 * Actualiza la apariencia visual del selector de promo simple vs calculadora
 */
function updatePromoModeUI(mode) {
  const btnSimple = document.getElementById('btn-promo-mode-simple');
  const btnCalc = document.getElementById('btn-promo-mode-calc');
  const container = document.getElementById('promo-input-container');

  if (mode === 'simple') {
    if (btnSimple) {
      btnSimple.className = 'py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all bg-white text-slate-900 shadow-xs cursor-pointer';
    }
    if (btnCalc) {
      btnCalc.className = 'py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-slate-600 hover:text-slate-900 cursor-pointer';
    }
    if (container) container.classList.add('hidden');
  } else {
    if (btnCalc) {
      btnCalc.className = 'py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all bg-white text-slate-900 shadow-xs cursor-pointer';
    }
    if (btnSimple) {
      btnSimple.className = 'py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-slate-600 hover:text-slate-900 cursor-pointer';
    }
    if (container) container.classList.remove('hidden');
  }
}

/**
 * Conmuta entre Modo Simple (sin promo ni calculadora) y Modo Descuento
 */
function setPromoMode(mode) {
  updatePromoModeUI(mode);
  const inputPromo = document.getElementById('input-promo');

  if (mode === 'simple') {
    if (inputPromo) inputPromo.value = '';
    appState.p = '';
  } else {
    if (inputPromo) {
      if (!inputPromo.value.trim()) {
        inputPromo.value = '10% OFF pagando por transferencia';
      }
      appState.p = inputPromo.value.trim();
      inputPromo.focus();
    }
  }

  saveStateToStorage();
  renderPosterPreview();
  renderMobileMockupPreview();
}

/**
 * Maneja el clic en "Actualizar Datos y Regenerar QR" (Rate Limit: 1 vez por minuto)
 */
function handleUpdateQRClick() {
  const lastUpdateStr = localStorage.getItem(STORAGE_LAST_UPDATE_KEY);
  const now = Date.now();

  if (lastUpdateStr) {
    const lastUpdate = parseInt(lastUpdateStr, 10);
    const elapsed = now - lastUpdate;
    if (elapsed >= 0 && elapsed < UPDATE_COOLDOWN_MS) {
      const remainingSec = Math.ceil((UPDATE_COOLDOWN_MS - elapsed) / 1000);
      showToast(`Podés actualizar nuevamente en ${remainingSec} segundos`, 'info');
      return;
    }
  }

  // 1. Recoger valores directamente de los inputs
  collectFormValues();

  // 2. Persistir en localStorage
  saveStateToStorage();

  // 3. Registrar marca temporal para el rate limit
  localStorage.setItem(STORAGE_LAST_UPDATE_KEY, now.toString());

  // 4. Regenerar cartel, maqueta y código QR inmediatamente
  renderPosterPreview();
  renderMobileMockupPreview();
  updateQRCode();

  // 5. Animación de confirmación visual en el cartel
  const poster = document.getElementById('printable-poster');
  if (poster) {
    poster.classList.add('ring-4', 'ring-blue-500', 'transition-all');
    setTimeout(() => poster.classList.remove('ring-4', 'ring-blue-500'), 1200);

    // En dispositivos móviles, cambiar a la pestaña de cartel y hacer scroll suave
    if (currentPreviewTab !== 'poster') {
      switchPreviewTab('poster');
    }
    if (window.innerWidth < 1024) {
      poster.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 6. Iniciar temporizador de cooldown de 60 segundos
  setUpdateCooldown(60);

  // 7. Notificación visual al usuario
  showToast('✓ Cartel y código QR actualizados con éxito', 'success');
}

/**
 * Vinculación de eventos de inputs en Modo Creador
 */
function bindInputEvents() {
  const onInput = (id, key, formatter = null) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      let val = e.target.value;
      if (formatter) {
        val = formatter(val);
        e.target.value = val;
      }
      appState[key] = val;
      saveStateToStorage();

      renderPosterPreview();
      renderMobileMockupPreview();

      if (key === 'c') updateCbuValidationBadge();
      if (key === 'w') updateWhatsAppHint();
    });
  };

  onInput('input-name', 'n', (v) => sanitizeInput(v, 80));
  onInput('input-rubro', 'r', (v) => sanitizeInput(v, 80));
  onInput('input-alias', 'a', sanitizeAlias);
  onInput('input-cbu', 'c', (val) => val.replace(/\D/g, '').slice(0, 22));
  onInput('input-titular', 't', (v) => sanitizeInput(v, 80));
  onInput('input-cuit', 'u', formatCUIT);
  onInput('input-banco', 'b', (v) => sanitizeInput(v, 40));
  onInput('input-whatsapp', 'w', (v) => sanitizeInput(v, 25));
  onInput('input-promo', 'p', (v) => sanitizeInput(v, 120));

  // Selector de Modalidad de Descuento (Simple vs Calculadora)
  const btnPromoSimple = document.getElementById('btn-promo-mode-simple');
  if (btnPromoSimple) {
    btnPromoSimple.addEventListener('click', () => {
      setPromoMode('simple');
    });
  }

  const btnPromoCalc = document.getElementById('btn-promo-mode-calc');
  if (btnPromoCalc) {
    btnPromoCalc.addEventListener('click', () => {
      setPromoMode('calc');
    });
  }

  // Píldoras rápidas de descuento (10%, 15%, 20%)
  document.querySelectorAll('.promo-quick-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const promoText = pill.getAttribute('data-promo') || '';
      const inputPromo = document.getElementById('input-promo');
      if (inputPromo) {
        inputPromo.value = promoText;
        appState.p = promoText;
        saveStateToStorage();
        renderPosterPreview();
        renderMobileMockupPreview();
      }
    });
  });

  // Botón Principal de Actualizar Datos y Regenerar QR (con Rate Limit)
  const updateQrBtn = document.getElementById('btn-update-qr');
  if (updateQrBtn) {
    updateQrBtn.addEventListener('click', handleUpdateQRClick);
  }

  // Selector de Temas predeterminados
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedTheme = sanitizeTheme(btn.getAttribute('data-theme-value'));
      appState.th = selectedTheme;
      saveStateToStorage();

      document.querySelectorAll('.theme-option').forEach(b => {
        b.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
      });
      btn.classList.add('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');

      const colorPicker = document.getElementById('input-theme-color-picker');
      const customColorInput = document.getElementById('input-custom-color-text');
      const hex = PRESET_THEMES[selectedTheme].hex;
      if (colorPicker) colorPicker.value = hex;
      if (customColorInput) customColorInput.value = hex;

      renderPosterPreview();
      renderMobileMockupPreview();
    });
  });

  // Selector de Color Personalizado (Picker nativo)
  const colorPicker = document.getElementById('input-theme-color-picker');
  const customColorInput = document.getElementById('input-custom-color-text');

  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      const hex = e.target.value.toUpperCase();
      if (customColorInput) customColorInput.value = hex;
      appState.th = hex.slice(1);
      saveStateToStorage();

      document.querySelectorAll('.theme-option').forEach(b => {
        b.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
      });

      renderPosterPreview();
      renderMobileMockupPreview();
    });
  }

  // Campo de texto de Color Personalizado (Hex / RGB)
  if (customColorInput) {
    customColorInput.addEventListener('input', (e) => {
      const parsed = parseColor(e.target.value);
      if (parsed) {
        if (colorPicker) colorPicker.value = parsed.hex;
        appState.th = parsed.hex.slice(1);
        saveStateToStorage();

        document.querySelectorAll('.theme-option').forEach(b => {
          b.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
        });

        renderPosterPreview();
        renderMobileMockupPreview();
      }
    });
  }

  // Píldoras rápidas de Banco / Billetera
  document.querySelectorAll('.bank-quick-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const bank = sanitizeInput(pill.getAttribute('data-bank'), 40);
      const input = document.getElementById('input-banco');
      if (input && bank) {
        input.value = bank;
        appState.b = bank;
        saveStateToStorage();
        if (currentPreviewTab === 'poster') {
          renderPosterPreview();
        } else {
          renderMobileMockupPreview();
        }
      }
    });
  });

  // Botón "+ Otro..." para ingresar banco libremente
  const btnBankOther = document.getElementById('btn-bank-other');
  if (btnBankOther) {
    btnBankOther.addEventListener('click', () => {
      const input = document.getElementById('input-banco');
      if (input) {
        input.value = '';
        input.placeholder = 'Escribí el nombre de tu banco o billetera...';
        input.focus();
        appState.b = '';
        saveStateToStorage();
        if (currentPreviewTab === 'poster') {
          renderPosterPreview();
        } else {
          renderMobileMockupPreview();
        }
      }
    });
  }

  // Botón para resetear a datos de ejemplo
  const resetBtn = document.getElementById('btn-reset-demo');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('¿Querés restaurar los datos de ejemplo predeterminados?')) {
        appState = { ...DEFAULT_STATE };
        saveStateToStorage();
        populateFormFields();
        updateQRCode();
        renderPosterPreview();
        renderMobileMockupPreview();
        showToast('Datos de ejemplo restaurados', 'info');
      }
    });
  }

  // Botón para limpiar formulario en blanco
  const clearBtn = document.getElementById('btn-clear-form');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('¿Querés vaciar el formulario para empezar desde cero?')) {
        appState = {
          n: '',
          r: '',
          a: '',
          c: '',
          t: '',
          u: '',
          b: '',
          w: '',
          p: '',
          th: 'blue'
        };
        saveStateToStorage();
        populateFormFields();
        updateQRCode();
        renderPosterPreview();
        renderMobileMockupPreview();
        showToast('Formulario vaciado', 'info');
      }
    });
  }

  // Pestañas de Vista Previa
  const tabPosterBtn = document.getElementById('tab-btn-poster');
  if (tabPosterBtn) {
    tabPosterBtn.addEventListener('click', () => switchPreviewTab('poster'));
  }
  const tabMobileBtn = document.getElementById('tab-btn-mobile');
  if (tabMobileBtn) {
    tabMobileBtn.addEventListener('click', () => switchPreviewTab('mobile'));
  }

  // Selector de Formato A5 / A4
  const btnFormatA5 = document.getElementById('format-btn-a5');
  if (btnFormatA5) {
    btnFormatA5.addEventListener('click', () => setPrintFormat('a5'));
  }

  const btnFormatA4 = document.getElementById('format-btn-a4');
  if (btnFormatA4) {
    btnFormatA4.addEventListener('click', () => setPrintFormat('a4'));
  }

  // Acciones de Exportación (Nuevos botones y retrocompatibilidad)
  const printPdfBtn = document.getElementById('btn-print-pdf');
  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', () => printPoster(selectedPrintFormat));
  }

  const downloadImgBtn = document.getElementById('btn-download-image');
  if (downloadImgBtn) {
    downloadImgBtn.addEventListener('click', () => downloadPosterImage(selectedPrintFormat));
  }

  const printBtn = document.getElementById('btn-print-poster');
  if (printBtn) printBtn.addEventListener('click', () => printPoster(selectedPrintFormat));

  const downloadBtn = document.getElementById('btn-download-png');
  if (downloadBtn) downloadBtn.addEventListener('click', () => downloadPosterImage(selectedPrintFormat));

  const copyLinkBtn = document.getElementById('btn-copy-link');
  if (copyLinkBtn) copyLinkBtn.addEventListener('click', copyPaymentLink);

  const shareWaBtn = document.getElementById('btn-share-whatsapp');
  if (shareWaBtn) shareWaBtn.addEventListener('click', shareOnWhatsApp);

  const viewClientBtn = document.getElementById('btn-preview-client-mode');
  if (viewClientBtn) {
    viewClientBtn.addEventListener('click', () => {
      const url = buildShareUrl(appState);
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }
}

/**
 * Vinculación de eventos en Modo Cliente
 */
function bindClientEvents() {
  const mainCopyBtn = document.getElementById('client-copy-alias-btn');
  if (mainCopyBtn) {
    mainCopyBtn.addEventListener('click', handleClientCopyAlias);
  }

  const copyCuitBtn = document.getElementById('client-copy-cuit-btn');
  if (copyCuitBtn) {
    copyCuitBtn.addEventListener('click', () => {
      if (appState.u) copyToClipboard(appState.u, 'CUIT copiado');
    });
  }

  const copyCbuBtn = document.getElementById('client-copy-cbu-btn');
  if (copyCbuBtn) {
    copyCbuBtn.addEventListener('click', () => {
      if (appState.c) copyToClipboard(appState.c, 'CBU copiado');
    });
  }
}

/**
 * Conmutación de Vistas (SPA)
 */
function showCreatorView() {
  isCreatorMode = true;
  const creatorRoot = document.getElementById('creator-view');
  const clientRoot = document.getElementById('client-view');

  if (creatorRoot) creatorRoot.classList.remove('hidden');
  if (clientRoot) clientRoot.classList.add('hidden');

  populateFormFields();
  updateQRCode();
  renderPosterPreview();
  renderMobileMockupPreview();
  initUpdateCooldown();
  setPrintFormat('a5');
  if (window.lucide) window.lucide.createIcons();
}

function showClientView() {
  isCreatorMode = false;
  const creatorRoot = document.getElementById('creator-view');
  const clientRoot = document.getElementById('client-view');

  if (creatorRoot) creatorRoot.classList.add('hidden');
  if (clientRoot) clientRoot.classList.remove('hidden');

  renderClientView();
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Navega hacia el inicio limpio de pasaDatos sin parámetros en la URL (?n=...&a=...)
 */
function navigateToCleanHome() {
  window.location.href = window.location.origin + window.location.pathname;
}

/**
 * Vincula los enlaces de la marca y botones para ir al inicio limpio
 */
function bindBrandHomeLinks() {
  const cleanUrl = window.location.origin + window.location.pathname;
  document.querySelectorAll('.brand-home-clean-link').forEach((link) => {
    link.href = cleanUrl;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToCleanHome();
    });
  });
}

/**
 * Enrutador Inicial de la Aplicación
 */
function initRouter() {
  const searchParams = new URLSearchParams(window.location.search);
  const isEdit = searchParams.get('edit') === '1';
  const hasAlias = searchParams.has('a') && searchParams.get('a').trim().length > 0;
  const hasName = searchParams.has('n') && searchParams.get('n').trim().length > 0;

  if (isEdit) {
    loadStateFromParams(searchParams);
    saveStateToStorage();
    showCreatorView();
  } else if (hasAlias || hasName) {
    loadStateFromParams(searchParams);
    showClientView();
  } else {
    loadStateFromStorage();
    showCreatorView();
  }

  bindInputEvents();
  bindClientEvents();
  bindBrandHomeLinks();

  if (window.lucide) window.lucide.createIcons();
}

// Inicialización en DOMContentLoaded
document.addEventListener('DOMContentLoaded', initRouter);
