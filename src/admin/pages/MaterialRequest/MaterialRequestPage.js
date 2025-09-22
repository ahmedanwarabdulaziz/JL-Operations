import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  LocalShipping as LocalShippingIcon,
  Note as NoteIcon
} from '@mui/icons-material';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNotification } from '../../../components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';

const MaterialRequestPage = () => {
  const [orders, setOrders] = useState([]);
  const [materialsRequired, setMaterialsRequired] = useState([]);
  const [materialsOrdered, setMaterialsOrdered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(false);
  const [materialNotes, setMaterialNotes] = useState({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedMaterialForNote, setSelectedMaterialForNote] = useState(null);
  const [currentNoteText, setCurrentNoteText] = useState('');

  const { showSuccess, showError } = useNotification();

  // Extract materials from orders (excluding completed/canceled orders)
  const extractMaterialsFromOrders = useCallback((ordersList) => {
    const materials = [];
    let skippedCount = 0;
    
    console.log('Total orders to process:', ordersList.length);
    
          ordersList.forEach(order => {
        // Skip "Done" and "Cancelled" orders - show all other statuses
        const orderStatus = order.orderStatus || order.status || order.invoiceStatus;
        console.log('Checking order status:', orderStatus, 'Order ID:', order.id, 'Invoice:', order.orderDetails?.billInvoice);
        
        if (orderStatus === 'Done' || orderStatus === 'done' || 
            orderStatus === 'Cancelled' || orderStatus === 'cancelled' ||
            orderStatus === 'Canceled' || orderStatus === 'canceled' ||
            orderStatus === 'Completed' || orderStatus === 'completed' ||
            orderStatus === 'Finished' || orderStatus === 'finished') {
          console.log('Skipping order with Done/Cancelled/Completed status:', orderStatus, 'Order ID:', order.id);
          skippedCount++;
          return;
        }

      const furnitureGroups = order.furnitureData?.groups || [];
      
      furnitureGroups.forEach(group => {
        if (group.materialCode && group.materialCompany) {
          // Get quantity from the correct field - use the same logic as materialQntyJL
          const materialQntyJL = group.materialJLQnty || 0;
          
          // Only add materials with actual quantities (> 0)
          if (materialQntyJL > 0) {
            materials.push({
              id: `${order.id}_${group.materialCode}_${group.materialCompany}`,
              orderId: order.id,
              invoiceNo: order.orderDetails?.billInvoice || 'N/A',
              materialCompany: group.materialCompany,
              materialCode: group.materialCode,
              materialName: group.materialName || group.materialCode,
              quantity: materialQntyJL,
              materialQntyJL: materialQntyJL,
              unit: group.unit || 'Yard',
              materialStatus: group.materialStatus || null,
              materialNote: group.materialNote || '',
              orderDate: order.createdAt,
              customerName: order.personalInfo?.customerName || 'N/A',
              orderStatus: orderStatus
            });
          }
        }
      });
    });
    
    console.log('Total materials extracted:', materials.length);
    return materials;
  }, []);

  // Group materials by company
  const groupMaterialsByCompany = (materials) => {
    const grouped = {};
    materials.forEach(material => {
      if (!grouped[material.materialCompany]) {
        grouped[material.materialCompany] = [];
      }
      grouped[material.materialCompany].push(material);
    });
    return grouped;
  };

  // Filter materials based on search term (quantity filtering is done at extraction)
  const filterMaterials = (materials, searchValue) => {
    // No need to filter by quantity here since it's done during extraction
    if (!searchValue.trim()) return materials;
    
    const searchLower = searchValue.toLowerCase();
    return materials.filter(material => 
      material.invoiceNo.toLowerCase().includes(searchLower) ||
      material.materialCode.toLowerCase().includes(searchLower) ||
      material.materialName.toLowerCase().includes(searchLower) ||
      material.materialCompany.toLowerCase().includes(searchLower) ||
      material.customerName.toLowerCase().includes(searchLower)
    );
  };

  // Fetch orders and extract materials
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      
      const ordersCollection = collection(db, 'orders');
      const ordersSnapshot = await getDocs(ordersCollection);
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setOrders(ordersData);
      
      const allMaterials = extractMaterialsFromOrders(ordersData);
      const requiredMaterials = allMaterials.filter(m => !m.materialStatus || m.materialStatus === null);
      const orderedMaterials = allMaterials.filter(m => m.materialStatus === 'Ordered');
      
      setMaterialsRequired(requiredMaterials);
      setMaterialsOrdered(orderedMaterials);
      
    } catch (error) {
      console.error('Error fetching materials:', error);
      showError('Failed to fetch materials');
    } finally {
      setLoading(false);
    }
  }, [extractMaterialsFromOrders, showError]);

  // Update material status and note
  const updateMaterialStatus = async (materialId, newStatus, note = '') => {
    try {
      setUpdating(true);
      
      // Find the material and its order
      const allMaterials = [...materialsRequired, ...materialsOrdered];
      const material = allMaterials.find(m => m.id === materialId);
      
      if (!material) {
        showError('Material not found');
        return;
      }

      // Update the order in Firebase
      const orderRef = doc(db, 'orders', material.orderId);
      const order = orders.find(o => o.id === material.orderId);
      
      if (!order) {
        showError('Order not found');
        return;
      }

      // Update the specific material status and note in the order
      const updatedFurnitureGroups = order.furnitureData.groups.map(group => {
        if (group.materialCode === material.materialCode && 
            group.materialCompany === material.materialCompany) {
          return { 
            ...group, 
            materialStatus: newStatus,
            materialNote: note || group.materialNote || ''
          };
        }
        return group;
      });

      await updateDoc(orderRef, {
        'furnitureData.groups': updatedFurnitureGroups
      });

      // Update local state
      if (newStatus === 'Ordered') {
        const materialToMove = materialsRequired.find(m => m.id === materialId);
        if (materialToMove) {
          const updatedMaterial = { 
            ...materialToMove, 
            materialStatus: 'Ordered',
            materialNote: note || materialToMove.materialNote || ''
          };
          setMaterialsRequired(prev => prev.filter(m => m.id !== materialId));
          setMaterialsOrdered(prev => [...prev, updatedMaterial]);
        }
      } else if (newStatus === 'Received') {
        setMaterialsOrdered(prev => prev.filter(m => m.id !== materialId));
      } else if (newStatus === null) {
        const materialToMove = materialsOrdered.find(m => m.id === materialId);
        if (materialToMove) {
          const updatedMaterial = { 
            ...materialToMove, 
            materialStatus: null,
            materialNote: note || materialToMove.materialNote || ''
          };
          setMaterialsOrdered(prev => prev.filter(m => m.id !== materialId));
          setMaterialsRequired(prev => [...prev, updatedMaterial]);
        }
      }

      showSuccess(`Material status updated to ${newStatus || 'Required'}`);
      
    } catch (error) {
      console.error('Error updating material status:', error);
      showError('Failed to update material status');
    } finally {
      setUpdating(false);
    }
  };

  // Handle note change
  const handleNoteChange = (materialId, note) => {
    setMaterialNotes(prev => ({
      ...prev,
      [materialId]: note
    }));
  };

  // Open note dialog
  const openNoteDialog = (material) => {
    setSelectedMaterialForNote(material);
    setCurrentNoteText(materialNotes[material.id] || material.materialNote || '');
    setNoteDialogOpen(true);
  };

  // Close note dialog
  const closeNoteDialog = () => {
    setNoteDialogOpen(false);
    setSelectedMaterialForNote(null);
    setCurrentNoteText('');
  };

  // Save note
  const saveNote = () => {
    if (selectedMaterialForNote) {
      handleNoteChange(selectedMaterialForNote.id, currentNoteText);
      closeNoteDialog();
      showSuccess('Note saved successfully');
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Filter materials based on search
  const filteredRequiredMaterials = filterMaterials(materialsRequired, searchTerm);
  const filteredOrderedMaterials = filterMaterials(materialsOrdered, searchTerm);

  // Group filtered materials
  const groupedRequiredMaterials = groupMaterialsByCompany(filteredRequiredMaterials);
  const groupedOrderedMaterials = groupMaterialsByCompany(filteredOrderedMaterials);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      let dateObj;
      if (date && typeof date === 'object' && date.toDate) {
        dateObj = date.toDate();
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh'
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: 'calc(100vh - 100px)', 
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
          Material Request Management
        </Typography>
        
        {/* Search and Refresh */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="Search by invoice number, material code, company, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'background.paper'
              }
            }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={fetchMaterials}
            disabled={updating}
            sx={buttonStyles.primaryButton}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Two Column Layout */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Column - Materials Required */}
        <Paper sx={{ 
          width: '50%', 
          height: '100%', 
          overflow: 'auto',
          borderRight: '2px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column'
        }}>
                     {/* Column Header */}
           <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
             <Box sx={{ display: 'flex', alignItems: 'center' }}>
               <InventoryIcon sx={{ mr: 1, color: '#b98f33', fontSize: 24 }} />
               <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                 Materials Required ({filteredRequiredMaterials.length})
               </Typography>
             </Box>
           </Box>
          
          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {Object.keys(groupedRequiredMaterials).length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {searchTerm ? 'No materials found matching your search' : 'No materials require ordering'}
                </Typography>
              </Box>
            ) : (
              Object.entries(groupedRequiredMaterials).map(([company, materials]) => (
                <Box key={company} sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1,
                    p: 1,
                    backgroundColor: 'rgba(185, 143, 51, 0.1)',
                    borderRadius: 1,
                    border: '1px solid rgba(185, 143, 51, 0.3)'
                  }}>
                    <BusinessIcon sx={{ mr: 1, color: '#b98f33', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {company}
                    </Typography>
                    <Chip 
                      label={materials.length} 
                      size="small" 
                      sx={{ ml: 'auto', backgroundColor: '#ff6b6b', color: 'white', fontSize: '0.7rem' }}
                    />
                  </Box>
                  
                  {materials.map((material) => (
                    <Card key={material.id} sx={{ 
                      mb: 2, 
                      backgroundColor: '#000000',
                      border: '2px solid #b98f33',
                      color: '#b98f33',
                      '&:hover': {
                        backgroundColor: '#1a1a1a',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(185, 143, 51, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        {/* Three Column Layout */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          {/* Left Column - Material Code and Details */}
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', textAlign: 'left' }}>
                              {material.materialCode}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.invoiceNo}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.customerName.split(' ')[0]}
                            </Typography>
                          </Box>
                          
                          {/* Middle Column - Quantity */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 80 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', textAlign: 'center' }}>
                              {material.materialQntyJL} {material.unit?.toLowerCase() || 'yards'}
                            </Typography>
                          </Box>
                          
                          {/* Right Column - Button */}
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: 48 }}>
                            <IconButton
                            sx={{
                              ...buttonStyles.secondaryButton,
                              minWidth: 'auto',
                              padding: '8px',
                              borderRadius: '50%',
                              width: '40px',
                              height: '40px'
                            }}
                            size="small"
                            onClick={() => openNoteDialog(material)}
                          >
                            <NoteIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                          </Box>
                          
                          {/* Action Button */}
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<LocalShippingIcon />}
                            onClick={() => updateMaterialStatus(
                              material.id, 
                              'Ordered', 
                              materialNotes[material.id] || material.materialNote || ''
                            )}
                            disabled={updating}
                            sx={{
                              ...buttonStyles.primaryButton,
                              fontSize: '0.75rem',
                              padding: '4px 12px'
                            }}
                          >
                            Order
                          </Button>
                        </Box>

                        {/* Note Display Row */}
                        {(materialNotes[material.id] || material.materialNote) && (
                          <Box sx={{ 
                            mt: 1, 
                            p: 1, 
                            backgroundColor: 'rgba(255,255,255,0.9)', 
                            borderRadius: 1,
                            border: '1px solid #8b6b1f'
                          }}>
                            <Typography variant="body2" sx={{ 
                              color: '#b98f33', 
                              fontStyle: 'italic',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}>
                              <NoteIcon sx={{ fontSize: 16, color: '#b98f33' }} />
                              {materialNotes[material.id] || material.materialNote}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Right Column - Materials Ordered */}
        <Paper sx={{ 
          width: '50%', 
          height: '100%', 
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Column Header */}
          <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LocalShippingIcon sx={{ mr: 1, color: '#feca57', fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#feca57' }}>
                Materials Ordered ({filteredOrderedMaterials.length})
              </Typography>
            </Box>
          </Box>
          
          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {Object.keys(groupedOrderedMaterials).length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {searchTerm ? 'No materials found matching your search' : 'No materials currently ordered'}
                </Typography>
              </Box>
            ) : (
              Object.entries(groupedOrderedMaterials).map(([company, materials]) => (
                <Box key={company} sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1,
                    p: 1,
                    backgroundColor: 'rgba(185, 143, 51, 0.1)',
                    borderRadius: 1,
                    border: '1px solid rgba(185, 143, 51, 0.3)'
                  }}>
                    <BusinessIcon sx={{ mr: 1, color: '#b98f33', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {company}
                    </Typography>
                    <Chip 
                      label={materials.length} 
                      size="small" 
                      sx={{ ml: 'auto', backgroundColor: '#feca57', color: 'white', fontSize: '0.7rem' }}
                    />
                  </Box>
                  
                  {materials.map((material) => (
                    <Card key={material.id} sx={{ 
                      mb: 2, 
                      backgroundColor: '#000000',
                      border: '2px solid #b98f33',
                      color: '#b98f33',
                      '&:hover': {
                        backgroundColor: '#1a1a1a',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(185, 143, 51, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        {/* Three Column Layout */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          {/* Left Column - Material Code and Details */}
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', textAlign: 'left' }}>
                              {material.materialCode}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.invoiceNo}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.customerName.split(' ')[0]}
                            </Typography>
                          </Box>
                          
                          {/* Middle Column - Quantity */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 80 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', textAlign: 'center' }}>
                              {material.materialQntyJL} {material.unit?.toLowerCase() || 'yards'}
                            </Typography>
                          </Box>
                          
                          {/* Right Column - Button */}
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: 48 }}>
                            <IconButton
                            sx={{
                              ...buttonStyles.secondaryButton,
                              minWidth: 'auto',
                              padding: '8px',
                              borderRadius: '50%',
                              width: '40px',
                              height: '40px'
                            }}
                            size="small"
                            onClick={() => openNoteDialog(material)}
                          >
                            <NoteIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                          </Box>
                          
                          {/* Action Buttons */}
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => updateMaterialStatus(
                                material.id, 
                                'Received', 
                                materialNotes[material.id] || material.materialNote || ''
                              )}
                              disabled={updating}
                              sx={{
                                ...buttonStyles.primaryButton,
                                fontSize: '0.75rem',
                                padding: '4px 8px'
                              }}
                            >
                              Received
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ArrowBackIcon />}
                              onClick={() => updateMaterialStatus(
                                material.id, 
                                null, 
                                materialNotes[material.id] || material.materialNote || ''
                              )}
                              disabled={updating}
                              sx={{
                                ...buttonStyles.cancelButton,
                                fontSize: '0.75rem',
                                padding: '4px 8px'
                              }}
                            >
                              Back
                            </Button>
                          </Box>
                        </Box>

                        {/* Note Display Row */}
                        {(materialNotes[material.id] || material.materialNote) && (
                          <Box sx={{ 
                            mt: 1, 
                            p: 1, 
                            backgroundColor: 'rgba(255,255,255,0.9)', 
                            borderRadius: 1,
                            border: '1px solid #8b6b1f'
                          }}>
                            <Typography variant="body2" sx={{ 
                              color: '#b98f33', 
                              fontStyle: 'italic',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}>
                              <NoteIcon sx={{ fontSize: 16, color: '#b98f33' }} />
                              {materialNotes[material.id] || material.materialNote}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </Paper>
      </Box>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onClose={closeNoteDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <NoteIcon />
          Add Note for Material
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Enter your note here..."
            value={currentNoteText}
            onChange={(e) => setCurrentNoteText(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#8b6b1f'
                },
                '&:hover fieldset': {
                  borderColor: '#b98f33'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#b98f33'
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={closeNoteDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveNote}
            variant="contained"
            sx={buttonStyles.primaryButton}
          >
            Save Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MaterialRequestPage;
