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

const TAGS_COLLECTION = 'tags';

// Create a new tag
export const createTag = async (tagData) => {
  try {
    const docRef = await addDoc(collection(db, TAGS_COLLECTION), {
      ...tagData,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...tagData };
  } catch (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
};

// Get all tags
export const getTags = async (filters = {}) => {
  try {
    let q = collection(db, TAGS_COLLECTION);

    if (filters.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }

    if (filters.categoryId) {
      q = query(q, where('categoryId', '==', filters.categoryId));
    }

    const querySnapshot = await getDocs(q);
    const tags = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (filters.isActive === undefined || data.isActive === filters.isActive) {
        tags.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      }
    });

    // Sort in memory to avoid index requirements
    tags.sort((a, b) => {
      const sortOrderA = a.sortOrder || 0;
      const sortOrderB = b.sortOrder || 0;
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return tags;
  } catch (error) {
    console.error('Error getting tags:', error);
    throw error;
  }
};

// Get tags by category
export const getTagsByCategory = async (categoryId) => {
  try {
    const q = query(
      collection(db, TAGS_COLLECTION),
      where('categoryId', '==', categoryId),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);
    const tags = [];

    querySnapshot.forEach((doc) => {
      tags.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort in memory to avoid index requirements
    tags.sort((a, b) => {
      const sortOrderA = a.sortOrder || 0;
      const sortOrderB = b.sortOrder || 0;
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return tags;
  } catch (error) {
    console.error('Error getting tags by category:', error);
    throw error;
  }
};

// Get tag by ID
export const getTagById = async (tagId) => {
  try {
    const docRef = doc(db, TAGS_COLLECTION, tagId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting tag by ID:', error);
    throw error;
  }
};

// Update a tag
export const updateTag = async (tagId, newData) => {
  try {
    const tagRef = doc(db, TAGS_COLLECTION, tagId);
    await updateDoc(tagRef, {
      ...newData,
      updatedAt: serverTimestamp(),
    });
    return { id: tagId, ...newData };
  } catch (error) {
    console.error('Error updating tag:', error);
    throw error;
  }
};

// Soft delete a tag
export const deleteTag = async (tagId) => {
  try {
    const tagRef = doc(db, TAGS_COLLECTION, tagId);
    await updateDoc(tagRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
};

// Hard delete a tag
export const hardDeleteTag = async (tagId) => {
  try {
    const tagRef = doc(db, TAGS_COLLECTION, tagId);
    await deleteDoc(tagRef);
  } catch (error) {
    console.error('Error hard deleting tag:', error);
    throw error;
  }
};

// Update tag sort order
export const updateTagSortOrder = async (tagId, newSortOrder) => {
  try {
    const tagRef = doc(db, TAGS_COLLECTION, tagId);
    await updateDoc(tagRef, {
      sortOrder: newSortOrder,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating tag sort order:', error);
    throw error;
  }
};

// Get next sort order for new tag in category
export const getNextTagSortOrder = async (categoryId) => {
  try {
    const tags = await getTagsByCategory(categoryId);
    if (tags.length === 0) return 1;
    
    const maxSortOrder = Math.max(...tags.map(tag => tag.sortOrder || 0));
    return maxSortOrder + 1;
  } catch (error) {
    console.error('Error getting next tag sort order:', error);
    return 1;
  }
};

// Search tags by name
export const searchTags = async (searchTerm, categoryId = null) => {
  try {
    const tags = await getTags({ isActive: true });
    
    if (!searchTerm) {
      return categoryId ? tags.filter(tag => tag.categoryId === categoryId) : tags;
    }
    
    const searchLower = searchTerm.toLowerCase();
    let filteredTags = tags.filter(tag => 
      tag.name.toLowerCase().includes(searchLower) ||
      (tag.description && tag.description.toLowerCase().includes(searchLower))
    );
    
    if (categoryId) {
      filteredTags = filteredTags.filter(tag => tag.categoryId === categoryId);
    }
    
    return filteredTags;
  } catch (error) {
    console.error('Error searching tags:', error);
    throw error;
  }
};

// Get tags with category information
export const getTagsWithCategories = async () => {
  try {
    const tags = await getTags({ isActive: true });
    
    // Group tags by category
    const tagsByCategory = {};
    tags.forEach(tag => {
      if (!tagsByCategory[tag.categoryId]) {
        tagsByCategory[tag.categoryId] = [];
      }
      tagsByCategory[tag.categoryId].push(tag);
    });
    
    return tagsByCategory;
  } catch (error) {
    console.error('Error getting tags with categories:', error);
    throw error;
  }
};

// Validate tag data
export const validateTag = (tagData) => {
  const errors = [];
  
  if (!tagData.name || tagData.name.trim() === '') {
    errors.push('Tag name is required');
  }
  
  if (!tagData.categoryId || tagData.categoryId.trim() === '') {
    errors.push('Category is required');
  }
  
  if (tagData.name && tagData.name.length > 50) {
    errors.push('Tag name must be 50 characters or less');
  }
  
  if (tagData.description && tagData.description.length > 200) {
    errors.push('Tag description must be 200 characters or less');
  }
  
  return errors;
};

// Auto-create Before/After tags for a category
export const createBeforeAfterTags = async (categoryId, createdBy = 'system') => {
  try {
    const beforeAfterTags = [
      {
        name: 'Before',
        categoryId: categoryId,
        description: 'Before transformation image',
        tagType: 'before-after-status',
        createdBy: createdBy
      },
      {
        name: 'After',
        categoryId: categoryId,
        description: 'After transformation image',
        tagType: 'before-after-status',
        createdBy: createdBy
      },
      {
        name: 'In Progress',
        categoryId: categoryId,
        description: 'Work in progress image',
        tagType: 'before-after-status',
        createdBy: createdBy
      }
    ];

    const createdTags = [];
    for (const tagData of beforeAfterTags) {
      const sortOrder = await getNextTagSortOrder(categoryId);
      const tag = await createTag({ 
        ...tagData, 
        sortOrder,
        createdBy 
      });
      createdTags.push(tag);
    }

    return createdTags;
  } catch (error) {
    console.error('Error creating Before/After tags:', error);
    throw error;
  }
};

// Get Before/After tags for a category
export const getBeforeAfterTags = async (categoryId) => {
  try {
    const tags = await getTagsByCategory(categoryId);
    return tags.filter(tag => tag.tagType === 'before-after-status');
  } catch (error) {
    console.error('Error getting Before/After tags:', error);
    throw error;
  }
};

// Get tags by type
export const getTagsByType = async (tagType) => {
  try {
    const tags = await getTags({ isActive: true });
    return tags.filter(tag => tag.tagType === tagType);
  } catch (error) {
    console.error('Error getting tags by type:', error);
    throw error;
  }
};
