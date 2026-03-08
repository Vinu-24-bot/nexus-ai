/**
 * Client-side resume text extraction.
 * Handles PDF (via pdfjs-dist), TXT, MD files without needing the backend.
 */
import * as pdfjsLib from "pdfjs-dist";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

  if (ext === ".txt" || ext === ".md") {
    return await file.text();
  }

  if (ext === ".pdf") {
    return await extractTextFromPDF(file);
  }

  if (ext === ".doc" || ext === ".docx") {
    // For DOC/DOCX we still need the backend, but provide a helpful fallback
    return "";
  }

  return "";
}

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(" ");
      textParts.push(pageText);
    }

    return textParts.join("\n\n").trim();
  } catch (err) {
    console.error("PDF extraction failed:", err);
    return "";
  }
}
