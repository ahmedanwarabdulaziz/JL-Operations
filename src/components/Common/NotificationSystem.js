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
import { buttonStyles } from '../../styles/buttonStyles';

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
    showConfirm,
    confirmDialogOpen: confirmDialog.open
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
        sx={{
          '& .MuiDialog-paper': {
            zIndex: 99999,
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            margin: 0,
            maxWidth: '500px',
            width: '90%'
          },
          '& .MuiBackdrop-root': {
            zIndex: 99998
          }
        }}
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
          <Button onClick={handleConfirmClose} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} sx={buttonStyles.primaryButton} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </NotificationContext.Provider>
  );
}; 