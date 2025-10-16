import { Cloudinary } from '@cloudinary/url-gen';
import CryptoJS from 'crypto-js';

// Cloudinary configuration for frontend use
const CLOUDINARY_CONFIG = {
  cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'ddajmhqxm',
  apiKey: process.env.REACT_APP_CLOUDINARY_API_KEY || '575976478374339',
  uploadPreset: process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'ml_default'
};

// Create Cloudinary instance
const cld = new Cloudinary({
  cloud: {
    cloudName: CLOUDINARY_CONFIG.cloudName
  }
});

export default CLOUDINARY_CONFIG;
export { cld };

// Helper function to upload image to Cloudinary using signed requests
export const uploadImageToCloudinary = async (file, options = {}, onProgress = null) => {
  return new Promise((resolve, reject) => {
    // Generate timestamp and signature for signed upload
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = process.env.REACT_APP_CLOUDINARY_API_SECRET || 'yEYgZC2YKYRrZT7P0onJuyD8Djk';
    
    // Create upload parameters
    const uploadParams = {
      timestamp: timestamp,
      folder: options.folder || 'website-images'
    };
    
    // Generate signature for upload
    const signature = generateSignature(uploadParams, apiSecret);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
    formData.append('folder', uploadParams.folder);

    // Add any additional options
    if (options.public_id) {
      formData.append('public_id', options.public_id);
    }
    if (options.tags) {
      formData.append('tags', options.tags.join(','));
    }

    // Use XMLHttpRequest for better progress tracking and performance
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        console.log(`Upload progress: ${progress.toFixed(2)}%`);
        // Call the progress callback if provided
        if (onProgress) {
          onProgress(progress);
        }
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          console.log('Cloudinary upload successful:', data.public_id);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid response from Cloudinary'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error?.message || 'Upload failed'));
        } catch (error) {
          reject(new Error('Upload failed'));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`);
    xhr.send(formData);
  });
};

// Helper function to delete image from Cloudinary using signed requests
export const deleteImageFromCloudinary = async (publicId) => {
  try {
    // For signed deletion, we need to generate a signature
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = process.env.REACT_APP_CLOUDINARY_API_SECRET || 'yEYgZC2YKYRrZT7P0onJuyD8Djk';
    
    // Generate signature for destroy request
    const signature = generateSignature({
      public_id: publicId,
      timestamp: timestamp
    }, apiSecret);
    
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/destroy`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to delete image from Cloudinary');
    }
    
    const result = await response.json();
    console.log('Successfully deleted image from Cloudinary:', publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Helper function to generate Cloudinary signature
const generateSignature = (params, apiSecret) => {
  // Sort parameters and create string to sign
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const stringToSign = sortedParams + apiSecret;
  
  // Generate SHA-1 hash
  const signature = CryptoJS.SHA1(stringToSign).toString();
  
  return signature;
};

// Helper function to get image URL with transformations
export const getCloudinaryImageUrl = (publicId, transformations = {}) => {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  
  if (Object.keys(transformations).length === 0) {
    return `${baseUrl}/${publicId}`;
  }
  
  const transformString = Object.entries(transformations)
    .map(([key, value]) => `${key}_${value}`)
    .join(',');
  
  return `${baseUrl}/${transformString}/${publicId}`;
};
