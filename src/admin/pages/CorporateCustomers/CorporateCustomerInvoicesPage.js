import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Collapse,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Close as CloseIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Note as NoteIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatDateOnly } from '../../../utils/dateUtils';
import { formatCorporateInvoiceForInvoice } from '../../../utils/invoiceNumberUtils';
import { fetchMaterialCompanyTaxRates, getMaterialCompanyTaxRate } from '../../../shared/utils/materialTaxRates';
import { Switch, FormControlLabel, Checkbox } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CorporateCustomerInvoicesPage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [corporateCustomer, setCorporateCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [creditCardFeeEnabled, setCreditCardFeeEnabled] = useState(false);
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [groupByNote, setGroupByNote] = useState(false);
  const [materialsCardExpanded, setMaterialsCardExpanded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (customerId) {
        await fetchCorporateCustomer();
      }
    };
    loadData();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, [customerId]);

  useEffect(() => {
    if (corporateCustomer) {
      fetchInvoices();
    }
  }, [corporateCustomer]);

  const fetchCorporateCustomer = async () => {
    try {
      const customerDoc = await getDoc(doc(db, 'corporateCustomers', customerId));
      if (customerDoc.exists()) {
        setCorporateCustomer({
          id: customerDoc.id,
          ...customerDoc.data()
        });
      } else {
        setError('Corporate customer not found');
      }
    } catch (err) {
      console.error('Error fetching corporate customer:', err);
      setError('Failed to load corporate customer');
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // Fetch all corporate orders
      const corporateOrdersRef = collection(db, 'corporate-orders');
      const q = query(corporateOrdersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      // Filter orders by corporate customer ID
      const filteredOrders = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(order => {
          // Primary check: match by corporateCustomer.id
          if (order.corporateCustomer?.id === customerId) {
            return true;
          }
          // Fallback: match by corporateName (for older orders that might not have id)
          if (order.corporateCustomer?.corporateName === corporateCustomer?.corporateName) {
            return true;
          }
          return false;
        });

      setInvoices(filteredOrders);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const calculateCorporateInvoiceTotals = (order) => {
    if (!order) return { subtotal: 0, delivery: 0, tax: 0, creditCardFee: 0, total: 0 };

    const furnitureGroups = order.furnitureGroups || [];
    let subtotal = 0;

    furnitureGroups.forEach(group => {
      if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
        subtotal += (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0);
      }
      if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
        subtotal += (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 0);
      }
      if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
        subtotal += (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
      }
      if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
        subtotal += (parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 0);
      }
    });

    const paymentDetails = order.paymentDetails || {};
    let delivery = 0;
    if (paymentDetails.pickupDeliveryEnabled) {
      const pickupCost = parseFloat(paymentDetails.pickupDeliveryCost) || 0;
      const serviceType = paymentDetails.pickupDeliveryServiceType;
      if (serviceType === 'both') {
        delivery = pickupCost * 2;
      } else {
        delivery = pickupCost;
      }
    }

    const tax = (subtotal + delivery) * 0.13;
    const creditCardFee = creditCardFeeEnabled ? (subtotal + delivery + tax) * 0.025 : 0;
    const total = subtotal + delivery + tax + creditCardFee;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      delivery: parseFloat(delivery.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      creditCardFee: parseFloat(creditCardFee.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  };

  const calculateInvoiceTotal = (order) => {
    const totals = calculateCorporateInvoiceTotals(order);
    return totals.total;
  };

  const getInvoiceTaxBreakdown = (invoice) => {
    const totals = calculateCorporateInvoiceTotals(invoice);
    return {
      beforeTax: totals.subtotal + totals.delivery,
      tax: totals.tax,
      afterTax: totals.total
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getMaterialSummary = (invoice) => {
    if (!invoice.furnitureGroups || invoice.furnitureGroups.length === 0) {
      return 'No materials';
    }

    const materials = [];
    invoice.furnitureGroups.forEach(group => {
      if (group.materialCompany && group.materialCode) {
        const materialKey = `${group.materialCompany} - ${group.materialCode}`;
        if (!materials.includes(materialKey)) {
          materials.push(materialKey);
        }
      }
    });

    if (materials.length === 0) {
      return 'No materials';
    }

    return materials.join(', ');
  };


  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setCreditCardFeeEnabled(invoice.creditCardFeeEnabled || false);
    setInvoiceDialogOpen(true);
  };

  const handleDownloadPDF = async (invoice) => {
    if (!invoice) return;

    try {
      // Check if the invoice dialog is already open with this invoice
      const isDialogOpen = invoiceDialogOpen && selectedInvoice?.id === invoice.id;
      const shouldCloseDialog = !isDialogOpen;

      // If dialog is not open, open it temporarily
      if (shouldCloseDialog) {
        setSelectedInvoice(invoice);
        setCreditCardFeeEnabled(invoice.creditCardFeeEnabled || false);
        setInvoiceDialogOpen(true);
        // Wait for dialog to render
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Find the invoice content element
      const invoiceElement = document.querySelector('[data-invoice-content]');
      if (!invoiceElement) {
        if (shouldCloseDialog) {
          setInvoiceDialogOpen(false);
        }
        alert('Invoice content not found. Please try again.');
        return;
      }

      // Capture the invoice content
      const canvas = await html2canvas(invoiceElement, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: invoiceElement.scrollWidth,
        windowHeight: invoiceElement.scrollHeight
      });

      // Generate PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF('p', 'mm', 'letter');
      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const margin = 12.7;
      const contentWidth = pageWidth - (margin * 2);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      const fileName = `Corporate_Invoice_${formatCorporateInvoiceForInvoice(invoice.orderDetails?.billInvoice) || 'N/A'}.pdf`;
      pdf.save(fileName);

      // Close dialog if we opened it temporarily
      if (shouldCloseDialog) {
        setInvoiceDialogOpen(false);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
      if (!invoiceDialogOpen) {
        setInvoiceDialogOpen(false);
      }
    }
  };

  const handleCloseInvoiceDialog = () => {
    setInvoiceDialogOpen(false);
    setSelectedInvoice(null);
    setCreditCardFeeEnabled(false);
  };

  const handleCreditCardFeeToggle = (enabled) => {
    setCreditCardFeeEnabled(enabled);
  };

  const getCurrentInvoiceIndex = () => {
    if (!selectedInvoice) return -1;
    return invoices.findIndex(inv => inv.id === selectedInvoice.id);
  };

  const handlePreviousInvoice = () => {
    const currentIndex = getCurrentInvoiceIndex();
    if (currentIndex > 0) {
      const previousInvoice = invoices[currentIndex - 1];
      setSelectedInvoice(previousInvoice);
      setCreditCardFeeEnabled(previousInvoice.creditCardFeeEnabled || false);
    }
  };

  const handleNextInvoice = () => {
    const currentIndex = getCurrentInvoiceIndex();
    if (currentIndex < invoices.length - 1) {
      const nextInvoice = invoices[currentIndex + 1];
      setSelectedInvoice(nextInvoice);
      setCreditCardFeeEnabled(nextInvoice.creditCardFeeEnabled || false);
    }
  };

  const canNavigatePrevious = () => {
    const currentIndex = getCurrentInvoiceIndex();
    return currentIndex > 0;
  };

  const canNavigateNext = () => {
    const currentIndex = getCurrentInvoiceIndex();
    return currentIndex >= 0 && currentIndex < invoices.length - 1;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: '#d4af5a' }} />
      </Box>
    );
  }

  if (error || !corporateCustomer) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Corporate customer not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/corporate-customers')}
          sx={{ mt: 2 }}
        >
          Back to Corporate Customers
        </Button>
      </Box>
    );
  }

  const primaryContact = corporateCustomer.contactPersons?.find(cp => cp.isPrimary) || 
                         corporateCustomer.contactPersons?.[0];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/admin/corporate-customers')}
          sx={{ mr: 2, color: '#d4af5a' }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
          Invoices for {corporateCustomer.corporateName}
        </Typography>
      </Box>

      {/* Customer Info Card and Materials Summary Card - Side by Side */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        {/* Customer Info Card */}
        <Card sx={{ flex: '1 1 300px', minWidth: '300px', border: '2px solid #d4af5a', borderRadius: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BusinessIcon sx={{ fontSize: 32, color: '#d4af5a', mr: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                {corporateCustomer.corporateName}
              </Typography>
            </Box>
            
            {primaryContact && (
              <Box sx={{ ml: 4, mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Primary Contact:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {primaryContact.name}
                    </Typography>
                    {primaryContact.position && (
                      <Typography variant="body2" color="text.secondary">
                        - {primaryContact.position}
                      </Typography>
                    )}
                  </Box>
                  {primaryContact.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon sx={{ fontSize: 16, color: '#d4af5a' }} />
                      <Typography variant="body2" color="text.secondary">
                        {primaryContact.email}
                      </Typography>
                    </Box>
                  )}
                  {primaryContact.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhoneIcon sx={{ fontSize: 16, color: '#d4af5a' }} />
                      <Typography variant="body2" color="text.secondary">
                        {primaryContact.phone}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {corporateCustomer.address && (
              <Box sx={{ ml: 4, display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                <LocationIcon sx={{ fontSize: 16, color: '#d4af5a', mt: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  {corporateCustomer.address}
                </Typography>
              </Box>
            )}

            {/* Notes (if exists) */}
            {corporateCustomer.notes && (
              <Box sx={{ 
                ml: 4,
                mb: 2,
                p: 1.5,
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                backgroundColor: 'rgba(212, 175, 90, 0.05)'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <NoteIcon sx={{ fontSize: 16, color: '#d4af5a' }} />
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#d4af5a' }}>
                    Notes
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ 
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  ml: 3
                }}>
                  {corporateCustomer.notes}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Materials Summary Card */}
      {invoices.length > 0 && (() => {
        if (groupByNote) {
          // Group materials by note
          const materialsByNote = {};
          invoices.forEach(invoice => {
            const noteValue = invoice.orderDetails?.note?.value || 'No Note';
            if (!materialsByNote[noteValue]) {
              materialsByNote[noteValue] = new Set();
            }
            if (invoice.furnitureGroups && invoice.furnitureGroups.length > 0) {
              invoice.furnitureGroups.forEach(group => {
                if (group.materialCompany && group.materialCode) {
                  materialsByNote[noteValue].add(`${group.materialCompany} - ${group.materialCode}`);
                }
              });
            }
          });

          const hasMaterials = Object.values(materialsByNote).some(set => set.size > 0);
          
          if (hasMaterials) {
            return (
              <Card sx={{ flex: '1 1 300px', minWidth: '300px', border: '2px solid #d4af5a', borderRadius: 2 }}>
                <CardHeader
                  title={
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      Materials Summary
                    </Typography>
                  }
                  action={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={groupByNote}
                            onChange={(e) => setGroupByNote(e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                              color: '#d4af5a',
                              '&.Mui-checked': {
                                color: '#d4af5a'
                              }
                            }}
                          />
                        }
                        label="Group by Note"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ color: '#b98f33', fontWeight: 'bold', mr: 1 }}
                      />
                      <IconButton
                        onClick={() => setMaterialsCardExpanded(!materialsCardExpanded)}
                        sx={{ color: '#b98f33' }}
                      >
                        {materialsCardExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  }
                  onClick={() => setMaterialsCardExpanded(!materialsCardExpanded)}
                  sx={{ cursor: 'pointer' }}
                />
                <Collapse in={materialsCardExpanded} timeout="auto" unmountOnExit>
                  <CardContent>
                    {Object.keys(materialsByNote).sort().map((note, noteIndex) => {
                      const materials = Array.from(materialsByNote[note]);
                      if (materials.length === 0) return null;
                      
                      return (
                        <Box key={noteIndex} sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
                            {note}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {materials.map((material, materialIndex) => (
                              <Chip
                                key={materialIndex}
                                label={material}
                                sx={{
                                  backgroundColor: '#f5f5f5',
                                  color: '#333',
                                  border: '1px solid #d4af5a',
                                  fontWeight: 'medium'
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      );
                    })}
                  </CardContent>
                </Collapse>
              </Card>
            );
          }
        } else {
          // Show all materials without grouping
          const allMaterials = new Set();
          invoices.forEach(invoice => {
            if (invoice.furnitureGroups && invoice.furnitureGroups.length > 0) {
              invoice.furnitureGroups.forEach(group => {
                if (group.materialCompany && group.materialCode) {
                  allMaterials.add(`${group.materialCompany} - ${group.materialCode}`);
                }
              });
            }
          });

          if (allMaterials.size > 0) {
            return (
              <Card sx={{ flex: '1 1 300px', minWidth: '300px', border: '2px solid #d4af5a', borderRadius: 2 }}>
                <CardHeader
                  title={
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      Materials Summary
                    </Typography>
                  }
                  action={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={groupByNote}
                            onChange={(e) => setGroupByNote(e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                              color: '#d4af5a',
                              '&.Mui-checked': {
                                color: '#d4af5a'
                              }
                            }}
                          />
                        }
                        label="Group by Note"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ color: '#b98f33', fontWeight: 'bold', mr: 1 }}
                      />
                      <IconButton
                        onClick={() => setMaterialsCardExpanded(!materialsCardExpanded)}
                        sx={{ color: '#b98f33' }}
                      >
                        {materialsCardExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  }
                  onClick={() => setMaterialsCardExpanded(!materialsCardExpanded)}
                  sx={{ cursor: 'pointer' }}
                />
                <Collapse in={materialsCardExpanded} timeout="auto" unmountOnExit>
                  <CardContent>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {Array.from(allMaterials).map((material, index) => (
                        <Chip
                          key={index}
                          label={material}
                          sx={{
                            backgroundColor: '#f5f5f5',
                            color: '#333',
                            border: '1px solid #d4af5a',
                            fontWeight: 'medium'
                          }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Collapse>
              </Card>
            );
          }
        }
        return null;
      })()}
      </Box>

      {/* Invoices Table */}
      {invoices.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No invoices found for this corporate customer.
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>Invoice #</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>Contact Person</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }} align="right">Total Before Tax</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }} align="right">Tax</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }} align="right">Total After Tax</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => {
                const taxBreakdown = getInvoiceTaxBreakdown(invoice);
                return (
                  <TableRow
                    key={invoice.id}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(212, 175, 90, 0.05)',
                        cursor: 'pointer'
                      }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ReceiptIcon sx={{ fontSize: 20, color: '#d4af5a' }} />
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatCorporateInvoiceForInvoice(invoice.orderDetails?.billInvoice) || 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {invoice.createdAt?.toDate
                        ? formatDateOnly(invoice.createdAt.toDate())
                        : invoice.createdAt
                        ? formatDateOnly(new Date(invoice.createdAt.seconds * 1000))
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {invoice.contactPerson?.name || 'N/A'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {formatCurrency(taxBreakdown.beforeTax)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {formatCurrency(taxBreakdown.tax)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 'bold', color: '#b98f33' }}>
                      {formatCurrency(taxBreakdown.afterTax)}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleViewInvoice(invoice)}
                          sx={{
                            background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                            color: '#000000',
                            border: '2px solid #4CAF50',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.2)',
                            '&:hover': {
                              background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                              border: '2px solid #45a049',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.3)'
                            }
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PdfIcon />}
                          onClick={() => handleDownloadPDF(invoice)}
                          sx={{
                            background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                            color: '#000000',
                            border: '2px solid #4CAF50',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.2)',
                            '&:hover': {
                              background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                              border: '2px solid #45a049',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.3)'
                            }
                          }}
                        >
                          PDF
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Summary */}
      {invoices.length > 0 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Card sx={{ border: '2px solid #d4af5a', borderRadius: 2, p: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Total Invoices: {invoices.length}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
              Total Amount: {formatCurrency(
                invoices.reduce((sum, invoice) => sum + calculateInvoiceTotal(invoice), 0)
              )}
            </Typography>
          </Card>
        </Box>
      )}

      {/* Invoice Dialog */}
      <Dialog
        open={invoiceDialogOpen}
        onClose={handleCloseInvoiceDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {selectedInvoice && (
          <>
            {/* Header with Credit Card Fee Toggle */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', backgroundColor: '#000000' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {/* Previous Invoice Button */}
                  <IconButton
                    onClick={handlePreviousInvoice}
                    disabled={!canNavigatePrevious()}
                    sx={{ 
                      color: canNavigatePrevious() ? '#b98f33' : '#666666',
                      '&:hover': {
                        backgroundColor: canNavigatePrevious() ? 'rgba(185, 143, 51, 0.1)' : 'transparent'
                      },
                      '&.Mui-disabled': {
                        color: '#666666'
                      }
                    }}
                  >
                    <ArrowLeftIcon />
                  </IconButton>
                  
                  {/* Invoice Counter */}
                  <Typography variant="body2" sx={{ color: '#b98f33', minWidth: '80px', textAlign: 'center' }}>
                    {getCurrentInvoiceIndex() + 1} / {invoices.length}
                  </Typography>
                  
                  {/* Next Invoice Button */}
                  <IconButton
                    onClick={handleNextInvoice}
                    disabled={!canNavigateNext()}
                    sx={{ 
                      color: canNavigateNext() ? '#b98f33' : '#666666',
                      '&:hover': {
                        backgroundColor: canNavigateNext() ? 'rgba(185, 143, 51, 0.1)' : 'transparent'
                      },
                      '&.Mui-disabled': {
                        color: '#666666'
                      }
                    }}
                  >
                    <ArrowRightIcon />
                  </IconButton>
                  
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', ml: 2 }}>
                    Corporate Invoice - #{formatCorporateInvoiceForInvoice(selectedInvoice.orderDetails?.billInvoice)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={creditCardFeeEnabled}
                        onChange={(e) => handleCreditCardFeeToggle(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Credit Card Fee (2.5%)"
                    sx={{ ml: 0, color: '#b98f33' }}
                  />
                  <IconButton
                    onClick={handleCloseInvoiceDialog}
                    sx={{ color: '#b98f33' }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Box>
              
              <Typography variant="body2" sx={{ color: '#b98f33', mb: 2 }}>
                {selectedInvoice.corporateCustomer?.corporateName} • {selectedInvoice.contactPerson?.name}
              </Typography>

              {/* Internal JL Cost Analysis */}
              {(() => {
                const furnitureGroups = selectedInvoice.furnitureGroups || [];
                
                let jlSubtotalBeforeTax = 0;
                let jlGrandTotal = 0;
                
                furnitureGroups.forEach(group => {
                  if (group.materialJLPrice && parseFloat(group.materialJLPrice) > 0) {
                    const materialSubtotal = (parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0);
                    jlSubtotalBeforeTax += materialSubtotal;
                    const materialTaxRate = getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates);
                    const materialLineTotal = materialSubtotal * (1 + materialTaxRate);
                    jlGrandTotal += materialLineTotal;
                  }
                  
                  if (group.foamJLPrice && parseFloat(group.foamJLPrice) > 0) {
                    const foamSubtotal = (parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0);
                    jlSubtotalBeforeTax += foamSubtotal;
                    jlGrandTotal += foamSubtotal;
                  }
                });
                
                if (selectedInvoice.extraExpenses && selectedInvoice.extraExpenses.length > 0) {
                  selectedInvoice.extraExpenses.forEach(expense => {
                    const expenseQty = parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1;
                    const expenseSubtotal = expenseQty * (parseFloat(expense.price) || 0);
                    jlSubtotalBeforeTax += expenseSubtotal;
                    const expenseLineTotal = parseFloat(expense.total) || expenseSubtotal * (1 + (parseFloat(expense.taxRate) || 0.13));
                    jlGrandTotal += expenseLineTotal;
                  });
                }
                
                const hasJLData = jlSubtotalBeforeTax > 0 || (selectedInvoice.extraExpenses && selectedInvoice.extraExpenses.length > 0);
                
                if (!hasJLData) return null;
                
                return (
                  <Box sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 'bold', 
                      mb: 1.5,
                      color: '#000000'
                    }}>
                      Internal JL Cost Analysis
                    </Typography>

                    {/* JL Table Header */}
                    <Box sx={{ 
                      display: 'flex',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#000000'
                    }}>
                      <Box sx={{ flex: 2, p: 0.5, borderRight: '1px solid #ccc' }}>Component</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Qty</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Unit Price</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Subtotal</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>TAX</Box>
                      <Box sx={{ flex: 1, p: 0.5, textAlign: 'right' }}>Line Total</Box>
                    </Box>

                    {/* JL Table Content */}
                    {furnitureGroups.map((group, groupIndex) => {
                      const hasMaterial = group.materialJLPrice && parseFloat(group.materialJLPrice) > 0;
                      const hasFoam = group.foamJLPrice && parseFloat(group.foamJLPrice) > 0;
                      const hasRecords = hasMaterial || hasFoam;
                      
                      if (!hasRecords) return null;
                      
                      return (
                        <Box key={groupIndex}>
                          <Box sx={{ 
                            display: 'flex',
                            backgroundColor: '#f8f8f8',
                            border: '1px solid #ccc',
                            borderTop: 'none',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            color: '#000000',
                            minHeight: '24px'
                          }}>
                            <Box sx={{ flex: 6, py: 0.25, px: 0.5, display: 'flex', alignItems: 'center' }}>
                              {group.furnitureType || 'Furniture Group'}
                            </Box>
                          </Box>

                          {hasMaterial && (
                            <Box sx={{ 
                              display: 'flex',
                              border: '1px solid #ccc',
                              borderTop: 'none',
                              fontSize: '0.8rem',
                              color: '#000000',
                              backgroundColor: '#ffffff',
                              minHeight: '24px'
                            }}>
                              <Box sx={{ flex: 2, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                                Material ({group.materialCode || 'N/A'})
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {(parseFloat(group.materialJLQnty) || 0).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(parseFloat(group.materialJLPrice) || 0).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates)).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * (1 + getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates))).toFixed(2)}
                              </Box>
                            </Box>
                          )}

                          {hasFoam && (
                            <Box sx={{ 
                              display: 'flex',
                              border: '1px solid #ccc',
                              borderTop: 'none',
                              fontSize: '0.8rem',
                              color: '#000000',
                              backgroundColor: '#ffffff',
                              minHeight: '24px'
                            }}>
                              <Box sx={{ flex: 2, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                                Foam
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {(parseFloat(group.foamQnty) || 1).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(parseFloat(group.foamJLPrice) || 0).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${((parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                $0.00
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${((parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)).toFixed(2)}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      );
                    })}

                    {/* Extra Expenses */}
                    {selectedInvoice.extraExpenses && selectedInvoice.extraExpenses.length > 0 && (
                      <>
                        <Box sx={{ 
                          display: 'flex',
                          backgroundColor: '#f8f8f8',
                          border: '1px solid #ccc',
                          borderTop: 'none',
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          color: '#000000',
                          minHeight: '24px'
                        }}>
                          <Box sx={{ flex: 6, py: 0.25, px: 0.5, display: 'flex', alignItems: 'center' }}>
                            Extra Expenses
                          </Box>
                        </Box>
                        {selectedInvoice.extraExpenses.map((expense, expenseIndex) => (
                          <Box key={expenseIndex} sx={{ 
                            display: 'flex',
                            border: '1px solid #ccc',
                            borderTop: 'none',
                            fontSize: '0.8rem',
                            color: '#000000',
                            backgroundColor: '#ffffff',
                            minHeight: '24px'
                          }}>
                            <Box sx={{ flex: 2, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                              {expense.description || 'Extra Expense'}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {(parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${(parseFloat(expense.price) || 0).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${((parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1) * (parseFloat(expense.price) || 0)).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${(((parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1) * (parseFloat(expense.price) || 0)) * (parseFloat(expense.taxRate) || 0.13)).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${(parseFloat(expense.total) || 0).toFixed(2)}
                            </Box>
                          </Box>
                        ))}
                      </>
                    )}

                    {/* JL Totals */}
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end',
                      mt: 1
                    }}>
                      <Box sx={{ 
                        width: 300,
                        backgroundColor: '#f0f0f0',
                        border: '1px solid #999',
                        p: 1.5
                      }}>
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          mb: 0.5,
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          color: '#000000'
                        }}>
                          <span>Subtotal (Before Tax):</span>
                          <span style={{ color: '#000000' }}>${jlSubtotalBeforeTax.toFixed(2)}</span>
                        </Box>
                        <Box sx={{ 
                          borderTop: '1px solid #ccc',
                          pt: 0.5,
                          display: 'flex', 
                          justifyContent: 'space-between',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          color: '#000000'
                        }}>
                          <span>Grand Total (JL Internal Cost):</span>
                          <span style={{ color: '#f27921' }}>${jlGrandTotal.toFixed(2)}</span>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })()}
            </Box>

            {/* Invoice Content */}
            <DialogContent sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              {(() => {
                const totals = calculateCorporateInvoiceTotals(selectedInvoice);
                return (
                  <Paper 
                    data-invoice-content
                    elevation={3} 
                    sx={{ 
                      p: 4, 
                      width: '100%',
                      mx: 'auto',
                      backgroundColor: 'white',
                      '& .MuiTableHead-root': {
                        backgroundColor: '#ffffff !important'
                      },
                      '& .MuiTableCell-head': {
                        backgroundColor: '#ffffff !important'
                      },
                      '& .MuiTableRow-head': {
                        backgroundColor: '#ffffff !important'
                      }
                    }}
                  >
                    {/* Professional Invoice Header - Image Only */}
                    <Box className="invoice-header" sx={{ 
                      mb: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <img 
                        src="/assets/images/invoice-headers/Invoice Header.png" 
                        alt="Invoice Header" 
                        style={{ 
                          width: '100%',
                          height: 'auto',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />
                    </Box>

                    {/* Invoice Information Row - Left: Customer Info, Right: Date/Invoice/Tax */}
                    <Box className="invoice-info-section" sx={{ 
                      mb: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}>
                      {/* Left Side - Customer Information */}
                      <Box sx={{ flex: 1, mr: 4 }}>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 'bold', 
                          color: 'black',
                          mb: 2
                        }}>
                          Invoice to:
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: 'black' }}>
                          {selectedInvoice.corporateCustomer?.corporateName}
                        </Typography>
                        {selectedInvoice.contactPerson?.name && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', display: 'inline' }}>
                              Contact: {selectedInvoice.contactPerson.name}
                            </Typography>
                            {selectedInvoice.orderDetails?.note?.value && (
                              <Typography variant="body1" sx={{ color: 'black', display: 'inline', ml: 1 }}>
                                • <strong>{selectedInvoice.orderDetails.note.caption || 'Note'}:</strong> {selectedInvoice.orderDetails.note.value}
                              </Typography>
                            )}
                          </Box>
                        )}
                        {selectedInvoice.contactPerson?.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <PhoneIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                            <Typography variant="body1" sx={{ color: 'black' }}>
                              {selectedInvoice.contactPerson.phone}
                            </Typography>
                          </Box>
                        )}
                        {selectedInvoice.contactPerson?.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <EmailIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                            <Typography variant="body1" sx={{ color: 'black' }}>
                              {selectedInvoice.contactPerson.email}
                            </Typography>
                          </Box>
                        )}
                        {selectedInvoice.corporateCustomer?.address && (
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                            <LocationIcon sx={{ mr: 1, fontSize: '16px', color: '#666666', mt: 0.2 }} />
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', color: 'black' }}>
                              {selectedInvoice.corporateCustomer.address}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* Right Side - Invoice Details */}
                      <Box sx={{ 
                        minWidth: '250px',
                        flexShrink: 0
                      }}>
                        <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                          <strong>Date:</strong> {selectedInvoice.createdAt?.toDate
                            ? formatDateOnly(selectedInvoice.createdAt.toDate())
                            : selectedInvoice.createdAt
                            ? formatDateOnly(new Date(selectedInvoice.createdAt.seconds * 1000))
                            : formatDateOnly(new Date())}
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                          <strong>Invoice #</strong> {formatCorporateInvoiceForInvoice(selectedInvoice.orderDetails?.billInvoice)}
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                          <strong>Tax #</strong> 798633319-RT0001
                        </Typography>
                      </Box>
                    </Box>

                    {/* Items Table and Totals - Professional Layout */}
                    <Box className="invoice-table-section" sx={{ mb: 4 }}>
                      <Box sx={{ 
                        border: '2px solid #333333',
                        borderRadius: 0,
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <table style={{ 
                          width: '100%', 
                          borderCollapse: 'collapse',
                          backgroundColor: 'white',
                          tableLayout: 'fixed'
                        }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                              <th style={{ 
                                width: '66.67%',
                                padding: '8px 16px',
                                textAlign: 'left',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                borderRight: '1px solid #ddd',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Description</th>
                              <th style={{ 
                                width: '11.11%',
                                padding: '8px 16px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                borderRight: '1px solid #ddd',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Price</th>
                              <th style={{ 
                                width: '11.11%',
                                padding: '8px 16px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                borderRight: '1px solid #ddd',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Unit</th>
                              <th style={{ 
                                width: '11.11%',
                                padding: '8px 16px',
                                textAlign: 'right',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const furnitureGroups = selectedInvoice.furnitureGroups || [];
                              const rows = [];
                              
                              if (furnitureGroups.length === 0) {
                                rows.push(
                                  <tr key="no-items">
                                    <td colSpan="4" style={{ 
                                      padding: '16px',
                                      textAlign: 'center',
                                      color: '#666666',
                                      fontStyle: 'italic',
                                      border: 'none'
                                    }}>
                                      No items found
                                    </td>
                                  </tr>
                                );
                              } else {
                                furnitureGroups.forEach((group, groupIndex) => {
                                  rows.push(
                                    <tr key={`group-${groupIndex}`} style={{ backgroundColor: '#f8f9fa' }}>
                                      <td colSpan="4" style={{ 
                                        padding: '10px 16px',
                                        fontWeight: 'bold',
                                        color: '#274290',
                                        border: 'none',
                                        borderBottom: '1px solid #ddd',
                                        fontSize: '14px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        {group.furnitureType || `Furniture Group ${groupIndex + 1}`}
                                      </td>
                                    </tr>
                                  );
                                  
                                  const groupItems = [];
                                  
                                  if (group.furniture && Array.isArray(group.furniture)) {
                                    group.furniture.forEach((furniture, furnitureIndex) => {
                                      if (furniture.price && furniture.quantity) {
                                        groupItems.push({
                                          id: `item-${groupIndex}-furniture-${furnitureIndex}`,
                                          name: furniture.name || `Furniture Item ${furnitureIndex + 1}`,
                                          price: parseFloat(furniture.price) || 0,
                                          quantity: parseFloat(furniture.quantity) || 0
                                        });
                                      }
                                    });
                                  }
                                  
                                  if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-material`,
                                      name: `${group.materialCompany || 'Material'} - ${group.materialCode || 'Code'}`,
                                      price: parseFloat(group.materialPrice) || 0,
                                      quantity: parseFloat(group.materialQnty) || 0
                                    });
                                  }
                                  
                                  if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-labour`,
                                      name: `Labour Work${group.labourNote ? ` - ${group.labourNote}` : ''}`,
                                      price: parseFloat(group.labourPrice) || 0,
                                      quantity: parseFloat(group.labourQnty) || 0
                                    });
                                  }
                                  
                                  if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-foam`,
                                      name: `Foam${group.foamNote ? ` - ${group.foamNote}` : ''}`,
                                      price: parseFloat(group.foamPrice) || 0,
                                      quantity: parseFloat(group.foamQnty) || 0
                                    });
                                  }
                                  
                                  if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-painting`,
                                      name: `Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}`,
                                      price: parseFloat(group.paintingLabour) || 0,
                                      quantity: parseFloat(group.paintingQnty) || 0
                                    });
                                  }
                                  
                                  groupItems.forEach((item, itemIndex) => {
                                    rows.push(
                                      <tr key={item.id || `item-${groupIndex}-${itemIndex}`} style={{ 
                                        borderBottom: '1px solid #ddd'
                                      }}>
                                        <td style={{ 
                                          width: '66.67%',
                                          padding: '8px 16px',
                                          color: '#333333',
                                          border: 'none',
                                          borderRight: '1px solid #eee',
                                          fontSize: '14px'
                                        }}>
                                          {item.name}
                                        </td>
                                        <td style={{ 
                                          width: '11.11%',
                                          padding: '8px 16px',
                                          textAlign: 'center',
                                          color: '#333333',
                                          border: 'none',
                                          borderRight: '1px solid #eee',
                                          fontSize: '14px',
                                          fontWeight: '500'
                                        }}>
                                          ${parseFloat(item.price || 0).toFixed(2)}
                                        </td>
                                        <td style={{ 
                                          width: '11.11%',
                                          padding: '8px 16px',
                                          textAlign: 'center',
                                          color: '#333333',
                                          border: 'none',
                                          borderRight: '1px solid #eee',
                                          fontSize: '14px',
                                          fontWeight: '500'
                                        }}>
                                          {item.quantity || 0}
                                        </td>
                                        <td style={{ 
                                          width: '11.11%',
                                          padding: '8px 16px',
                                          textAlign: 'right',
                                          fontWeight: 'bold',
                                          color: '#333333',
                                          border: 'none',
                                          fontSize: '14px'
                                        }}>
                                          ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  });
                                  
                                  if (groupItems.length === 0) {
                                    rows.push(
                                      <tr key={`no-items-${groupIndex}`} style={{ 
                                        borderBottom: '1px solid #ddd'
                                      }}>
                                        <td colSpan="4" style={{ 
                                          padding: '8px 16px',
                                          color: '#666666',
                                          fontStyle: 'italic',
                                          border: 'none',
                                          fontSize: '14px'
                                        }}>
                                          No items in this group
                                        </td>
                                      </tr>
                                    );
                                  }
                                });
                              }

                              return rows;
                            })()}
                          </tbody>
                        </table>
                      </Box>
                      
                      {/* Terms and Conditions + Totals Section - Side by side */}
                      <Box sx={{ mt: 1 }}>
                        <Box sx={{ 
                          display: 'flex',
                          width: '100%',
                          gap: 4
                        }}>
                          {/* Left Side - Terms and Conditions */}
                          <Box sx={{ 
                            flex: '0 0 50%',
                            maxWidth: '50%'
                          }}>
                            <Box className="terms-header" sx={{ 
                              backgroundColor: '#cc820d',
                              color: 'white',
                              p: 1,
                              mb: 2
                            }}>
                              <Typography variant="h6" sx={{ 
                                fontWeight: 'bold', 
                                color: 'white',
                                textAlign: 'center',
                                textTransform: 'uppercase'
                              }}>
                                Terms and Conditions
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                                  Payment by Cheque: <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666' }}>(for corporates only)</span>
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Mail to: 322 Etheridge ave, Milton, ON CANADA L9E 1H7
                                </Typography>
                              </Box>
                              
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                                  Payment by direct deposit:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Transit Number: 07232
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Institution Number: 010
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Account Number: 1090712
                                </Typography>
                              </Box>
                              
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                                  Payment by e-transfer:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  JL@JLupholstery.com
                                </Typography>
                              </Box>
                            </Box>
                          </Box>

                          {/* Right Side - Totals Section */}
                          <Box sx={{ 
                            flex: '1',
                            display: 'flex', 
                            justifyContent: 'flex-end', 
                            alignItems: 'flex-start'
                          }}>
                            <Box className="totals-section" sx={{ 
                              minWidth: '300px',
                              maxWidth: '400px'
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" sx={{ color: 'black' }}>Subtotal:</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                  ${totals.subtotal.toFixed(2)}
                                </Typography>
                              </Box>
                              
                              {totals.delivery > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="body1" sx={{ color: 'black' }}>Delivery:</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                    ${totals.delivery.toFixed(2)}
                                  </Typography>
                                </Box>
                              )}
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" sx={{ color: 'black' }}>Tax Rate:</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                  13%
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" sx={{ color: 'black' }}>Tax Due:</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                  ${totals.tax.toFixed(2)}
                                </Typography>
                              </Box>
                              
                              {creditCardFeeEnabled && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="body1" sx={{ color: 'black' }}>Credit Card Fee:</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                    ${totals.creditCardFee.toFixed(2)}
                                  </Typography>
                                </Box>
                              )}
                              
                              <Box className="total-box" sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                mb: 1,
                                backgroundColor: '#2c2c2c',
                                color: 'white',
                                p: 1,
                                borderRadius: 1
                              }}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white !important' }}>
                                  Total:
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white !important' }}>
                                  ${totals.total.toFixed(2)}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Professional Invoice Footer - Image Only */}
                    <Box className="invoice-footer" sx={{ 
                      mt: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <img 
                        src="/assets/images/invoice-headers/invoice Footer.png" 
                        alt="Invoice Footer" 
                        style={{ 
                          width: '100%',
                          height: 'auto',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />
                    </Box>
                  </Paper>
                );
              })()}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default CorporateCustomerInvoicesPage;

