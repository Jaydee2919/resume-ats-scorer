/* ─────────────────────────────────────────────────────────────────────────────
   ResumeAI — Client-Side App Logic
   PDF parsing with PDF.js · ATS scoring · Gemini AI (browser)
   ───────────────────────────────────────────────────────────────────────────── */

// PDF.js worker
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ── Config ─────────────────────────────────────────────────────────────────
// Cloudflare Worker proxy URL — key is stored securely on Cloudflare.
// All visitors get AI insights without needing their own key.
const WORKER_URL = 'https://resumeai-gemini-proxy.jayant-db91.workers.dev/analyze';

// ── State ──────────────────────────────────────────────────────────────────
let selectedFile = null;
let currentTab = 'upload';
let geminiApiKey = ''; // personal override key (optional)
let apiPanelOpen = false;

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadApiKey();
});

// ── API Key Management ─────────────────────────────────────────────────────
function loadApiKey() {
  const stored = localStorage.getItem('resumeai_gemini_key') || '';
  geminiApiKey = stored;
  updateApiStatus();
  if (stored) {
    document.getElementById('api-key-input').value = stored;
  }
}

function saveApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val) { showToast('Please enter an API key.', 'error'); return; }
  geminiApiKey = val;
  localStorage.setItem('resumeai_gemini_key', val);
  updateApiStatus();
  toggleApiKeyPanel(true); // close
  showToast('✅ Gemini API key saved!', 'success');
}

function clearApiKey() {
  geminiApiKey = '';
  localStorage.removeItem('resumeai_gemini_key');
  document.getElementById('api-key-input').value = '';
  updateApiStatus();
  showToast('API key cleared.', 'info');
}

function updateApiStatus() {
  const badge = document.getElementById('ai-badge');
  const dot = badge.querySelector('.badge-dot');
  const label = badge.querySelector('.badge-label');
  // Worker proxy = AI always available for everyone
  if (WORKER_URL && !WORKER_URL.includes('PLACEHOLDER')) {
    dot.classList.remove('inactive');
    label.textContent = 'Gemini AI Active';
  } else if (geminiApiKey) {
    dot.classList.remove('inactive');
    label.textContent = 'Gemini AI (Personal Key)';
  } else {
    dot.classList.add('inactive');
    label.textContent = 'AI Unavailable';
  }
}

function toggleApiKeyPanel(forceClose = false) {
  apiPanelOpen = forceClose ? false : !apiPanelOpen;
  document.getElementById('api-panel').classList.toggle('hidden', !apiPanelOpen);
  if (apiPanelOpen) {
    setTimeout(() => document.getElementById('api-key-input').focus(), 50);
  }
}

// ── Tab Switching ──────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
  document.getElementById('tab-paste').classList.toggle('active', tab === 'paste');
  document.getElementById('panel-upload').classList.toggle('hidden', tab !== 'upload');
  document.getElementById('panel-paste').classList.toggle('hidden', tab !== 'paste');
}

// ── File Handling ──────────────────────────────────────────────────────────
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('drag-over');
}
function handleDragLeave() {
  document.getElementById('dropzone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
}
function handleFileSelect(e) {
  if (e.target.files[0]) setFile(e.target.files[0]);
}

function setFile(file) {
  if (file.type !== 'application/pdf') {
    showToast('Please upload a PDF file.', 'error'); return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large. Max 10MB.', 'error'); return;
  }
  selectedFile = file;
  const dz = document.getElementById('dropzone');
  dz.classList.add('has-file');
  dz.querySelector('.dropzone-text').textContent = '✓ ' + file.name;
  const fi = document.getElementById('file-info');
  fi.textContent = formatBytes(file.size) + ' — ready to analyze';
  fi.classList.remove('hidden');
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── PDF Text Extraction (client-side PDF.js) ───────────────────────────────
async function extractPDFText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

// ── Main Analysis ──────────────────────────────────────────────────────────
async function runAnalysis() {
  const jd = document.getElementById('job-description').value.trim();
  const pastedText = document.getElementById('resume-text').value.trim();

  if (currentTab === 'upload' && !selectedFile) {
    showToast('Please upload a PDF resume first.', 'error'); return;
  }
  if (currentTab === 'paste' && pastedText.length < 50) {
    showToast('Please paste your resume text (at least 50 characters).', 'error'); return;
  }

  setAnalyzeBtn(true);
  showLoading(true);
  hideResults();

  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  let si = 0;
  const stepTexts = ['📄 Parsing resume', '🔍 ATS analysis', '🎯 Keyword matching', '🤖 AI insights'];

  function advanceStep() {
    if (si > 0) {
      const prev = document.getElementById(steps[si - 1]);
      prev.classList.remove('active');
      prev.classList.add('done');
    }
    if (si < steps.length) {
      document.getElementById(steps[si]).classList.add('active');
      document.getElementById(steps[si]).textContent = stepTexts[si];
      si++;
    }
  }

  advanceStep(); // step 1

  try {
    // 1. Extract text
    let resumeText = '';
    if (currentTab === 'upload') {
      resumeText = await extractPDFText(selectedFile);
    } else {
      resumeText = pastedText;
    }

    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error('Resume text too short or PDF is unreadable. Try pasting text instead.');
    }

    advanceStep(); // step 2
    const atsResult = computeATSScore(resumeText);

    advanceStep(); // step 3
    let keywordResult = null;
    if (jd && jd.length > 20) {
      keywordResult = computeKeywordMatch(resumeText, jd);
    }

    // Step 4: AI (only attempt if key + JD are present)
    const hasJD = !!(jd && jd.length > 20);
    const workerReady = WORKER_URL && !WORKER_URL.includes('PLACEHOLDER');
    const aiKeyWasSet = workerReady || !!geminiApiKey;
    let aiResult = null;
    let aiFailed = false;

    if (aiKeyWasSet && hasJD) {
      advanceStep(); // step 4 active
      document.getElementById('loading-text').textContent = 'Getting AI insights...';
      try {
        aiResult = await callGeminiAPI(resumeText, jd);
        if (!aiResult) aiFailed = true; // key set but response was null
      } catch (aiErr) {
        aiFailed = true;
        // Re-throw only if it's an invalid key error
        if (aiErr.message.includes('Invalid Gemini')) throw aiErr;
      }
    } else {
      // Skip step 4 visually
      const s4 = document.getElementById('step-4');
      s4.classList.remove('active');
      s4.classList.add('done');
    }

    // Finalize all steps
    steps.forEach(id => {
      const el = document.getElementById(id);
      el.classList.remove('active');
      el.classList.add('done');
    });

    await sleep(300);
    showLoading(false);

    // Compute final score
    let finalScore = atsResult.score;
    if (keywordResult) finalScore = Math.round(atsResult.score * 0.6 + keywordResult.matchScore * 0.4);
    if (aiResult?.estimatedMatchScore) {
      finalScore = Math.round(atsResult.score * 0.4 + (keywordResult?.matchScore || 0) * 0.3 + aiResult.estimatedMatchScore * 0.3);
    }
    finalScore = Math.min(100, finalScore);

    renderResults({ finalScore, ats: atsResult, keywords: keywordResult, ai: aiResult, hasJD, aiKeyWasSet, aiFailed });

  } catch (err) {
    showLoading(false);
    showToast(err.message || 'Analysis failed. Please try again.', 'error');
  } finally {
    setAnalyzeBtn(false);
  }
}

// ── ATS Scoring ────────────────────────────────────────────────────────────
const SECTION_PATTERNS = {
  contact:      /(\b(email|phone|mobile|linkedin|github|address|location)\b)/i,
  summary:      /\b(summary|objective|profile|about me|overview)\b/i,
  experience:   /\b(experience|work history|employment|career|professional)\b/i,
  education:    /\b(education|degree|university|college|bachelor|master|phd|gpa)\b/i,
  skills:       /\b(skills|technologies|tools|proficiencies|competencies)\b/i,
  certifications:/\b(certification|certificate|certified|license)\b/i,
  projects:     /\b(projects|portfolio|work samples)\b/i,
  achievements: /\b(achievement|award|honor|recognition)\b/i,
};

const ACTION_VERBS = [
  'achieved','built','created','designed','developed','delivered','engineered',
  'improved','increased','launched','led','managed','optimized','reduced',
  'spearheaded','implemented','coordinated','established','executed','generated',
  'grew','mentored','negotiated','produced','resolved','streamlined','transformed',
  'accelerated','collaborated','conceptualized','drove','expanded','facilitated',
];

function computeATSScore(resumeText) {
  let score = 0;
  const strengths = [], warnings = [];
  const sections = {};

  // Sections (30 pts)
  for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) {
    const found = pattern.test(resumeText);
    sections[name] = found;
    if (found && ['contact','experience','education','skills','summary'].includes(name)) {
      score += 6; strengths.push(`✓ ${cap(name)} section detected`);
    } else if (!found && ['contact','experience','education','skills'].includes(name)) {
      warnings.push(`⚠ Missing or unclear "${cap(name)}" section`);
    }
  }

  // Contact (10 pts)
  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i.test(resumeText);
  const hasPhone = /(\+?\d[\d\s\-().]{7,}\d)/i.test(resumeText);
  const hasLinkedIn = /linkedin\.com/i.test(resumeText);
  if (hasEmail)    { score += 4; strengths.push('✓ Email address found'); }
  else warnings.push('⚠ No email address detected');
  if (hasPhone)    { score += 3; strengths.push('✓ Phone number found'); }
  else warnings.push('⚠ No phone number detected');
  if (hasLinkedIn) { score += 3; strengths.push('✓ LinkedIn profile linked'); }

  // Action Verbs (15 pts)
  const usedVerbs = ACTION_VERBS.filter(v => new RegExp(`\\b${v}`, 'i').test(resumeText));
  score += Math.min(15, Math.round((usedVerbs.length / ACTION_VERBS.length) * 30));
  if (usedVerbs.length >= 8) strengths.push(`✓ Strong action verbs (${usedVerbs.length} found)`);
  else warnings.push(`⚠ Use more action verbs (found ${usedVerbs.length}, aim for 8+)`);

  // Quantified (15 pts)
  const quantMatches = [/\d+%/, /\$[\d,]+/, /\d+x/i, /\d+[\+]?\s*(users|clients|employees|team|projects)/i].filter(p => p.test(resumeText));
  score += Math.min(15, quantMatches.length * 4);
  if (quantMatches.length >= 3) strengths.push('✓ Good use of numbers & metrics');
  else warnings.push('⚠ Add quantified achievements (numbers, %, $)');

  // Length (10 pts)
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 250 && wordCount <= 900) { score += 5; strengths.push(`✓ Good resume length (~${wordCount} words)`); }
  else if (wordCount > 900) warnings.push(`⚠ Resume may be too long (~${wordCount} words)`);
  else warnings.push(`⚠ Resume seems too short (~${wordCount} words)`);

  // Bullets
  if (/[•\-\*]\s/.test(resumeText)) { score += 5; strengths.push('✓ Uses bullet points'); }
  else warnings.push('⚠ Consider using bullet points for readability');

  // Format bonus
  score += 10; strengths.push('✓ Parsed successfully (ATS-readable)');

  return {
    score: Math.min(100, score),
    strengths, warnings,
    details: { sections, wordCount, actionVerbs: usedVerbs }
  };
}

// ── Keyword Matching ───────────────────────────────────────────────────────
const STOPWORDS = new Set(['the','and','for','are','but','not','you','all','any','can',
  'had','was','one','our','out','get','has','how','new','now','see','two','way',
  'who','did','its','let','put','say','she','too','use','with','that','this',
  'from','they','have','been','will','about','after','also','back','down','each',
  'good','into','just','know','like','look','make','more','most','need','only',
  'open','other','over','same','some','take','than','them','then','there','these',
  'time','when','well','were','what','work','your','year','which','their','very',
]);

function extractKeywords(text) {
  const freq = {};
  text.toLowerCase().replace(/[^a-z0-9\s\+\#\.]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,80).map(([w]) => w);
}

function computeKeywordMatch(resumeText, jd) {
  const jdKw = extractKeywords(jd);
  const resumeSet = new Set(extractKeywords(resumeText));
  const matched = jdKw.filter(k => resumeSet.has(k));
  const missing = jdKw.filter(k => !resumeSet.has(k)).slice(0, 20);
  const matchScore = jdKw.length > 0 ? Math.min(100, Math.round((matched.length / Math.min(jdKw.length, 30)) * 100)) : 0;
  return { matchScore, matchedKeywords: matched.slice(0, 25), missingKeywords: missing, totalJDKeywords: jdKw.length, totalMatched: matched.length };
}

// ── Gemini API — tries Worker proxy first, falls back to personal key ──────
async function callGeminiAPI(resumeText, jd) {
  const prompt = buildGeminiPrompt(resumeText, jd);

  // 1️⃣ Try the Cloudflare Worker proxy (shared key, secure)
  if (WORKER_URL && !WORKER_URL.includes('PLACEHOLDER')) {
    try {
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return parseGeminiResponse(data);
      }
      // Worker returned error — fall through to personal key
      console.warn('Worker proxy failed:', resp.status);
    } catch (err) {
      console.warn('Worker proxy unreachable:', err.message);
    }
  }

  // 2️⃣ Fall back to personal key if the user added one
  if (geminiApiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      const msg = err?.error?.message || 'Gemini API error';
      if (msg.includes('API_KEY_INVALID') || resp.status === 400) {
        throw new Error('Invalid Gemini API key. Please check and try again.');
      }
      return null;
    }
    return parseGeminiResponse(await resp.json());
  }

  return null;
}

function buildGeminiPrompt(resumeText, jd) {
  return `You are an expert ATS analyst and career coach. Analyze this RESUME vs JOB DESCRIPTION.

RESUME:
${resumeText.substring(0, 3000)}

JOB DESCRIPTION:
${jd.substring(0, 2000)}

Respond ONLY with valid JSON:
{
  "overallFit": "Excellent|Good|Fair|Poor",
  "fitSummary": "2-3 sentence summary of candidate fit",
  "topStrengths": ["strength1", "strength2", "strength3"],
  "skillGaps": ["gap1", "gap2", "gap3"],
  "recommendations": ["action1", "action2", "action3", "action4"],
  "missingKeySkills": ["skill1", "skill2"],
  "atsOptimizationTips": ["tip1", "tip2", "tip3"],
  "estimatedMatchScore": 75
}`;
}

function parseGeminiResponse(data) {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { return null; }
  }
  return null;
}

// ── Render Results ─────────────────────────────────────────────────────────
function renderResults(data) {
  const section = document.getElementById('results-section');
  section.classList.remove('hidden');
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  // Score ring
  animateScore(data.finalScore);
  setScoreGrade(data.finalScore);

  // Breakdown
  animateBar('bar-ats', 'val-ats', data.ats.score);
  if (data.keywords) {
    document.getElementById('kw-breakdown').classList.remove('hidden');
    animateBar('bar-kw', 'val-kw', data.keywords.matchScore);
  }
  if (data.ai?.estimatedMatchScore) {
    document.getElementById('ai-breakdown').classList.remove('hidden');
    animateBar('bar-ai', 'val-ai', data.ai.estimatedMatchScore);
  }

  // Meta
  const meta = [];
  if (data.ats.details.wordCount) meta.push(`~${data.ats.details.wordCount} words`);
  if (data.keywords) meta.push(`${data.keywords.totalMatched}/${data.keywords.totalJDKeywords} JD keywords`);
  document.getElementById('score-meta').textContent = meta.join(' · ');

  // Lists
  renderList('strengths-list', data.ats.strengths);
  renderList('warnings-list', data.ats.warnings);

  // Keywords
  if (data.keywords && data.hasJD) {
    document.getElementById('keywords-section').classList.remove('hidden');
    document.getElementById('match-badge').textContent = `${data.keywords.matchScore}% match`;
    renderTags('matched-tags', data.keywords.matchedKeywords, 'matched-tag');
    renderTags('missing-tags', data.keywords.missingKeywords, 'missing-tag');
  }

  // AI section — three possible states:
  if (data.ai) {
    // ✅ AI succeeded — show full insights
    document.getElementById('ai-section').classList.remove('hidden');
    renderAI(data.ai);
  } else if (data.hasJD && data.aiKeyWasSet && data.aiFailed) {
    // ⚠️ Key was set but API call returned nothing — show soft error
    document.getElementById('ai-nudge').classList.remove('hidden');
    const nudgeText = document.querySelector('#ai-nudge .nudge-text');
    nudgeText.innerHTML = `
      <strong>⚠️ AI insights unavailable</strong>
      <p>The Gemini API returned no response. Your key may be invalid, have no quota, or the request timed out. <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent-violet)">Check your key →</a></p>
    `;
    document.querySelector('#ai-nudge .nudge-btn').style.display = 'none';
  } else if (data.hasJD && !data.aiKeyWasSet) {
    // ℹ️ No key at all — invite them to add one
    document.getElementById('ai-nudge').classList.remove('hidden');
    // Reset nudge to default content (in case it was changed by a previous failed run)
    const nudgeText = document.querySelector('#ai-nudge .nudge-text');
    nudgeText.innerHTML = `
      <strong>🤖 Unlock AI-powered insights</strong>
      <p>Click <strong>"🔑 API Key"</strong> in the top-right and enter your free Gemini API key to get deep semantic analysis, skill gap detection, and personalized recommendations. <em>Your key stays in your browser only — other visitors cannot see or use it.</em></p>
    `;
    document.querySelector('#ai-nudge .nudge-btn').style.display = '';
  }
  // If no JD was provided, show nothing — no nag at all

  // Sections
  renderSections(data.ats.details.sections);
}

function animateScore(target) {
  const numEl = document.getElementById('score-number');
  const ring = document.getElementById('ring-progress');
  const circ = 314.16;
  setTimeout(() => { ring.style.strokeDashoffset = circ - (target / 100) * circ; }, 100);
  let cur = 0; const inc = target / 60;
  const t = setInterval(() => {
    cur = Math.min(cur + inc, target);
    numEl.textContent = Math.round(cur);
    if (cur >= target) clearInterval(t);
  }, 25);
}

function setScoreGrade(score) {
  const el = document.getElementById('score-grade');
  if (score >= 80) { el.textContent = '🌟 Excellent'; el.className = 'score-grade grade-excellent'; }
  else if (score >= 65) { el.textContent = '✅ Good'; el.className = 'score-grade grade-good'; }
  else if (score >= 50) { el.textContent = '⚡ Fair'; el.className = 'score-grade grade-fair'; }
  else { el.textContent = '⚠️ Needs Work'; el.className = 'score-grade grade-poor'; }
}

function animateBar(barId, valId, value) {
  setTimeout(() => {
    document.getElementById(barId).style.width = value + '%';
    document.getElementById(valId).textContent = value + '%';
  }, 350);
}

function renderList(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  (items || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

function renderTags(id, tags, cls) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  if (!tags?.length) { el.innerHTML = `<span class="keyword-tag ${cls}">None found</span>`; return; }
  tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = `keyword-tag ${cls}`;
    span.textContent = tag;
    el.appendChild(span);
  });
}

function renderAI(ai) {
  const fitMap = {
    'Excellent': ['🌟 Excellent Fit', 'fit-excellent'],
    'Good':      ['✅ Good Fit',      'fit-good'],
    'Fair':      ['⚡ Fair Fit',      'fit-fair'],
    'Poor':      ['⚠️ Poor Fit',     'fit-poor'],
  };
  const [txt, cls] = fitMap[ai.overallFit] || ['Unknown', 'fit-fair'];
  const fb = document.getElementById('fit-badge');
  fb.textContent = txt; fb.className = `fit-badge ${cls}`;

  document.getElementById('ai-summary').textContent = ai.fitSummary || '';
  renderAIList('ai-strengths', ai.topStrengths);
  renderAIList('ai-gaps', ai.skillGaps);
  renderAIList('ai-tips', ai.atsOptimizationTips);
  renderAIList('ai-recommendations', ai.recommendations);
}

function renderAIList(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  (items || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

function renderSections(sections) {
  const grid = document.getElementById('sections-grid');
  grid.innerHTML = '';
  if (!sections) return;
  const icons = { contact:'📬', summary:'📝', experience:'💼', education:'🎓', skills:'⚙️', certifications:'🏆', projects:'🔨', achievements:'🌟' };
  Object.entries(sections).forEach(([name, found]) => {
    const chip = document.createElement('div');
    chip.className = `section-chip ${found ? 'section-found' : 'section-missing'}`;
    chip.innerHTML = `<span>${icons[name] || '📄'}</span><span>${cap(name)}</span>`;
    grid.appendChild(chip);
  });
}

// ── UI Helpers ─────────────────────────────────────────────────────────────
function showLoading(show) {
  document.getElementById('loading-state').classList.toggle('hidden', !show);
  if (show) {
    document.getElementById('loading-text').textContent = 'Parsing your resume...';
    ['step-1','step-2','step-3','step-4'].forEach(id => {
      document.getElementById(id).classList.remove('active','done');
    });
  }
}

function hideResults() {
  ['results-section','keywords-section','ai-section','ai-nudge','kw-breakdown','ai-breakdown'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  // Reset nudge button visibility in case it was hidden by a failed AI run
  const nudgeBtn = document.querySelector('#ai-nudge .nudge-btn');
  if (nudgeBtn) nudgeBtn.style.display = '';
}

function setAnalyzeBtn(loading) {
  const btn = document.getElementById('analyze-btn');
  btn.disabled = loading;
  btn.querySelector('.btn-text').textContent = loading ? 'Analyzing...' : 'Analyze Resume';
}

function resetForm() {
  selectedFile = null;
  document.getElementById('file-input').value = '';
  const dz = document.getElementById('dropzone');
  dz.classList.remove('has-file','drag-over');
  dz.querySelector('.dropzone-text').textContent = 'Drop your PDF here';
  document.getElementById('file-info').classList.add('hidden');
  document.getElementById('resume-text').value = '';
  document.getElementById('job-description').value = '';
  hideResults();
  setAnalyzeBtn(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, type = 'info') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const colors = { error: ['hsl(0,60%,15%)', 'hsl(0,75%,40%)', 'hsl(0,80%,75%)'], success: ['hsl(158,60%,12%)', 'hsl(158,72%,35%)', 'hsl(158,72%,70%)'], info: ['hsl(228,25%,14%)', 'hsl(259,85%,40%)', 'hsl(220,20%,85%)'] };
  const [bg, border, color] = colors[type] || colors.info;
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${bg};border:1px solid ${border};color:${color};padding:12px 24px;border-radius:100px;font-size:0.875rem;font-weight:500;box-shadow:0 8px 32px hsla(0,0%,0%,0.4);z-index:1000;animation:fade-in-up 0.3s ease;backdrop-filter:blur(12px);white-space:nowrap;`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
