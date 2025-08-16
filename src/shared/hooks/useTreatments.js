import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export const useTreatments = () => {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTreatments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const treatmentsRef = collection(db, 'treatments');
      const treatmentsQuery = query(treatmentsRef, orderBy('treatmentKind'));
      const treatmentsSnapshot = await getDocs(treatmentsQuery);
      const treatmentsData = treatmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTreatments(treatmentsData);
    } catch (err) {
      console.error('Error fetching treatments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTreatments();
  }, [fetchTreatments]);

  return {
    treatments,
    loading,
    error,
    refetch: fetchTreatments
  };
}; 