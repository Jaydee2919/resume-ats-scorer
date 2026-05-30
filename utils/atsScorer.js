const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── ATS Section Keywords ────────────────────────────────────────────────────
const SECTION_PATTERNS = {
  contact:     /(\b(email|phone|mobile|linkedin|github|address|location)\b)/i,
  summary:     /\b(summary|objective|profile|about me|overview)\b/i,
  experience:  /\b(experience|work history|employment|career|professional background)\b/i,
  education:   /\b(education|degree|university|college|bachelor|master|phd|gpa)\b/i,
  skills:      /\b(skills|technologies|tools|proficiencies|competencies|languages)\b/i,
  certifications: /\b(certification|certificate|certified|license|accreditation)\b/i,
  projects:    /\b(projects|portfolio|work samples)\b/i,
  achievements: /\b(achievement|award|honor|recognition|accomplishment)\b/i,
};

const ACTION_VERBS = [
  'achieved','built','created','designed','developed','delivered','engineered',
  'improved','increased','launched','led','managed','optimized','reduced',
  'spearheaded','implemented','coordinated','established','executed','generated',
  'grew','mentored','negotiated','produced','resolved','streamlined','transformed',
  'accelerated','collaborated','conceptualized','drove','expanded','facilitated',
];

const QUANTIFIER_PATTERNS = [
  /\d+%/,           // percentages
  /\$[\d,]+/,       // dollar amounts
  /\d+x/i,          // multipliers
  /\d+[\+]?\s*(users|clients|employees|team|projects|products)/i,
  /increased|decreased|reduced|improved|grew/i,
];

// ─── Rule-Based ATS Scoring ──────────────────────────────────────────────────
function computeATSScore(resumeText) {
  const text = resumeText.toLowerCase();
  const lines = resumeText.split('\n').filter(l => l.trim());

  let score = 0;
  const details = {};
  const warnings = [];
  const strengths = [];

  // 1. Sections check (30 pts total)
  const sectionScores = {};
  for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
    const found = pattern.test(resumeText);
    sectionScores[section] = found;
    if (found && ['contact','experience','education','skills','summary'].includes(section)) {
      score += 6;
      strengths.push(`✓ ${capitalize(section)} section detected`);
    } else if (!found && ['contact','experience','education','skills'].includes(section)) {
      warnings.push(`⚠ Missing or unclear "${capitalize(section)}" section`);
    }
  }
  details.sections = sectionScores;

  // 2. Contact info check (10 pts)
  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i.test(resumeText);
  const hasPhone = /(\+?\d[\d\s\-().]{7,}\d)/i.test(resumeText);
  const hasLinkedIn = /linkedin\.com/i.test(resumeText);
  if (hasEmail) { score += 4; strengths.push('✓ Email address found'); }
  else warnings.push('⚠ No email address detected');
  if (hasPhone) { score += 3; strengths.push('✓ Phone number found'); }
  else warnings.push('⚠ No phone number detected');
  if (hasLinkedIn) { score += 3; strengths.push('✓ LinkedIn profile linked'); }
  details.contact = { hasEmail, hasPhone, hasLinkedIn };

  // 3. Action verbs (15 pts)
  const usedVerbs = ACTION_VERBS.filter(v => new RegExp(`\\b${v}`, 'i').test(resumeText));
  const verbScore = Math.min(15, Math.round((usedVerbs.length / ACTION_VERBS.length) * 30));
  score += verbScore;
  details.actionVerbs = { used: usedVerbs, count: usedVerbs.length };
  if (usedVerbs.length >= 8) strengths.push(`✓ Strong action verbs (${usedVerbs.length} found)`);
  else warnings.push(`⚠ Use more action verbs (found ${usedVerbs.length}, aim for 8+)`);

  // 4. Quantified achievements (15 pts)
  const quantMatches = QUANTIFIER_PATTERNS.filter(p => p.test(resumeText));
  const quantScore = Math.min(15, quantMatches.length * 3);
  score += quantScore;
  details.quantified = quantMatches.length;
  if (quantMatches.length >= 3) strengths.push('✓ Good use of numbers & metrics');
  else warnings.push('⚠ Add more quantified achievements (numbers, %, $)');

  // 5. Length & formatting (10 pts)
  const wordCount = resumeText.split(/\s+/).length;
  if (wordCount >= 300 && wordCount <= 800) { score += 5; strengths.push(`✓ Good resume length (${wordCount} words)`); }
  else if (wordCount > 800) warnings.push(`⚠ Resume may be too long (${wordCount} words)`);
  else warnings.push(`⚠ Resume seems too short (${wordCount} words)`);

  const hasBullets = /[•\-\*]\s/.test(resumeText);
  if (hasBullets) { score += 5; strengths.push('✓ Uses bullet points'); }
  else warnings.push('⚠ Consider using bullet points for readability');

  // 6. File format bonus (already uploaded PDF = good)
  score += 10;
  strengths.push('✓ PDF format (ATS-friendly)');
  details.wordCount = wordCount;

  return {
    score: Math.min(100, score),
    strengths,
    warnings,
    details,
  };
}

// ─── Keyword Matching (JD vs Resume) ────────────────────────────────────────
function extractKeywords(text) {
  // Remove common stopwords and short words
  const stopwords = new Set(['the','and','for','are','but','not','you','all','any',
    'can','had','her','was','one','our','out','day','get','has','him','his','how',
    'man','new','now','old','see','two','way','who','boy','did','its','let','put',
    'say','she','too','use','with','that','this','from','they','have','been','will',
    'about','after','also','back','down','each','from','good','into','just','know',
    'like','look','make','more','most','move','much','need','only','open','other',
    'over','same','some','take','than','them','then','there','these','time','when',
    'well','were','what','work','your','year','which']);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s\+\#\.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));

  // Count frequency
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  // Sort by frequency, return top unique keywords
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([word]) => word);
}

function computeKeywordMatch(resumeText, jobDescription) {
  const jdKeywords = extractKeywords(jobDescription);
  const resumeWords = new Set(extractKeywords(resumeText));

  const matched = jdKeywords.filter(k => resumeWords.has(k));
  const missing = jdKeywords.filter(k => !resumeWords.has(k)).slice(0, 20);

  const matchScore = jdKeywords.length > 0
    ? Math.round((matched.length / Math.min(jdKeywords.length, 30)) * 100)
    : 0;

  return {
    matchScore: Math.min(100, matchScore),
    matchedKeywords: matched.slice(0, 25),
    missingKeywords: missing,
    totalJDKeywords: jdKeywords.length,
    totalMatched: matched.length,
  };
}

// ─── Gemini AI Insights ──────────────────────────────────────────────────────
async function getGeminiInsights(resumeText, jobDescription) {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an expert ATS (Applicant Tracking System) analyst and career coach.

Analyze the following RESUME against the JOB DESCRIPTION and provide detailed insights.

RESUME:
${resumeText.substring(0, 3000)}

JOB DESCRIPTION:
${jobDescription.substring(0, 2000)}

Respond ONLY with a valid JSON object in this exact format:
{
  "overallFit": "Excellent|Good|Fair|Poor",
  "fitSummary": "2-3 sentence summary of how well the candidate fits",
  "topStrengths": ["strength1", "strength2", "strength3"],
  "skillGaps": ["gap1", "gap2", "gap3"],
  "recommendations": ["specific action 1", "specific action 2", "specific action 3", "specific action 4"],
  "missingKeySkills": ["skill1", "skill2", "skill3"],
  "atsOptimizationTips": ["tip1", "tip2", "tip3"],
  "estimatedMatchScore": 75
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (err) {
    console.error('Gemini AI error:', err.message);
    return null;
  }
}

// ─── Main Analyzer ───────────────────────────────────────────────────────────
async function analyzeResume(resumeText, jobDescription) {
  const atsResult = computeATSScore(resumeText);
  let keywordResult = null;
  let aiInsights = null;

  if (jobDescription && jobDescription.trim().length > 20) {
    keywordResult = computeKeywordMatch(resumeText, jobDescription);
    aiInsights = await getGeminiInsights(resumeText, jobDescription);
  }

  // Composite final score
  let finalScore = atsResult.score;
  if (keywordResult) {
    finalScore = Math.round(atsResult.score * 0.6 + keywordResult.matchScore * 0.4);
  }
  if (aiInsights?.estimatedMatchScore) {
    finalScore = Math.round(
      atsResult.score * 0.4 +
      (keywordResult?.matchScore || 0) * 0.3 +
      aiInsights.estimatedMatchScore * 0.3
    );
  }

  return {
    finalScore: Math.min(100, finalScore),
    ats: atsResult,
    keywords: keywordResult,
    ai: aiInsights,
    hasJobDescription: !!(jobDescription && jobDescription.trim().length > 20),
    hasAI: !!aiInsights,
  };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { analyzeResume };
