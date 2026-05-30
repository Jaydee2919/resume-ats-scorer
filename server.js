require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { extractTextFromPDF } = require('./utils/pdfParser');
const { analyzeResume } = require('./utils/atsScorer');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── File Upload Setup ───────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, `resume_${Date.now()}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

// ─── API Routes ──────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiEnabled: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Main analyze endpoint — accepts PDF upload + optional job description
app.post('/api/analyze', upload.single('resume'), async (req, res) => {
  let filePath = null;

  try {
    const jobDescription = req.body.jobDescription || '';
    let resumeText = '';

    // Option 1: PDF file uploaded
    if (req.file) {
      filePath = req.file.path;
      resumeText = await extractTextFromPDF(filePath);
    }
    // Option 2: Plain text pasted
    else if (req.body.resumeText) {
      resumeText = req.body.resumeText;
    }
    else {
      return res.status(400).json({ error: 'Please provide a resume (PDF file or text).' });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume text is too short or could not be extracted.' });
    }

    const result = await analyzeResume(resumeText, jobDescription);

    res.json({
      success: true,
      ...result,
    });

  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed. Please try again.' });
  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Resume ATS Scorer running at http://localhost:${PORT}`);
  console.log(`🤖 AI Mode: ${process.env.GEMINI_API_KEY ? '✅ Gemini AI enabled' : '⚠️  Rule-based only (add GEMINI_API_KEY to .env)'}`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
