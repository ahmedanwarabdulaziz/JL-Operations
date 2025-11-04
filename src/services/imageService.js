import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Collection name for image metadata
const IMAGES_COLLECTION = 'website_images';

// Image metadata structure
export const createImageMetadata = (imageData) => ({
  name: imageData.name || '',
  originalName: imageData.originalName || '',
  cloudinaryPublicId: imageData.public_id || '',
  cloudinaryUrl: imageData.secure_url || '',
  cloudinaryUrlTransformed: imageData.secure_url || '',
  alt: imageData.alt || imageData.name?.replace(/\.[^/.]+$/, "") || '',
  description: imageData.description || '',
  dimensions: imageData.dimensions || '',
  fileSize: imageData.bytes || 0,
  format: imageData.format || '',
  width: imageData.width || 0,
  height: imageData.height || 0,
  uploadedBy: imageData.uploadedBy || '',
  uploadedAt: serverTimestamp(),
  lastModified: serverTimestamp(),
  isActive: true,
  // Tag system
  tags: imageData.tags || {}, // Object with categoryId as key and tagId as value
  // Future fields for advanced features
  usage: [], // Track where this image is used
  downloads: 0,
  views: 0,
  featured: false,
  // SEO fields
  seoTitle: imageData.seoTitle || '',
  seoDescription: imageData.seoDescription || '',
  // Organization fields
  folder: imageData.folder || 'root',
  collection: imageData.collection || 'default'
});

// Save image metadata to Firebase
export const saveImageMetadata = async (imageData) => {
  try {
    const metadata = createImageMetadata(imageData);
    const docRef = await addDoc(collection(db, IMAGES_COLLECTION), metadata);
    return { id: docRef.id, ...metadata };
  } catch (error) {
    console.error('Error saving image metadata:', error);
    throw error;
  }
};

// Get all images with optional filtering
export const getImages = async (filters = {}) => {
  try {
    let q = collection(db, IMAGES_COLLECTION);
    
    // Apply filters - but avoid composite queries that need indexes
    if (filters.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }
    
    // Note: We'll sort in memory to avoid index requirements
    const querySnapshot = await getDocs(q);
    const images = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Apply isActive filter in memory if not already filtered
      if (filters.isActive === undefined || data.isActive === filters.isActive) {
        images.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    // Sort by upload date (newest first) in memory
    images.sort((a, b) => {
      const dateA = a.uploadedAt?.toDate?.() || new Date(0);
      const dateB = b.uploadedAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
    
    return images;
  } catch (error) {
    console.error('Error getting images:', error);
    throw error;
  }
};

// Get image by ID
export const getImageById = async (imageId) => {
  try {
    const docRef = doc(db, IMAGES_COLLECTION, imageId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error('Image not found');
    }
  } catch (error) {
    console.error('Error getting image by ID:', error);
    throw error;
  }
};

// Update image metadata
export const updateImageMetadata = async (imageId, updates) => {
  try {
    const docRef = doc(db, IMAGES_COLLECTION, imageId);
    await updateDoc(docRef, {
      ...updates,
      lastModified: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating image metadata:', error);
    throw error;
  }
};


// Delete image metadata (hard delete - completely remove from Firebase)
export const deleteImageMetadata = async (imageId) => {
  try {
    const docRef = doc(db, IMAGES_COLLECTION, imageId);
    await deleteDoc(docRef);
    console.log('Successfully deleted image metadata from Firebase:', imageId);
    return true;
  } catch (error) {
    console.error('Error deleting image metadata:', error);
    throw error;
  }
};

// Search images by name
export const searchImages = async (searchTerm, filters = {}) => {
  try {
    const images = await getImages(filters);
    
    if (!searchTerm) {
      return images;
    }
    
    const searchLower = searchTerm.toLowerCase();
    
    return images.filter(image => 
      image.name.toLowerCase().includes(searchLower) ||
      image.alt.toLowerCase().includes(searchLower) ||
      image.description.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error('Error searching images:', error);
    throw error;
  }
};

// Get images by category
export const getImagesByCategory = async (category) => {
  try {
    const q = query(
      collection(db, IMAGES_COLLECTION),
      where('category', '==', category),
      where('isActive', '==', true),
      orderBy('uploadedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const images = [];
    
    querySnapshot.forEach((doc) => {
      images.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return images;
  } catch (error) {
    console.error('Error getting images by category:', error);
    throw error;
  }
};

// Update image tags (replaces tags, supports arrays per category for multiple tags from same category)
export const updateImageTags = async (imageId, newTags) => {
  try {
    const docRef = doc(db, IMAGES_COLLECTION, imageId);
    
    // Convert newTags to ensure arrays are properly formatted
    const formattedTags = {};
    Object.entries(newTags).forEach(([categoryId, tagValue]) => {
      // Ensure tagValue is always an array (supporting multiple tags per category)
      if (Array.isArray(tagValue)) {
        formattedTags[categoryId] = tagValue.filter(t => t); // Remove null/undefined
      } else if (tagValue) {
        formattedTags[categoryId] = [tagValue];
      }
    });
    
    await updateDoc(docRef, {
      tags: formattedTags,
      lastModified: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating image tags:', error);
    throw error;
  }
};

// Get images by tags
export const getImagesByTags = async (tagFilters = {}) => {
  try {
    const images = await getImages({ isActive: true });
    
    if (Object.keys(tagFilters).length === 0) {
      return images;
    }
    
    return images.filter(image => {
      // Check if image has all required tags (support both old and new format)
      return Object.entries(tagFilters).every(([categoryId, tagId]) => {
        if (!image.tags || !image.tags[categoryId]) return false;
        
        const imageTagValue = image.tags[categoryId];
        // Handle both old format (single tagId) and new format (array of tagIds)
        if (Array.isArray(imageTagValue)) {
          return imageTagValue.includes(tagId);
        } else {
          return imageTagValue === tagId;
        }
      });
    });
  } catch (error) {
    console.error('Error getting images by tags:', error);
    throw error;
  }
};

// Bulk update image tags
export const bulkUpdateImageTags = async (imageIds, tags) => {
  try {
    const batch = writeBatch(db);
    
    imageIds.forEach(imageId => {
      const docRef = doc(db, IMAGES_COLLECTION, imageId);
      batch.update(docRef, {
        tags: tags,
        lastModified: serverTimestamp()
      });
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error bulk updating image tags:', error);
    throw error;
  }
};

// Get all unique categories
export const getImageCategories = async () => {
  try {
    const images = await getImages();
    const categories = [...new Set(images.map(img => img.category))];
    return categories.sort();
  } catch (error) {
    console.error('Error getting image categories:', error);
    throw error;
  }
};

