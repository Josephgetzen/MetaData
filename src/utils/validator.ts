import { MetadataTags, ValidationFeedback } from '../types';

export function validateMetadata(tags: MetadataTags): ValidationFeedback {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // Latitude validation
  if (tags.latitude) {
    const lat = parseFloat(tags.latitude);
    if (isNaN(lat)) {
      errors.latitude = 'Latitude must be a valid number (e.g. 40.7128 or -12.3456).';
    } else if (lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be between -90° and +90°.';
    }
  }

  // Longitude validation
  if (tags.longitude) {
    const lon = parseFloat(tags.longitude);
    if (isNaN(lon)) {
      errors.longitude = 'Longitude must be a valid number (e.g. -74.0060 or 151.2093).';
    } else if (lon < -180 || lon > 180) {
      errors.longitude = 'Longitude must be between -180° and +180°.';
    }
  }

  // Date created validation
  if (tags.dateCreated) {
    const dateStr = tags.dateCreated.trim();
    // common formats: YYYY:MM:DD HH:MM:SS (EXIF) or YYYY-MM-DD (ISO)
    const exifRegex = /^\d{4}:\d{2}:\d{2}\s\d{2}:\d{2}:\d{2}$/;
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

    if (!exifRegex.test(dateStr) && !isoRegex.test(dateStr) && !datetimeLocalRegex.test(dateStr) && isNaN(Date.parse(dateStr))) {
      warnings.dateCreated = 'Format looks unconventional. For images, "YYYY:MM:DD HH:MM:SS" is recommended.';
    }
  }

  // Title lengths
  if (tags.title && tags.title.length > 255) {
    warnings.title = 'Title is extremely long (> 255 chars). Some players may truncate.';
  }

  // Author lengths
  if (tags.authorArtist && tags.authorArtist.length > 150) {
    warnings.authorArtist = 'Author/Artist name is quite long (> 150 chars).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
}
