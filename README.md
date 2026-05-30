# ResumeAI — ATS Score & Job Match Analyzer

🚀 **Live Demo**: [https://Jaydee2919.github.io/resume-ats-scorer](https://Jaydee2919.github.io/resume-ats-scorer)

An AI-powered resume ATS scorer that runs **entirely in your browser** — your resume never leaves your device.

## ✨ Features

- 📄 **Resume Upload** — Drag & drop PDF or paste plain text
- 🎯 **ATS Score** — Animated circular gauge (0–100) with section-by-section breakdown
- 🔑 **Keyword Analysis** — Matched vs. missing keywords from the job description
- 📊 **Section Detection** — Automatically checks for contact, experience, education, skills, etc.
- ✅ **Strengths & Issues** — Clear, actionable feedback
- 🤖 **Gemini AI Insights** *(optional, free)* — Deep semantic analysis, skill gaps, and personalized recommendations
- 🔒 **100% Private** — Everything runs in your browser, nothing is sent to any server

## 🚀 How to Use

1. Visit the live site
2. Upload your resume PDF (or paste the text)
3. Paste the job description (optional, enables keyword matching)
4. Click **Analyze Resume**
5. *(Optional)* Click **🔑 Add API Key** and enter your free Gemini API key for AI-powered insights

### Getting a Free Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key and paste it into the **🔑 Add API Key** button in the app
4. Your key is stored only in your browser's localStorage — never sent anywhere except Google's API

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5 + Vanilla CSS + Vanilla JS |
| PDF Parsing | [PDF.js](https://mozilla.github.io/pdf.js/) (CDN, browser-side) |
| AI Analysis | Google Gemini 1.5 Flash API (browser fetch) |
| Hosting | GitHub Pages |

## 📁 Project Structure

```
resume-ats-scorer/
├── index.html    ← Main page
├── style.css     ← Dark glassmorphism design
├── app.js        ← All logic (PDF parsing, scoring, AI)
└── README.md
```

## 🔒 Privacy

- Your resume is **never uploaded** to any server
- PDF parsing happens locally in your browser using PDF.js
- The Gemini API key is stored in `localStorage` on your device only
- AI calls go directly from your browser to Google's API

## 📜 License

MIT
