import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import * as XLSX from 'xlsx';

const DataManagementPage = () => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState('');


  const handleDeleteAllData = async () => {
    setIsLoading(true);
    setCurrentOperation('Deleting data...');
    try {
      // Delete all collections
      const collections = ['customers', 'orders', 'treatments', 'materialCompanies', 'workshop'];
      
      for (let i = 0; i < collections.length; i++) {
        const collectionName = collections[i];
        setCurrentOperation(`Deleting ${collectionName}...`);
        
        const snapshot = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((document) => {
          batch.delete(doc(db, collectionName, document.id));
        });
        
        await batch.commit();
      }
      
      alert('All data has been successfully deleted');
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting data:', error);
      alert('Error deleting data. Please try again.');
    } finally {
      setIsLoading(false);
      setCurrentOperation('');
    }
  };

  const handleExportToExcel = async () => {
    setIsLoading(true);
    setExportProgress(0);
    setCurrentOperation('Starting export...');
    
    try {
      const collections = ['customers', 'orders', 'treatments', 'materialCompanies', 'workshop'];
      const allData = {};
      
      // Fetch data with progress updates
      for (let i = 0; i < collections.length; i++) {
        const collectionName = collections[i];
        setCurrentOperation(`Fetching ${collectionName} data...`);
        setExportProgress((i / collections.length) * 50); // First 50% for fetching
        
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          allData[collectionName] = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
          }));
          console.log(`Fetched ${allData[collectionName].length} records from ${collectionName}`);
        } catch (error) {
          console.error(`Error fetching ${collectionName}:`, error);
          allData[collectionName] = []; // Continue with empty array if one collection fails
        }
      }

      setCurrentOperation('Processing data for Excel...');
      setExportProgress(60);

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Process each collection with progress updates
      const collectionKeys = Object.keys(allData);
      for (let i = 0; i < collectionKeys.length; i++) {
        const collectionName = collectionKeys[i];
        const data = allData[collectionName];
        
        setCurrentOperation(`Processing ${collectionName}...`);
        setExportProgress(60 + ((i / collectionKeys.length) * 30)); // Next 30% for processing
        
        if (data.length === 0) {
          // Create empty sheet with headers
          const headers = ['No Data Available'];
          const emptyData = [['This collection is empty']];
          const worksheet = XLSX.utils.aoa_to_sheet([headers, ...emptyData]);
          XLSX.utils.book_append_sheet(workbook, worksheet, collectionName);
        } else if (collectionName === 'orders') {
          // Special handling for orders - more organized format
          const organizedOrders = data.map(order => {
            // Helper function to safely get nested values
            const getValue = (obj, path) => {
              try {
                return path.split('.').reduce((current, key) => {
                  return current && current[key] !== undefined ? current[key] : '';
                }, obj) || '';
              } catch (e) {
                return '';
              }
            };

            // Helper function to format dates
            const formatDate = (dateValue) => {
              try {
                if (!dateValue) return '';
                if (dateValue.toDate) {
                  return dateValue.toDate().toLocaleDateString();
                }
                if (typeof dateValue === 'string' || typeof dateValue === 'number') {
                  return new Date(dateValue).toLocaleDateString();
                }
                return '';
              } catch (e) {
                return '';
              }
            };

            // Helper function to format furniture groups
            const formatFurnitureGroups = (groups) => {
              try {
                if (!groups || !Array.isArray(groups)) return '';
                return groups.map(group => {
                  const parts = [];
                  if (group.furnitureType) parts.push(`Type: ${group.furnitureType}`);
                  if (group.materialCompany) parts.push(`Material: ${group.materialCompany}`);
                  if (group.quantity) parts.push(`Qty: ${group.quantity}`);
                  if (group.labourWork) parts.push(`Labour: $${group.labourWork}`);
                  return parts.join(', ');
                }).join(' | ');
              } catch (e) {
                return '';
              }
            };

            return {
              // Order Basic Info
              'Order ID': order.id || '',
              'Order Date': formatDate(order.createdAt),
              'Last Updated': formatDate(order.updatedAt),
              
              // Customer Information (from personalInfo)
              'Customer Name': getValue(order, 'personalInfo.customerName') || getValue(order, 'personalInfo.name') || '',
              'Customer Phone': getValue(order, 'personalInfo.phone') || '',
              'Customer Email': getValue(order, 'personalInfo.email') || '',
              'Customer Address': getValue(order, 'personalInfo.address') || '',
              
              // Order Details (from orderDetails)
              'Bill Invoice': getValue(order, 'orderDetails.billInvoice') || '',
              'Description': getValue(order, 'orderDetails.description') || '',
              'Platform': getValue(order, 'orderDetails.platform') || '',
              'Start Date': getValue(order, 'orderDetails.startDate') || '',
              'Timeline': getValue(order, 'orderDetails.timeline') || '',
              
              // Furniture Data (simplified)
              'Furniture Details': formatFurnitureGroups(getValue(order, 'furnitureData.groups')),
              
              // Payment Information (from paymentData)
              'Deposit Amount': getValue(order, 'paymentData.deposit') || '',
              'Amount Paid': getValue(order, 'paymentData.amountPaid') || '',
              'Pickup/Delivery': getValue(order, 'paymentData.pickupDeliveryEnabled') ? 'Yes' : 'No',
              'Pickup/Delivery Cost': getValue(order, 'paymentData.pickupDeliveryCost') || '',
              'Notes': getValue(order, 'paymentData.notes') || '',
              
              // Additional Information
              'Status': order.status || '',
              'Total Amount': getValue(order, 'totalAmount') || '',
              'Priority': getValue(order, 'priority') || '',
              'Assigned To': getValue(order, 'assignedTo') || '',
            };
          });

          // Create worksheet with organized orders
          const worksheet = XLSX.utils.json_to_sheet(organizedOrders);
          
          // Set column widths for better readability
          const orderColumnWidths = [
            { width: 15 }, // Order ID
            { width: 12 }, // Order Date
            { width: 12 }, // Last Updated
            { width: 20 }, // Customer Name
            { width: 15 }, // Customer Phone
            { width: 25 }, // Customer Email
            { width: 30 }, // Customer Address
            { width: 15 }, // Bill Invoice
            { width: 30 }, // Description
            { width: 12 }, // Platform
            { width: 12 }, // Start Date
            { width: 15 }, // Timeline
            { width: 50 }, // Furniture Details
            { width: 12 }, // Deposit Amount
            { width: 12 }, // Amount Paid
            { width: 15 }, // Pickup/Delivery
            { width: 15 }, // Pickup/Delivery Cost
            { width: 25 }, // Notes
            { width: 12 }, // Status
            { width: 12 }, // Total Amount
            { width: 10 }, // Priority
            { width: 15 }, // Assigned To
          ];
          
          worksheet['!cols'] = orderColumnWidths;
          
          // Add to workbook
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        } else {
          // Prepare data for Excel (other collections)
          const processedData = data.map(item => {
            const processedItem = {};
            Object.keys(item).forEach(key => {
              try {
                const value = item[key];
                if (typeof value === 'object' && value !== null) {
                  // Handle complex objects (like timestamps, arrays, etc.)
                  if (value.toDate) {
                    // Firebase timestamp
                    processedItem[key] = value.toDate().toLocaleString();
                  } else if (Array.isArray(value)) {
                    // Arrays
                    processedItem[key] = value.join(', ');
                  } else {
                    // Other objects
                    processedItem[key] = JSON.stringify(value);
                  }
                } else if (value === null || value === undefined) {
                  processedItem[key] = '';
                } else {
                  processedItem[key] = value;
                }
              } catch (e) {
                processedItem[key] = 'Error processing data';
              }
            });
            return processedItem;
          });

          // Convert to worksheet
          const worksheet = XLSX.utils.json_to_sheet(processedData);
          
          // Auto-size columns
          if (processedData.length > 0) {
            const columnWidths = [];
            const headers = Object.keys(processedData[0] || {});
            
            headers.forEach((header, index) => {
              const maxLength = Math.max(
                header.length,
                ...processedData.map(row => String(row[header] || '').length)
              );
              columnWidths[index] = Math.min(Math.max(maxLength + 2, 10), 50);
            });
            
            worksheet['!cols'] = columnWidths.map(width => ({ width }));
          }
          
          // Add to workbook
          XLSX.utils.book_append_sheet(workbook, worksheet, collectionName);
        }
      }

      setCurrentOperation('Generating Excel file...');
      setExportProgress(95);

      // Generate and download file
      const fileName = `anwar_data_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setExportProgress(100);
      setCurrentOperation('Export completed!');
      
      setTimeout(() => {
        alert('Data exported successfully to Excel file');
        setExportDialogOpen(false);
      }, 500);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      alert(`Error exporting data: ${error.message}. Please try again.`);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setExportProgress(0);
        setCurrentOperation('');
      }, 1000);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#274290' }}>
        Data Management
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <DeleteIcon sx={{ color: '#f27921', mr: 1 }} />
                <Typography variant="h6">Erase All Data</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                This action will permanently delete all data from the system including customers, orders, treatments, and workshop data.
              </Typography>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                fullWidth
                disabled={isLoading}
              >
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <FileDownloadIcon sx={{ color: '#f27921', mr: 1 }} />
                <Typography variant="h6">Export Data</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Export all data to an Excel file that can be opened in Excel or other spreadsheet applications.
              </Typography>
              <Button
                variant="contained"
                sx={{ backgroundColor: '#274290', '&:hover': { backgroundColor: '#1e2d5a' } }}
                startIcon={<FileDownloadIcon />}
                onClick={() => setExportDialogOpen(true)}
                fullWidth
                disabled={isLoading}
              >
                Export to Excel
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <WarningIcon sx={{ color: 'error.main', mr: 1 }} />
            Confirm Data Deletion
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. All data will be permanently deleted.
          </Alert>
          <Typography>
            Are you sure you want to delete all data from the system? This includes:
          </Typography>
          <ul>
            <li>All customer records</li>
            <li>All order data</li>
            <li>All treatment records</li>
            <li>All material company data</li>
            <li>All workshop data</li>
          </ul>
          {isLoading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {currentOperation}
              </Typography>
              <LinearProgress />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAllData}
            color="error"
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {isLoading ? 'Deleting...' : 'Delete All Data'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Confirmation Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Data to Excel</DialogTitle>
        <DialogContent>
          <Typography>
            This will export all data from the system to an Excel file. The file will include:
          </Typography>
          <ul>
            <li>Customer records</li>
            <li>Order data (organized and detailed)</li>
            <li>Treatment records</li>
            <li>Material company data</li>
            <li>Workshop data</li>
          </ul>
          {isLoading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {currentOperation}
              </Typography>
              <LinearProgress variant="determinate" value={exportProgress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                {Math.round(exportProgress)}% complete
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleExportToExcel}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} /> : <FileDownloadIcon />}
            sx={{ backgroundColor: '#274290', '&:hover': { backgroundColor: '#1e2d5a' } }}
          >
            {isLoading ? `Exporting... ${Math.round(exportProgress)}%` : 'Export Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataManagementPage; 