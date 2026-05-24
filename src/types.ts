export interface MediaFile {
  id: string;
  name: string;
  size: number;
  type: string; // mime type
  extension: string; // e.g. "jpg", "png", "mp4", "pdf", "mkv"
  file: File;
  previewUrl?: string;
  status: 'Original' | 'Modified' | 'Processing' | 'Saved' | 'Error';
  errorMessage?: string;
  backupId?: string; // id of the backup file if created
  tags: MetadataTags;
  originalTags: MetadataTags;
  isBackedUp: boolean;
}

export interface MetadataTags {
  title?: string;
  authorArtist?: string;
  dateCreated?: string;
  description?: string;
  copyright?: string;
  software?: string;
  latitude?: string; // GPS Latitude decimal string or formatted
  longitude?: string; // GPS Longitude decimal string or formatted
  cameraModel?: string;
  customTags: Record<string, string>; // custom name/value pairs
}

export interface FileBackup {
  id: string;
  fileId: string;
  name: string;
  timestamp: string;
  size: number;
  data: ArrayBuffer; // original binary data
}

export interface ValidationFeedback {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}
