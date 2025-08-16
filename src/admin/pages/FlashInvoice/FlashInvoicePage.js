import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Fab,
  Zoom,
  Fade,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  FlashOn as FlashIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Register the autoTable plugin
jsPDF.API.autoTable = autoTable;

const FlashInvoicePage = () => {
  // State for invoice list
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // State for flash editing
  const [flashInvoices, setFlashInvoices] = useState({});
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isFlashMode, setIsFlashMode] = useState(false);
  const [flashEditorOpen, setFlashEditorOpen] = useState(false);

  // State for notifications
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });

  // State for PDF generation
  const [generatingPDF, setGeneratingPDF] = useState(false);
  
  // State for new invoice creation
  const [createNewInvoice, setCreateNewInvoice] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const invoicesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Order data for invoice:', data); // Debug log
        
        // Create invoice structure from order data
        const invoice = {
          id: doc.id,
          ...data,
          invoiceNumber: data.orderDetails?.billInvoice ? `INV-${data.orderDetails.billInvoice}` : `INV-${doc.id.slice(-6).toUpperCase()}`,
          status: data.invoiceStatus || 'active',
          customer: {
            name: data.personalInfo?.customerName || 'Customer Name',
            email: data.personalInfo?.email || '',
            phone: data.personalInfo?.phone || '',
            address: data.personalInfo?.address || ''
          },
          // Convert furniture data to invoice items
          items: []
        };
        
        // Convert furniture groups to invoice items
        if (data.furnitureData?.groups) {
          data.furnitureData.groups.forEach((group, groupIndex) => {
            if (group.items && group.items.length > 0) {
              group.items.forEach((item, itemIndex) => {
                invoice.items.push({
                  id: `item_${groupIndex}_${itemIndex}`,
                  description: item.description || item.name || `Furniture Item ${groupIndex + 1}-${itemIndex + 1}`,
                  quantity: item.quantity || 1,
                  unitPrice: item.price || item.cost || 0,
                  total: (item.quantity || 1) * (item.price || item.cost || 0),
                  group: group.name || `Group ${groupIndex + 1}`
                });
              });
            }
          });
        }
        
        // If no items from furniture data, create from total
        if (invoice.items.length === 0) {
          const total = data.orderDetails?.total || data.total || 0;
          invoice.items = [{
            id: 'default_item',
            description: 'Order Service',
            quantity: 1,
            unitPrice: total,
            total: total
          }];
        }
        
        return invoice;
      });
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      showNotification('Error fetching invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ open: true, message, type });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // Flash Invoice Management
  const enterFlashMode = (invoice) => {
    console.log('Entering flash mode for invoice:', invoice); // Debug log
    
    // Ensure items have proper structure
    const processedItems = (invoice.items || []).map((item, index) => ({
      id: item.id || `item_${index}`,
      description: item.description || item.name || `Item ${index + 1}`,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || item.price || item.cost || 0,
      total: item.total || ((item.quantity || 1) * (item.unitPrice || item.price || item.cost || 0))
    }));
    
    const flashData = {
      originalData: { ...invoice },
      flashData: { ...invoice },
      isModified: false,
      lastModified: new Date(),
      items: processedItems
    };

    console.log('Flash data created:', flashData); // Debug log

    setFlashInvoices(prev => ({
      ...prev,
      [invoice.id]: flashData
    }));

    setSelectedInvoice(invoice);
    setIsFlashMode(true);
    setFlashEditorOpen(true);
    showNotification(`Entered flash mode for ${invoice.invoiceNumber}`, 'info');
  };

  const exitFlashMode = () => {
    if (selectedInvoice && flashInvoices[selectedInvoice.id]?.isModified) {
      if (window.confirm('You have unsaved changes. Are you sure you want to exit flash mode?')) {
        resetFlashInvoice(selectedInvoice.id);
      } else {
        return;
      }
    }
    
    setFlashEditorOpen(false);
    setIsFlashMode(false);
    setSelectedInvoice(null);
    setCreateNewInvoice(false);
    showNotification('Exited flash mode', 'info');
  };

  const resetFlashInvoice = (invoiceId) => {
    setFlashInvoices(prev => {
      const newState = { ...prev };
      delete newState[invoiceId];
      return newState;
    });
  };

  const updateFlashInvoice = (invoiceId, updates) => {
    setFlashInvoices(prev => ({
      ...prev,
      [invoiceId]: {
        ...prev[invoiceId],
        flashData: { ...prev[invoiceId].flashData, ...updates },
        isModified: true,
        lastModified: new Date()
      }
    }));
  };

  const updateFlashItem = (invoiceId, itemIndex, updates) => {
    console.log('Updating flash item:', { invoiceId, itemIndex, updates }); // Debug log
    
    setFlashInvoices(prev => {
      const flashInvoice = prev[invoiceId];
      if (!flashInvoice) {
        console.error('Flash invoice not found:', invoiceId);
        return prev;
      }
      
      const updatedItems = [...flashInvoice.items];
      if (updatedItems[itemIndex]) {
        updatedItems[itemIndex] = { 
          ...updatedItems[itemIndex], 
          ...updates,
          // Recalculate total if quantity or unitPrice changed
          total: (updates.quantity || updatedItems[itemIndex].quantity || 1) * 
                 (updates.unitPrice || updatedItems[itemIndex].unitPrice || 0)
        };
      }
      
      console.log('Updated items:', updatedItems); // Debug log
      
      return {
        ...prev,
        [invoiceId]: {
          ...flashInvoice,
          items: updatedItems,
          isModified: true,
          lastModified: new Date()
        }
      };
    });
  };

  const addFlashItem = (invoiceId) => {
    console.log('Adding flash item to invoice:', invoiceId); // Debug log
    
    const newItem = {
      id: `item_${Date.now()}`,
      description: 'New Item',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      isNew: true
    };

    setFlashInvoices(prev => {
      const flashInvoice = prev[invoiceId];
      if (!flashInvoice) {
        console.error('Flash invoice not found:', invoiceId);
        return prev;
      }
      
      const updatedItems = [...flashInvoice.items, newItem];
      console.log('Items after adding:', updatedItems); // Debug log
      
      return {
        ...prev,
        [invoiceId]: {
          ...flashInvoice,
          items: updatedItems,
          isModified: true,
          lastModified: new Date()
        }
      };
    });
  };

  const removeFlashItem = (invoiceId, itemIndex) => {
    console.log('Removing flash item:', { invoiceId, itemIndex }); // Debug log
    
    setFlashInvoices(prev => {
      const flashInvoice = prev[invoiceId];
      if (!flashInvoice) {
        console.error('Flash invoice not found:', invoiceId);
        return prev;
      }
      
      const updatedItems = flashInvoice.items.filter((_, index) => index !== itemIndex);
      console.log('Items after removal:', updatedItems); // Debug log
      
      return {
        ...prev,
        [invoiceId]: {
          ...flashInvoice,
          items: updatedItems,
          isModified: true,
          lastModified: new Date()
        }
      };
    });
  };

  // PDF Generation
  const generatePDF = async (invoiceId) => {
    try {
      setGeneratingPDF(true);
      const flashInvoice = flashInvoices[invoiceId];
      const invoiceData = flashInvoice ? flashInvoice.flashData : invoices.find(inv => inv.id === invoiceId);
      
      if (!invoiceData) {
        showNotification('Invoice data not found', 'error');
        return;
      }

      const pdf = new jsPDF();
      
      // Company Header
      pdf.setFontSize(24);
      pdf.setTextColor(40, 40, 40);
      pdf.text('JL OPERATIONS', 20, 30);
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Professional Furniture Services', 20, 40);
      pdf.text('Phone: +1 (555) 123-4567', 20, 50);
      pdf.text('Email: info@jloperations.com', 20, 60);
      
      // Invoice Details
      pdf.setFontSize(18);
      pdf.setTextColor(40, 40, 40);
      pdf.text('INVOICE', 150, 30);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Invoice #: ${invoiceData.invoiceNumber}`, 150, 45);
      pdf.text(`Date: ${new Date(invoiceData.createdAt?.toDate?.() || invoiceData.createdAt).toLocaleDateString()}`, 150, 55);
      pdf.text(`Due Date: ${new Date(invoiceData.dueDate?.toDate?.() || invoiceData.dueDate || Date.now() + 30*24*60*60*1000).toLocaleDateString()}`, 150, 65);
      
             // Customer Information
       pdf.setFontSize(12);
       pdf.setTextColor(40, 40, 40);
       pdf.text('Bill To:', 20, 90);
       
       pdf.setFontSize(10);
       pdf.setTextColor(100, 100, 100);
       if (invoiceData.customer) {
         pdf.text(invoiceData.customer.name || 'Customer Name', 20, 105);
         pdf.text(invoiceData.customer.email || 'customer@email.com', 20, 115);
         pdf.text(invoiceData.customer.phone || 'Phone Number', 20, 125);
         if (invoiceData.customer.address) {
           pdf.text(invoiceData.customer.address, 20, 135);
         }
       } else if (invoiceData.personalInfo) {
         // Fallback to personalInfo if customer object doesn't exist
         pdf.text(invoiceData.personalInfo.customerName || 'Customer Name', 20, 105);
         pdf.text(invoiceData.personalInfo.email || 'customer@email.com', 20, 115);
         pdf.text(invoiceData.personalInfo.phone || 'Phone Number', 20, 125);
         if (invoiceData.personalInfo.address) {
           pdf.text(invoiceData.personalInfo.address, 20, 135);
         }
       }
      
      // Items Table
      const items = flashInvoice ? flashInvoice.items : (invoiceData.items || []);
      const tableData = items.map((item, index) => [
        index + 1,
        item.description || 'Item Description',
        item.quantity || 1,
        `$${(item.unitPrice || 0).toFixed(2)}`,
        `$${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}`
      ]);
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0);
      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;
      
      // Add total row
      tableData.push(['', '', '', 'Subtotal:', `$${subtotal.toFixed(2)}`]);
      tableData.push(['', '', '', 'Tax (10%):', `$${tax.toFixed(2)}`]);
      tableData.push(['', '', '', 'Total:', `$${total.toFixed(2)}`]);
      
      pdf.autoTable({
        startY: 150,
        head: [['#', 'Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [185, 143, 51],
          textColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 10,
          cellPadding: 5
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 80 },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 }
        }
      });
      
      // Footer
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Thank you for your business!', 20, pdf.internal.pageSize.height - 30);
      pdf.text('Terms: Net 30 days', 20, pdf.internal.pageSize.height - 20);
      
      // Save PDF
      const fileName = `Invoice_${invoiceData.invoiceNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      showNotification('PDF generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showNotification('Error generating PDF', 'error');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Filter and search
  const filteredInvoices = invoices.filter(invoice => {
    const customerName = invoice.customer?.name || invoice.personalInfo?.customerName || '';
    const matchesSearch = invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'flash' && flashInvoices[invoice.id]) ||
                         (filterStatus === 'modified' && flashInvoices[invoice.id]?.isModified);
    return matchesSearch && matchesFilter;
  });

  const getCurrentInvoiceData = (invoice) => {
    return flashInvoices[invoice.id] ? flashInvoices[invoice.id].flashData : invoice;
  };

  const getCurrentItems = (invoice) => {
    if (flashInvoices[invoice.id]) {
      console.log('Getting flash items for invoice:', invoice.id, flashInvoices[invoice.id].items);
      return flashInvoices[invoice.id].items;
    } else {
      console.log('Getting original items for invoice:', invoice.id, invoice.items);
      return invoice.items || [];
    }
  };

  // Create new invoice functionality
  const createNewFlashInvoice = () => {
    const newInvoice = {
      id: `new_${Date.now()}`,
      invoiceNumber: `INV-NEW-${Date.now().toString().slice(-6).toUpperCase()}`,
      customer: { name: '', email: '', phone: '' },
      createdAt: new Date(),
      items: [{
        id: 'new_item_1',
        description: 'New Service',
        quantity: 1,
        unitPrice: 0,
        total: 0
      }],
      status: 'draft'
    };

    const flashData = {
      originalData: { ...newInvoice },
      flashData: { ...newInvoice },
      isModified: false,
      lastModified: new Date(),
      items: [...newInvoice.items]
    };

    setFlashInvoices(prev => ({
      ...prev,
      [newInvoice.id]: flashData
    }));

    setSelectedInvoice(newInvoice);
    setIsFlashMode(true);
    setFlashEditorOpen(true);
    setCreateNewInvoice(true);
    showNotification('Created new flash invoice', 'success');
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#1a1a1a' }}>
      {/* Header */}
      <Card sx={{ mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                Flash Invoice System
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, color: '#ffffff' }}>
                Professional invoice editing with temporary modifications and PDF generation
              </Typography>
            </Box>
                         <Box sx={{ display: 'flex', gap: 1 }}>
               <Button
                 variant="contained"
                 startIcon={<AddIcon />}
                 onClick={createNewFlashInvoice}
                 sx={{
                   backgroundColor: '#4caf50',
                   color: '#ffffff',
                   '&:hover': {
                     backgroundColor: '#45a049',
                   }
                 }}
               >
                 Create New Invoice
               </Button>
               <Button
                 variant="outlined"
                 startIcon={<RefreshIcon />}
                 onClick={fetchInvoices}
                 disabled={loading}
                 sx={{
                   borderColor: '#b98f33',
                   color: '#b98f33',
                   '&:hover': {
                     borderColor: '#d4af5a',
                     backgroundColor: 'rgba(185, 143, 51, 0.08)'
                   }
                 }}
               >
                 Refresh
               </Button>
             </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <Card sx={{ mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#b98f33' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: '#333333',
                    },
                    '&:hover fieldset': {
                      borderColor: '#b98f33',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#b98f33',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`All (${invoices.length})`}
                  onClick={() => setFilterStatus('all')}
                  color={filterStatus === 'all' ? 'primary' : 'default'}
                  sx={{
                    backgroundColor: filterStatus === 'all' ? '#b98f33' : '#3a3a3a',
                    color: filterStatus === 'all' ? '#000000' : '#ffffff',
                  }}
                />
                <Chip
                  label={`Flash Mode (${Object.keys(flashInvoices).length})`}
                  onClick={() => setFilterStatus('flash')}
                  color={filterStatus === 'flash' ? 'primary' : 'default'}
                  sx={{
                    backgroundColor: filterStatus === 'flash' ? '#b98f33' : '#3a3a3a',
                    color: filterStatus === 'flash' ? '#000000' : '#ffffff',
                  }}
                />
                <Chip
                  label={`Modified (${Object.values(flashInvoices).filter(fi => fi.isModified).length})`}
                  onClick={() => setFilterStatus('modified')}
                  color={filterStatus === 'modified' ? 'primary' : 'default'}
                  sx={{
                    backgroundColor: filterStatus === 'modified' ? '#b98f33' : '#3a3a3a',
                    color: filterStatus === 'modified' ? '#000000' : '#ffffff',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Grid container spacing={3}>
        {loading ? (
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress sx={{ color: '#b98f33' }} />
            </Box>
          </Grid>
        ) : filteredInvoices.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <ReceiptIcon sx={{ fontSize: 64, color: '#666666', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                  No invoices found
                </Typography>
                <Typography variant="body2" sx={{ color: '#999999' }}>
                  {searchTerm || filterStatus !== 'all' ? 'Try adjusting your search or filter criteria.' : 'No invoices available.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredInvoices.map((invoice) => {
            const currentData = getCurrentInvoiceData(invoice);
            const isInFlashMode = flashInvoices[invoice.id];
            const isModified = flashInvoices[invoice.id]?.isModified;
            
            return (
              <Grid item xs={12} md={6} lg={4} key={invoice.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #333333',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      transform: 'translateY(-2px)'
                    },
                    ...(isInFlashMode && {
                      border: '2px solid #b98f33',
                      boxShadow: '0 0 20px rgba(185, 143, 51, 0.3)'
                    })
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
                          {currentData.invoiceNumber}
                        </Typography>
                                                 <Typography variant="body2" sx={{ color: '#ffffff', mb: 1 }}>
                           {currentData.customer?.name || currentData.personalInfo?.customerName || 'Customer Name'}
                         </Typography>
                        <Typography variant="caption" sx={{ color: '#999999' }}>
                          {new Date(currentData.createdAt?.toDate?.() || currentData.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        {isInFlashMode && (
                          <Chip
                            label={isModified ? "Modified" : "Flash Mode"}
                            size="small"
                            sx={{
                              backgroundColor: isModified ? '#ff9800' : '#b98f33',
                              color: '#000000',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                                                 <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                           ${getCurrentItems(invoice).reduce((sum, item) => 
                             sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0
                           ).toFixed(2)}
                         </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2, borderColor: '#333333' }} />

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Tooltip title="Enter Flash Mode">
                        <IconButton
                          size="small"
                          onClick={() => enterFlashMode(invoice)}
                          sx={{
                            color: isInFlashMode ? '#b98f33' : '#ffffff',
                            backgroundColor: isInFlashMode ? 'rgba(185, 143, 51, 0.1)' : 'transparent',
                            '&:hover': {
                              backgroundColor: 'rgba(185, 143, 51, 0.2)',
                            }
                          }}
                        >
                          <FlashIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Generate PDF">
                        <IconButton
                          size="small"
                          onClick={() => generatePDF(invoice.id)}
                          disabled={generatingPDF}
                          sx={{
                            color: '#ffffff',
                            '&:hover': {
                              backgroundColor: 'rgba(76, 175, 80, 0.2)',
                            }
                          }}
                        >
                          {generatingPDF ? <CircularProgress size={16} /> : <PdfIcon />}
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Print Invoice">
                        <IconButton
                          size="small"
                          onClick={() => window.print()}
                          sx={{
                            color: '#ffffff',
                            '&:hover': {
                              backgroundColor: 'rgba(33, 150, 243, 0.2)',
                            }
                          }}
                        >
                          <PrintIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      {/* Flash Editor Dialog */}
      <Dialog
        open={flashEditorOpen}
        onClose={exitFlashMode}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          fontWeight: 'bold'
        }}>
          <Box display="flex" alignItems="center">
            <FlashIcon sx={{ color: '#000000', mr: 1 }} />
                         <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
               {createNewInvoice ? 'New Flash Invoice' : `Flash Invoice Editor - ${selectedInvoice?.invoiceNumber}`}
             </Typography>
          </Box>
          <Box display="flex" gap={1}>
            {flashInvoices[selectedInvoice?.id]?.isModified && (
              <Chip
                label="Modified"
                size="small"
                sx={{
                  backgroundColor: '#ff9800',
                  color: '#000000',
                  fontWeight: 'bold'
                }}
              />
            )}
            <IconButton
              onClick={exitFlashMode}
              sx={{
                color: '#000000',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.1)',
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#2a2a2a' }}>
          {selectedInvoice && (
            <Grid container spacing={3}>
              {/* Invoice Details */}
              <Grid item xs={12} md={6}>
                <Card sx={{ backgroundColor: '#3a3a3a', border: '1px solid #333333' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: '#b98f33', mb: 2, fontWeight: 'bold' }}>
                      Invoice Details
                    </Typography>
                    
                    <TextField
                      fullWidth
                      label="Invoice Number"
                      value={getCurrentInvoiceData(selectedInvoice).invoiceNumber || ''}
                      onChange={(e) => updateFlashInvoice(selectedInvoice.id, { invoiceNumber: e.target.value })}
                      sx={{ mb: 2 }}
                      InputProps={{
                        sx: { color: '#ffffff' }
                      }}
                      InputLabelProps={{
                        sx: { color: '#b98f33' }
                      }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Customer Name"
                      value={getCurrentInvoiceData(selectedInvoice).customer?.name || ''}
                      onChange={(e) => updateFlashInvoice(selectedInvoice.id, { 
                        customer: { 
                          ...getCurrentInvoiceData(selectedInvoice).customer,
                          name: e.target.value 
                        }
                      })}
                      sx={{ mb: 2 }}
                      InputProps={{
                        sx: { color: '#ffffff' }
                      }}
                      InputLabelProps={{
                        sx: { color: '#b98f33' }
                      }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Customer Email"
                      value={getCurrentInvoiceData(selectedInvoice).customer?.email || ''}
                      onChange={(e) => updateFlashInvoice(selectedInvoice.id, { 
                        customer: { 
                          ...getCurrentInvoiceData(selectedInvoice).customer,
                          email: e.target.value 
                        }
                      })}
                      sx={{ mb: 2 }}
                      InputProps={{
                        sx: { color: '#ffffff' }
                      }}
                      InputLabelProps={{
                        sx: { color: '#b98f33' }
                      }}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Invoice Items */}
              <Grid item xs={12} md={6}>
                <Card sx={{ backgroundColor: '#3a3a3a', border: '1px solid #333333' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                        Invoice Items
                      </Typography>
                      <Button
                        startIcon={<AddIcon />}
                        onClick={() => addFlashItem(selectedInvoice.id)}
                        sx={{
                          backgroundColor: '#b98f33',
                          color: '#000000',
                          '&:hover': {
                            backgroundColor: '#d4af5a',
                          }
                        }}
                      >
                        Add Item
                      </Button>
                    </Box>

                    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {getCurrentItems(selectedInvoice).map((item, index) => (
                        <ListItem
                          key={item.id || index}
                          sx={{
                            backgroundColor: '#2a2a2a',
                            mb: 1,
                            borderRadius: 1,
                            border: '1px solid #333333'
                          }}
                        >
                          <ListItemText
                            primary={
                              <TextField
                                fullWidth
                                size="small"
                                placeholder="Item description"
                                value={item.description || ''}
                                onChange={(e) => updateFlashItem(selectedInvoice.id, index, { description: e.target.value })}
                                sx={{ mb: 1 }}
                                InputProps={{
                                  sx: { color: '#ffffff' }
                                }}
                              />
                            }
                            secondary={
                              <Grid container spacing={1}>
                                <Grid item xs={4}>
                                  <TextField
                                    size="small"
                                    placeholder="Qty"
                                    type="number"
                                    value={item.quantity || 1}
                                    onChange={(e) => updateFlashItem(selectedInvoice.id, index, { 
                                      quantity: parseFloat(e.target.value) || 1 
                                    })}
                                    InputProps={{
                                      sx: { color: '#ffffff' }
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={4}>
                                  <TextField
                                    size="small"
                                    placeholder="Price"
                                    type="number"
                                    value={item.unitPrice || 0}
                                    onChange={(e) => updateFlashItem(selectedInvoice.id, index, { 
                                      unitPrice: parseFloat(e.target.value) || 0 
                                    })}
                                    InputProps={{
                                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                      sx: { color: '#ffffff' }
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={4}>
                                  <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                                    ${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}
                                  </Typography>
                                </Grid>
                              </Grid>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              onClick={() => removeFlashItem(selectedInvoice.id, index)}
                              sx={{ color: '#ff4444' }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>

                    {/* Totals */}
                    <Divider sx={{ my: 2, borderColor: '#333333' }} />
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                        Total: ${getCurrentItems(selectedInvoice).reduce((sum, item) => 
                          sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0
                        ).toFixed(2)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, backgroundColor: '#2a2a2a', borderTop: '1px solid #333333' }}>
          <Button
            onClick={exitFlashMode}
            sx={{
              backgroundColor: '#666666',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#888888',
              }
            }}
          >
            Exit Flash Mode
          </Button>
          <Button
            onClick={() => generatePDF(selectedInvoice?.id)}
            variant="contained"
            startIcon={generatingPDF ? <CircularProgress size={16} /> : <PdfIcon />}
            disabled={generatingPDF}
            sx={{
              backgroundColor: '#b98f33',
              color: '#000000',
              '&:hover': {
                backgroundColor: '#d4af5a',
              }
            }}
          >
            {generatingPDF ? 'Generating PDF...' : 'Generate PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.type}
          sx={{
            backgroundColor: notification.type === 'success' ? '#4caf50' : 
                           notification.type === 'error' ? '#f44336' : '#2196f3',
            color: '#ffffff'
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FlashInvoicePage;
