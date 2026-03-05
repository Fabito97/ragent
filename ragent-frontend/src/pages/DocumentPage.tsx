import React, { useState } from 'react';
import { Upload, Zap } from 'lucide-react';
import { DocumentCard } from '../components/documents/DocumentCard';
import { DocumentDetailsSidebar } from '../components/documents/DocumentDetailsSidebar';
import {
  useGetDocumentsQuery,
  useGetDocumentByIdQuery,
  useDeleteDocumentMutation,
  useReingestDocumentMutation,
} from '../store/api/documentsApi';
import AddDocumentModal from '../components/AddDocumentModal';

const DocumentPage = () => {
  const [isDocsModalOpen, setDocsModalOpen] = useState(false);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);

  // Fetch documents list
  const { data: documentsData, isLoading: isLoadingDocs, refetch: refetchDocs } =
    useGetDocumentsQuery();

  // Fetch selected document details
  const { data: selectedDocumentData, isLoading: isLoadingDetail } =
    useGetDocumentByIdQuery(selectedFilename || '', {
      skip: !selectedFilename,
    });

  // Document mutations
  const [deleteDocument, { isLoading: isDeleting }] =
    useDeleteDocumentMutation();
  const [reingestDocument, { isLoading: isReingesting }] =
    useReingestDocumentMutation();

  // Handle delete
  const handleDelete = async (filename: string) => {
    try {
      await deleteDocument(filename).unwrap();
      if (selectedFilename === filename) {
        setSelectedFilename(null);
      }
      refetchDocs();
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete document');
    }
  };

  // Handle reingest
  const handleReingest = async (filename: string) => {
    try {
      await reingestDocument(filename).unwrap();
      refetchDocs();
      // Refresh the selected document details if it's the current one
      if (selectedFilename === filename) {
        // Re-query the document details
      }
    } catch (err) {
      console.error('Failed to reingest document:', err);
      alert('Failed to reingest document');
    }
  };

  // Handle download
  const handleDownload = (filename: string) => {
    // Create a download link
    const link = document.createElement('a');
    link.href = `http://127.0.0.1:8000/documents/${filename}/download`;
    link.download = filename;
    link.click();
  };

  const documents = documentsData?.documents || [];
  const totalChunks = documentsData?.total_chunks || 0;

  return (
    <div className="min-h-screen flex flex-col">     

      {/* Documents Grid */}
      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-6 py-8 pt-12">
        {isLoadingDocs ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading documents...</p>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <Zap size={48} className="text-gray-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-300 mb-2">
              No documents yet
            </h2>
            <p className="text-gray-500 mb-6">
              Upload your first document to get started
            </p>
            <button
              onClick={() => setDocsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <Upload size={20} />
              Upload Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {documents.map((document) => {
              // For the currently selected document, use its details
              
              const fileOnDisk =
                selectedFilename === document.filename && selectedDocumentData
                  ? selectedDocumentData.file_on_disk
                  : true; // Assume on disk by default

              return (
                <DocumentCard
                  key={document.filename}
                  filename={document.filename}
                  totalChunks={document.chunks}
                  fileOnDisk={fileOnDisk}
                  onSelect={setSelectedFilename}
                  onDelete={handleDelete}
                  onReingest={handleReingest}
                  onDownload={handleDownload}
                  isDeleting={isDeleting}
                  isReingesting={isReingesting}
                />
              );
            })} 
          </div>
        )}
      </div>

      {/* Document Details Sidebar */}
      {selectedFilename && (
        <DocumentDetailsSidebar
          document={selectedDocumentData || null}
          isLoading={isLoadingDetail}
          onClose={() => setSelectedFilename(null)}
        />
      )}

      {/* Upload Modal */}
      <AddDocumentModal
        isOpen={isDocsModalOpen}
        onClose={() => setDocsModalOpen(false)}
      />
    </div>
  );
};

export default DocumentPage;