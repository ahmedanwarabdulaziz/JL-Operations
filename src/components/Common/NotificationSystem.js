import React, { createContext, useContext, useState } from 'react';
import {
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const showSuccess = (message) => {
    setSnackbar({
      open: true,
      message,
      severity: 'success'
    });
  };

  const showError = (message) => {
    setSnackbar({
      open: true,
      message,
      severity: 'error'
    });
  };

  const showConfirm = (title, message) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        open: true,
        title,
        message,
        onConfirm: resolve
      });
    });
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleConfirmClose = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm(false); // User cancelled
    }
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm(true); // User confirmed
    }
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const value = {
    showSuccess,
    showError,
    showConfirm
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleConfirmClose}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirm} color="error" variant="contained" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </NotificationContext.Provider>
  );
}; 