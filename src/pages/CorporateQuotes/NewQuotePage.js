import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Stepper, Step, StepLabel,
  Paper, Container, CircularProgress,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  collection, getDocs, addDoc, query, orderBy, where, doc, setDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { buttonStyles } from '../../styles/buttonStyles';

import QuoteStep1Customer from './steps/QuoteStep1Customer';
import Step3Furniture from '../Orders/steps/Step3Furniture';
import QuoteStep3Terms from './steps/QuoteStep3Terms';
import QuoteStep4TaxNotes from './steps/QuoteStep4TaxNotes';
import QuoteStep5Review from './steps/QuoteStep5Review';
import QuoteStep6Submit from './steps/QuoteStep6Submit';

const STEPS = [
  'Select Customer',
  'Furniture',
  'Terms & Conditions',
  'Tax & Notes',
  'Review',
  'Submit',
];

// ── helpers ──────────────────────────────────────────────────────────────────
const getNextQuoteNumber = async () => {
  try {
    const snap = await getDocs(collection(db, 'corporate-quotes'));
    if (snap.empty) return 'CQ-000001';

    let maxNum = 0;

    snap.docs.forEach(d => {
      const data = d.data();

      // Check baseQuoteNumber first (always "CQ-XXXXXX" with no version suffix)
      const base = data.baseQuoteNumber || '';
      if (base.startsWith('CQ-')) {
        const n = parseInt(base.replace('CQ-', ''), 10) || 0;
        if (n > maxNum) maxNum = n;
      }

      // Fallback: also parse quoteNumber (may have "-02" version suffix — strip it)
      const qn = data.quoteNumber || '';
      if (qn.startsWith('CQ-')) {
        const stripped = qn.replace(/-\d{2}$/, ''); // remove "-02", "-03" etc.
        const n = parseInt(stripped.replace('CQ-', ''), 10) || 0;
        if (n > maxNum) maxNum = n;
      }
    });

    return `CQ-${String(maxNum + 1).padStart(6, '0')}`;
  } catch (e) {
    console.error('getNextQuoteNumber error:', e);
    return 'CQ-000001';
  }
};

const getNextVersionNumber = async (baseQuoteNumber) => {
  try {
    const q = query(
      collection(db, 'corporate-quotes'),
      where('baseQuoteNumber', '==', baseQuoteNumber),
    );
    const snap = await getDocs(q);
    const versions = snap.docs.map(d => d.data().version || 1);
    const next = Math.max(...versions, 1) + 1;
    const suffix = String(next).padStart(2, '0');
    return { quoteNumber: `${baseQuoteNumber}-${suffix}`, version: next };
  } catch {
    return { quoteNumber: `${baseQuoteNumber}-02`, version: 2 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────

const NewQuotePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();

  // Mode detection
  const isVersionMode = location.state?.versionMode || false;
  const isEditMode    = location.state?.editMode || false;
  const sourceQuote   = location.state?.sourceQuoteData || null;

  // Stepper
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading]       = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // Step 1 — Customer
  const [quoteNumber, setQuoteNumber]             = useState('');
  const [baseQuoteNumber, setBaseQuoteNumber]     = useState('');
  const [version, setVersion]                     = useState(1);
  const [selectedCustomer, setSelectedCustomer]   = useState(null);
  const [isTemporaryCustomer, setIsTemporaryCustomer] = useState(false);
  const [selectedContactPerson, setSelectedContactPerson] = useState(null);

  // Step 2 — Furniture
  const [furnitureGroups, setFurnitureGroups] = useState([]);
  const [formErrors, setFormErrors]           = useState({});

  // Step 3 — Terms
  const [selectedTerms, setSelectedTerms] = useState([]);

  // Step 4 — Tax + Notes
  const [tax, setTax]     = useState({ enabled: true, percentage: 13 });
  const [notes, setNotes] = useState('');

  // Step 6 — Submit
  const [quoteStatus, setQuoteStatus] = useState('draft');

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        if ((isVersionMode || isEditMode) && sourceQuote) {
          // Pre-fill from source
          if (isVersionMode) {
            const { quoteNumber: vNum, version: vVer } = await getNextVersionNumber(sourceQuote.baseQuoteNumber);
            setQuoteNumber(vNum);
            setBaseQuoteNumber(sourceQuote.baseQuoteNumber);
            setVersion(vVer);
            setActiveStep(1); // skip to furniture for new version
          } else {
            setQuoteNumber(sourceQuote.quoteNumber);
            setBaseQuoteNumber(sourceQuote.baseQuoteNumber);
            setVersion(sourceQuote.version || 1);
            setActiveStep(0);
          }
          setSelectedCustomer(sourceQuote.corporateCustomer || null);
          setIsTemporaryCustomer(sourceQuote.isTemporaryCustomer || false);
          setSelectedContactPerson(sourceQuote.contactPerson || null);
          setFurnitureGroups(sourceQuote.furnitureGroups || []);
          setSelectedTerms(sourceQuote.selectedTerms || []);
          setTax(sourceQuote.tax || { enabled: true, percentage: 13 });
          setNotes(sourceQuote.notes || '');
        } else {
          const num = await getNextQuoteNumber();
          setQuoteNumber(num);
          setBaseQuoteNumber(num);
        }
      } catch (e) {
        console.error(e);
        showError('Failed to initialise quote');
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, []);

  // ── Customer handlers ─────────────────────────────────────────────────────
  const handleCustomerSelect = (customer, isTemp) => {
    setSelectedCustomer(customer);
    setIsTemporaryCustomer(isTemp || false);
  };

  const handleContactPersonSelect = (person) => {
    setSelectedContactPerson(person);
  };

  // ── Furniture handler ─────────────────────────────────────────────────────
  const handleFurnitureChange = (groups) => setFurnitureGroups(groups);
  const handleFormErrors      = (errors) => setFormErrors(errors);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = () => {
    switch (activeStep) {
      case 0:
        if (!selectedCustomer) { showError('Please select a customer'); return false; }
        if (!selectedContactPerson) { showError('Please select a contact person'); return false; }
        if (!quoteNumber || quoteNumber === 'CQ-') {
          showError('Please enter a valid quote number'); return false;
        }
        return true;
      case 1:
        if (!furnitureGroups.length) { showError('Add at least one furniture item'); return false; }
        // Basic furniture validation
        const errs = {};
        furnitureGroups.forEach((g, i) => {
          if (!g.furnitureType?.trim()) errs[`furniture_${i}_type`] = 'Type is required';
        });
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (activeStep === STEPS.length - 1) {
      handleSubmit();
      return;
    }
    if (!validateStep()) return;
    setActiveStep(s => s + 1);
    setFormErrors({});
  };

  const handleBack = () => {
    setActiveStep(s => s - 1);
    setFormErrors({});
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      setLoading(true);

      const payload = {
        quoteNumber,
        baseQuoteNumber,
        version,
        corporateCustomer: selectedCustomer
          ? {
              id: selectedCustomer.id || null,
              corporateName: selectedCustomer.corporateName || '',
              email: selectedCustomer.email || '',
              phone: selectedCustomer.phone || '',
              address: selectedCustomer.address || '',
            }
          : null,
        isTemporaryCustomer,
        contactPerson: selectedContactPerson
          ? {
              id: selectedContactPerson.id || null,
              name: selectedContactPerson.name || '',
              email: selectedContactPerson.email || '',
              phone: selectedContactPerson.phone || '',
              position: selectedContactPerson.position || '',
            }
          : null,
        furnitureGroups,
        selectedTerms,
        tax: { enabled: tax.enabled, percentage: parseFloat(tax.percentage) || 0 },
        notes,
        status: quoteStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (isEditMode && sourceQuote?.id) {
        payload.updatedAt = new Date();
        delete payload.createdAt; // preserve existing createdAt on update
        await setDoc(doc(db, 'corporate-quotes', sourceQuote.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, 'corporate-quotes'), payload);
      }

      showSuccess(
        isVersionMode
          ? `Quote version ${quoteNumber} created successfully!`
          : isEditMode
            ? `Quote ${quoteNumber} updated successfully!`
            : `Quote ${quoteNumber} created successfully!`,
      );
      navigate('/admin/corporate-quotes');
    } catch (e) {
      console.error('Error saving quote:', e);
      showError('Failed to save quote');
    } finally {
      setLoading(false);
    }
  };

  // ── Step Content ──────────────────────────────────────────────────────────
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <QuoteStep1Customer
            quoteNumber={quoteNumber}
            onQuoteNumberChange={setQuoteNumber}
            selectedCustomer={selectedCustomer}
            isTemporaryCustomer={isTemporaryCustomer}
            selectedContactPerson={selectedContactPerson}
            onCustomerSelect={handleCustomerSelect}
            onContactPersonSelect={handleContactPersonSelect}
          />
        );
      case 1:
        return (
          <Step3Furniture
            furnitureGroups={furnitureGroups}
            onFurnitureChange={handleFurnitureChange}
            formErrors={formErrors}
            setFormErrors={handleFormErrors}
          />
        );
      case 2:
        return (
          <QuoteStep3Terms
            selectedTerms={selectedTerms}
            onTermsChange={setSelectedTerms}
          />
        );
      case 3:
        return (
          <QuoteStep4TaxNotes
            tax={tax}
            onTaxChange={setTax}
            notes={notes}
            onNotesChange={setNotes}
          />
        );
      case 4:
        return (
          <QuoteStep5Review
            quoteNumber={quoteNumber}
            selectedCustomer={selectedCustomer}
            isTemporaryCustomer={isTemporaryCustomer}
            selectedContactPerson={selectedContactPerson}
            furnitureGroups={furnitureGroups}
            selectedTerms={selectedTerms}
            tax={tax}
            notes={notes}
          />
        );
      case 5:
        return (
          <QuoteStep6Submit
            quoteStatus={quoteStatus}
            onStatusChange={setQuoteStatus}
            isVersionMode={isVersionMode}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#b98f33' }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
          {isVersionMode ? `New Version — ${quoteNumber}` : isEditMode ? `Edit Quote — ${quoteNumber}` : 'New Corporate Quote'}
        </Typography>
        {isVersionMode && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Based on quote {sourceQuote?.baseQuoteNumber}. All fields are editable.
          </Typography>
        )}
        {isEditMode && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Editing existing quote. Updates will be saved directly to this record.
          </Typography>
        )}

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mt: 4 }}>
          {getStepContent(activeStep)}
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ ...buttonStyles.primaryButton, mr: 1 }}
          >
            Back
          </Button>
          <Box>
            <Button
              variant="outlined"
              onClick={() => navigate('/admin/corporate-quotes')}
              sx={{ ...buttonStyles.cancelButton, mr: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
              sx={buttonStyles.primaryButton}
            >
              {loading
                ? <CircularProgress size={22} sx={{ color: '#000' }} />
                : activeStep === STEPS.length - 1
                  ? (isVersionMode ? 'Save Version' : isEditMode ? 'Update Quote' : 'Create Quote')
                  : 'Next'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default NewQuotePage;
