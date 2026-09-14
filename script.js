/* ============================================================
   ANTISCAM TOOLS — Frontend (Backend-Integrated)
   Semua request ke /api (Vercel Serverless)
   Project: tracker-penipu
   ============================================================ */

/* ============================================================
   1. CONFIG
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyAMJU2BpafyMqH7_MQ7KdlS4PEyEoKbSNA",
  authDomain: "tracker-penipu.firebaseapp.com",
  databaseURL: "https://tracker-penipu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tracker-penipu",
  storageBucket: "tracker-penipu.firebasestorage.app",
  messagingSenderId: "841486185152",
  appId: "1:841486185152:web:5583e22b0f9efac7d7f325",
  measurementId: "G-950QYSG9FN"
};

/* Deteksi base URL backend */
const API_BASE = (window.location.hostname === 'localhost'
              || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

/* ============================================================
   2. FIREBASE INIT
   ============================================================ */
let db = null;
let auth = null;
let fbReady = false;

function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();

    updateConnStatus('connecting', 'Connecting...');

    auth.signInAnonymously()
      .then(() => {
        fbReady = true;
        updateConnStatus('online', 'Connected');
        console.log('[fb] ✓ anonymous auth ok');
        loadHomeData();
      })
      .catch(err => {
        updateConnStatus('error', 'Auth Error');
        console.error('[fb] ✗ auth gagal:', err.code, err.message);
        if (err.code === 'auth/admin-restricted-operation') {
          console.warn('[fb] → Aktifkan Anonymous Auth di Firebase Console');
        }
      });
  } catch (e) {
    updateConnStatus('error', 'Init Error');
    console.error('[fb] init gagal:', e);
  }
}

function updateConnStatus(state, text) {
  const dot = document.getElementById('connStatus');
  const txt = document.getElementById('connText');
  if (!dot || !txt) return;
  dot.className = 'status-dot' + (state === 'online' ? ' online' : state === 'error' ? ' error' : '');
  txt.textContent = text;
}

/* ============================================================
   3. TOOL DEFINITIONS
   ============================================================ */
const TOOLS = {
  rekening: {
    id: 'rekening',
    name: 'Cek Rekening',
    desc: 'Verifikasi nomor rekening bank terhadap database penipuan publik.',
    icon: 'i-card',
    tag: 'Banking',
    fields: [
      { name: 'bank', label: 'Bank', type: 'select', options: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'CIMB', 'PERMATA', 'DANAMON', 'BTN', 'MEGA', 'PANIN', 'BSI', 'JAGO', 'SEABANK', 'OTHER'] },
      { name: 'nomor', label: 'Nomor Rekening', type: 'text', placeholder: '1234567890' }
    ]
  },
  phone: {
    id: 'phone',
    name: 'Cek Nomor HP',
    desc: 'Cek reputasi nomor HP, provider, dan laporan penipuan terkait.',
    icon: 'i-phone',
    tag: 'Contact',
    fields: [
      { name: 'nomor', label: 'Nomor HP', type: 'text', placeholder: '08123456789' }
    ]
  },
  situs: {
    id: 'situs',
    name: 'Scan Situs',
    desc: 'Analisis URL untuk mendeteksi judi online, phishing, dan konten ilegal.',
    icon: 'i-globe',
    tag: 'Web',
    fields: [
      { name: 'url', label: 'URL Situs', type: 'text', placeholder: 'https://example.com' }
    ]
  },
  email: {
    id: 'email',
    name: 'Cek Email',
    desc: 'Deteksi email disposable, kebocoran data, dan reputasi domain.',
    icon: 'i-mail',
    tag: 'Contact',
    fields: [
      { name: 'email', label: 'Alamat Email', type: 'text', placeholder: 'user@example.com' }
    ]
  },
  link: {
    id: 'link',
    name: 'Expand Link',
    desc: 'Buka link pendek (bit.ly, s.id, dll) dan lacak redirect chain.',
    icon: 'i-link',
    tag: 'Web',
    fields: [
      { name: 'url', label: 'Link Pendek', type: 'text', placeholder: 'https://bit.ly/xxx' }
    ]
  },
  laporan: {
    id: 'laporan',
    name: 'Laporan Penipuan',
    desc: 'Generate laporan resmi siap kirim ke Bareskrim/OJK/Komdigi.',
    icon: 'i-file',
    tag: 'Report',
    fields: [
      { name: 'suspectName', label: 'Nama Terlapor', type: 'text', placeholder: 'Nama/alias' },
      { name: 'suspectPhone', label: 'No HP Terlapor', type: 'text', placeholder: '08123456789' },
      { name: 'suspectAccount', label: 'No Rekening Terlapor', type: 'text', placeholder: '1234567890' },
      { name: 'suspectBank', label: 'Bank', type: 'text', placeholder: 'BCA' },
      { name: 'reporterName', label: 'Nama Pelapor', type: 'text', placeholder: 'Nama lengkap Anda' },
      { name: 'reporterContact', label: 'Kontak Pelapor', type: 'text', placeholder: 'HP / email' },
      { name: 'lossAmount', label: 'Kerugian (Rp)', type: 'text', placeholder: '1000000' },
      { name: 'modus', label: 'Modus', type: 'text', placeholder: 'Investasi palsu, jual-beli online, dll' },
      { name: 'chronology', label: 'Kronologi', type: 'textarea', placeholder: 'Jelaskan kronologi lengkap...' }
    ]
  }
};

/* ============================================================
   4. HELPERS
   ============================================================ */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return diff + 's lalu';
  if (diff < 3600) return Math.floor(diff / 60) + 'm lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h lalu';
  return Math.floor(diff / 86400) + 'd lalu';
}

function num(n) {
  return new Intl.NumberFormat('id-ID').format(n || 0);
}

/* ============================================================
   5. BACKEND API — panggilan ke /api
   ============================================================ */
async function callAPI(tool, data) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, data })
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
  return result;
}

/* ---------- Tool Handlers ---------- */
async function scanRekening(formData)  { return await callAPI('rekening', formData); }
async function scanPhone(formData)     { return await callAPI('phone', formData); }
async function scanSitus(formData)     { return await callAPI('situs', formData); }
async function scanEmail(formData)     { return await callAPI('email', formData); }
async function scanLink(formData)      { return await callAPI('link', formData); }
async function generateLaporan(formData) {
  const result = await callAPI('laporan', formData);
  // Generate PDF di client setelah dapat konfirmasi dari backend
  try { generateLaporanPDF(result); } catch (e) { console.warn('[pdf] error:', e); }
  return result;
}

/* ============================================================
   6. PDF GENERATION — jsPDF
   ============================================================ */
function generateLaporanPDF(data) {
  if (!window.jspdf) {
    console.warn('[pdf] jsPDF tidak ter-load');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ size: 'A4', unit: 'mm' });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('LAPORAN DUGAAN PENIPUAN', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Dibuat: ${new Date().toLocaleString('id-ID')}`, pageW / 2, y, { align: 'center' });
  doc.setTextColor(0);
  y += 6;

  doc.setDrawColor(0);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  const sectionTitle = (title) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
  };

  const line = (label, value) => {
    if (!value) value = '—';
    doc.text(`${label.padEnd(18)}: ${value}`, margin, y);
    y += 6;
  };

  // A. Data Terlapor
  sectionTitle('A. DATA TERLAPOR');
  line('Nama', data.suspectName);
  line('Nomor HP', data.suspectPhone);
  line('Nomor Rekening', data.suspectAccount);
  line('Bank', data.suspectBank);
  y += 3;

  // B. Data Pelapor
  sectionTitle('B. DATA PELAPOR');
  line('Nama', data.reporterName);
  line('Kontak', data.reporterContact);
  y += 3;

  // C. Kronologi
  sectionTitle('C. KRONOLOGI KEJADIAN');
  const chronology = data.chronology || '—';
  const chronLines = doc.splitTextToSize(chronology, pageW - margin * 2);
  doc.text(chronLines, margin, y);
  y += chronLines.length * 6 + 5;

  // D. Kerugian
  sectionTitle('D. KERUGIAN');
  line('Total Kerugian', `Rp ${num(data.lossAmount)}`);
  line('Modus', data.modus);
  y += 3;

  // Footer
  doc.setDrawColor(0);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(80);
  const footerText = 'Laporan ini dibuat untuk keperluan pelaporan resmi kepada pihak berwenang. ' +
    'Dokumen ini dapat diserahkan ke Bareskrim Polri, OJK (157), atau Komdigi untuk ditindaklanjuti.';
  const footLines = doc.splitTextToSize(footerText, pageW - margin * 2);
  doc.text(footLines, margin, y);

  // Save
  const filename = `laporan-penipuan-${Date.now()}.pdf`;
  doc.save(filename);
  console.log('[pdf] ✓ saved:', filename);
}

/* ============================================================
   7. FIREBASE — Save & Load
   ============================================================ */
async function saveScan(scanData) {
  if (!fbReady || !db) return;
  try {
    const ref = db.ref(`scans/${scanData.type}`).push();
    await ref.set({
      type: scanData.type,
      target: scanData.target,
      riskLevel: scanData.riskLevel || 'unknown',
      data: JSON.stringify(scanData).slice(0, 5000),
      created_at: Date.now()
    });
    console.log('[fb] ✓ scan saved:', scanData.type);
  } catch (e) {
    console.warn('[fb] gagal simpan scan:', e.message);
  }
}

async function loadHomeData() {
  if (!fbReady || !db) return;
  try {
    const snap = await db.ref('scans').once('value');
    const data = snap.val() || {};

    let total = 0, danger = 0, safe = 0;
    const recent = [];

    for (const [toolType, scans] of Object.entries(data)) {
      for (const [id, scan] of Object.entries(scans || {})) {
        total++;
        if (scan.riskLevel === 'high' || scan.riskLevel === 'medium') danger++;
        else safe++;
        recent.push({ id, toolType, ...scan });
      }
    }

    recent.sort((a, b) => b.created_at - a.created_at);

    document.getElementById('statTotal').textContent = num(total);
    document.getElementById('statDanger').textContent = num(danger);
    document.getElementById('statSafe').textContent = num(safe);

    renderRecent(recent.slice(0, 10));
  } catch (e) {
    console.warn('[fb] loadHomeData gagal:', e.message);
  }
}

function renderRecent(items) {
  const el = document.getElementById('recentList');
  if (!items || items.length === 0) {
    el.innerHTML = '<div class="empty">Belum ada aktivitas.</div>';
    return;
  }
  el.innerHTML = items.map(item => `
    <div class="recent-item">
      <span class="recent-type">${esc(item.toolType || item.type)}</span>
      <span class="recent-target">${esc(item.target || '—')}</span>
      <span class="recent-time">${timeAgo(item.created_at)}</span>
    </div>
  `).join('');
}

/* ============================================================
   8. UI ROUTER
   ============================================================ */
function showHome() {
  document.getElementById('view-home').classList.add('active');
  document.getElementById('view-tool').classList.remove('active');
  loadHomeData();
}

function showTool(toolId) {
  const tool = TOOLS[toolId];
  if (!tool) return;

  document.getElementById('view-home').classList.remove('active');
  document.getElementById('view-tool').classList.add('active');

  document.getElementById('toolIcon').innerHTML =
    `<svg width="24" height="24" aria-hidden="true"><use href="#${tool.icon}"/></svg>`;
  document.getElementById('toolTitle').textContent = tool.name;
  document.getElementById('toolDesc').textContent = tool.desc;

  // Render form
  const form = document.getElementById('toolForm');
  form.innerHTML = tool.fields.map(f => {
    if (f.type === 'select') {
      return `
        <div class="field">
          <label>${esc(f.label)}</label>
          <select name="${f.name}">
            ${f.options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
          </select>
        </div>`;
    }
    if (f.type === 'textarea') {
      return `
        <div class="field">
          <label>${esc(f.label)}</label>
          <textarea name="${f.name}" placeholder="${esc(f.placeholder || '')}"></textarea>
        </div>`;
    }
    return `
      <div class="field">
        <label>${esc(f.label)}</label>
        <input type="${f.type}" name="${f.name}" placeholder="${esc(f.placeholder || '')}">
      </div>`;
  }).join('') + `
    <button type="button" class="btn-submit" id="submitBtn">
      <svg width="14" height="14" aria-hidden="true"><use href="#i-search"/></svg>
      ${toolId === 'laporan' ? 'Generate Laporan' : 'Scan Sekarang'}
    </button>
  `;

  document.getElementById('toolResult').innerHTML = '';
  document.getElementById('toolHistory').innerHTML = '';

  document.getElementById('submitBtn').addEventListener('click', () => runScan(toolId));
}

/* ============================================================
   9. RUN SCAN
   ============================================================ */
async function runScan(toolId) {
  const tool = TOOLS[toolId];
  const btn = document.getElementById('submitBtn');
  const resultEl = document.getElementById('toolResult');

  // Collect form data
  const formData = {};
  for (const f of tool.fields) {
    const input = document.querySelector(`#toolForm [name="${f.name}"]`);
    if (input) formData[f.name] = input.value.trim();
  }

  // Validate — required fields per tool
  const requiredMap = {
    rekening: ['bank', 'nomor'],
    phone: ['nomor'],
    situs: ['url'],
    email: ['email'],
    link: ['url'],
    laporan: ['suspectName'] // minimal 1
  };
  const required = requiredMap[toolId] || [];

  for (const field of required) {
    if (!formData[field]) {
      const fieldDef = tool.fields.find(f => f.name === field);
      resultEl.innerHTML = `<div class="result-card risk-high">
        <div class="result-header">
          <span class="result-target">Validasi Gagal</span>
          <span class="risk-badge high">Error</span>
        </div>
        <p style="color:var(--text-dim);font-size:13px">
          Field "${esc(fieldDef?.label || field)}" wajib diisi.
        </p>
      </div>`;
      return;
    }
  }

  // Loading
  btn.disabled = true;
  resultEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Memindai target...</span>
    </div>`;

  try {
    let result;
    switch (toolId) {
      case 'rekening': result = await scanRekening(formData); break;
      case 'phone':    result = await scanPhone(formData);    break;
      case 'situs':    result = await scanSitus(formData);    break;
      case 'email':    result = await scanEmail(formData);    break;
      case 'link':     result = await scanLink(formData);     break;
      case 'laporan':  result = await generateLaporan(formData); break;
      default: throw new Error('Tool tidak dikenali');
    }

    renderResult(result);
    await saveScan(result);
    loadHomeData();
  } catch (e) {
    console.error('[scan] error:', e);
    resultEl.innerHTML = `<div class="result-card risk-high">
      <div class="result-header">
        <span class="result-target">Error</span>
        <span class="risk-badge high">Failed</span>
      </div>
      <p style="color:var(--text-dim);font-size:13px">${esc(e.message)}</p>
    </div>`;
  } finally {
    btn.disabled = false;
  }
}

/* ============================================================
   10. RENDER RESULT
   ============================================================ */
function renderResult(result) {
  const el = document.getElementById('toolResult');
  const riskClass = `risk-${result.riskLevel || 'unknown'}`;
  const badgeClass = result.riskLevel || 'unknown';

  const riskLabel = {
    high: 'Bahaya',
    medium: 'Waspada',
    low: 'Rendah',
    safe: 'Aman',
    unknown: 'Unknown'
  }[result.riskLevel] || 'Unknown';

  // Grid info — filter fields yang mau ditampilkan
  const SKIP_KEYS = ['type', 'target', 'riskScore', 'riskLevel', 'flags', 'sources',
                     'data', 'createdAt', 'cached'];

  const entries = [];
  for (const [k, v] of Object.entries(result)) {
    if (SKIP_KEYS.includes(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;

    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    let value = String(v);
    if (k === 'lossAmount' && !isNaN(v)) {
      value = 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(v));
    }
    entries.push([label, value]);
  }

  // Sources
  const sourcesHtml = (result.sources && result.sources.length > 0)
    ? `<div class="result-flags">
        ${result.sources.map(s => {
          const ok = s.found || s.reported || s.hits > 0;
          const icon = ok ? 'i-warning' : 'i-check';
          const color = ok ? 'var(--red)' : 'var(--green)';
          const text = s.error
            ? `${s.source}: ${s.error}`
            : ok
              ? `${s.source}: ✓ Ditemukan`
              : `${s.source}: ✓ Bersih`;
          return `<div class="flag-item" style="color:${color}">
            <svg width="14" height="14" aria-hidden="true"><use href="#${icon}"/></svg>
            ${esc(text)}
          </div>`;
        }).join('')}
      </div>`
    : '';

  // Flags
  const flagsHtml = (result.flags && result.flags.length > 0)
    ? `<div class="result-flags">
        ${result.flags.map(f => `
          <div class="flag-item">
            <svg width="14" height="14" aria-hidden="true"><use href="#i-warning"/></svg>
            ${esc(f)}
          </div>
        `).join('')}
      </div>`
    : '';

  el.innerHTML = `
    <div class="result-card ${riskClass}">
      <div class="result-header">
        <span class="result-target">${esc(result.target || '—')}</span>
        <span class="risk-badge ${badgeClass}">${riskLabel}</span>
      </div>

      ${entries.length > 0 ? `
        <dl class="result-grid">
          ${entries.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
        </dl>
      ` : ''}

      ${flagsHtml}
      ${sourcesHtml}
    </div>
  `;
}

/* ============================================================
   11. RENDER TOOLS GRID
   ============================================================ */
function renderToolsGrid() {
  const el = document.getElementById('toolsGrid');
  el.innerHTML = Object.values(TOOLS).map(tool => `
    <div class="tool-card" data-tool="${tool.id}">
      <div class="tool-card-icon">
        <svg width="32" height="32" aria-hidden="true"><use href="#${tool.icon}"/></svg>
      </div>
      <div class="tool-card-name">${esc(tool.name)}</div>
      <div class="tool-card-desc">${esc(tool.desc)}</div>
      <span class="tool-card-tag">${esc(tool.tag)}</span>
    </div>
  `).join('');

  el.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => showTool(card.dataset.tool));
  });
}

/* ============================================================
   12. INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[app] AntiScam Tools starting...');
  console.log('[app] API_BASE:', API_BASE);

  renderToolsGrid();
  document.getElementById('btnBack').addEventListener('click', showHome);

  initFirebase();
});