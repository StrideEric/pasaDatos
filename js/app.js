/**
 * =========================================================================
 * pasaDatos - CONTRATO OFICIAL DE PARÁMETROS URL (ZERO-DB)
 * Impulsado por prolijo.ar
 * =========================================================================
 * REGLA DE RETROCOMPATIBILIDAD PERPETUA:
 * Estas claves se graban en códigos QR físicos ya impresos en miles de
 * mostradores de comercios en Argentina. NUNCA deben renombrarse, eliminarse
 * ni modificarse su semántica en futuros commits.
 *
 * Si algún parámetro falta en la URL, la interfaz debe degradarse con elegancia
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
 * 'th'  : Color de Acento / Tema ('blue'|'emerald'|'violet'|'slate'|'orange')
 * 'edit': Forzar Modo Creador / Edición ('1')
 * =========================================================================
 */

// Estado Global
const DEFAULT_STATE = {
  n: 'Café & Deli Martínez',
  r: 'Cafetería de Especialidad & Pastelería',
  a: 'CAFE.MARTINEZ.MP',
  c: '0000003100085492348571',
  t: 'Gonzalo Agustín Martínez',
  u: '20-38495821-3',
  b: 'Mercado Pago',
  w: '1134859201',
  p: '10% OFF abonando por transferencia inmediata',
  th: 'blue'
};

let appState = { ...DEFAULT_STATE };
let isCreatorMode = true;
let currentPreviewTab = 'poster'; // 'poster' o 'mobile'

// Lista de Billeteras y Bancos frecuentes en Argentina
const POPULAR_BANKS = [
  'Mercado Pago',
  'Banco Galicia',
  'Banco Nación',
  'Santander',
  'BBVA',
  'Brubank',
  'Ualá',
  'Naranja X',
  'Banco Macro',
  'Banco Provincia'
];

/**
 * Normaliza número de teléfono de Argentina al formato internacional '549...'
 * Remueve 0 de prefijo de área y 15 de celular para que funcione sin agendar en wa.me
 */
function normalizeArgentinaWhatsApp(input) {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54')) {
    let rest = digits.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (rest.startsWith('9')) return '54' + rest;
    return '549' + rest;
  }
  if (digits.startsWith('0')) digits = digits.slice(1);

  // Casos comunes de 15 insertado (CABA 11, o códigos de 3/4 dígitos)
  if (digits.startsWith('11') && digits.length >= 10 && digits.slice(2, 4) === '15') {
    digits = '11' + digits.slice(4);
  } else if (digits.length >= 11 && digits.slice(3, 5) === '15') {
    digits = digits.slice(0, 3) + digits.slice(5);
  } else if (digits.length >= 12 && digits.slice(4, 6) === '15') {
    digits = digits.slice(0, 4) + digits.slice(6);
  } else if (digits.startsWith('15') && digits.length === 9) {
    digits = digits.slice(2);
  }

  return '549' + digits;
}

/**
 * Formatea número telefónico para visualización amigable en Argentina
 */
function formatWhatsAppDisplay(raw) {
  const norm = normalizeArgentinaWhatsApp(raw);
  if (!norm || norm.length < 11) return raw || '';
  // norm = 549 + area + subscriber
  const withoutCountry = norm.slice(3); // e.g. 1134859201 o 3624000000
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
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
}

/**
 * Limpia y normaliza el Alias (letras mayúsculas, números, puntos y guiones)
 */
function sanitizeAlias(value) {
  if (!value) return '';
  return value.toUpperCase().replace(/[^A-Z0-9.-]/g, '');
}

/**
 * Construye la URL corta para compartir o codificar en el QR
 */
function buildShareUrl(state) {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const params = new URLSearchParams();

  if (state.n) params.set('n', state.n.trim());
  if (state.r) params.set('r', state.r.trim());
  if (state.a) params.set('a', sanitizeAlias(state.a));
  if (state.c) {
    const cleanCbu = state.c.replace(/\D/g, '');
    if (cleanCbu) params.set('c', cleanCbu);
  }
  if (state.t) params.set('t', state.t.trim());
  if (state.u) {
    const cleanCuit = state.u.trim();
    if (cleanCuit) params.set('u', cleanCuit);
  }
  if (state.b) params.set('b', state.b.trim());
  if (state.w) {
    const cleanWa = normalizeArgentinaWhatsApp(state.w);
    if (cleanWa) params.set('w', cleanWa);
  }
  if (state.p) params.set('p', state.p.trim());
  if (state.th && state.th !== 'blue') params.set('th', state.th);

  return `${origin}${pathname}?${params.toString()}`;
}

/**
 * Muestra un Toast estilizado en pantalla
 */
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  
  const iconName = type === 'success' ? 'check-circle' : 'info';
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 flex-shrink-0"></i>
    <span>${message}</span>
  `;
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
      // Ignorar si el navegador bloquea vibración
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
 * Actualiza el código QR en la vista de cartel y sincroniza el print-stage
 */
function updateQRCode() {
  const shareUrl = buildShareUrl(appState);
  const qrDataUrl = generateQRDataURL(shareUrl, 600);

  const posterImg = document.getElementById('poster-qr-img');
  if (posterImg) {
    posterImg.src = qrDataUrl;
  }

  // Sincronizar el contenedor de impresión estricto
  syncPrintStage();
}

/**
 * Sincroniza el elemento para impresión física (@media print)
 */
function syncPrintStage() {
  const printStage = document.getElementById('print-stage');
  const posterElem = document.getElementById('printable-poster');
  if (!printStage || !posterElem) return;

  // Clonar el nodo del cartel para garantizar que tenga los mismos estilos y QR
  printStage.innerHTML = '';
  const clone = posterElem.cloneNode(true);
  clone.id = 'printable-poster-clone';
  printStage.appendChild(clone);

  // Asegurar que Lucide reemplace los iconos dentro del clon
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Carga el estado desde localStorage o mantiene defaults
 */
function loadStateFromStorage() {
  try {
    const saved = localStorage.getItem('pasadatos_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      appState = { ...DEFAULT_STATE, ...parsed };
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
    localStorage.setItem('pasadatos_config', JSON.stringify(appState));
  } catch (e) {
    console.warn('Error guardando en localStorage:', e);
  }
}

/**
 * Carga el estado a partir de los query parameters en la URL
 */
function loadStateFromParams(params) {
  if (params.has('n')) appState.n = params.get('n') || '';
  if (params.has('r')) appState.r = params.get('r') || '';
  if (params.has('a')) appState.a = sanitizeAlias(params.get('a') || '');
  if (params.has('c')) appState.c = params.get('c') || '';
  if (params.has('t')) appState.t = params.get('t') || '';
  if (params.has('u')) appState.u = params.get('u') || '';
  if (params.has('b')) appState.b = params.get('b') || '';
  if (params.has('w')) appState.w = params.get('w') || '';
  if (params.has('p')) appState.p = params.get('p') || '';
  if (params.has('th')) appState.th = params.get('th') || 'blue';
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

  // Selector de tema activo
  document.querySelectorAll('.theme-option').forEach(btn => {
    const theme = btn.getAttribute('data-theme-value');
    if (theme === appState.th) {
      btn.classList.add('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
    } else {
      btn.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
    }
  });

  // Indicador de validación CBU
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

  // Asignar el tema al contenedor del cartel
  container.setAttribute('data-theme', appState.th || 'blue');

  const nameEl = document.getElementById('poster-name');
  if (nameEl) nameEl.textContent = appState.n || 'Nombre de tu Comercio';

  const rubroEl = document.getElementById('poster-rubro');
  if (rubroEl) {
    if (appState.r) {
      rubroEl.textContent = appState.r;
      rubroEl.classList.remove('hidden');
    } else {
      rubroEl.classList.add('hidden');
    }
  }

  const aliasEl = document.getElementById('poster-alias');
  if (aliasEl) aliasEl.textContent = appState.a || 'TU.ALIAS.AQUI';

  const bancoEl = document.getElementById('poster-banco');
  if (bancoEl) bancoEl.textContent = appState.b || 'Tu Banco o Billetera';

  const titularEl = document.getElementById('poster-titular');
  if (titularEl) titularEl.textContent = appState.t || 'Nombre del Titular';

  const cuitWrapper = document.getElementById('poster-cuit-wrapper');
  const cuitEl = document.getElementById('poster-cuit');
  if (cuitWrapper && cuitEl) {
    if (appState.u) {
      cuitEl.textContent = appState.u;
      cuitWrapper.classList.remove('hidden');
    } else {
      cuitWrapper.classList.add('hidden');
    }
  }

  const cbuWrapper = document.getElementById('poster-cbu-wrapper');
  const cbuEl = document.getElementById('poster-cbu');
  if (cbuWrapper && cbuEl) {
    if (appState.c) {
      cbuEl.textContent = appState.c;
      cbuWrapper.classList.remove('hidden');
    } else {
      cbuWrapper.classList.add('hidden');
    }
  }

  const promoWrapper = document.getElementById('poster-promo-wrapper');
  const promoEl = document.getElementById('poster-promo');
  if (promoWrapper && promoEl) {
    if (appState.p) {
      promoEl.textContent = appState.p;
      promoWrapper.classList.remove('hidden');
    } else {
      promoWrapper.classList.add('hidden');
    }
  }

  // Generar QR en el cartel
  updateQRCode();
}

/**
 * Renderiza la Maqueta de Celular del Cliente en el Modo Creador
 */
function renderMobileMockupPreview() {
  const container = document.getElementById('mobile-preview-container');
  if (!container) return;

  container.setAttribute('data-theme', appState.th || 'blue');

  const mName = document.getElementById('mockup-name');
  if (mName) mName.textContent = appState.n || 'Tu Comercio';

  const mRubro = document.getElementById('mockup-rubro');
  if (mRubro) {
    if (appState.r) {
      mRubro.textContent = appState.r;
      mRubro.classList.remove('hidden');
    } else {
      mRubro.classList.add('hidden');
    }
  }

  const mBanco = document.getElementById('mockup-banco');
  if (mBanco) mBanco.textContent = appState.b || 'Billetera Digital';

  const mAlias = document.getElementById('mockup-alias');
  if (mAlias) mAlias.textContent = appState.a || 'TU.ALIAS';

  const mTitular = document.getElementById('mockup-titular');
  if (mTitular) mTitular.textContent = appState.t || 'Titular de la Cuenta';

  const mCuitRow = document.getElementById('mockup-cuit-row');
  const mCuit = document.getElementById('mockup-cuit');
  if (mCuitRow && mCuit) {
    if (appState.u) {
      mCuit.textContent = appState.u;
      mCuitRow.classList.remove('hidden');
    } else {
      mCuitRow.classList.add('hidden');
    }
  }

  const mCbuRow = document.getElementById('mockup-cbu-row');
  const mCbu = document.getElementById('mockup-cbu');
  if (mCbuRow && mCbu) {
    if (appState.c) {
      mCbu.textContent = appState.c;
      mCbuRow.classList.remove('hidden');
    } else {
      mCbuRow.classList.add('hidden');
    }
  }

  const mPromoRow = document.getElementById('mockup-promo-row');
  const mPromo = document.getElementById('mockup-promo');
  if (mPromoRow && mPromo) {
    if (appState.p) {
      mPromo.textContent = appState.p;
      mPromoRow.classList.remove('hidden');
    } else {
      mPromoRow.classList.add('hidden');
    }
  }

  const mWaBtn = document.getElementById('mockup-wa-btn');
  if (mWaBtn) {
    if (appState.w) {
      mWaBtn.classList.remove('hidden');
    } else {
      mWaBtn.classList.add('hidden');
    }
  }
}

/**
 * Renderiza la VISTA 2: MODO CLIENTE (Pantalla de Cobro Rápido)
 */
function renderClientView() {
  const clientRoot = document.getElementById('client-view');
  if (!clientRoot) return;

  clientRoot.setAttribute('data-theme', appState.th || 'blue');

  const cName = document.getElementById('client-name');
  if (cName) cName.textContent = appState.n || 'Comercio';

  const cRubro = document.getElementById('client-rubro');
  if (cRubro) {
    if (appState.r) {
      cRubro.textContent = appState.r;
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
    if (appState.u) {
      cCuit.textContent = appState.u;
      cCuitRow.classList.remove('hidden');
    } else {
      cCuitRow.classList.add('hidden');
    }
  }

  // CBU
  const cCbuRow = document.getElementById('client-cbu-row');
  const cCbu = document.getElementById('client-cbu');
  if (cCbuRow && cCbu) {
    if (appState.c) {
      cCbu.textContent = appState.c;
      cCbuRow.classList.remove('hidden');
    } else {
      cCbuRow.classList.add('hidden');
    }
  }

  // Promo Banner
  const cPromoBanner = document.getElementById('client-promo-banner');
  const cPromoText = document.getElementById('client-promo-text');
  if (cPromoBanner && cPromoText) {
    if (appState.p) {
      cPromoText.textContent = appState.p;
      cPromoBanner.classList.remove('hidden');
    } else {
      cPromoBanner.classList.add('hidden');
    }
  }

  // Botón de WhatsApp
  const cWaSection = document.getElementById('client-wa-section');
  const cWaLink = document.getElementById('client-wa-btn');
  if (cWaSection && cWaLink) {
    if (appState.w) {
      const normWa = normalizeArgentinaWhatsApp(appState.w);
      const textMsg = `¡Hola! Te envío el comprobante de transferencia para *${appState.n || 'el local'}*.`;
      cWaLink.href = `https://wa.me/${normWa}?text=${encodeURIComponent(textMsg)}`;
      cWaSection.classList.remove('hidden');
    } else {
      cWaSection.classList.add('hidden');
    }
  }

  // Botón sutil para el dueño editar datos
  const editLink = document.getElementById('client-edit-link');
  if (editLink) {
    const editUrl = new URL(window.location.href);
    editUrl.searchParams.set('edit', '1');
    editLink.href = editUrl.toString();
  }

  // Inicializar o resetear calculadora de montos
  initClientCalculator();

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Calculadora interactiva rápida para el cliente (descuento y copiado de monto)
 */
function initClientCalculator() {
  const calcAmountInput = document.getElementById('client-calc-amount');
  const calcDiscountPill = document.getElementById('client-calc-discount-pill');
  const calcFinalTotal = document.getElementById('client-calc-final');
  const calcCopyBtn = document.getElementById('client-calc-copy-btn');
  if (!calcAmountInput || !calcFinalTotal) return;

  // Detectar porcentaje en la promo (ej: "10% OFF")
  let promoDiscountPercent = 0;
  if (appState.p) {
    const match = appState.p.match(/(\d+)\s*%/);
    if (match && match[1]) {
      promoDiscountPercent = parseInt(match[1], 10);
    }
  }

  if (promoDiscountPercent > 0 && calcDiscountPill) {
    calcDiscountPill.textContent = `Promo aplicada: ${promoDiscountPercent}% OFF`;
    calcDiscountPill.classList.remove('hidden');
  } else if (calcDiscountPill) {
    calcDiscountPill.classList.add('hidden');
  }

  const updateCalculator = () => {
    const val = parseFloat(calcAmountInput.value) || 0;
    if (val <= 0) {
      calcFinalTotal.textContent = '$0';
      return;
    }
    let total = val;
    if (promoDiscountPercent > 0) {
      total = val - (val * (promoDiscountPercent / 100));
    }
    calcFinalTotal.textContent = `$${Math.round(total).toLocaleString('es-AR')}`;
  };

  calcAmountInput.oninput = updateCalculator;

  if (calcCopyBtn) {
    calcCopyBtn.onclick = () => {
      const val = parseFloat(calcAmountInput.value) || 0;
      if (val <= 0) {
        showToast('Ingresá un monto para copiar', 'info');
        return;
      }
      let total = val;
      if (promoDiscountPercent > 0) {
        total = Math.round(val - (val * (promoDiscountPercent / 100)));
      }
      copyToClipboard(total.toString(), `Monto $${total} copiado para tu transferencia`);
    };
  }
}

/**
 * Maneja el evento de clic en el BOTÓN GIGANTE DE COPIAR ALIAS (Modo Cliente)
 */
function handleClientCopyAlias() {
  const btn = document.getElementById('client-copy-alias-btn');
  const btnText = document.getElementById('client-copy-alias-text');
  const btnSub = document.getElementById('client-copy-alias-sub');
  const btnIcon = document.getElementById('client-copy-alias-icon');
  if (!btn || !btnText) return;

  copyToClipboard(appState.a, '¡Alias copiado! Abrí tu billetera y pegalo');

  // Estado visual activo verde
  btn.classList.remove('bg-theme-primary', 'hover:brightness-110');
  btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'scale-[1.02]');
  btnText.textContent = '¡ALIAS COPIADO!';
  if (btnSub) btnSub.textContent = 'Abrí tu billetera o banco y pegalo';
  if (btnIcon) btnIcon.setAttribute('data-lucide', 'check');

  if (window.lucide) window.lucide.createIcons();

  // Revertir a los 2.5 segundos
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
 * Disparador nativo de Impresión de Cartel
 */
function printPoster() {
  syncPrintStage();
  window.print();
}

/**
 * Descarga del Cartel como imagen PNG en alta resolución mediante html2canvas
 */
async function downloadPosterPNG() {
  if (typeof html2canvas === 'undefined') {
    showToast('html2canvas no está cargado', 'info');
    return;
  }

  const posterElem = document.getElementById('printable-poster');
  const downloadBtn = document.getElementById('btn-download-png');
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
    const canvas = await html2canvas(posterElem, {
      scale: 3, // Ultra alta resolución para impresión / redes
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const safeName = (appState.n || 'comercio')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const fileName = `cartel-pasadatos-${safeName}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Cartel descargado en alta definición', 'success');
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
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
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

      if (currentPreviewTab === 'poster') {
        renderPosterPreview();
      } else {
        renderMobileMockupPreview();
      }

      if (key === 'c') updateCbuValidationBadge();
      if (key === 'w') updateWhatsAppHint();
    });
  };

  onInput('input-name', 'n');
  onInput('input-rubro', 'r');
  onInput('input-alias', 'a', sanitizeAlias);
  onInput('input-cbu', 'c', (val) => val.replace(/\D/g, '').slice(0, 22));
  onInput('input-titular', 't');
  onInput('input-cuit', 'u', formatCUIT);
  onInput('input-banco', 'b');
  onInput('input-whatsapp', 'w');
  onInput('input-promo', 'p');

  // Selector de Temas
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedTheme = btn.getAttribute('data-theme-value');
      appState.th = selectedTheme;
      saveStateToStorage();

      document.querySelectorAll('.theme-option').forEach(b => {
        b.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');
      });
      btn.classList.add('ring-4', 'ring-offset-2', 'ring-slate-900', 'scale-105');

      renderPosterPreview();
      renderMobileMockupPreview();
    });
  });

  // Píldoras rápidas de Banco / Billetera
  document.querySelectorAll('.bank-quick-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const bank = pill.getAttribute('data-bank');
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

  // Botón para resetear a datos de ejemplo
  const resetBtn = document.getElementById('btn-reset-demo');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('¿Querés restaurar los datos de ejemplo predeterminados?')) {
        appState = { ...DEFAULT_STATE };
        saveStateToStorage();
        populateFormFields();
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

  // Acciones de Exportación
  const printBtn = document.getElementById('btn-print-poster');
  if (printBtn) printBtn.addEventListener('click', printPoster);

  const downloadBtn = document.getElementById('btn-download-png');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadPosterPNG);

  const copyLinkBtn = document.getElementById('btn-copy-link');
  if (copyLinkBtn) copyLinkBtn.addEventListener('click', copyPaymentLink);

  const shareWaBtn = document.getElementById('btn-share-whatsapp');
  if (shareWaBtn) shareWaBtn.addEventListener('click', shareOnWhatsApp);

  const viewClientBtn = document.getElementById('btn-preview-client-mode');
  if (viewClientBtn) {
    viewClientBtn.addEventListener('click', () => {
      const url = buildShareUrl(appState);
      window.open(url, '_blank');
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
  renderPosterPreview();
  renderMobileMockupPreview();
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
 * Enrutador Inicial de la Aplicación
 */
function initRouter() {
  const searchParams = new URLSearchParams(window.location.search);
  const isEdit = searchParams.get('edit') === '1';
  const hasAlias = searchParams.has('a') && searchParams.get('a').trim().length > 0;
  const hasName = searchParams.has('n') && searchParams.get('n').trim().length > 0;

  if (isEdit) {
    // Modo Edición: Se forzó entrar al Creador con los datos de la URL
    loadStateFromParams(searchParams);
    saveStateToStorage();
    showCreatorView();
  } else if (hasAlias || hasName) {
    // Modo Cliente: El usuario escaneó el QR o abrió el link
    loadStateFromParams(searchParams);
    showClientView();
  } else {
    // Modo Creador: Acceso directo a la raíz
    loadStateFromStorage();
    showCreatorView();
  }

  bindInputEvents();
  bindClientEvents();

  if (window.lucide) window.lucide.createIcons();
}

// Inicialización en DOMContentLoaded
document.addEventListener('DOMContentLoaded', initRouter);
