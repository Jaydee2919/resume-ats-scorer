# ResumeAI — ATS Score & Job Match Analyzer

A full-stack Node.js web application that scores your resume against ATS (Applicant Tracking System) criteria and provides AI-powered matching insights when compared with a job description.

## ✨ Features

- 📄 **Resume Upload** — Drag & drop PDF or paste plain text
- 🎯 **ATS Score** — Animated circular gauge (0–100) with detailed breakdown
- 🔑 **Keyword Analysis** — Matched vs. missing keywords from the job description
- 📊 **Section Detection** — Checks for contact, experience, education, skills, etc.
- ✅ **Strengths & Issues** — Clear list of what's working and what needs fixing
- 🤖 **Gemini AI Insights** *(optional)* — Deep semantic analysis, skill gap detection, and personalized recommendations
- 🌙 **Premium Dark UI** — Glassmorphism design with smooth animations

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Optional: add your Gemini API key for AI-powered insights
# Get a free key at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_key_here

PORT=3000
```

### 3. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🤖 AI Mode (Gemini)

Without a Gemini API key, the app runs in **rule-based mode** — still very useful!

With a key added to `.env`, you get:
- Deep semantic matching between resume and job description
- Personalized improvement recommendations
- Skill gap analysis
- ATS optimization tips

Get a **free** Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikey).

## 📁 Project Structure

```
resume-ats-scorer/
├── server.js          ← Express backend
├── utils/
│   ├── pdfParser.js   ← PDF text extraction
│   └── atsScorer.js   ← Scoring engine + Gemini AI
├── public/
│   ├── index.html     ← Single-page frontend
│   ├── style.css      ← Dark glassmorphism UI
│   └── app.js         ← Frontend logic
├── .env.example       ← Environment template
└── package.json
```

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| PDF Parsing | pdf-parse |
| File Upload | multer |
| AI Scoring | Google Gemini 1.5 Flash |
| Frontend | HTML5 + Vanilla CSS + JS |

## 🔒 Privacy

Your resume file is **deleted immediately** after analysis. No data is stored on the server.

## 📜 License

MIT
