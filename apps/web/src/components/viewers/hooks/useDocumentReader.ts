import { useState, useCallback, useEffect, useRef } from "react";

export type DocumentFormat = "pdf" | "epub";

export interface Bookmark {
  page: number;
  label: string;
  timestamp: string;
}

export interface DocumentReaderState {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  zoom: number;
  bookmarks: Bookmark[];
  isReady: boolean;
}

export interface DocumentReaderControls {
  goToPage: (pageNum: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setZoom: (level: number) => void;
  addBookmark: (page: number, label: string) => void;
  removeBookmark: (page: number) => void;
  reload: () => void;
}

interface UseDocumentReaderOptions {
  documentUrl: string;
  format: DocumentFormat;
  initialPage?: number;
}

export function useDocumentReader({
  documentUrl,
  format,
  initialPage = 1,
}: UseDocumentReaderOptions) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoomLevel] = useState(1.0);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Refs for library instances
  const pdfDocRef = useRef<any>(null);
  const epubBookRef = useRef<any>(null);
  const loadingRef = useRef(false);

  // Load the document
  const loadDocument = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setIsReady(false);

    try {
      if (format === "pdf") {
        // Dynamically import PDF.js
        try {
          const pdfjs = await import("pdfjs-dist");

          // Set worker source
          if (typeof window !== "undefined") {
            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
          }

          // Load the PDF document
          const loadingTask = pdfjs.getDocument(documentUrl);
          const pdf = await loadingTask.promise;

          pdfDocRef.current = pdf;
          setTotalPages(pdf.numPages);
          setCurrentPage(Math.min(initialPage, pdf.numPages));
          setIsReady(true);
        } catch (err) {
          if ((err as any)?.code === "MODULE_NOT_FOUND" || (err as Error)?.message?.includes("Cannot find module")) {
            setError(
              "PDF.js library not installed. Install with: npm install pdfjs-dist"
            );
          } else {
            throw err;
          }
        }
      } else if (format === "epub") {
        // Dynamically import epub.js
        try {
          const ePub = (await import("epubjs")).default;

          // Load the EPUB book
          const book = ePub(documentUrl);
          await book.ready;

          // Get locations (pages)
          const locations = await book.locations.generate(1024);

          epubBookRef.current = book;
          setTotalPages(locations.length || 1);
          setCurrentPage(Math.min(initialPage, locations.length || 1));
          setIsReady(true);
        } catch (err) {
          if ((err as any)?.code === "MODULE_NOT_FOUND" || (err as Error)?.message?.includes("Cannot find module")) {
            setError(
              "epub.js library not installed. Install with: npm install epubjs"
            );
          } else {
            throw err;
          }
        }
      } else {
        setError(`Unsupported document format: ${format}`);
      }
    } catch (err) {
      console.error("Error loading document:", err);
      setError(err instanceof Error ? err.message : "Failed to load document");
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [documentUrl, format, initialPage]);

  // Load document on mount or when URL changes
  useEffect(() => {
    loadDocument();

    // Cleanup
    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      if (epubBookRef.current) {
        epubBookRef.current.destroy();
        epubBookRef.current = null;
      }
    };
  }, [loadDocument]);

  // Navigation controls
  const goToPage = useCallback(
    (pageNum: number) => {
      if (!isReady) return;

      const validPage = Math.max(1, Math.min(pageNum, totalPages));
      setCurrentPage(validPage);

      // Trigger navigation in the library
      if (format === "pdf" && pdfDocRef.current) {
        // PDF page navigation is typically handled by the renderer component
        // This just updates state
      } else if (format === "epub" && epubBookRef.current) {
        // EPUB uses locations
        const locations = epubBookRef.current.locations;
        if (locations && locations.length > 0) {
          const cfi = locations.cfiFromLocation(validPage - 1);
          epubBookRef.current.rendition?.display(cfi);
        }
      }
    },
    [isReady, totalPages, format]
  );

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const setZoom = useCallback((level: number) => {
    const validZoom = Math.max(0.5, Math.min(3.0, level));
    setZoomLevel(validZoom);
  }, []);

  const addBookmark = useCallback(
    (page: number, label: string) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      const newBookmark: Bookmark = {
        page: validPage,
        label,
        timestamp: new Date().toISOString(),
      };

      setBookmarks((prev) => {
        // Remove existing bookmark at the same page
        const filtered = prev.filter((b) => b.page !== validPage);
        // Add new bookmark and sort by page
        return [...filtered, newBookmark].sort((a, b) => a.page - b.page);
      });
    },
    [totalPages]
  );

  const removeBookmark = useCallback((page: number) => {
    setBookmarks((prev) => prev.filter((b) => b.page !== page));
  }, []);

  const reload = useCallback(() => {
    loadDocument();
  }, [loadDocument]);

  const state: DocumentReaderState = {
    currentPage,
    totalPages,
    isLoading,
    error,
    zoom,
    bookmarks,
    isReady,
  };

  const controls: DocumentReaderControls = {
    goToPage,
    nextPage,
    prevPage,
    setZoom,
    addBookmark,
    removeBookmark,
    reload,
  };

  // Return both state and controls, plus the document ref for rendering
  return {
    state,
    controls,
    documentRef: format === "pdf" ? pdfDocRef : epubBookRef,
  };
}
