import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Container,
  CircularProgress,
  TextField,
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { useAuth } from './AuthContext';

const LoginPage = ({ onLoginSuccess }) => {
  const { loginWithPin } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginWithPin(pin);
      onLoginSuccess?.({ displayName: 'Admin', uid: 'admin' });
    } catch (err) {
      const message = err?.message || err?.code || 'Login failed';
      setError(message.replace('authWithPin/', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            width: '100%',
            maxWidth: 400,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3, color: '#000000', fontWeight: 'bold' }}>
            JL Operation
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Enter PIN to access your dashboard
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type="password"
              label="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={loading}
              autoComplete="off"
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 }}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} sx={{ color: '#000000' }} /> : <LockIcon sx={{ color: '#000000' }} />}
              disabled={loading || !pin.trim()}
              sx={{
                width: '100%',
                py: 2,
                background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                color: '#000000 !important',
                border: '3px solid #4CAF50',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 6px 12px rgba(0,0,0,0.3)',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': {
                  background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                  border: '3px solid #45a049',
                  color: '#000000 !important'
                },
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Only authorized users can access this application
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
