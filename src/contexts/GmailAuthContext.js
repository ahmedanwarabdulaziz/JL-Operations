import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  isSignedIn, 
  getCurrentUser, 
  signOut as signOutService, 
  loadEmailConfig 
} from '../services/emailService';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

const GmailAuthContext = createContext();

export const useGmailAuth = () => {
  const context = useContext(GmailAuthContext);
  if (!context) {
    throw new Error('useGmailAuth must be used within a GmailAuthProvider');
  }
  return context;
};

export const GmailAuthProvider = ({ children }) => {
  const [gmailSignedIn, setGmailSignedIn] = useState(false);
  const [gmailUser, setGmailUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState(null);

  // Check if email is configured on app load
  useEffect(() => {
    const checkEmailConfig = () => {
      const config = loadEmailConfig();
      
      if (config.isConfigured) {
        setGmailSignedIn(true);
        setGmailUser({
          email: config.email,
          name: 'Configured User',
          picture: null
        });
      } else {
        setGmailSignedIn(false);
        setGmailUser(null);
      }
    };

    // Check immediately
    checkEmailConfig();

    // Also check after a short delay to ensure services are loaded
    const timer = setTimeout(checkEmailConfig, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in with Firebase, check if email is configured
        const config = loadEmailConfig();
        if (config.isConfigured) {
          setGmailSignedIn(true);
          setGmailUser({
            email: config.email,
            name: firebaseUser.displayName || 'Configured User',
            picture: firebaseUser.photoURL
          });
        } else {
          setGmailSignedIn(false);
          setGmailUser(null);
        }
      } else {
        // User signed out of Firebase
        setGmailSignedIn(false);
        setGmailUser(null);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      // Check if email is configured
      const config = loadEmailConfig();
      if (!config.isConfigured) {
        throw new Error('Email not configured. Please set up email settings first.');
      }
      
      setGmailSignedIn(true);
      setGmailUser({
        email: config.email,
        name: 'Configured User',
        picture: null
      });
      
      return {
        email: config.email,
        name: 'Configured User',
        picture: null
      };
    } catch (error) {
      setSignInError(error.message);
      throw error;
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = () => {
    signOutService();
    setGmailSignedIn(false);
    setGmailUser(null);
    setSignInError(null);
  };

  const value = {
    gmailSignedIn,
    gmailUser,
    signingIn,
    signInError,
    signIn,
    signOut
  };

  return (
    <GmailAuthContext.Provider value={value}>
      {children}
    </GmailAuthContext.Provider>
  );
}; 