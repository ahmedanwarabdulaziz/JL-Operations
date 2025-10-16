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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

const FURNITURE_PIECES_COLLECTION = 'furniturePieces';

// Create a new furniture piece
export const createFurniturePiece = async (furnitureData) => {
  try {
    const docRef = await addDoc(collection(db, FURNITURE_PIECES_COLLECTION), {
      ...furnitureData,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...furnitureData };
  } catch (error) {
    console.error('Error creating furniture piece:', error);
    throw error;
  }
};

// Get all furniture pieces
export const getFurniturePieces = async (filters = {}) => {
  try {
    let q = collection(db, FURNITURE_PIECES_COLLECTION);

    if (filters.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }

    const querySnapshot = await getDocs(q);
    const furniturePieces = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (filters.isActive === undefined || data.isActive === filters.isActive) {
        furniturePieces.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      }
    });

    // Sort by creation date (newest first)
    furniturePieces.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    return furniturePieces;
  } catch (error) {
    console.error('Error getting furniture pieces:', error);
    throw error;
  }
};

// Get furniture piece by ID
export const getFurniturePieceById = async (pieceId) => {
  try {
    const docRef = doc(db, FURNITURE_PIECES_COLLECTION, pieceId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting furniture piece by ID:', error);
    throw error;
  }
};

// Update a furniture piece
export const updateFurniturePiece = async (pieceId, newData) => {
  try {
    const pieceRef = doc(db, FURNITURE_PIECES_COLLECTION, pieceId);
    await updateDoc(pieceRef, {
      ...newData,
      updatedAt: serverTimestamp(),
    });
    return { id: pieceId, ...newData };
  } catch (error) {
    console.error('Error updating furniture piece:', error);
    throw error;
  }
};

// Delete a furniture piece
export const deleteFurniturePiece = async (pieceId) => {
  try {
    const pieceRef = doc(db, FURNITURE_PIECES_COLLECTION, pieceId);
    await deleteDoc(pieceRef);
  } catch (error) {
    console.error('Error deleting furniture piece:', error);
    throw error;
  }
};

// Assign image to furniture piece
export const assignImageToFurniturePiece = async (pieceId, imageData) => {
  try {
    const piece = await getFurniturePieceById(pieceId);
    if (!piece) {
      throw new Error('Furniture piece not found');
    }

    const updatedImages = piece.images || [];
    
    // Check if image is already assigned
    const existingImageIndex = updatedImages.findIndex(img => img.imageId === imageData.imageId);
    
    if (existingImageIndex >= 0) {
      // Update existing assignment
      updatedImages[existingImageIndex] = {
        ...updatedImages[existingImageIndex],
        ...imageData,
        assignedAt: new Date()
      };
    } else {
      // Add new assignment
      updatedImages.push({
        ...imageData,
        assignedAt: new Date()
      });
    }

    await updateFurniturePiece(pieceId, { images: updatedImages });
    return { id: pieceId, images: updatedImages };
  } catch (error) {
    console.error('Error assigning image to furniture piece:', error);
    throw error;
  }
};

// Remove image from furniture piece
export const removeImageFromFurniturePiece = async (pieceId, imageId) => {
  try {
    const piece = await getFurniturePieceById(pieceId);
    if (!piece) {
      throw new Error('Furniture piece not found');
    }

    const updatedImages = (piece.images || []).filter(img => img.imageId !== imageId);
    await updateFurniturePiece(pieceId, { images: updatedImages });
    return { id: pieceId, images: updatedImages };
  } catch (error) {
    console.error('Error removing image from furniture piece:', error);
    throw error;
  }
};

// Get furniture pieces with before/after images
export const getFurniturePiecesWithImages = async () => {
  try {
    const pieces = await getFurniturePieces({ isActive: true });
    
    // Filter pieces that have images assigned
    return pieces.filter(piece => piece.images && piece.images.length > 0);
  } catch (error) {
    console.error('Error getting furniture pieces with images:', error);
    throw error;
  }
};

// Search furniture pieces
export const searchFurniturePieces = async (searchTerm) => {
  try {
    const pieces = await getFurniturePieces({ isActive: true });
    
    if (!searchTerm) {
      return pieces;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return pieces.filter(piece => 
      piece.name?.toLowerCase().includes(searchLower) ||
      piece.description?.toLowerCase().includes(searchLower) ||
      piece.furnitureType?.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error('Error searching furniture pieces:', error);
    throw error;
  }
};

// Validate furniture piece data
export const validateFurniturePiece = (pieceData) => {
  const errors = [];
  
  if (!pieceData.name || pieceData.name.trim() === '') {
    errors.push('Furniture piece name is required');
  }
  
  if (!pieceData.furnitureType || pieceData.furnitureType.trim() === '') {
    errors.push('Furniture type is required');
  }
  
  if (pieceData.name && pieceData.name.length > 100) {
    errors.push('Furniture piece name must be 100 characters or less');
  }
  
  if (pieceData.description && pieceData.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }
  
  return errors;
};

// Get images assigned to furniture pieces by status
export const getImagesByStatus = async (status = null) => {
  try {
    const pieces = await getFurniturePiecesWithImages();
    const allImages = [];
    
    pieces.forEach(piece => {
      if (piece.images) {
        piece.images.forEach(image => {
          if (!status || image.status === status) {
            allImages.push({
              ...image,
              furniturePieceId: piece.id,
              furniturePieceName: piece.name,
              furnitureType: piece.furnitureType
            });
          }
        });
      }
    });
    
    return allImages;
  } catch (error) {
    console.error('Error getting images by status:', error);
    throw error;
  }
};

// Get furniture pieces with image counts
export const getFurniturePiecesWithCounts = async () => {
  try {
    const pieces = await getFurniturePieces({ isActive: true });
    
    return pieces.map(piece => ({
      ...piece,
      imageCount: piece.images ? piece.images.length : 0,
      beforeCount: piece.images ? piece.images.filter(img => img.status === 'before').length : 0,
      afterCount: piece.images ? piece.images.filter(img => img.status === 'after').length : 0,
      inProgressCount: piece.images ? piece.images.filter(img => img.status === 'in progress').length : 0
    }));
  } catch (error) {
    console.error('Error getting furniture pieces with counts:', error);
    throw error;
  }
};

// Generate a unique furniture piece ID
export const generateFurnitureId = () => {
  return `FP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Add image to furniture piece (alias for assignImageToFurniturePiece)
export const addImageToFurniturePiece = async (pieceId, imageData) => {
  return await assignImageToFurniturePiece(pieceId, imageData);
};