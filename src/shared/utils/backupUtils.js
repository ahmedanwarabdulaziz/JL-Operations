import CryptoJS from 'crypto-js';

/**
 * Generate a backup ID in JL-YYYY-MM-DD-HH-MM-SS format
 * @returns {string} Backup ID
 */
export const generateBackupId = () => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  return `JL-${dateStr}-${timeStr}`;
};

/**
 * Encrypt backup data using AES-256 encryption
 * @param {Object} data - Data to encrypt
 * @param {string} password - Encryption password
 * @returns {string} Encrypted data as base64 string
 */
export const encryptBackupData = (data, password) => {
  if (!password || !password.trim()) {
    throw new Error('Password is required for encryption');
  }
  
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, password).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt backup data');
  }
};

/**
 * Decrypt backup data using AES-256 decryption
 * @param {string} encryptedData - Encrypted data as base64 string
 * @param {string} password - Decryption password
 * @returns {Object} Decrypted data object
 */
export const decryptBackupData = (encryptedData, password) => {
  if (!password || !password.trim()) {
    throw new Error('Password is required for decryption');
  }
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, password);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error('Invalid password or corrupted data');
    }
    
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption error:', error);
    if (error.message === 'Invalid password or corrupted data') {
      throw error;
    }
    throw new Error('Failed to decrypt backup data. Please check your password.');
  }
};

/**
 * Generate SHA-256 checksum for data integrity verification
 * @param {Object} data - Data to generate checksum for
 * @returns {Promise<string>} SHA-256 checksum
 */
export const generateChecksum = async (data) => {
  try {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Checksum generation error:', error);
    throw new Error('Failed to generate checksum');
  }
};

/**
 * Validate backup file structure and checksum
 * @param {Object} backupData - Backup data object
 * @param {Object} metadata - Backup metadata
 * @returns {Object} Validation result with isValid and errors
 */
export const validateBackupFile = async (backupData, metadata) => {
  const errors = [];
  
  // Check if backupData has required structure
  if (!backupData || typeof backupData !== 'object') {
    errors.push('Invalid backup data structure');
    return { isValid: false, errors };
  }
  
  // Check if metadata exists
  if (!metadata) {
    errors.push('Missing backup metadata');
    return { isValid: false, errors };
  }
  
  // Validate metadata structure
  if (!metadata.backupId || !metadata.timestamp || !metadata.version) {
    errors.push('Invalid metadata structure');
  }
  
  // Check if collections match metadata
  if (metadata.collections) {
    const dataCollections = Object.keys(backupData);
    const metadataCollections = Object.keys(metadata.collections);
    
    if (dataCollections.length !== metadataCollections.length) {
      errors.push('Collection count mismatch between data and metadata');
    }
    
    // Check document counts
    for (const collectionName of metadataCollections) {
      const expectedCount = metadata.collections[collectionName];
      const actualCount = Array.isArray(backupData[collectionName]) 
        ? backupData[collectionName].length 
        : 0;
      
      if (expectedCount !== actualCount) {
        errors.push(`Document count mismatch for ${collectionName}: expected ${expectedCount}, got ${actualCount}`);
      }
    }
  }
  
  // Validate checksum if provided
  if (metadata.checksum) {
    try {
      const currentChecksum = await generateChecksum(backupData);
      if (currentChecksum !== metadata.checksum) {
        errors.push('Checksum validation failed - data may be corrupted');
      }
    } catch (error) {
      errors.push('Failed to validate checksum');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
export const formatBackupSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Sanitize file name to prevent path traversal
 * @param {string} fileName - File name to sanitize
 * @returns {string} Sanitized file name
 */
export const sanitizeFileName = (fileName) => {
  // Remove path separators and dangerous characters
  return fileName
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .trim();
};

/**
 * Check if a file is encrypted based on its structure
 * @param {any} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
export const isEncrypted = (data) => {
  // Encrypted data from crypto-js is typically a base64 string
  if (typeof data === 'string') {
    // Check if it looks like base64 and is long enough to be encrypted
    return /^[A-Za-z0-9+/=]+$/.test(data) && data.length > 100;
  }
  return false;
};

/**
 * Parse backup file content (handles both JSON and encrypted formats)
 * @param {string} fileContent - File content as string
 * @param {string} password - Optional password for decryption
 * @returns {Object} Parsed backup data
 */
export const parseBackupFile = async (fileContent, password = null) => {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(fileContent);
    
    // Check if it's encrypted
    if (isEncrypted(parsed) || (typeof parsed === 'string' && isEncrypted(parsed))) {
      if (!password) {
        throw new Error('This backup file is encrypted. Please provide a password.');
      }
      return decryptBackupData(parsed, password);
    }
    
    // Check if it's a structured backup with metadata
    if (parsed.metadata && parsed.data) {
      return parsed.data;
    }
    
    // Otherwise, assume it's the data directly
    return parsed;
  } catch (error) {
    // If JSON parsing fails, try decryption if password provided
    if (password) {
      try {
        return decryptBackupData(fileContent, password);
      } catch (decryptError) {
        throw new Error('Failed to parse backup file. Invalid format or incorrect password.');
      }
    }
    throw new Error('Failed to parse backup file. Invalid JSON format.');
  }
};
