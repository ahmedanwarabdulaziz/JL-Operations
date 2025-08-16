import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

const useMaterialCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      const companiesRef = collection(db, 'materialCompanies');
      const q = query(companiesRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      const companiesData = querySnapshot.docs.map((doc, index) => ({
        id: doc.id,
        order: doc.data().order ?? index, // Use existing order or fallback to index
        ...doc.data()
      }));
      
      // Sort by order field to respect the manual drag-and-drop order
      companiesData.sort((a, b) => a.order - b.order);
      
      setCompanies(companiesData);
    } catch (err) {
      console.error('Error fetching material companies:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  return {
    companies,
    loading,
    error,
    refetch: fetchCompanies
  };
};

export default useMaterialCompanies; 