import React, { useRef, useState } from 'react';
import {
  FileText,
  Download,
  MoreVertical,
  RefreshCw,
  Trash2,
  LogOut,
} from 'lucide-react';
import {
  extractFilename,
  getFileExtension,
  getExtensionLabel,
} from '../../utils/fileUtils';

interface DocumentCardProps {
  filename: string;
  totalChunks: number;
  fileOnDisk: boolean;
  onSelect: (filename: string) => void;
  onDelete: (filename: string) => Promise<void>;
  onReingest: (filename: string) => Promise<void>;
  onDownload: (filename: string) => void;
  isDeleting?: boolean;
  isReingesting?: boolean;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  filename,
  totalChunks,
  fileOnDisk,
  onSelect,
  onDelete,
  onReingest,
  onDownload,
  isDeleting = false,
  isReingesting = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cleanFilename = extractFilename(filename);
  const extension = getFileExtension(cleanFilename);
  const extensionLabel = getExtensionLabel(extension);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (window.confirm(`Delete "${cleanFilename}"?`)) {
      await onDelete(filename);
      setMenuOpen(false);
    }
  };

  const handleReingest = async () => {
    if (
      window.confirm(
        `Re-ingest "${cleanFilename}"? This will refresh the chunks.`
      )
    ) {
      await onReingest(filename);
      setMenuOpen(false);
    }
  };

  const handleDownload = () => {
    onDownload(filename);
    setMenuOpen(false);
  };

  return (
    <div
      className="flex flex-col items-center p-4 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-900/90 transition-colors relative group"
      onClick={() => onSelect(filename)}
    >
      {/* File Icon */}
      <div className="mb-3 relative">
        <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
          <FileText size={32} className="text-white" />
        </div>
        <div className="absolute top-0 right-0 bg-gray-600 rounded-full px-2 py-1 text-xs font-bold text-white">
          {extensionLabel}
        </div>
      </div>

      {/* Filename */}
      <h3 className="text-sm font-semibold text-gray-100 text-center truncate w-full mb-2">
        {cleanFilename}
      </h3>

      {/* Chunk count */}
      <p className="text-xs text-gray-400 mb-3">{totalChunks} chunks</p>

      {/* Status indicator */}
      {!fileOnDisk && (
        <div className="absolute top-2 left-2">
          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
            File Not Available
          </span>
        </div>
      )}

      {/* Context Menu Button */}
      <div className="absolute top-2 right-2 opacity- group-hover:opacity-100 transition-opacity" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="bg-gray-800 hover:bg-gray-800/90 p-2 rounded transition-colors"
          disabled={isDeleting || isReingesting}
        >
          <MoreVertical size={16} className="text-gray-300" />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={!fileOnDisk}
              title={!fileOnDisk ? 'File not on disk' : ''}
            >
              <Download size={14} />
              Download
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReingest();
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={isReingesting}
            >
              <RefreshCw
                size={14}
                className={isReingesting ? 'animate-spin' : ''}
              />
              {isReingesting ? 'Reingesting...' : 'Reingest'}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-2 transition-colors disabled:opacity-50"
              disabled={isDeleting}
            >
              <Trash2 size={14} />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
