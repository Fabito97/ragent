/**
 * Extract the original filename from a UUID-prefixed filename.
 * Example: "87183737_Atomic Habits.pdf" -> "Atomic Habits.pdf"
 */
export function extractFilename(prefixedFilename: string): string {
  const parts = prefixedFilename.split('_');
  // If there's only one part or it doesn't match UUID pattern, return as is
  if (parts.length < 2) return prefixedFilename;
  // Remove the first part (UUID) and rejoin the rest
  return parts.slice(1).join('_');
}

/**
 * Get file extension from filename.
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return filename.substring(lastDotIndex + 1).toLowerCase();
}

/**
 * Get a friendly name for the file extension.
 */
export function getExtensionLabel(extension: string): string {
  const labels: Record<string, string> = {
    pdf: 'PDF',
    txt: 'Text',
    csv: 'CSV',
    xlsx: 'Excel',
    xls: 'Excel',
  };
  return labels[extension.toLowerCase()] || extension.toUpperCase();
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format timestamp for display.
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}
