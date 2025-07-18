import React from 'react';
import {
  Box,
  Typography,
  Alert
} from '@mui/material';

const Step3Timeline = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Timeline & Milestones
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Define the project timeline and key milestones.
      </Typography>
      <Alert severity="info">
        Timeline step will be implemented in the next iteration.
      </Alert>
    </Box>
  );
};

export default Step3Timeline; 