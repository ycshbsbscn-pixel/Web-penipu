/* ============================================================
   ANTISCAM TOOLS — Backend API (All-in-One)
   Project: tracker-penipu
   Endpoint: POST /api { tool, data }
   ============================================================ */

import axios from 'axios';
import * as cheerio from 'cheerio';
import whois from 'whois-json';

/* ============================================================
   CONFIG
   ============================================================ */
const CONFIG = {
  TAVILY_API_KEY: process.env.TAVILY_API_KEY || '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',
  HIBP_API_KEY: process.env.HIBP_API_KEY || '',
  CACHE_TTL: 5 * 60 * 1000,
  RATE_LIMIT_PER_MIN: 10
};

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/* ============================================================
   RATE LIMIT + CACHE
   ============================================================ */
const rateLimitMap = new Map();
const cacheMap = new Map();

function checkRateLimit(ip, limit = CONFIG.RATE_LIMIT_PER_MIN) {
  const now = Date.now();
  const e = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { e.count = 0; e.start = now; }
  e.count++;
  rateLimitMap.set(ip, e);
  return e.count <= limit;
}

function cacheGet(key) {
  const e = cacheMap.get(key);
  if (!e) return null;
  if (Date.now() - e.t > CONFIG.CACHE_TTL) { cacheMap.delete(key); return null; }
  return e.v;
}

function cacheSet(key, val) {
  cacheMap.set(key, { v: val, t: Date.now() });
  if (cacheMap.size > 500) {
    const now = Date.now();
    for (const [k, v] of cacheMap) {
      if (now - v.t > CONFIG.CACHE_TTL) cacheMap.delete(k);
    }
  }
}

/* ============================================================
   TAVILY SEARCH
   ============================================================ */
async function tavilySearch(query, maxResults = 5) {
  try {
    const res = await axios.post(TAVILY_ENDPOINT, {
      api_key: CONFIG.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false
    }, { timeout: 15000 });
    return res.data?.results || [];
  } catch (e) {
    console.warn('[tavily] error:', e.message);
    return [];
  }
}

/* ============================================================
   TOOL 1 — CEK REKENING
   ============================================================ */
async function checkCekRekeningId(bank, nomor) {
  try {
    const home = await axios.get('https://cekrekening.id/home', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    const cookies = (home.headers['set-cookie'] || []).join('; ');

    const res = await axios.post(
      'https://cekrekening.id/api/cek-rekening',
      { bank: bank.toUpperCase(), rekening: nomor },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://cekrekening.id/home',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    return {
      source: 'cekrekening.id',
      reported: res.data?.status === 'found' || res.data?.data?.reported > 0,
      reportCount: res.data?.data?.reported || 0
    };
  } catch (e) {
    return { source: 'cekrekening.id', error: e.message, reported: false };
  }
}

async function checkKredibelRekening(bank, nomor) {
  try {
    const res = await axios.post(
      'https://api.kredibel.com/v1/rekening/check',
      { bank: bank.toUpperCase(), account_number: nomor },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Origin': 'https://kredibel.com',
          'Referer': 'https://kredibel.com/'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );
    return {
      source: 'kredibel.com',
      reported: res.data?.reported || false,
      reportCount: res.data?.report_count || 0,
      tags: res.data?.tags || []
    };
  } catch (e) {
    return { source: 'kredibel.com', error: e.message, reported: false };
  }
}

async function toolRekening(data) {
  const { bank, nomor } = data;
  if (!bank || !nomor) throw new Error('Bank dan nomor rekening wajib diisi.');
  if (!/^\d{8,20}$/.test(nomor)) throw new Error('Nomor rekening harus 8-20 digit.');

  const cacheKey = `rek:${bank}:${nomor}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

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

  const [cek, kred, tavily] = await Promise.all([
    checkCekRekeningId(bank, nomor),
    checkKredibelRekening(bank, nomor),
    tavilySearch(`"${nomor}" penipuan OR scam OR laporan ${bank}`, 5)
  ]);

  result.sources.push(cek);
  if (cek.reported) {
    result.reported = true;
    result.riskScore += 50;
    result.flags.push(`Terdaftar di CekRekening.id (${cek.reportCount} laporan)`);
  }

  result.sources.push(kred);
  if (kred.reported) {
    result.reported = true;
    result.riskScore += 30;
    result.flags.push(`Terdaftar di Kredibel (${kred.reportCount} laporan)`);
  }

  const suspicious = tavily.filter(r =>
    /penipu|scam|lapor|tipu|curang|penipuan/i.test((r.title || '') + ' ' + (r.content || ''))
  );
  if (suspicious.length > 0) {
    result.riskScore += Math.min(suspicious.length * 10, 30);
    result.flags.push(`Ditemukan ${suspicious.length} laporan di web`);
    result.sources.push({
      source: 'tavily-web',
      hits: suspicious.length,
      results: suspicious.slice(0, 3).map(r => ({ title: r.title, url: r.url }))
    });
  }

  if (result.riskScore >= 60) result.riskLevel = 'high';
  else if (result.riskScore >= 30) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  cacheSet(cacheKey, result);
  return result;
}

/* ============================================================
   TOOL 2 — CEK NOMOR HP
   ============================================================ */
const PROVIDERS = {
  '811': 'Telkomsel', '812': 'Telkomsel', '813': 'Telkomsel', '821': 'Telkomsel',
  '822': 'Telkomsel', '823': 'Telkomsel', '851': 'Telkomsel', '852': 'Telkomsel', '853': 'Telkomsel',
  '814': 'Indosat', '815': 'Indosat', '816': 'Indosat',
  '855': 'Indosat', '856': 'Indosat', '857': 'Indosat', '858': 'Indosat',
  '817': 'XL', '818': 'XL', '819': 'XL', '859': 'XL', '877': 'XL', '878': 'XL',
  '831': 'Axis', '832': 'Axis', '833': 'Axis', '838': 'Axis',
  '895': 'Tri', '896': 'Tri', '897': 'Tri', '898': 'Tri', '899': 'Tri',
  '881': 'Smartfren', '882': 'Smartfren', '883': 'Smartfren', '884': 'Smartfren',
  '885': 'Smartfren', '886': 'Smartfren', '887': 'Smartfren', '888': 'Smartfren', '889': 'Smartfren'
};

async function checkKredibelPhone(nomor) {
  try {
    const res = await axios.post(
      'https://api.kredibel.com/v1/phone/check',
      { phone_number: nomor },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Origin': 'https://kredibel.com',
          'Referer': 'https://kredibel.com/'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );
    return {
      source: 'kredibel.com',
      reported: res.data?.reported || false,
      reportCount: res.data?.report_count || 0,
      tags: res.data?.tags || []
    };
  } catch (e) {
    return { source: 'kredibel.com', error: e.message, reported: false };
  }
}

async function toolPhone(data) {
  const { nomor } = data;
  if (!nomor) throw new Error('Nomor HP wajib diisi.');

  const cleaned = String(nomor).replace(/[^\d+]/g, '').replace(/^\+62/, '0').replace(/^62/, '0');
  const cacheKey = `phone:${cleaned}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const result = {
    type: 'phone',
    target: cleaned,
    nomor: cleaned,
    provider: null,
    reported: false,
    riskScore: 0,
    riskLevel: 'safe',
    sources: [],
    flags: []
  };

  const prefix = cleaned.replace(/^0/, '').slice(0, 3);
  result.provider = PROVIDERS[prefix] || 'Unknown';

  const [kred, tavily] = await Promise.all([
    checkKredibelPhone(cleaned),
    tavilySearch(`"${cleaned}" penipuan OR scam OR laporan OR was-was`, 5)
  ]);

  result.sources.push(kred);
  if (kred.reported) {
    result.reported = true;
    result.riskScore += 50;
    result.flags.push(`Terdaftar di Kredibel (${kred.reportCount} laporan)`);
    if (kred.tags?.length) result.flags.push(`Modus: ${kred.tags.join(', ')}`);
  }

  const suspicious = tavily.filter(r =>
    /penipu|scam|lapor|tipu|curang|penipuan|was-was|modus|hati-hati/i.test((r.title || '') + ' ' + (r.content || ''))
  );
  if (suspicious.length > 0) {
    result.riskScore += Math.min(suspicious.length * 12, 40);
    result.flags.push(`Ditemukan ${suspicious.length} laporan di web`);
    result.sources.push({
      source: 'tavily-web',
      hits: suspicious.length,
      results: suspicious.slice(0, 3).map(r => ({ title: r.title, url: r.url }))
    });
  }

  if (result.riskScore >= 60) result.riskLevel = 'high';
  else if (result.riskScore >= 30) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  cacheSet(cacheKey, result);
  return result;
}

/* ============================================================
   TOOL 3 — SCAN SITUS
   ============================================================ */
async function fetchHTML(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true
    });
    return { html: res.data.toString(), status: res.status };
  } catch (e) {
    return { error: e.message };
  }
}

async function checkWhois(domain) {
  try {
    const data = await whois(domain, { timeout: 8000, follow: 2 });
    return {
      registrar: data.registrar,
      created: data.creationDate,
      expires: data.registryExpiryDate,
      country: data.registrantCountry,
      ageDays: data.creationDate
        ? Math.floor((Date.now() - new Date(data.creationDate).getTime()) / 86400000)
        : null
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function toolSitus(data) {
  let { url } = data;
  if (!url) throw new Error('URL wajib diisi.');

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;

  let domain;
  try { domain = new URL(url).hostname; }
  catch { throw new Error('URL tidak valid.'); }

  const cacheKey = `situs:${domain}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const result = {
    type: 'situs',
    target: url,
    domain,
    reachable: false,
    whois: null,
    riskScore: 0,
    riskLevel: 'safe',
    flags: [],
    keywords: {}
  };

  const [fetchRes, tavily, whoisData] = await Promise.all([
    fetchHTML(url),
    tavilySearch(`"${domain}" penipuan OR scam OR judi OR phishing OR laporan`, 5),
    checkWhois(domain)
  ]);

  result.whois = whoisData;
  result.reachable = !fetchRes.error;

  if (fetchRes.html) {
    const $ = cheerio.load(fetchRes.html);
    const text = $('body').text().toLowerCase();

    const keywordSets = {
      judi: ['judi', 'slot', 'togel', 'casino', 'taruhan', 'jackpot', 'maxwin', 'rtp', 'poker'],
      phishing: ['verifikasi akun', 'konfirmasi data', 'login bank', 'update informasi', 'akun diblokir'],
      scam: ['investasi', 'profit harian', 'bonus deposit', 'cashback', 'withdraw', 'pasif income'],
      spam: ['menang', 'hadiah', 'undian', 'klaim', 'transfer'],
      crypto: ['bitcoin', 'usdt', 'wallet', 'crypto', 'binance']
    };

    for (const [cat, words] of Object.entries(keywordSets)) {
      const matches = words.filter(w => text.includes(w));
      if (matches.length > 0) {
        result.keywords[cat] = matches;
        result.riskScore += matches.length * 4;
      }
    }

    const loginForms = $('form').filter((_, f) => {
      const html = $(f).html().toLowerCase();
      return html.includes('password') || html.includes('pin') || html.includes('passcode');
    });
    if (loginForms.length > 0) {
      result.keywords.loginForms = loginForms.length;
      result.riskScore += 15;
    }

    const accountMatches = text.match(/\b\d{10,16}\b/g) || [];
    if (accountMatches.length > 0) {
      result.keywords.rekening = [...new Set(accountMatches)].slice(0, 5);
      result.riskScore += 10;
    }

    if (result.keywords.judi) result.flags.push('Konten judi terdeteksi');
    if (result.keywords.phishing) result.flags.push('Indikasi phishing');
    if (result.keywords.scam) result.flags.push('Indikasi scam / investasi bodong');
    if (loginForms.length > 0) result.flags.push(`Ada ${loginForms.length} form login — hati-hati`);
  }

  const suspicious = tavily.filter(r =>
    /penipu|scam|judi|phishing|lapor|tipu|illegal/i.test((r.title || '') + ' ' + (r.content || ''))
  );
  if (suspicious.length > 0) {
    result.riskScore += Math.min(suspicious.length * 8, 30);
    result.flags.push(`Ditemukan ${suspicious.length} laporan terkait domain`);
    result.keywords.reports = suspicious.slice(0, 3).map(r => ({ title: r.title, url: r.url }));
  }

  if (whoisData.ageDays !== null && whoisData.ageDays < 180) {
    result.riskScore += 20;
    result.flags.push(`Domain baru (< 6 bulan) — ${whoisData.ageDays} hari`);
  }

  if (result.riskScore >= 60) result.riskLevel = 'high';
  else if (result.riskScore >= 30) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  cacheSet(cacheKey, result);
  return result;
}

/* ============================================================
   TOOL 4 — CEK EMAIL
   ============================================================ */
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
  'throwawaymail.com', 'yopmail.com', 'sharklasers.com', 'maildrop.cc',
  'getnada.com', 'temp-mail.org', 'trashmail.com', 'fakeinbox.com',
  'mailnesia.com', 'mohmal.com', 'dispostable.com', 'mintemail.com',
  'spamgourmet.com', 'mytrashmail.com', 'mailexpire.com', 'throwaway.email'
];

async function toolEmail(data) {
  const { email } = data;
  if (!email || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
    throw new Error('Email tidak valid.');
  }

  const domain = email.split('@')[1].toLowerCase();
  const cacheKey = `email:${email}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const result = {
    type: 'email',
    target: email,
    email,
    domain,
    disposable: false,
    breachCount: 0,
    breaches: [],
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

  try {
    const headers = { 'User-Agent': 'AntiScam-Tools' };
    if (CONFIG.HIBP_API_KEY) headers['hibp-api-key'] = CONFIG.HIBP_API_KEY;

    const res = await axios.get(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`,
      { headers, timeout: 10000, validateStatus: () => true }
    );

    if (res.status === 200 && Array.isArray(res.data)) {
      result.breachCount = res.data.length;
      result.breaches = res.data.map(b => ({ name: b.Name, domain: b.Domain, date: b.BreachDate }));
      result.riskScore += Math.min(result.breachCount * 5, 30);
      result.sources.push({ source: 'haveibeenpwned.com', found: true, count: result.breachCount });
      result.flags.push(`Email ditemukan di ${result.breachCount} kebocoran data`);
    } else if (res.status === 404) {
      result.sources.push({ source: 'haveibeenpwned.com', found: false, count: 0 });
    }
  } catch (e) {
    result.sources.push({ source: 'haveibeenpwned.com', error: e.message });
  }

  if (result.riskScore >= 40) result.riskLevel = 'high';
  else if (result.riskScore >= 15) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  cacheSet(cacheKey, result);
  return result;
}

/* ============================================================
   TOOL 5 — EXPAND SHORT LINK
   ============================================================ */
async function toolLink(data) {
  let { url } = data;
  if (!url) throw new Error('URL wajib diisi.');

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;

  const result = {
    type: 'link',
    target: url,
    input: url,
    final: url,
    chain: [],
    domain: null,
    reachable: false,
    suspicious: false,
    riskScore: 0,
    riskLevel: 'safe',
    flags: []
  };

  let current = url;
  const chain = [current];
  let maxHops = 15;

  while (maxHops-- > 0) {
    try {
      const res = await axios.get(current, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: 'text'
      });

      if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
        const next = new URL(res.headers.location, current).toString();
        if (chain.includes(next)) break;
        chain.push(next);
        current = next;
      } else {
        break;
      }
    } catch (e) {
      result.error = e.message;
      break;
    }
  }

  result.chain = chain;
  result.final = current;
  result.reachable = chain.length > 1 || !result.error;

  try { result.domain = new URL(current).hostname; } catch {}

  const suspiciousWords = ['judi', 'slot', 'togel', 'casino', 'poker', 'bet', 'maxwin',
                            'login', 'verify', 'bonus', 'hadiah', 'claim', 'wallet',
                            'investment', 'profit', 'crypto'];
  const lower = current.toLowerCase();
  const found = suspiciousWords.filter(w => lower.includes(w));

  if (found.length > 0) {
    result.suspicious = true;
    result.riskScore += 50;
    result.flags.push(`URL final mengandung kata: ${found.join(', ')}`);
  }

  const shortDomains = ['bit.ly', 'tinyurl.com', 's.id', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'rebrand.ly'];
  const inputDomain = chain[0] ? new URL(chain[0]).hostname : '';
  if (shortDomains.some(d => inputDomain.includes(d)) && chain.length > 1) {
    result.flags.push(`Short URL — di-redirect ${chain.length - 1} kali`);
    result.riskScore += 10;
  }

  if (result.riskScore >= 50) result.riskLevel = 'high';
  else if (result.riskScore >= 25) result.riskLevel = 'medium';
  else if (result.riskScore > 0) result.riskLevel = 'low';

  return result;
}

/* ============================================================
   TOOL 6 — LAPORAN
   ============================================================ */
async function toolLaporan(data) {
  if (!data.suspectName && !data.suspectAccount && !data.suspectPhone) {
    throw new Error('Minimal salah satu data terlapor harus diisi.');
  }

  return {
    type: 'laporan',
    target: data.suspectName || data.suspectAccount || data.suspectPhone || 'unknown',
    ...data,
    riskLevel: 'medium',
    createdAt: Date.now()
  };
}

/* ============================================================
   ROUTER
   ============================================================ */
const TOOLS = {
  rekening: toolRekening,
  phone:    toolPhone,
  situs:    toolSitus,
  email:    toolEmail,
  link:     toolLink,
  laporan:  toolLaporan
};

/* ============================================================
   MAIN HANDLER
   ============================================================ */
export default async function handler(req, res) {
  // CORS headers — WAJIB untuk POST dari browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Handle GET — health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'AntiScam Tools API',
      tools: Object.keys(TOOLS),
      timestamp: Date.now()
    });
  }

  // Hanya POST yang diizinkan untuk operasi
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.',
      method: req.method
    });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || req.socket?.remoteAddress
          || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Terlalu banyak permintaan. Tunggu 1 menit.' });
  }

  // Parse body
  let body = req.body;

  // Kalau body masih string (edge case), parse manual
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }

  if (!body) {
    return res.status(400).json({ error: 'Body kosong. Format: { tool, data }' });
  }

  const { tool, data } = body;

  if (!tool || !data) {
    return res.status(400).json({ error: 'Format: { tool, data }' });
  }

  const fn = TOOLS[tool];
  if (!fn) {
    return res.status(400).json({
      error: `Tool tidak dikenal: "${tool}"`,
      available: Object.keys(TOOLS)
    });
  }

  try {
    console.log(`[api] ${tool} | ${ip}`);
    const result = await fn(data);
    res.status(200).json(result);
  } catch (e) {
    console.error(`[api] ${tool} error:`, e.message);
    res.status(500).json({ error: e.message });
  }
}