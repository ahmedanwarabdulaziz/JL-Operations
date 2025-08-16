import React, { useState } from 'react';
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material';
import { useFirebaseStatus } from '../../contexts/FirebaseContext';
import { useFirebase } from '../../hooks/useFirebase';

const FirebaseTest = () => {
  const { isConnected, isChecking } = useFirebaseStatus();
  const { addDocument, getDocuments, loading } = useFirebase();
  const [testResult, setTestResult] = useState(null);

  const runTest = async () => {
    try {
      // Test writing to Firestore
      const testData = {
        testField: 'Hello Firebase!',
        timestamp: new Date().toISOString()
      };
      
      const docRef = await addDocument('test', testData);
      setTestResult({
        success: true,
        message: `Successfully wrote document with ID: ${docRef.id}`,
        docId: docRef.id
      });

      // Test reading from Firestore
      const documents = await getDocuments('test');
      console.log('Test documents:', documents);
      
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error.message}`
      });
    }
  };

  if (isChecking) {
    return (
      <Box display="flex" alignItems="center" gap={2}>
        <CircularProgress size={20} />
        <Typography>Checking Firebase connection...</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Typography variant="h6" gutterBottom>
        Firebase Connection Test
      </Typography>
      
      <Alert 
        severity={isConnected ? "success" : "error"} 
        sx={{ mb: 2 }}
      >
        {isConnected 
          ? "Firebase is connected successfully!" 
          : "Firebase connection failed. Check your configuration."
        }
      </Alert>

      {isConnected && (
        <Box>
          <Button 
            variant="contained" 
            onClick={runTest}
            disabled={loading}
            sx={{ mb: 2 }}
          >
            {loading ? "Running Test..." : "Run Firestore Test"}
          </Button>

          {testResult && (
            <Alert severity={testResult.success ? "success" : "error"}>
              {testResult.message}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default FirebaseTest; 