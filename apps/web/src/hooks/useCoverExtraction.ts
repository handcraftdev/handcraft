"use client";

/**
 * Client-side cover extraction for books and comics
 * Supports EPUB and PDF files
 */

export interface ExtractedCover {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Extract cover from an EPUB file
 * EPUBs are ZIP files with cover images referenced in the OPF metadata
 */
export async function extractEpubCover(file: File): Promise<ExtractedCover | null> {
  try {
    const ePub = (await import("epubjs")).default;

    // Load the EPUB from the file
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);

    await book.ready;

    // Try to get the cover URL from the book
    const coverUrl = await book.coverUrl();

    if (!coverUrl) {
      // Try alternative: look for cover in resources
      const resources = book.resources;
      // @ts-ignore - accessing internal resources
      const resourceList = resources?.resources || [];
      const coverResource = Object.values(resourceList).find((r: any) =>
        r.type?.startsWith('image/') &&
        (r.href?.toLowerCase().includes('cover') || r.id?.toLowerCase().includes('cover'))
      );

      if (!coverResource) {
        book.destroy();
        return null;
      }
    }

    if (coverUrl) {
      // Fetch the cover image
      const response = await fetch(coverUrl);
      const blob = await response.blob();

      // Get image dimensions
      const dimensions = await getImageDimensions(blob);

      book.destroy();

      return {
        blob,
        width: dimensions.width,
        height: dimensions.height,
      };
    }

    book.destroy();
    return null;
  } catch (error) {
    console.error("[CoverExtraction] EPUB extraction error:", error);
    return null;
  }
}

/**
 * Extract first page from a PDF as cover
 * Uses pdf.js to render the first page to a canvas
 */
export async function extractPdfCover(file: File): Promise<ExtractedCover | null> {
  try {
    const pdfjs = await import("pdfjs-dist");

    // Set worker source
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

    // Load the PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    // Get the first page
    const page = await pdf.getPage(1);

    // Set scale for good quality thumbnail (target ~1200px width)
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1200 / viewport.width, 1600 / viewport.height, 2);
    const scaledViewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not get canvas context");
    }

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Render the page
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas,
    }).promise;

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create blob"));
        },
        "image/jpeg",
        0.9
      );
    });

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.error("[CoverExtraction] PDF extraction error:", error);
    return null;
  }
}

/**
 * Extract cover from a book/comic file
 * Automatically detects file type and uses appropriate extraction method
 */
export async function extractCover(file: File): Promise<ExtractedCover | null> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  // EPUB detection
  if (
    mimeType === "application/epub+zip" ||
    fileName.endsWith(".epub")
  ) {
    return extractEpubCover(file);
  }

  // PDF detection
  if (
    mimeType === "application/pdf" ||
    fileName.endsWith(".pdf")
  ) {
    return extractPdfCover(file);
  }

  // CBZ/CBR (comic archives) - these are ZIP/RAR files with images
  // For now, return null - could be implemented later
  if (fileName.endsWith(".cbz") || fileName.endsWith(".cbr")) {
    console.log("[CoverExtraction] CBZ/CBR not yet supported");
    return null;
  }

  return null;
}

/**
 * Convert ExtractedCover to a File object for upload
 */
export function coverToFile(cover: ExtractedCover, originalFileName: string): File {
  const baseName = originalFileName.replace(/\.[^/.]+$/, "");
  const fileName = `${baseName}_cover.jpg`;

  return new File([cover.blob], fileName, { type: "image/jpeg" });
}

/**
 * Get dimensions of an image blob
 */
function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
