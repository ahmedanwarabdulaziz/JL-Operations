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
import { useGmailAuth } from '../../../shared/contexts/GmailAuthContext';

const Step6Submit = ({ 
  sendEmail, 
  onSendEmailChange, 
  personalInfo, 
  isEditMode = false 
}) => {
  const { gmailSignedIn, gmailUser } = useGmailAuth();

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
        
        {/* Gmail Sign-in Status */}
        {!gmailSignedIn ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              To send emails, please sign in with Gmail using the button in the header.
            </Typography>
          </Alert>
        ) : (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Gmail signed in as <strong>{gmailUser?.email || 'Gmail User'}</strong>
            </Typography>
          </Alert>
        )}
        
        <FormControlLabel
          control={
            <Switch
              checked={sendEmail}
              onChange={(e) => onSendEmailChange(e.target.checked)}
              color="primary"
              disabled={!gmailSignedIn}
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
        
        {sendEmail && !gmailSignedIn && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Please sign in with Google to enable email sending.
            </Typography>
          </Alert>
        )}
        
        {sendEmail && gmailSignedIn && (
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
