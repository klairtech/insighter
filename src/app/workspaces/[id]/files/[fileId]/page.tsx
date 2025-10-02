"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmationModal from "@/components/ConfirmationModal";

interface FileUpload {
  id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  s3_key: string;
  s3_bucket: string;
  workspace_id: string;
  uploaded_by: string;
  processing_status: string;
  processing_error?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
  download_url?: string;
  file_summaries?: {
    id: string;
    summary: string;
    key_points: string[];
    tags: string[];
    llm_model: string;
    created_at: string;
  }[];
}

const FileDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { user, session } = useSupabaseAuth();
  const [file, setFile] = useState<FileUpload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [isEditingKeyPoints, setIsEditingKeyPoints] = useState(false);
  const [editedKeyPoints, setEditedKeyPoints] = useState<string[]>([]);
  const [isUpdatingAnalysis, setIsUpdatingAnalysis] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const workspaceId = params.id as string;
  const fileId = params.fileId as string;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileType: string | undefined) => {
    if (!fileType) return "📁";
    if (fileType.includes("pdf")) return "PDF";
    if (fileType.includes("doc") || fileType.includes("docx")) return "DOC";
    if (fileType.includes("xls") || fileType.includes("xlsx")) return "XLS";
    if (fileType.includes("ppt") || fileType.includes("pptx")) return "PPT";
    if (fileType.includes("image")) return "IMG";
    if (fileType.includes("text")) return "TXT";
    return "FILE";
  };

  const loadFileData = useCallback(async () => {
    if (!user || !workspaceId || !fileId || !session?.access_token) return;

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(
        `/api/workspaces/${workspaceId}/files/${fileId}?t=${Date.now()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "Cache-Control": "no-cache",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ File detail API error:", errorData);
        setError(errorData.error || "Failed to load file data");
        return;
      }

      const data = await response.json();

      setFile(data.file);
      setEditedName(data.file.original_name || data.file.filename);
      if (data.file.file_summaries && data.file.file_summaries.length > 0) {
        const summary = data.file.file_summaries[0];
        setEditedSummary(summary.summary || "");
        setEditedKeyPoints(summary.key_points || []);
      }
    } catch (error) {
      console.error("❌ Error loading file data:", error);
      setError("Failed to load file data");
    } finally {
      setIsLoading(false);
    }
  }, [user, workspaceId, fileId, session?.access_token]);

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameCancel = () => {
    setIsEditingName(false);
    setEditedName(file?.original_name || file?.filename || "");
  };

  const handleNameSave = async () => {
    if (!file || !editedName.trim() || isUpdatingName) return;

    try {
      setIsUpdatingName(true);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/files/${fileId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            original_name: editedName.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update file name");
      }

      setFile((prev) =>
        prev ? { ...prev, original_name: editedName.trim() } : null
      );
      setIsEditingName(false);
      toast.success("File name updated successfully!");
    } catch (error) {
      console.error("Error updating file name:", error);
      toast.error("Failed to update file name");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleSummaryEdit = () => {
    setIsEditingSummary(true);
  };

  const handleSummaryCancel = () => {
    setIsEditingSummary(false);
    setEditedSummary(file?.file_summaries?.[0]?.summary || "");
  };

  const handleSummarySave = async () => {
    if (!file || !editedSummary.trim() || isUpdatingAnalysis) return;

    try {
      setIsUpdatingAnalysis(true);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/files/${fileId}/summary`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            summary: editedSummary.trim(),
            key_points: editedKeyPoints,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update file analysis");
      }

      setFile((prev) => {
        if (!prev) return null;
        const updatedSummaries = [...(prev.file_summaries || [])];
        if (updatedSummaries.length > 0) {
          updatedSummaries[0] = {
            ...updatedSummaries[0],
            summary: editedSummary.trim(),
            key_points: editedKeyPoints,
          };
        }
        return { ...prev, file_summaries: updatedSummaries };
      });

      setIsEditingSummary(false);
      toast.success("File analysis updated successfully!");
    } catch (error) {
      console.error("Error updating file analysis:", error);
      toast.error("Failed to update file analysis");
    } finally {
      setIsUpdatingAnalysis(false);
    }
  };

  const handleKeyPointsEdit = () => {
    setIsEditingKeyPoints(true);
  };

  const handleKeyPointsCancel = () => {
    setIsEditingKeyPoints(false);
    setEditedKeyPoints(file?.file_summaries?.[0]?.key_points || []);
  };

  const handleKeyPointsSave = async () => {
    if (!file || isUpdatingAnalysis) return;

    try {
      setIsUpdatingAnalysis(true);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/files/${fileId}/summary`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            summary: editedSummary,
            key_points: editedKeyPoints,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update file analysis");
      }

      setFile((prev) => {
        if (!prev) return null;
        const updatedSummaries = [...(prev.file_summaries || [])];
        if (updatedSummaries.length > 0) {
          updatedSummaries[0] = {
            ...updatedSummaries[0],
            key_points: editedKeyPoints,
          };
        }
        return { ...prev, file_summaries: updatedSummaries };
      });

      setIsEditingKeyPoints(false);
      toast.success("Key points updated successfully!");
    } catch (error) {
      console.error("Error updating key points:", error);
      toast.error("Failed to update key points");
    } finally {
      setIsUpdatingAnalysis(false);
    }
  };

  const handleDownload = async () => {
    if (!file || !session?.access_token) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/files/${fileId}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_name || file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("File downloaded successfully!");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const handleDelete = () => {
    if (!file || isDeleting) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/files/${fileId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete file");
      }

      toast.success("File deleted successfully!");
      router.push(`/workspaces/${workspaceId}`);
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadFileData();
  }, [loadFileData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading file details...</p>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">File Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error ||
              "The file you're looking for doesn't exist or has been deleted."}
          </p>
          <button
            onClick={() => router.push(`/workspaces/${workspaceId}`)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              <button
                onClick={() => router.push(`/workspaces/${workspaceId}`)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Go to Workspace"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
                  <span className="text-4xl">
                    {getFileIcon(file?.file_type)}
                  </span>
                  <span>{file?.original_name || file?.filename}</span>
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                    File
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <button
              onClick={() => {
                /* TODO: Implement file sharing */
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
              <span>Share</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Download</span>
            </button>

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              {isDeleting ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
              <span>{isDeleting ? "Deleting..." : "Delete"}</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* File Information */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                File Information
              </h2>
              <button
                onClick={handleNameEdit}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                Edit Name
              </button>
            </div>

            {isEditingName ? (
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameSave();
                    if (e.key === "Escape") handleNameCancel();
                  }}
                />
                <button
                  onClick={handleNameSave}
                  disabled={isUpdatingName || !editedName.trim()}
                  className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  title="Save"
                >
                  {isUpdatingName ? (
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <button
                  onClick={handleNameCancel}
                  className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  title="Cancel"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="text-gray-400">Original Name</label>
                  <p className="text-white font-medium">
                    {file.original_name || file.filename}
                  </p>
                </div>
                <div>
                  <label className="text-gray-400">File Type</label>
                  <p className="text-white font-medium">{file.file_type}</p>
                </div>
                <div>
                  <label className="text-gray-400">File Size</label>
                  <p className="text-white font-medium">
                    {formatFileSize(file.file_size)}
                  </p>
                </div>
                <div>
                  <label className="text-gray-400">Uploaded By</label>
                  <p className="text-white font-medium">{file.uploaded_by}</p>
                </div>
                <div>
                  <label className="text-gray-400">Upload Date</label>
                  <p className="text-white font-medium">
                    {formatDate(file.created_at)}
                  </p>
                </div>
                <div>
                  <label className="text-gray-400">Processing Status</label>
                  <p className="text-white font-medium">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        file.processing_status === "completed"
                          ? "bg-green-600 text-white"
                          : file.processing_status === "processing"
                          ? "bg-yellow-600 text-white"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {file.processing_status}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* AI Analysis Section */}
          {file.file_summaries && file.file_summaries.length > 0 && (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  AI Analysis
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">
                    Generated {formatDate(file.file_summaries[0].created_at)}
                  </span>
                  <button
                    onClick={handleSummaryEdit}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Edit Analysis
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-6">
                <h3 className="text-md font-medium text-white mb-3 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Summary
                </h3>
                {isEditingSummary ? (
                  <div className="space-y-3">
                    <textarea
                      value={editedSummary}
                      onChange={(e) => setEditedSummary(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      placeholder="Enter file summary..."
                    />
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSummarySave}
                        disabled={isUpdatingAnalysis || !editedSummary.trim()}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                      >
                        {isUpdatingAnalysis ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleSummaryCancel}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-300 leading-relaxed">
                    {file.file_summaries[0].summary}
                  </p>
                )}
              </div>

              {/* Key Points */}
              <div>
                <h3 className="text-md font-medium text-white mb-3 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Key Points
                </h3>
                {isEditingKeyPoints ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {editedKeyPoints.map((point, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="text"
                            value={point}
                            onChange={(e) => {
                              const newPoints = [...editedKeyPoints];
                              newPoints[index] = e.target.value;
                              setEditedKeyPoints(newPoints);
                            }}
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Key point ${index + 1}`}
                          />
                          <button
                            onClick={() => {
                              const newPoints = editedKeyPoints.filter(
                                (_, i) => i !== index
                              );
                              setEditedKeyPoints(newPoints);
                            }}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          setEditedKeyPoints([...editedKeyPoints, ""])
                        }
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                      >
                        + Add Point
                      </button>
                      <button
                        onClick={handleKeyPointsSave}
                        disabled={isUpdatingAnalysis}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                      >
                        {isUpdatingAnalysis ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleKeyPointsCancel}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {file.file_summaries[0].key_points.map((point, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span className="text-gray-300">{point}</span>
                      </div>
                    ))}
                    <button
                      onClick={handleKeyPointsEdit}
                      className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Edit Key Points
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No AI Analysis Available */}
          {(!file.file_summaries || file.file_summaries.length === 0) && (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  No AI Analysis Available
                </h3>
                <p className="text-gray-400 mb-4">
                  {file.processing_status === "processing"
                    ? "AI analysis is in progress..."
                    : file.processing_status === "failed"
                    ? "AI analysis failed to process this file."
                    : "This file hasn't been analyzed by AI yet."}
                </p>
                {file.processing_status === "completed" && (
                  <button
                    onClick={() => {
                      // TODO: Implement reprocess functionality
                      toast.info("Reprocess functionality will be implemented");
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Generate AI Analysis
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Processing Error */}
          {file.processing_error && (
            <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 backdrop-blur-sm border border-red-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-400 mb-3">
                Processing Error
              </h2>
              <p className="text-red-300">{file.processing_error}</p>
            </div>
          )}
        </div>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${
          file?.original_name || file?.filename
        }"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default FileDetailPage;
