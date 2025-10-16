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

const CATEGORIES_COLLECTION = 'categories';

// Create a new category
export const createCategory = async (categoryData) => {
  try {
    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
      ...categoryData,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...categoryData };
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
};

// Get all categories
export const getCategories = async (filters = {}) => {
  try {
    let q = collection(db, CATEGORIES_COLLECTION);

    if (filters.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }

    const querySnapshot = await getDocs(q);
    const categories = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (filters.isActive === undefined || data.isActive === filters.isActive) {
        categories.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      }
    });

    // Sort in memory to avoid index requirements
    categories.sort((a, b) => {
      const sortOrderA = a.sortOrder || 0;
      const sortOrderB = b.sortOrder || 0;
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return categories;
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
};

// Get category by ID
export const getCategoryById = async (categoryId) => {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting category by ID:', error);
    throw error;
  }
};

// Update a category
export const updateCategory = async (categoryId, newData) => {
  try {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    await updateDoc(categoryRef, {
      ...newData,
      updatedAt: serverTimestamp(),
    });
    return { id: categoryId, ...newData };
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

// Soft delete a category
export const deleteCategory = async (categoryId) => {
  try {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    await updateDoc(categoryRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Hard delete a category
export const hardDeleteCategory = async (categoryId) => {
  try {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    await deleteDoc(categoryRef);
  } catch (error) {
    console.error('Error hard deleting category:', error);
    throw error;
  }
};

// Update category sort order
export const updateCategorySortOrder = async (categoryId, newSortOrder) => {
  try {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    await updateDoc(categoryRef, {
      sortOrder: newSortOrder,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating category sort order:', error);
    throw error;
  }
};

// Get next sort order for new category
export const getNextSortOrder = async () => {
  try {
    const categories = await getCategories({ isActive: true });
    if (categories.length === 0) return 1;
    
    const maxSortOrder = Math.max(...categories.map(cat => cat.sortOrder || 0));
    return maxSortOrder + 1;
  } catch (error) {
    console.error('Error getting next sort order:', error);
    return 1;
  }
};

// Validate category data
export const validateCategory = (categoryData) => {
  const errors = [];
  
  if (!categoryData.name || categoryData.name.trim() === '') {
    errors.push('Category name is required');
  }
  
  if (!categoryData.color || categoryData.color.trim() === '') {
    errors.push('Category color is required');
  }
  
  if (!categoryData.categoryType || !['normal', 'before-after'].includes(categoryData.categoryType)) {
    errors.push('Category type must be either "normal" or "before-after"');
  }
  
  if (categoryData.name && categoryData.name.length > 50) {
    errors.push('Category name must be 50 characters or less');
  }
  
  if (categoryData.description && categoryData.description.length > 200) {
    errors.push('Category description must be 200 characters or less');
  }
  
  return errors;
};

// Get categories by type
export const getCategoriesByType = async (categoryType) => {
  try {
    const categories = await getCategories({ isActive: true });
    return categories.filter(category => category.categoryType === categoryType);
  } catch (error) {
    console.error('Error getting categories by type:', error);
    throw error;
  }
};

// Get Before/After categories
export const getBeforeAfterCategories = async () => {
  return await getCategoriesByType('before-after');
};

// Get normal categories
export const getNormalCategories = async () => {
  return await getCategoriesByType('normal');
};
