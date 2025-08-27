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
  Paper
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

  const { showSuccess, showError } = useNotification();

  // Extract materials from orders (excluding completed/canceled orders)
  const extractMaterialsFromOrders = useCallback((ordersList) => {
    const materials = [];
    
          ordersList.forEach(order => {
        // Skip only "Done" orders - show all other statuses
        const orderStatus = order.orderStatus || order.status;
        if (orderStatus === 'Done' || orderStatus === 'done') {
          console.log('Skipping order with Done status:', orderStatus, 'Order ID:', order.id);
          return;
        }

      const furnitureGroups = order.furnitureData?.groups || [];
      
      furnitureGroups.forEach(group => {
        if (group.materialCode && group.materialCompany) {
          // Get quantity from the correct field
          const quantity = group.materialQntyJL || 
                          group.materialQnty || 
                          group.qntyJL || 
                          group.qnty || 
                          group.quantity || 
                          group.jlQuantity || 
                          1;
          
          materials.push({
            id: `${order.id}_${group.materialCode}_${group.materialCompany}`,
            orderId: order.id,
            invoiceNo: order.orderDetails?.billInvoice || 'N/A',
            materialCompany: group.materialCompany,
            materialCode: group.materialCode,
            materialName: group.materialName || group.materialCode,
            quantity: quantity,
            materialStatus: group.materialStatus || null,
            materialNote: group.materialNote || '',
            orderDate: order.createdAt,
            customerName: order.personalInfo?.customerName || 'N/A',
            orderStatus: orderStatus
          });
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

  // Filter materials based on search term
  const filterMaterials = (materials, searchValue) => {
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
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
          Material Request Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Track and manage material orders from active customer orders
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
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)'
              }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '2px solid #8b6b1f',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 20px rgba(185, 143, 51, 0.3)'
              },
              transition: 'all 0.3s ease'
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#000000' }}>
                  {materialsRequired.length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#000000', fontWeight: 'bold' }}>
                  Materials Required
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '2px solid #8b6b1f',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 20px rgba(185, 143, 51, 0.3)'
              },
              transition: 'all 0.3s ease'
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#000000' }}>
                  {materialsOrdered.length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#000000', fontWeight: 'bold' }}>
                  Materials Ordered
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
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
                    mb: 2,
                    p: 2,
                    backgroundColor: 'rgba(185, 143, 51, 0.1)',
                    borderRadius: 2,
                    border: '1px solid rgba(185, 143, 51, 0.3)'
                  }}>
                    <BusinessIcon sx={{ mr: 1, color: '#b98f33' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {company}
                    </Typography>
                    <Chip 
                      label={materials.length} 
                      size="small" 
                      sx={{ ml: 'auto', backgroundColor: '#ff6b6b', color: 'white' }}
                    />
                  </Box>
                  
                  {materials.map((material) => (
                    <Card key={material.id} sx={{ 
                      mb: 2, 
                      background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                      border: '2px solid #8b6b1f',
                      color: '#000000',
                      '&:hover': {
                        background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(185, 143, 51, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        {/* Main Material Info Row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <ReceiptIcon sx={{ mr: 1, color: '#000000', fontSize: 20 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                Invoice: {material.invoiceNo}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                              {material.materialCode} - {material.materialName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#000000' }}>
                              Customer: {material.customerName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#000000' }}>
                              Date: {formatDate(material.orderDate)}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right', ml: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                              Qty: {material.quantity}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Note Field */}
                        <Box sx={{ mb: 2 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            placeholder="Add notes for this material..."
                            value={materialNotes[material.id] || material.materialNote || ''}
                            onChange={(e) => handleNoteChange(material.id, e.target.value)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <NoteIcon sx={{ color: '#000000', fontSize: 20 }} />
                                </InputAdornment>
                              )
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(255,255,255,0.8)',
                                '& fieldset': {
                                  borderColor: '#8b6b1f'
                                },
                                '&:hover fieldset': {
                                  borderColor: '#b98f33'
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#b98f33'
                                },
                                '& .MuiInputBase-input': {
                                  color: '#000000'
                                },
                                '& .MuiInputBase-input::placeholder': {
                                  color: '#666666'
                                }
                              }
                            }}
                          />
                        </Box>
                        
                                                 {/* Action Button */}
                         <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                           <Button
                             variant="contained"
                             startIcon={<LocalShippingIcon />}
                             onClick={() => updateMaterialStatus(
                               material.id, 
                               'Ordered', 
                               materialNotes[material.id] || material.materialNote || ''
                             )}
                             disabled={updating}
                             sx={{
                               background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                               color: '#000000',
                               fontWeight: 'bold',
                               '&:hover': {
                                 background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)'
                               }
                             }}
                           >
                             Order Material
                           </Button>
                         </Box>
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
                    mb: 2,
                    p: 2,
                    backgroundColor: 'rgba(185, 143, 51, 0.1)',
                    borderRadius: 2,
                    border: '1px solid rgba(185, 143, 51, 0.3)'
                  }}>
                    <BusinessIcon sx={{ mr: 1, color: '#b98f33' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {company}
                    </Typography>
                    <Chip 
                      label={materials.length} 
                      size="small" 
                      sx={{ ml: 'auto', backgroundColor: '#feca57', color: 'white' }}
                    />
                  </Box>
                  
                  {materials.map((material) => (
                    <Card key={material.id} sx={{ 
                      mb: 2, 
                      background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                      border: '2px solid #8b6b1f',
                      color: '#000000',
                      '&:hover': {
                        background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(185, 143, 51, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        {/* Main Material Info Row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <ReceiptIcon sx={{ mr: 1, color: '#000000', fontSize: 20 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                Invoice: {material.invoiceNo}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                              {material.materialCode} - {material.materialName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#000000' }}>
                              Customer: {material.customerName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#000000' }}>
                              Date: {formatDate(material.orderDate)}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right', ml: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                              Qty: {material.quantity}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Note Field */}
                        <Box sx={{ mb: 2 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            placeholder="Add notes for this material..."
                            value={materialNotes[material.id] || material.materialNote || ''}
                            onChange={(e) => handleNoteChange(material.id, e.target.value)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <NoteIcon sx={{ color: '#000000', fontSize: 20 }} />
                                </InputAdornment>
                              )
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(255,255,255,0.8)',
                                '& fieldset': {
                                  borderColor: '#8b6b1f'
                                },
                                '&:hover fieldset': {
                                  borderColor: '#b98f33'
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#b98f33'
                                },
                                '& .MuiInputBase-input': {
                                  color: '#000000'
                                },
                                '& .MuiInputBase-input::placeholder': {
                                  color: '#666666'
                                }
                              }
                            }}
                          />
                        </Box>
                        
                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Button
                            variant="contained"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => updateMaterialStatus(
                              material.id, 
                              'Received', 
                              materialNotes[material.id] || material.materialNote || ''
                            )}
                            disabled={updating}
                                                          sx={buttonStyles.primaryButton}
                          >
                            Mark Received
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => updateMaterialStatus(
                              material.id, 
                              null, 
                              materialNotes[material.id] || material.materialNote || ''
                            )}
                            disabled={updating}
                                                          sx={buttonStyles.cancelButton}
                          >
                            Back to Required
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default MaterialRequestPage;
