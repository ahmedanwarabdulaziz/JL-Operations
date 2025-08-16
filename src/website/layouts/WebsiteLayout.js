import React from 'react';
import { Box, Container } from '@mui/material';
import WebsiteHeader from '../components/WebsiteHeader';
import WebsiteFooter from '../components/WebsiteFooter';

const WebsiteLayout = ({ children }) => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <WebsiteHeader />
      <Box component="main" sx={{ flex: 1 }}>
        {children}
      </Box>
      <WebsiteFooter />
    </Box>
  );
};

export default WebsiteLayout;
