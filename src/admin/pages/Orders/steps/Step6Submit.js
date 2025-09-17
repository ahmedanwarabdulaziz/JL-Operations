import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Paper,
  Alert
} from '@mui/material';
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const Step6Submit = ({ 
  sendEmail, 
  onSendEmailChange, 
  personalInfo, 
  isEditMode = false 
}) => {
  // Gmail is now automatically configured during login

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CheckCircleIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="h5" gutterBottom>
          Ready to {isEditMode ? 'Update' : 'Create'} Order
        </Typography>
      </Box>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        All information has been reviewed. Click "{isEditMode ? 'Update' : 'Create'} Order" to {isEditMode ? 'update' : 'submit'} the order to the database.
      </Typography>

      {/* Email Toggle Section */}
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <EmailIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Email Options
          </Typography>
        </Box>
        
        <FormControlLabel
          control={
            <Switch
              checked={sendEmail}
              onChange={(e) => onSendEmailChange(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Send Order Details Email
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Send a detailed quote email to {personalInfo.email || 'customer'}
              </Typography>
            </Box>
          }
          sx={{ mb: 2 }}
        />
        
        {sendEmail && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              An email with the complete order details and quote will be sent to <strong>{personalInfo.email}</strong> 
              once the order is {isEditMode ? 'updated' : 'created'}.
            </Typography>
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default Step6Submit; 
