import type { ContentType } from "./types";
import { LIMITS } from "../constants";

/**
 * Determine content type from MIME type
 */
export function getContentType(mimeType: string): ContentType {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/json") return "json";
  return "other";
}

/**
 * Validate file size against limits
 */
export function validateFileSize(
  file: File,
  contentType: ContentType
): { valid: boolean; error?: string } {
  const sizeMB = file.size / (1024 * 1024);

  switch (contentType) {
    case "video":
      if (sizeMB > LIMITS.MAX_VIDEO_SIZE_MB) {
        return {
          valid: false,
          error: `Video must be under ${LIMITS.MAX_VIDEO_SIZE_MB}MB`,
        };
      }
      break;
    case "audio":
      if (sizeMB > LIMITS.MAX_AUDIO_SIZE_MB) {
        return {
          valid: false,
          error: `Audio must be under ${LIMITS.MAX_AUDIO_SIZE_MB}MB`,
        };
      }
      break;
    case "image":
      if (sizeMB > LIMITS.MAX_IMAGE_SIZE_MB) {
        return {
          valid: false,
          error: `Image must be under ${LIMITS.MAX_IMAGE_SIZE_MB}MB`,
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Get video duration from file
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Get audio duration from file
 */
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error("Failed to load audio metadata"));
    };

    audio.src = URL.createObjectURL(file);
  });
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get video dimensions from file
 */
export function getVideoDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Generate thumbnail from video file
 */
export function generateVideoThumbnail(
  file: File,
  seekTime = 1 // seconds into video
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTime, video.duration);
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to generate thumbnail"));
          }
        },
        "image/jpeg",
        0.8
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video"));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Resize image to max dimensions while maintaining aspect ratio
 */
export function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to resize image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if content is short-form video (< 3 minutes)
 */
export function isShortFormVideo(durationSeconds: number): boolean {
  return durationSeconds <= LIMITS.SHORT_VIDEO_MAX_SECONDS;
}
