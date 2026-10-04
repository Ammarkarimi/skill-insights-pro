
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileUpload: (files: FileList, extractedInfo?: any) => void;

  acceptedTypes?: string;
  multiple?: boolean;
  className?: string;
  maxFiles?: number;
  extractTechStack?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  acceptedTypes = '.pdf',
  multiple = false,
  className,
  maxFiles = 5,
  extractTechStack = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const extractTechStackFromResume = async (file) => {
    setIsProcessing(true);
    
    try {
      // Create FormData to send the file
      const formData = new FormData();
      formData.append('resume', file);
      
      // Call the backend endpoint to extract tech stack
      const response = await fetch('http://127.0.0.1:5000/extract_tech_stack', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to extract tech stack from resume');
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return {
        techStack: data.techStack || [],
        category: data.category || 'Technology'
      };
    } catch (error) {
      console.error('Error extracting tech stack:', error);
      toast({
        title: "Error",
        description: "Failed to extract tech stack from your resume. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFiles = async (files: FileList) => {
    setError(null);
    
    // Check if exceeding max files limit
    if (multiple && files.length + uploadedFiles.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} files.`);
      return;
    }
    
    // Check file types
    const types = acceptedTypes.split(',');
    const newFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!types.some(type => type.trim() === fileExtension || type.trim() === file.type)) {
        setError(`File '${file.name}' is not a supported file type.`);
        return;
      }
      
      newFiles.push(file);
    }
    
    const updatedFiles = multiple 
      ? [...uploadedFiles, ...newFiles]
      : newFiles;
    
    setUploadedFiles(updatedFiles);
    
    // If tech stack extraction is enabled, process the file
    if (extractTechStack && newFiles.length > 0) {
      setIsProcessing(true);
      const techStackInfo = await extractTechStackFromResume(newFiles[0]);
      setIsProcessing(false);
      
      // Call the onFileUpload callback with the extracted tech stack
      onFileUpload(files, techStackInfo);
    } else {
      // Regular file upload without extraction
      onFileUpload(files);
    }
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary",
          isProcessing ? "opacity-70 pointer-events-none" : "",
          "flex flex-col items-center justify-center"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
          accept={acceptedTypes}
          multiple={multiple}
        />
        
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
            <p className="text-sm text-gray-500">Processing your resume...</p>
          </div>
        ) : (
          <>
            <Upload size={36} className="text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-700 mb-1">
              {multiple ? 'Upload your files' : 'Upload your file'}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-gray-400">
              {acceptedTypes.split(',').join(', ')} files are supported
              {multiple && ` (max ${maxFiles} files)`}
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files</h4>
          <ul className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <li key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="text-gray-500 hover:text-red-500"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload;