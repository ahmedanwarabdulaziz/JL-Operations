import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Button
} from '@mui/material';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase/config';

const defaultFormState = {
  corporateName: '',
  email: '',
  phone: '',
  address: '',
  notes: ''
};

const CorporateCustomerDialog = ({
  open,
  onClose,
  customer = null,
  onSaved,
  onSuccess,
  onError
}) => {
  const [formValues, setFormValues] = useState(defaultFormState);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isEditMode = useMemo(() => Boolean(customer?.id), [customer]);

  useEffect(() => {
    if (open) {
      setFormValues({
        corporateName: customer?.corporateName || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
        address: customer?.address || '',
        notes: customer?.notes || ''
      });
      setErrors({});
    } else {
      setFormValues(defaultFormState);
      setErrors({});
    }
  }, [open, customer]);

  const handleInputChange = (field) => (event) => {
    const { value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [field]: value
    }));
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validate = () => {
    const validationErrors = {};
    if (!formValues.corporateName.trim()) {
      validationErrors.corporateName = 'Corporate name is required';
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      const timestamps = {
        updatedAt: new Date()
      };

      if (isEditMode) {
        const customerRef = doc(db, 'corporateCustomers', customer.id);
        await updateDoc(customerRef, {
          ...formValues,
          ...timestamps
        });

        const updatedCustomer = {
          ...customer,
          ...formValues,
          ...timestamps
        };

        onSuccess?.('Corporate customer updated successfully');
        onSaved?.(updatedCustomer, { isUpdate: true });
      } else {
        const docRef = await addDoc(collection(db, 'corporateCustomers'), {
          ...formValues,
          contactPersons: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const createdCustomer = {
          id: docRef.id,
          ...formValues,
          contactPersons: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        onSuccess?.('Corporate customer created successfully');
        onSaved?.(createdCustomer, { isUpdate: false });
      }

      onClose?.();
    } catch (error) {
      console.error('Error saving corporate customer:', error);
      onError?.('Error saving corporate customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}
      >
        {isEditMode ? 'Edit Corporate Customer' : 'Add Corporate Customer'}
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            fullWidth
            label="Corporate Name"
            value={formValues.corporateName}
            onChange={handleInputChange('corporateName')}
            required
            error={Boolean(errors.corporateName)}
            helperText={errors.corporateName}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a',
                  borderWidth: 2
                }
              },
              '& .MuiInputLabel-root': {
                '&.Mui-focused': {
                  color: '#d4af5a'
                }
              }
            }}
          />

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formValues.email}
            onChange={handleInputChange('email')}
            error={Boolean(errors.email)}
            helperText={errors.email}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a',
                  borderWidth: 2
                }
              },
              '& .MuiInputLabel-root': {
                '&.Mui-focused': {
                  color: '#d4af5a'
                }
              }
            }}
          />

          <TextField
            fullWidth
            label="Phone"
            value={formValues.phone}
            onChange={handleInputChange('phone')}
            error={Boolean(errors.phone)}
            helperText={errors.phone}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a',
                  borderWidth: 2
                }
              },
              '& .MuiInputLabel-root': {
                '&.Mui-focused': {
                  color: '#d4af5a'
                }
              }
            }}
          />

          <TextField
            fullWidth
            label="Address"
            value={formValues.address}
            onChange={handleInputChange('address')}
            multiline
            rows={2}
            placeholder="Enter the corporate address..."
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a',
                  borderWidth: 2
                }
              },
              '& .MuiInputLabel-root': {
                '&.Mui-focused': {
                  color: '#d4af5a'
                }
              }
            }}
          />

          <TextField
            fullWidth
            label="Notes"
            value={formValues.notes}
            onChange={handleInputChange('notes')}
            multiline
            rows={3}
            placeholder="Enter any additional notes about this corporate customer..."
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d4af5a',
                  borderWidth: 2
                }
              },
              '& .MuiInputLabel-root': {
                '&.Mui-focused': {
                  color: '#d4af5a'
                }
              }
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} sx={{ color: '#666666' }} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{
            background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
            color: '#000000',
            border: '3px solid #4CAF50',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
            position: 'relative',
            '&:hover': {
              background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
              border: '3px solid #45a049',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
            },
            '&.Mui-disabled': {
              background: 'linear-gradient(145deg, rgba(212,175,90,0.5) 0%, rgba(185,143,51,0.5) 50%, rgba(139,107,31,0.5) 100%)',
              borderColor: 'rgba(76,175,80,0.5)',
              color: 'rgba(0,0,0,0.4)'
            }
          }}
        >
          {isEditMode ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CorporateCustomerDialog;

