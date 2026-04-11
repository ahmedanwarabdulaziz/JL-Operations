import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  TextField,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Gavel as GavelIcon,
} from '@mui/icons-material';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';

// Default seed terms — created once if collection is empty
const SEED_TERMS = [
  'All prices are in Canadian Dollars (CAD) and do not include applicable taxes unless stated otherwise.',
  'This quote is valid for 30 days from the date of issue.',
  'A deposit of 50% is required upon order confirmation.',
  'Delivery timelines will be confirmed upon order placement.',
  'Prices are subject to change based on material availability and market conditions.',
  'Any changes to the scope of work after order confirmation may result in additional charges.',
  'JL Operations reserves the right to adjust pricing if quantities or specifications change.',
];

const QuoteStep3Terms = ({ selectedTerms, onTermsChange }) => {
  const { showSuccess, showError } = useNotification();

  const [allTerms, setAllTerms] = useState([]); // [ { id, text, isDefault, order } ]
  const [loading, setLoading] = useState(true);
  const [newTermText, setNewTermText] = useState('');
  const [addingTerm, setAddingTerm] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  useEffect(() => {
    const fetchOrSeedTerms = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, 'quote-terms'), orderBy('order'));
        const snap = await getDocs(q);

        if (snap.empty) {
          // Seed defaults
          const seeded = [];
          for (let i = 0; i < SEED_TERMS.length; i++) {
            const ref = await addDoc(collection(db, 'quote-terms'), {
              text: SEED_TERMS[i],
              isDefault: true,
              order: i,
              createdAt: new Date(),
            });
            seeded.push({ id: ref.id, text: SEED_TERMS[i], isDefault: true, order: i });
          }
          setAllTerms(seeded);
          // Auto-select all defaults
          if (selectedTerms.length === 0) {
            onTermsChange(seeded.filter(t => t.isDefault).map(t => ({ id: t.id, text: t.text })));
          }
        } else {
          const terms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAllTerms(terms);
          // Auto-select defaults on first load (only if selectedTerms is empty)
          if (selectedTerms.length === 0) {
            onTermsChange(terms.filter(t => t.isDefault).map(t => ({ id: t.id, text: t.text })));
          }
        }
      } catch (e) {
        console.error('Error fetching terms:', e);
        showError('Failed to load terms');
      } finally {
        setLoading(false);
      }
    };
    fetchOrSeedTerms();
  }, []);

  const isSelected = (termId) => selectedTerms.some(t => t.id === termId);

  const handleToggle = (term) => {
    if (isSelected(term.id)) {
      onTermsChange(selectedTerms.filter(t => t.id !== term.id));
    } else {
      onTermsChange([...selectedTerms, { id: term.id, text: term.text }]);
    }
  };

  const handleAddTerm = async () => {
    if (!newTermText.trim()) return;
    try {
      setAddingTerm(true);
      const nextOrder = allTerms.length;
      const ref = await addDoc(collection(db, 'quote-terms'), {
        text: newTermText.trim(),
        isDefault: false,
        order: nextOrder,
        createdAt: new Date(),
      });
      const newTerm = { id: ref.id, text: newTermText.trim(), isDefault: false, order: nextOrder };
      setAllTerms(prev => [...prev, newTerm]);
      // Auto-select the newly added term
      onTermsChange([...selectedTerms, { id: newTerm.id, text: newTerm.text }]);
      setNewTermText('');
      setShowAddField(false);
      showSuccess('Term added and saved globally');
    } catch (e) {
      console.error(e);
      showError('Failed to add term');
    } finally {
      setAddingTerm(false);
    }
  };

  const handleDeleteTerm = async (term) => {
    try {
      await deleteDoc(doc(db, 'quote-terms', term.id));
      setAllTerms(prev => prev.filter(t => t.id !== term.id));
      // Also deselect if it was selected
      onTermsChange(selectedTerms.filter(t => t.id !== term.id));
      showSuccess('Term deleted');
    } catch (e) {
      console.error(e);
      showError('Failed to delete term');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: '#b98f33' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <GavelIcon sx={{ color: '#b98f33' }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Terms &amp; Conditions</Typography>
        <Chip
          label={`${selectedTerms.length} selected`}
          size="small"
          sx={{ bgcolor: '#b98f33', color: '#000', fontWeight: 'bold' }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Check the terms to include in this quote. You can add new terms — they'll be saved for all future quotes.
      </Typography>

      <List disablePadding>
        {allTerms.map((term, i) => (
          <React.Fragment key={term.id}>
            <ListItem
              disablePadding
              secondaryAction={
                <IconButton
                  size="small"
                  onClick={() => handleDeleteTerm(term)}
                  sx={{
                    color: '#666',
                    '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.08)' },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
              sx={{
                bgcolor: isSelected(term.id) ? 'rgba(185,143,51,0.06)' : 'transparent',
                borderRadius: 1,
                mb: 0.5,
                pr: 5,
                transition: 'background 0.2s',
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Checkbox
                  edge="start"
                  checked={isSelected(term.id)}
                  onChange={() => handleToggle(term)}
                  sx={{
                    color: '#b98f33',
                    '&.Mui-checked': { color: '#b98f33' },
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: isSelected(term.id) ? 600 : 400,
                      color: isSelected(term.id) ? '#fff' : '#888',
                    }}
                  >
                    {term.text}
                  </Typography>
                }
              />
              {term.isDefault && (
                <Chip
                  label="Default"
                  size="small"
                  sx={{ mr: 1, fontSize: '0.7rem', bgcolor: '#333', color: '#888', border: '1px solid #444' }}
                />
              )}
            </ListItem>
            {i < allTerms.length - 1 && <Divider sx={{ my: 0.25, borderColor: '#333' }} />}
          </React.Fragment>
        ))}
      </List>

      {/* Add new term */}
      <Box sx={{ mt: 3 }}>
        {showAddField ? (
          <Box sx={{ p: 2.5, bgcolor: '#1e1e1e', borderRadius: 2, border: '1px dashed #b98f33' }}>
            <Typography sx={{ mb: 1.5, fontWeight: 'bold', color: '#b98f33', fontSize: '0.9rem' }}>New Term</Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              placeholder="Enter the new term or condition..."
              value={newTermText}
              onChange={e => setNewTermText(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={() => { setShowAddField(false); setNewTermText(''); }}
                sx={buttonStyles.cancelButton}
              >
                Cancel
              </Button>
              <Button
                size="small"
                disabled={!newTermText.trim() || addingTerm}
                onClick={handleAddTerm}
                sx={buttonStyles.primaryButton}
              >
                {addingTerm ? <CircularProgress size={18} sx={{ color: '#000' }} /> : 'Save & Select'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Button
            startIcon={<AddIcon />}
            onClick={() => setShowAddField(true)}
            sx={{
              bgcolor: 'transparent',
              color: '#b98f33',
              fontWeight: 'bold',
              border: '1px dashed #555',
              px: 2,
              borderRadius: 1.5,
              '&:hover': { bgcolor: 'rgba(185,143,51,0.08)', borderColor: '#b98f33' },
            }}
          >
            Add New Term
          </Button>
        )}
      </Box>

      {selectedTerms.length === 0 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          No terms selected. The quote will be sent without any terms and conditions.
        </Alert>
      )}
    </Box>
  );
};

export default QuoteStep3Terms;
