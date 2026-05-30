/* ─── app.js — ResumeAI Frontend Logic ─────────────────────────────────────── */

let selectedFile = null;
let currentTab = 'upload';

// ── On Load ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  injectSVGDefs();
  await checkHealth();
});

// Inject SVG gradient definition for the ring
function injectSVGDefs() {
  const svg = document.querySelector('.score-ring');
  if (!svg) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="hsl(259,85%,65%)"/>
      <stop offset="50%"  stop-color="hsl(214,100%,60%)"/>
      <stop offset="100%" stop-color="hsl(320,80%,62%)"/>
    </linearGradient>`;
  svg.prepend(defs);
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const badge = document.getElementById('ai-badge');
    const dot = badge.querySelector('.badge-dot');
    const label = badge.querySelector('.badge-label');
    if (data.aiEnabled) {
      label.textContent = 'Gemini AI Active';
      dot.classList.remove('inactive');
    } else {
      label.textContent = 'Rule-Based Mode';
      dot.classList.add('inactive');
    }
  } catch {
    const badge = document.getElementById('ai-badge');
    badge.querySelector('.badge-label').textContent = 'Offline';
    badge.querySelector('.badge-dot').classList.add('inactive');
  }
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
  document.getElementById('tab-paste').classList.toggle('active', tab === 'paste');
  document.getElementById('panel-upload').classList.toggle('hidden', tab !== 'upload');
  document.getElementById('panel-paste').classList.toggle('hidden', tab !== 'paste');
}

// ── File Handling ─────────────────────────────────────────────────────────────
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('drag-over');
}

function handleDragLeave(e) {
  document.getElementById('dropzone').classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const dropzone = document.getElementById('dropzone');
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  if (file.type !== 'application/pdf') {
    showToast('Please upload a PDF file.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large. Max size is 10MB.', 'error');
    return;
  }
  selectedFile = file;
  const dropzone = document.getElementById('dropzone');
  const fileInfo = document.getElementById('file-info');
  dropzone.classList.add('has-file');
  fileInfo.style.display = 'block';
  fileInfo.textContent = `✓ ${file.name} (${formatBytes(file.size)})`;
  dropzone.querySelector('.dropzone-text').textContent = 'PDF selected';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Main Analyze Function ─────────────────────────────────────────────────────
async function analyzeResume() {
  const jobDescription = document.getElementById('job-description').value.trim();
  const resumeText = document.getElementById('resume-text').value.trim();

  // Validation
  if (currentTab === 'upload' && !selectedFile) {
    showToast('Please upload a PDF resume first.', 'error');
    return;
  }
  if (currentTab === 'paste' && resumeText.length < 50) {
    showToast('Please paste your resume text (at least 50 characters).', 'error');
    return;
  }

  // Show loading
  setAnalyzeButtonState(true);
  showLoading(true);
  hideResults();

  // Animate loading steps
  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  let stepIndex = 0;

  const stepInterval = setInterval(() => {
    if (stepIndex > 0) {
      const prev = document.getElementById(steps[stepIndex - 1]);
      prev.classList.remove('active');
      prev.classList.add('done');
      const text = prev.textContent;
      prev.textContent = '✓ ' + text.replace(/^[^\s]+\s/, '');
    }
    if (stepIndex < steps.length) {
      document.getElementById(steps[stepIndex]).classList.add('active');
      stepIndex++;
    } else {
      clearInterval(stepInterval);
    }
  }, 700);

  try {
    const formData = new FormData();
    formData.append('jobDescription', jobDescription);

    if (currentTab === 'upload') {
      formData.append('resume', selectedFile);
    } else {
      formData.append('resumeText', resumeText);
    }

    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    clearInterval(stepInterval);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed');
    }

    // Mark all steps done
    steps.forEach(id => {
      const el = document.getElementById(id);
      el.classList.remove('active');
      el.classList.add('done');
    });

    await sleep(500);
    showLoading(false);
    renderResults(data);

  } catch (err) {
    clearInterval(stepInterval);
    showLoading(false);
    showToast(err.message || 'Something went wrong. Please try again.', 'error');
    setAnalyzeButtonState(false);
  }
}

// ── Render Results ─────────────────────────────────────────────────────────────
function renderResults(data) {
  const section = document.getElementById('results-section');
  section.classList.remove('hidden');

  // Scroll to results
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  // Score ring animation
  animateScore(data.finalScore);
  setScoreGrade(data.finalScore);

  // Breakdown bars
  animateBar('bar-ats', 'val-ats', data.ats.score);

  if (data.keywords) {
    document.getElementById('kw-breakdown').classList.remove('hidden');
    animateBar('bar-kw', 'val-kw', data.keywords.matchScore);
  }

  if (data.ai?.estimatedMatchScore) {
    document.getElementById('ai-breakdown').classList.remove('hidden');
    animateBar('bar-ai', 'val-ai', data.ai.estimatedMatchScore);
  }

  // Score meta
  const meta = [];
  if (data.ats.details.wordCount) meta.push(`${data.ats.details.wordCount} words`);
  if (data.keywords) meta.push(`${data.keywords.totalMatched}/${data.keywords.totalJDKeywords} keywords matched`);
  document.getElementById('score-meta').textContent = meta.join(' · ');

  // Strengths
  renderList('strengths-list', data.ats.strengths);
  renderList('warnings-list', data.ats.warnings);

  // Keywords
  if (data.keywords && data.hasJobDescription) {
    document.getElementById('keywords-section').classList.remove('hidden');
    document.getElementById('match-badge').textContent = `${data.keywords.matchScore}% match`;
    renderTags('matched-tags', data.keywords.matchedKeywords, 'matched-tag');
    renderTags('missing-tags', data.keywords.missingKeywords, 'missing-tag');
  }

  // AI Insights
  if (data.ai) {
    document.getElementById('ai-section').classList.remove('hidden');
    renderAIInsights(data.ai);
  } else if (data.hasJobDescription) {
    document.getElementById('ai-nudge').classList.remove('hidden');
  }

  // Sections detected
  renderSections(data.ats.details.sections);

  setAnalyzeButtonState(false);
}

function animateScore(targetScore) {
  const numberEl = document.getElementById('score-number');
  const ring = document.getElementById('ring-progress');
  const circumference = 314.16;

  let current = 0;
  const increment = targetScore / 60;
  const offset = circumference - (targetScore / 100) * circumference;

  // Animate the ring
  setTimeout(() => {
    ring.style.strokeDashoffset = offset;
  }, 100);

  // Animate the number
  const timer = setInterval(() => {
    current = Math.min(current + increment, targetScore);
    numberEl.textContent = Math.round(current);
    if (current >= targetScore) clearInterval(timer);
  }, 25);
}

function setScoreGrade(score) {
  const grade = document.getElementById('score-grade');
  let text, cls;
  if (score >= 80) { text = '🌟 Excellent'; cls = 'grade-excellent'; }
  else if (score >= 65) { text = '✅ Good'; cls = 'grade-good'; }
  else if (score >= 50) { text = '⚡ Fair'; cls = 'grade-fair'; }
  else { text = '⚠️ Needs Work'; cls = 'grade-poor'; }
  grade.textContent = text;
  grade.className = `score-grade ${cls}`;
}

function animateBar(barId, valId, value) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  setTimeout(() => {
    bar.style.width = value + '%';
    val.textContent = value + '%';
  }, 300);
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
  if (!tags || !tags.length) {
    el.innerHTML = `<span class="keyword-tag ${cls}">None found</span>`;
    return;
  }
  tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = `keyword-tag ${cls}`;
    span.textContent = tag;
    el.appendChild(span);
  });
}

function renderAIInsights(ai) {
  // Fit badge
  const fitBadge = document.getElementById('fit-badge');
  const fitMap = {
    'Excellent': ['🌟 Excellent Fit', 'fit-excellent'],
    'Good':      ['✅ Good Fit',      'fit-good'],
    'Fair':      ['⚡ Fair Fit',      'fit-fair'],
    'Poor':      ['⚠️ Poor Fit',     'fit-poor'],
  };
  const [fitText, fitCls] = fitMap[ai.overallFit] || ['Unknown', 'fit-fair'];
  fitBadge.textContent = fitText;
  fitBadge.className = `fit-badge ${fitCls}`;

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

  const icons = {
    contact: '📬', summary: '📝', experience: '💼', education: '🎓',
    skills: '⚙️', certifications: '🏆', projects: '🔨', achievements: '🌟',
  };

  Object.entries(sections).forEach(([name, found]) => {
    const chip = document.createElement('div');
    chip.className = `section-chip ${found ? 'section-found' : 'section-missing'}`;
    chip.innerHTML = `<span>${icons[name] || '📄'}</span><span>${capitalize(name)}</span>`;
    grid.appendChild(chip);
  });
}

// ── UI Helpers ─────────────────────────────────────────────────────────────────
function showLoading(show) {
  document.getElementById('loading-state').classList.toggle('hidden', !show);
  if (show) {
    // Reset loading steps
    ['step-1','step-2','step-3','step-4'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.remove('active', 'done');
    });
    const originalTexts = [
      '📄 Parsing resume content',
      '🔍 Running ATS checks',
      '🎯 Matching keywords',
      '🤖 Generating AI insights',
    ];
    ['step-1','step-2','step-3','step-4'].forEach((id, i) => {
      document.getElementById(id).textContent = originalTexts[i];
    });
  }
}

function hideResults() {
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('keywords-section').classList.add('hidden');
  document.getElementById('ai-section').classList.add('hidden');
  document.getElementById('ai-nudge').classList.add('hidden');
  document.getElementById('kw-breakdown').classList.add('hidden');
  document.getElementById('ai-breakdown').classList.add('hidden');
}

function setAnalyzeButtonState(loading) {
  const btn = document.getElementById('analyze-btn');
  btn.disabled = loading;
  btn.querySelector('.btn-text').textContent = loading ? 'Analyzing...' : 'Analyze Resume';
}

function resetForm() {
  // Reset file
  selectedFile = null;
  document.getElementById('file-input').value = '';
  const dropzone = document.getElementById('dropzone');
  dropzone.classList.remove('has-file', 'drag-over');
  dropzone.querySelector('.dropzone-text').textContent = 'Drop your PDF here';
  document.getElementById('file-info').style.display = 'none';

  // Reset textareas
  document.getElementById('resume-text').value = '';
  document.getElementById('job-description').value = '';

  // Hide results
  hideResults();
  setAnalyzeButtonState(false);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, type = 'info') {
  // Remove existing toast
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: ${type === 'error' ? 'hsl(0,75%,20%)' : 'hsl(228,25%,16%)'};
    border: 1px solid ${type === 'error' ? 'hsl(0,75%,40%)' : 'hsl(259,85%,40%)'};
    color: ${type === 'error' ? 'hsl(0,80%,75%)' : 'hsl(220,20%,90%)'};
    padding: 12px 24px; border-radius: 100px;
    font-size: 0.875rem; font-weight: 500;
    box-shadow: 0 8px 32px hsla(0,0%,0%,0.4);
    z-index: 1000; animation: fade-in-up 0.3s ease;
    backdrop-filter: blur(12px);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
