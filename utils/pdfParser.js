const pdfParse = require('pdf-parse');
const fs = require('fs');

/**
 * Extract text from a PDF file path
 * @param {string} filePath - absolute path to the PDF
 * @returns {Promise<string>} extracted text
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || '';
  } catch (err) {
    console.error('PDF parse error:', err.message);
    throw new Error('Could not extract text from PDF. Make sure the file is not password protected.');
  }
}

module.exports = { extractTextFromPDF };
