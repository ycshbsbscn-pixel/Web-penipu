/* ============================================================
   ANTISCAM TOOLS — All-in-One Script (v2.0)
   Firebase + Tavily + 6 Tools + Deteksi Merek Kartu + UI Router
   Cara pakai: buka index.html dari web server (GitHub Pages / Netlify)
   Project: tracker-penipu
   ============================================================ */

/* ============================================================
   1. FIREBASE CONFIG
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

const TAVILY_API_KEY = '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';
const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/* ============================================================
   2. FIREBASE INIT
   ============================================================ */
let db = null;
let auth = null;
let fbReady = false;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.error('[fb] Firebase SDK tidak ter-load');
      updateConnStatus('error', 'SDK Missing');
      return;
    }

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
   3. PROVIDER + BRAND DATABASE
   Prefix nomor HP Indonesia → Operator + Merek Kartu
   ============================================================ */
const PROVIDERS = {
  // ============ TELKOMSEL ============
  '811': { operator: 'Telkomsel', brand: 'by.U / KartuHalo', type: 'Prabayar MVNO / Postpaid' },
  '812': { operator: 'Telkomsel', brand: 'Simpati / As / Halo', type: 'Prabayar / Postpaid' },
  '813': { operator: 'Telkomsel', brand: 'Simpati / As / Halo', type: 'Prabayar / Postpaid' },
  '821': { operator: 'Telkomsel', brand: 'Simpati / As / Halo', type: 'Prabayar / Postpaid' },
  '822': { operator: 'Telkomsel', brand: 'Simpati / As / Halo', type: 'Prabayar / Postpaid' },
  '823': { operator: 'Telkomsel', brand: 'Simpati / As / Halo', type: 'Prabayar / Postpaid' },
  '851': { operator: 'Telkomsel', brand: 'by.U', type: 'Prabayar Digital' },
  '852': { operator: 'Telkomsel', brand: 'Simpati / As / Halo', type: 'Prabayar / Postpaid' },
  '853': { operator: 'Telkomsel', brand: 'Simpati / As / Halo', type: 'Prabayar / Postpaid' },

  // ============ INDOSAT OOREDOO ============
  '814': { operator: 'Indosat', brand: 'IM3 / Matrix', type: 'Prabayar / Postpaid' },
  '815': { operator: 'Indosat', brand: 'IM3 / Matrix', type: 'Prabayar / Postpaid' },
  '816': { operator: 'Indosat', brand: 'IM3 / Matrix', type: 'Prabayar / Postpaid' },
  '855': { operator: 'Indosat', brand: 'IM3', type: 'Prabayar' },
  '856': { operator: 'Indosat', brand: 'IM3', type: 'Prabayar' },
  '857': { operator: 'Indosat', brand: 'IM3', type: 'Prabayar' },
  '858': { operator: 'Indosat', brand: 'IM3', type: 'Prabayar' },

  // ============ XL AXIATA ============
  '817': { operator: 'XL Axiata', brand: 'XL', type: 'Prabayar' },
  '818': { operator: 'XL Axiata', brand: 'XL', type: 'Prabayar' },
  '819': { operator: 'XL Axiata', brand: 'XL', type: 'Prabayar' },
  '859': { operator: 'XL Axiata', brand: 'XL', type: 'Prabayar' },
  '877': { operator: 'XL Axiata', brand: 'XL', type: 'Prabayar' },
  '878': { operator: 'XL Axiata', brand: 'XL', type: 'Prabayar' },

  // ============ AXIS ============
  '831': { operator: 'AXIS', brand: 'AXIS', type: 'Prabayar' },
  '832': { operator: 'AXIS', brand: 'AXIS', type: 'Prabayar' },
  '833': { operator: 'AXIS', brand: 'AXIS', type: 'Prabayar' },
  '838': { operator: 'AXIS', brand: 'AXIS', type: 'Prabayar' },

  // ============ TRI (3) ============
  '895': { operator: 'Tri', brand: 'Tri (3)', type: 'Prabayar' },
  '896': { operator: 'Tri', brand: 'Tri (3)', type: 'Prabayar' },
  '897': { operator: 'Tri', brand: 'Tri (3)', type: 'Prabayar' },
  '898': { operator: 'Tri', brand: 'Tri (3)', type: 'Prabayar' },
  '899': { operator: 'Tri', brand: 'Tri (3)', type: 'Prabayar' },

  // ============ SMARTFREN ============
  '881': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '882': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '883': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '884': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '885': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '886': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '887': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '888': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' },
  '889': { operator: 'Smartfren', brand: 'Smartfren', type: 'Prabayar' }
};

/* ============================================================
   4. TOOL DEFINITIONS
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
    desc: 'Cek operator, merek kartu, dan reputasi nomor HP.',
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
      { name: 'modus', label: 'Modus', type: 'text', placeholder: 'Investasi palsu, jual-beli online' },
      { name: 'chronology', label: 'Kronologi', type: 'textarea', placeholder: 'Jelaskan kronologi lengkap...' }
    ]
  }
};

/* ============================================================
   5. HELPERS
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
   6. TAVILY SEARCH
   ============================================================ */
async function tavilySearch(query, maxResults = 5) {
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false
      })
    });
    if (!res.ok) {
      console.warn('[tavily] HTTP', res.status);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.warn('[tavily] error:', e.message);
    return [];
  }
}

/* ============================================================
   7. TOOL LOGIC
   ============================================================ */

/* ---------- 7.1 REKENING ---------- */
async function scanRekening({ bank, nomor }) {
  if (!bank || !nomor) throw new Error('Bank dan nomor rekening wajib diisi.');
  if (!/^\d{8,20}$/.test(nomor)) throw new Error('Nomor rekening harus 8-20 digit.');

  const result = {
    type: 'rekening',
    target: `${bank.toUpperCase()}:${nomor}`,
    bank: bank.toUpperCase(),
    nomor,
    reported: false,
    riskScore: 0,
    riskLevel: 'safe',
    sources: [],
    flags: []
  };

  const tavily = await tavilySearch(`"${nomor}" penipuan OR scam OR laporan ${bank}`, 5);
  const suspicious = tavily.filter(r =>
    /penipu|scam|lapor|tipu|curang|penipuan/i.test((r.title || '') + ' ' + (r.content || ''))
  );

  if (suspicious.length > 0) {
    result.reported = true;
    result.riskScore += Math.min(suspicious.length * 15, 60);
    result.flags.push(`Ditemukan ${suspicious.length} laporan di web`);
    result.sources.push({
      source: 'tavily-web',
      found: true,
      hits: suspicious.length,
      results: suspicious.slice(0, 3).map(r => ({ title: r.title, url: r.url }))
    });
  } else {
    result.sources.push({ source: 'tavily-web', found: false, hits: 0 });
  }

  result.sources.push({
    source: 'cekrekening.id',
    found: false,
    note: 'Buka manual di cekrekening.id'
  });

  if (result.riskScore >= 45) result.riskLevel = 'high';
  else if (result.riskScore >= 20) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  return result;
}

/* ---------- 7.2 PHONE ---------- */
async function scanPhone({ nomor }) {
  if (!nomor) throw new Error('Nomor HP wajib diisi.');

  const cleaned = String(nomor).replace(/[^\d+]/g, '').replace(/^\+62/, '0').replace(/^62/, '0');

  const result = {
    type: 'phone',
    target: cleaned,
    nomor: cleaned,
    operator: null,
    brand: null,
    cardType: null,
    reported: false,
    riskScore: 0,
    riskLevel: 'safe',
    sources: [],
    flags: []
  };

  // ============ DETEKSI OPERATOR & BRAND ============
  const prefix = cleaned.replace(/^0/, '').slice(0, 3);
  const info = PROVIDERS[prefix];

  if (info) {
    result.operator = info.operator;
    result.brand = info.brand;
    result.cardType = info.type;
  } else {
    result.operator = 'Unknown';
    result.brand = 'Unknown';
    result.cardType = 'Unknown';
  }

  // ============ TAVILY SEARCH ============
  const tavily = await tavilySearch(`"${cleaned}" penipuan OR scam OR laporan OR was-was`, 5);
  const suspicious = tavily.filter(r =>
    /penipu|scam|lapor|tipu|curang|penipuan|was-was|modus|hati-hati/i.test((r.title || '') + ' ' + (r.content || ''))
  );

  if (suspicious.length > 0) {
    result.reported = true;
    result.riskScore += Math.min(suspicious.length * 15, 70);
    result.flags.push(`Ditemukan ${suspicious.length} laporan di web`);
    result.sources.push({
      source: 'tavily-web',
      found: true,
      hits: suspicious.length,
      results: suspicious.slice(0, 3).map(r => ({ title: r.title, url: r.url }))
    });
  } else {
    result.sources.push({ source: 'tavily-web', found: false, hits: 0 });
  }

  result.sources.push({
    source: 'kredibel.com',
    found: false,
    note: 'Buka manual di kredibel.com'
  });

  if (result.riskScore >= 50) result.riskLevel = 'high';
  else if (result.riskScore >= 25) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  return result;
}

/* ---------- 7.3 SITUS ---------- */
async function scanSitus({ url }) {
  if (!url) throw new Error('URL wajib diisi.');

  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) target = 'http://' + target;

  let domain;
  try { domain = new URL(target).hostname; }
  catch { throw new Error('URL tidak valid.'); }

  const result = {
    type: 'situs',
    target,
    domain,
    riskScore: 0,
    riskLevel: 'safe',
    flags: [],
    keywords: {},
    sources: []
  };

  const urlKeywords = ['judi', 'slot', 'togel', 'casino', 'poker', 'bet', 'maxwin', 'jackpot', 'rtp'];
  const urlLower = target.toLowerCase();
  const foundUrl = urlKeywords.filter(k => urlLower.includes(k));
  if (foundUrl.length > 0) {
    result.keywords.urlKeywords = foundUrl;
    result.riskScore += 40;
    result.flags.push(`URL mengandung kata kunci: ${foundUrl.join(', ')}`);
  }

  const tavily = await tavilySearch(`"${domain}" penipuan OR scam OR judi OR phishing OR laporan`, 5);
  const suspicious = tavily.filter(r =>
    /penipu|scam|judi|phishing|lapor|tipu|illegal/i.test((r.title || '') + ' ' + (r.content || ''))
  );

  if (suspicious.length > 0) {
    result.riskScore += Math.min(suspicious.length * 10, 40);
    result.flags.push(`Ditemukan ${suspicious.length} laporan terkait domain`);
    result.keywords.reports = suspicious.slice(0, 3).map(r => ({ title: r.title, url: r.url }));
    result.sources.push({ source: 'tavily-web', found: true, hits: suspicious.length });
  } else {
    result.sources.push({ source: 'tavily-web', found: false, hits: 0 });
  }

  if (result.riskScore >= 50) result.riskLevel = 'high';
  else if (result.riskScore >= 25) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  return result;
}

/* ---------- 7.4 EMAIL ---------- */
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
  'throwawaymail.com', 'yopmail.com', 'sharklasers.com', 'maildrop.cc',
  'getnada.com', 'temp-mail.org', 'trashmail.com', 'fakeinbox.com',
  'mailnesia.com', 'mohmal.com', 'dispostable.com', 'mintemail.com',
  'spamgourmet.com', 'mytrashmail.com', 'mailexpire.com', 'throwaway.email'
];

async function scanEmail({ email }) {
  if (!email || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
    throw new Error('Email tidak valid.');
  }

  const domain = email.split('@')[1].toLowerCase();

  const result = {
    type: 'email',
    target: email,
    email,
    domain,
    disposable: false,
    riskScore: 0,
    riskLevel: 'safe',
    sources: [],
    flags: []
  };

  if (DISPOSABLE_DOMAINS.includes(domain)) {
    result.disposable = true;
    result.riskScore += 40;
    result.flags.push('Email dari layanan disposable/temporary');
  }

  result.sources.push({
    source: 'haveibeenpwned.com',
    found: false,
    note: 'Buka manual di haveibeenpwned.com'
  });

  if (result.riskScore >= 40) result.riskLevel = 'high';
  else if (result.riskScore >= 15) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  return result;
}

/* ---------- 7.5 LINK ---------- */
async function scanLink({ url }) {
  if (!url) throw new Error('URL wajib diisi.');

  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) target = 'http://' + target;

  const result = {
    type: 'link',
    target,
    input: target,
    final: target,
    domain: null,
    suspicious: false,
    riskScore: 0,
    riskLevel: 'safe',
    flags: []
  };

  try { result.domain = new URL(target).hostname; } catch {}

  const suspiciousWords = ['judi', 'slot', 'togel', 'casino', 'poker', 'bet', 'maxwin',
                            'login', 'verify', 'bonus', 'hadiah', 'claim', 'wallet',
                            'investment', 'profit', 'crypto'];
  const lower = target.toLowerCase();
  const found = suspiciousWords.filter(w => lower.includes(w));

  if (found.length > 0) {
    result.suspicious = true;
    result.riskScore += 50;
    result.flags.push(`URL mengandung kata: ${found.join(', ')}`);
  }

  const shortDomains = ['bit.ly', 'tinyurl.com', 's.id', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'rebrand.ly'];
  if (shortDomains.some(d => result.domain.includes(d))) {
    result.flags.push('Short URL — cek redirect manual di browser');
    result.riskScore += 10;
  }

  const tavily = await tavilySearch(`${target} penipuan OR scam OR judi OR phishing`, 3);
  const suspicious2 = tavily.filter(r =>
    /penipu|scam|judi|phishing|lapor|tipu|illegal/i.test((r.title || '') + ' ' + (r.content || ''))
  );
  if (suspicious2.length > 0) {
    result.riskScore += Math.min(suspicious2.length * 10, 30);
    result.flags.push(`Ditemukan ${suspicious2.length} laporan terkait URL`);
  }

  if (result.riskScore >= 50) result.riskLevel = 'high';
  else if (result.riskScore >= 25) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  return result;
}

/* ---------- 7.6 LAPORAN ---------- */
async function generateLaporan(formData) {
  if (!formData.suspectName && !formData.suspectAccount && !formData.suspectPhone) {
    throw new Error('Minimal salah satu data terlapor harus diisi.');
  }

  const result = {
    type: 'laporan',
    target: formData.suspectName || formData.suspectAccount || formData.suspectPhone || 'unknown',
    ...formData,
    riskLevel: 'medium',
    createdAt: Date.now()
  };

  try {
    generateLaporanPDF(result);
  } catch (e) {
    console.warn('[pdf] error:', e);
  }

  return result;
}

/* ============================================================
   8. PDF GENERATION
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

  const section = (t) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(t, margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
  };

  const line = (l, v) => {
    if (!v) v = '—';
    doc.text(`${l}: ${v}`, margin, y);
    y += 6;
  };

  section('A. DATA TERLAPOR');
  line('Nama', data.suspectName);
  line('Nomor HP', data.suspectPhone);
  line('Nomor Rekening', data.suspectAccount);
  line('Bank', data.suspectBank);
  y += 3;

  section('B. DATA PELAPOR');
  line('Nama', data.reporterName);
  line('Kontak', data.reporterContact);
  y += 3;

  section('C. KRONOLOGI KEJADIAN');
  const chron = data.chronology || '—';
  const chronLines = doc.splitTextToSize(chron, pageW - margin * 2);
  doc.text(chronLines, margin, y);
  y += chronLines.length * 6 + 5;

  section('D. KERUGIAN');
  line('Total Kerugian', 'Rp ' + num(data.lossAmount));
  line('Modus', data.modus);
  y += 3;

  doc.setDrawColor(0);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(80);
  const footer = 'Laporan ini dibuat untuk keperluan pelaporan resmi. ' +
    'Dokumen ini dapat diserahkan ke Bareskrim Polri, OJK (157), atau Komdigi.';
  const footLines = doc.splitTextToSize(footer, pageW - margin * 2);
  doc.text(footLines, margin, y);

  doc.save(`laporan-penipuan-${Date.now()}.pdf`);
  console.log('[pdf] ✓ saved');
}

/* ============================================================
   9. FIREBASE — Save & Load
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
    console.warn('[fb] gagal simpan:', e.message);
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
   10. UI ROUTER
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
   11. RUN SCAN
   ============================================================ */
async function runScan(toolId) {
  const tool = TOOLS[toolId];
  const btn = document.getElementById('submitBtn');
  const resultEl = document.getElementById('toolResult');

  const formData = {};
  for (const f of tool.fields) {
    const input = document.querySelector(`#toolForm [name="${f.name}"]`);
    if (input) formData[f.name] = input.value.trim();
  }

  const requiredMap = {
    rekening: ['bank', 'nomor'],
    phone: ['nomor'],
    situs: ['url'],
    email: ['email'],
    link: ['url'],
    laporan: ['suspectName']
  };
  const required = requiredMap[toolId] || [];

  for (const field of required) {
    if (!formData[field]) {
      const fd = tool.fields.find(f => f.name === field);
      resultEl.innerHTML = `<div class="result-card risk-high">
        <div class="result-header">
          <span class="result-target">Validasi Gagal</span>
          <span class="risk-badge high">Error</span>
        </div>
        <p style="color:var(--text-dim);font-size:13px">
          Field "${esc(fd?.label || field)}" wajib diisi.
        </p>
      </div>`;
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = 'Memindai...';
  resultEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Memindai target... (mohon tunggu)</span>
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
    btn.innerHTML = `<svg width="14" height="14" aria-hidden="true"><use href="#i-search"/></svg> ${toolId === 'laporan' ? 'Generate Laporan' : 'Scan Sekarang'}`;
  }
}

/* ============================================================
   12. RENDER RESULT
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

  // Field yang tidak ditampilkan di grid
  const SKIP_KEYS = [
    'type', 'target', 'riskScore', 'riskLevel', 'flags', 'sources',
    'data', 'createdAt', 'cached', 'keywords',
    'suspectName', 'reporterName', 'suspectPhone', 'suspectAccount',
    'suspectBank', 'reporterContact', 'lossAmount', 'modus', 'chronology'
  ];

  // Mapping label custom
  const LABEL_MAP = {
    operator: 'Operator',
    brand: 'Merek Kartu',
    cardType: 'Tipe Kartu',
    nomor: 'Nomor',
    email: 'Email',
    domain: 'Domain',
    bank: 'Bank',
    disposable: 'Disposable',
    breachCount: 'Jumlah Kebocoran',
    reported: 'Dilaporkan',
    reachable: 'Bisa Diakses',
    suspicious: 'Mencurigakan',
    input: 'URL Input',
    final: 'URL Final'
  };

  const entries = [];
  for (const [k, v] of Object.entries(result)) {
    if (SKIP_KEYS.includes(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;

    const label = LABEL_MAP[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    let value = String(v);

    // Format khusus
    if (k === 'lossAmount' && !isNaN(v)) {
      value = 'Rp ' + num(Number(v));
    } else if (k === 'reported' || k === 'disposable' || k === 'suspicious' || k === 'reachable') {
      value = v === true ? 'Ya' : 'Tidak';
    }

    entries.push([label, value]);
  }

  // Sources
  const sourcesHtml = (result.sources && Array.isArray(result.sources) && result.sources.length > 0)
    ? `<div class="result-flags">
        ${result.sources.map(s => {
          const ok = s.found || s.reported || s.hits > 0;
          const icon = ok ? 'i-warning' : 'i-check';
          const color = ok ? 'var(--red)' : 'var(--green)';
          let text = s.source || 'source';
          if (s.note) text += `: ${s.note}`;
          else if (s.error) text += `: error`;
          else if (ok) text += `: ✓ Ditemukan (${s.hits || s.count || s.reportCount || 1})`;
          else text += ': ✓ Bersih';
          return `<div class="flag-item" style="color:${color}">
            <svg width="14" height="14" aria-hidden="true"><use href="#${icon}"/></svg>
            ${esc(text)}
          </div>`;
        }).join('')}
      </div>`
    : '';

  // Flags
  const flagsHtml = (result.flags && Array.isArray(result.flags) && result.flags.length > 0)
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
   13. RENDER TOOLS GRID
   ============================================================ */
function renderToolsGrid() {
  const el = document.getElementById('toolsGrid');
  if (!el) return;

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
   14. INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[app] AntiScam Tools starting...');
  console.log('[app] Version: 2.0 (with brand detection)');

  renderToolsGrid();

  const btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.addEventListener('click', showHome);

  initFirebase();
});