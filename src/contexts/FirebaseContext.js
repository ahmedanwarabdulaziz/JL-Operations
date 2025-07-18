import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const FirebaseContext = createContext();

export const useFirebaseStatus = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebaseStatus must be used within a FirebaseProvider');
  }
  return context;
};

export const FirebaseProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to read from customers collection to verify connection
        // This is more reliable than a test collection
        await getDocs(collection(db, 'customers'));
        setIsConnected(true);
      } catch (error) {
        console.error('Firebase connection check failed:', error);
        // If customers collection doesn't exist, try a simple connection test
        try {
          await getDocs(collection(db, 'test'));
          setIsConnected(true);
        } catch (testError) {
          setIsConnected(false);
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkConnection();
  }, []);

  const value = {
    isConnected,
    isChecking
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}; 