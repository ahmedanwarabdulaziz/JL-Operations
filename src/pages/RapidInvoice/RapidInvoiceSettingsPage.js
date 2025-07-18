import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Button,
  Grid,
  Paper,
  Divider,
  Alert,
  Chip
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon } from '@mui/icons-material';

const RapidInvoiceSettingsPage = () => {
  // Default field configurations for fast order step 2
  const [fieldSettings, setFieldSettings] = useState({
    // Order Details
    billInvoice: { enabled: true, label: 'Bill Invoice', category: 'Order Details' },
    description: { enabled: true, label: 'Description', category: 'Order Details' },
    platform: { enabled: false, label: 'Platform', category: 'Order Details' },
    startDate: { enabled: true, label: 'Start Date', category: 'Order Details' },
    timeline: { enabled: false, label: 'Timeline', category: 'Order Details' },
    
    // Furniture Details
    furnitureType: { enabled: true, label: 'Furniture Type', category: 'Furniture' },
    
    // Material Group (grouped toggle)
    materialGroup: { enabled: true, label: 'Material Section', category: 'Material', isGroup: true },
    materialCompany: { enabled: true, label: 'Material Company', category: 'Material', parentGroup: 'materialGroup' },
    materialCode: { enabled: true, label: 'Material Code', category: 'Material', parentGroup: 'materialGroup' },
    materialQnty: { enabled: true, label: 'Material Quantity', category: 'Material', parentGroup: 'materialGroup' },
    materialPrice: { enabled: true, label: 'Material Price', category: 'Material', parentGroup: 'materialGroup' },
    
    // Labour Group (grouped toggle)
    labourGroup: { enabled: true, label: 'Labour Section', category: 'Labour', isGroup: true },
    labourPrice: { enabled: true, label: 'Labour Price', category: 'Labour', parentGroup: 'labourGroup' },
    labourNote: { enabled: false, label: 'Labour Note', category: 'Labour', parentGroup: 'labourGroup' },
    labourQnty: { enabled: true, label: 'Labour Quantity', category: 'Labour', parentGroup: 'labourGroup' },
    
    // Foam Group (grouped toggle)
    foamGroup: { enabled: false, label: 'Foam Section', category: 'Foam', isGroup: true },
    foamPrice: { enabled: false, label: 'Foam Price', category: 'Foam', parentGroup: 'foamGroup' },
    foamQnty: { enabled: false, label: 'Foam Quantity', category: 'Foam', parentGroup: 'foamGroup' },
    
    // Payment
    deposit: { enabled: true, label: 'Deposit Amount', category: 'Payment' },
    pickupDelivery: { enabled: false, label: 'Pickup/Delivery', category: 'Payment' },
    notes: { enabled: false, label: 'Notes', category: 'Payment' },
    
    // Additional
    priority: { enabled: false, label: 'Priority', category: 'Additional' },
    assignedTo: { enabled: false, label: 'Assigned To', category: 'Additional' }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('rapidInvoiceSettings');
    if (savedSettings) {
      setFieldSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Handle field toggle with group logic
  const handleFieldToggle = (fieldKey) => {
    setFieldSettings(prev => {
      const newSettings = { ...prev };
      const field = newSettings[fieldKey];
      const newEnabled = !field.enabled;
      
      // Update the toggled field
      newSettings[fieldKey] = {
        ...field,
        enabled: newEnabled
      };
      
      // If this is a group toggle, update all child fields
      if (field.isGroup) {
        Object.keys(newSettings).forEach(key => {
          if (newSettings[key].parentGroup === fieldKey) {
            newSettings[key] = {
              ...newSettings[key],
              enabled: newEnabled
            };
          }
        });
      }
      
      // If this is a child field being disabled, check if parent should be disabled
      if (!newEnabled && field.parentGroup) {
        const siblings = Object.keys(newSettings).filter(key => 
          newSettings[key].parentGroup === field.parentGroup && key !== fieldKey
        );
        const anyChildEnabled = siblings.some(key => newSettings[key].enabled);
        
        if (!anyChildEnabled) {
          newSettings[field.parentGroup] = {
            ...newSettings[field.parentGroup],
            enabled: false
          };
        }
      }
      
      // If this is a child field being enabled, make sure parent is enabled
      if (newEnabled && field.parentGroup) {
        newSettings[field.parentGroup] = {
          ...newSettings[field.parentGroup],
          enabled: true
        };
      }
      
      return newSettings;
    });
  };

  // Save settings
  const handleSaveSettings = () => {
    setIsSaving(true);
    
    // Save to localStorage (in real app, this would be saved to Firebase)
    localStorage.setItem('rapidInvoiceSettings', JSON.stringify(fieldSettings));
    
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    }, 500);
  };

  // Group fields by category
  const groupedFields = Object.entries(fieldSettings).reduce((acc, [key, field]) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push({ key, ...field });
    return acc;
  }, {});

  // Count enabled fields
  const enabledCount = Object.values(fieldSettings).filter(field => field.enabled).length;

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <SettingsIcon sx={{ color: '#274290', mr: 1, fontSize: 32 }} />
        <Typography variant="h4" component="h1" sx={{ color: '#274290' }}>
          Rapid Invoice Settings
        </Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" mb={3}>
        Configure which fields appear in the fast order creation popup. Only enabled fields will be shown in step 2 of the quick order process.
      </Typography>

      {/* Summary */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Quick Summary
          </Typography>
          <Chip 
            label={`${enabledCount} fields enabled`} 
            color="primary" 
            variant="outlined"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" mt={1}>
          Fast orders will have customer info (step 1) + {enabledCount} configurable fields (step 2)
        </Typography>
      </Paper>

      {/* Field Categories */}
      <Grid container spacing={3}>
        {Object.entries(groupedFields).map(([category, fields]) => (
          <Grid item xs={12} md={6} key={category}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  {category}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {fields.map((field) => (
                  <FormControlLabel
                    key={field.key}
                    control={
                      <Switch
                        checked={field.enabled}
                        onChange={() => handleFieldToggle(field.key)}
                        color="primary"
                      />
                    }
                    label={field.label}
                    sx={{ 
                      display: 'block', 
                      mb: 1,
                      ml: field.parentGroup ? 3 : 0, // Indent child fields
                      '& .MuiFormControlLabel-label': {
                        fontSize: field.isGroup ? '1rem' : '0.9rem',
                        fontWeight: field.isGroup ? 'bold' : 'normal',
                        color: field.isGroup ? '#274290' : 'inherit'
                      }
                    }}
                  />
                ))}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Save Button */}
      <Box mt={4} display="flex" justifyContent="center">
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
          disabled={isSaving}
          sx={{ 
            backgroundColor: '#f27921', 
            '&:hover': { backgroundColor: '#e06810' },
            px: 4,
            py: 1.5
          }}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {/* Success Message */}
      {saveMessage && (
        <Box mt={2} display="flex" justifyContent="center">
          <Alert severity="success" sx={{ maxWidth: 400 }}>
            {saveMessage}
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default RapidInvoiceSettingsPage; 