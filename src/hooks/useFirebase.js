import { useState } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const useFirebase = () => {
  const [loading, setLoading] = useState(false);

  const addDocument = async (collectionName, data) => {
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateDocument = async (collectionName, docId, data) => {
    setLoading(true);
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (collectionName, docId) => {
    setLoading(true);
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getDocuments = async (collectionName) => {
    setLoading(true);
    try {
      // First try to get documents with createdAt ordering
      try {
        const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const documents = [];
        querySnapshot.forEach((doc) => {
          documents.push({
            id: doc.id,
            ...doc.data()
          });
        });
        return documents;
      } catch (orderError) {
        // If ordering fails (no createdAt field), get documents without ordering
        console.log('Ordering failed, getting documents without order:', orderError);
        const querySnapshot = await getDocs(collection(db, collectionName));
        const documents = [];
        querySnapshot.forEach((doc) => {
          documents.push({
            id: doc.id,
            ...doc.data()
          });
        });
        return documents;
      }
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocuments
  };
}; 