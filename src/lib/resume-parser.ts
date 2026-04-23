/**
 * Client-side resume text extraction (BATS ForgePro God Mode).
 * Handles complex multi-column PDFs via spatial coordinate reconstruction.
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
    // For DOC/DOCX we rely on the backend, but provide a helpful fallback string
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
      
      // 🛡️ GOD MODE: Spatial Coordinate Grouping
      // Fixes multi-column layouts and fragmented text by sorting by X/Y coordinates
      const items = content.items as any[];
      const lines: { [y: string]: any[] } = {};
      
      for (const item of items) {
        if (!item.str || item.str.trim() === "") continue;
        
        // Extract X and Y coordinates from the pdfjs transform matrix
        const y = Math.round(item.transform[5]); 
        const x = Math.round(item.transform[4]);
        
        // Handle slight vertical offsets (like superscripts or misaligned fonts)
        let assignedY = y;
        for (const existingY in lines) {
          if (Math.abs(parseInt(existingY) - y) < 6) {
            assignedY = parseInt(existingY);
            break;
          }
        }
        
        if (!lines[assignedY]) lines[assignedY] = [];
        lines[assignedY].push({ text: item.str, x });
      }

      // Sort Y coordinates descending (PDF Y=0 is the bottom of the page)
      const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
      
      const pageText = sortedY.map(y => {
        // Sort items in this line by X coordinate (left to right)
        const lineItems = lines[y].sort((a, b) => a.x - b.x);
        
        // Reconstruct the line, maintaining visual spacing for columns
        let lineString = "";
        let lastX = -1;
        
        for (const item of lineItems) {
          // If there is a massive gap between words, it's a new column
          if (lastX !== -1 && (item.x - lastX) > 40) {
            lineString += " | "; 
          } else {
            lineString += " ";
          }
          lineString += item.text;
          lastX = item.x + (item.text.length * 4); // Approximate width
        }
        
        return lineString.replace(/\s{2,}/g, ' ').trim();
      }).join("\n");

      textParts.push(pageText);
    }

    return textParts.join("\n\n").trim();
  } catch (err) {
    console.error("PDF spatial extraction failed, attempting raw rip fallback:", err);
    // 🛡️ GOD MODE FALLBACK: If the PDF is corrupted, rip the raw string text
    try {
      const rawText = await file.text();
      const cleanText = rawText.replace(/[^\x20-\x7E\n\r\t]/g, " ");
      return cleanText.replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }
}