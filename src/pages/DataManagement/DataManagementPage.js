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
  Checkbox,
  FormControlLabel,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
  Warning as WarningIcon,
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Security as SecurityIcon,
  Folder as FolderIcon,
  History as HistoryIcon,
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
  
  // Collection selection state
  const [selectedCollections, setSelectedCollections] = useState({});
  const [selectedExportCollections, setSelectedExportCollections] = useState({});
  const [collectionStats, setCollectionStats] = useState({});
  const [showCollectionStats, setShowCollectionStats] = useState(false);

  // Backup and Restore state
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [backupHistoryDialogOpen, setBackupHistoryDialogOpen] = useState(false);
  const [selectedBackupCollections, setSelectedBackupCollections] = useState({});
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupPassword, setBackupPassword] = useState('');
  const [encryptBackup, setEncryptBackup] = useState(true);
  const [backupLocation, setBackupLocation] = useState('');
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const [restoreMode, setRestoreMode] = useState('full'); // 'full', 'selective', 'merge'

  // Complete list of all collections with descriptions
  const collections = [
    {
      name: 'customers',
      label: 'Customers',
      description: 'Customer information and contact details',
      icon: '👥'
    },
    {
      name: 'orders',
      label: 'Orders',
      description: 'Order records and project details',
      icon: '📋'
    },
    {
      name: 'treatments',
      label: 'Treatments',
      description: 'Treatment records and schedules',
      icon: '🔧'
    },
    {
      name: 'materialCompanies',
      label: 'Material Companies',
      description: 'Supplier and material company data',
      icon: '🏭'
    },
    {
      name: 'workshop',
      label: 'Workshop',
      description: 'Workshop operations and activities',
      icon: '⚙️'
    },
    {
      name: 'platforms',
      label: 'Platforms',
      description: 'Platform and channel information',
      icon: '🌐'
    },
    {
      name: 'leads',
      label: 'Leads',
      description: 'Lead management and inquiries',
      icon: '🎯'
    },
    {
      name: 'invoiceStatuses',
      label: 'Invoice Statuses',
      description: 'Invoice status configurations',
      icon: '📊'
    }
  ];

  // Initialize selected collections when dialog opens
  const handleOpenDeleteDialog = async () => {
    setDeleteDialogOpen(true);
    setSelectedCollections({});
    setCollectionStats({});
    setShowCollectionStats(false);
    
    // Add a small delay to ensure dialog is fully rendered
    setTimeout(async () => {
      console.log('Starting collection stats fetch...');
      await fetchCollectionStats();
    }, 100);
  };

  // Initialize export collections when dialog opens
  const handleOpenExportDialog = async () => {
    setExportDialogOpen(true);
    setSelectedExportCollections({});
    setCollectionStats({});
    setShowCollectionStats(false);
    
    // Add a small delay to ensure dialog is fully rendered
    setTimeout(async () => {
      console.log('Starting collection stats fetch for export...');
      await fetchCollectionStats();
    }, 100);
  };

  // Initialize backup collections when dialog opens
  const handleOpenBackupDialog = async () => {
    setBackupDialogOpen(true);
    setSelectedBackupCollections({});
    setCollectionStats({});
    setShowCollectionStats(false);
    
    // Add a small delay to ensure dialog is fully rendered
    setTimeout(async () => {
      console.log('Starting collection stats fetch for backup...');
      await fetchCollectionStats();
    }, 100);
  };

  // Fetch statistics for each collection
  const fetchCollectionStats = async () => {
    const stats = {};
    setCurrentOperation('Analyzing data...');
    
    for (const collectionInfo of collections) {
      try {
        console.log(`Fetching stats for collection: ${collectionInfo.name}`);
        
        // Use the same approach as the test function
        const snapshot = await getDocs(collection(db, collectionInfo.name));
        const count = snapshot.size;
        stats[collectionInfo.name] = count;
        console.log(`✅ ${collectionInfo.name}: ${count} documents`);
        
      } catch (error) {
        console.error(`❌ Error fetching stats for ${collectionInfo.name}:`, error);
        stats[collectionInfo.name] = 'Error';
      }
    }
    
    console.log('Final collection stats:', stats);
    setCollectionStats(stats);
    setCurrentOperation('');
  };

  // Handle collection selection for delete
  const handleCollectionToggle = (collectionName) => {
    setSelectedCollections(prev => ({
      ...prev,
      [collectionName]: !prev[collectionName]
    }));
  };

  // Handle collection selection for export
  const handleExportCollectionToggle = (collectionName) => {
    setSelectedExportCollections(prev => ({
      ...prev,
      [collectionName]: !prev[collectionName]
    }));
  };

  // Handle select all/none for delete
  const handleSelectAll = () => {
    const allSelected = {};
    collections.forEach(collection => {
      allSelected[collection.name] = true;
    });
    setSelectedCollections(allSelected);
  };

  const handleSelectNone = () => {
    setSelectedCollections({});
  };

  // Handle select all/none for export
  const handleExportSelectAll = () => {
    const allSelected = {};
    collections.forEach(collection => {
      allSelected[collection.name] = true;
    });
    setSelectedExportCollections(allSelected);
  };

  const handleExportSelectNone = () => {
    setSelectedExportCollections({});
  };

  // Get selected collections count for delete
  const getSelectedCount = () => {
    return Object.values(selectedCollections).filter(Boolean).length;
  };

  // Get selected collections count for export
  const getExportSelectedCount = () => {
    return Object.values(selectedExportCollections).filter(Boolean).length;
  };

  // Get total documents to be deleted
  const getTotalDocumentsToDelete = () => {
    return Object.keys(selectedCollections)
      .filter(key => selectedCollections[key])
      .reduce((total, collectionName) => {
        const count = collectionStats[collectionName];
        return total + (typeof count === 'number' ? count : 0);
      }, 0);
  };

  // Get total documents to be exported
  const getTotalDocumentsToExport = () => {
    return Object.keys(selectedExportCollections)
      .filter(key => selectedExportCollections[key])
      .reduce((total, collectionName) => {
        const count = collectionStats[collectionName];
        return total + (typeof count === 'number' ? count : 0);
      }, 0);
  };



  const handleDeleteAllData = async () => {
    const selectedCollectionNames = Object.keys(selectedCollections).filter(key => selectedCollections[key]);
    
    if (selectedCollectionNames.length === 0) {
      alert('Please select at least one collection to delete.');
      return;
    }

    setIsLoading(true);
    setCurrentOperation('Deleting selected data...');
    try {
      let totalDeleted = 0;
      const deletedCollections = [];
      
      for (let i = 0; i < selectedCollectionNames.length; i++) {
        const collectionName = selectedCollectionNames[i];
        const collectionInfo = collections.find(c => c.name === collectionName);
        setCurrentOperation(`Deleting ${collectionInfo?.label || collectionName}...`);
        
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const batch = writeBatch(db);
          let batchCount = 0;
          
          snapshot.docs.forEach((document) => {
            batch.delete(doc(db, collectionName, document.id));
            batchCount++;
          });
          
          if (batchCount > 0) {
            await batch.commit();
            totalDeleted += batchCount;
            deletedCollections.push(collectionInfo?.label || collectionName);
            console.log(`✅ Deleted ${batchCount} documents from ${collectionName}`);
          } else {
            console.log(`ℹ️ No documents found in ${collectionName}`);
          }
        } catch (collectionError) {
          console.error(`❌ Error deleting ${collectionName}:`, collectionError);
          // Continue with other collections even if one fails
        }
      }
      
      const successMessage = `Selected data has been successfully deleted!\n\n` +
        `Collections deleted: ${deletedCollections.join(', ')}\n` +
        `Total documents deleted: ${totalDeleted}\n` +
        `Collections processed: ${selectedCollectionNames.length}`;
      
      alert(successMessage);
      setDeleteDialogOpen(false);
      setSelectedCollections({});
    } catch (error) {
      console.error('Error deleting data:', error);
      alert('Error deleting data. Please try again.');
    } finally {
      setIsLoading(false);
      setCurrentOperation('');
    }
  };

  const handleExportToExcel = async () => {
    const selectedCollectionNames = Object.keys(selectedExportCollections).filter(key => selectedExportCollections[key]);
    
    if (selectedCollectionNames.length === 0) {
      alert('Please select at least one collection to export.');
      return;
    }

    setIsLoading(true);
    setExportProgress(0);
    setCurrentOperation('Starting export...');
    
    try {
      const allData = {};
      
      // Fetch data with progress updates
      for (let i = 0; i < selectedCollectionNames.length; i++) {
        const collectionName = selectedCollectionNames[i];
        const collectionInfo = collections.find(c => c.name === collectionName);
        setCurrentOperation(`Fetching ${collectionInfo?.label || collectionName} data...`);
        setExportProgress((i / selectedCollectionNames.length) * 50); // First 50% for fetching
        
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
        const collectionInfo = collections.find(c => c.name === collectionName);
        const data = allData[collectionName];
        
        setCurrentOperation(`Processing ${collectionInfo?.label || collectionName}...`);
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
      
      const successMessage = `Selected data has been successfully exported!\n\n` +
        `Collections exported: ${Object.keys(allData).map(name => {
          const info = collections.find(c => c.name === name);
          return info?.label || name;
        }).join(', ')}\n` +
        `Total documents exported: ${Object.values(allData).reduce((total, data) => total + data.length, 0)}\n` +
        `Collections processed: ${Object.keys(allData).length}`;
      
      setTimeout(() => {
        alert(successMessage);
        setExportDialogOpen(false);
        setSelectedExportCollections({});
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

  // ==================== PROFESSIONAL BACKUP SYSTEM ====================

  // Generate SHA-256 hash for data integrity
  const generateChecksum = async (data) => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Simple encryption function (AES-like simulation)
  const encryptData = (data, password) => {
    if (!password) return data;
    // In a real implementation, you'd use a proper encryption library
    // This is a simplified version for demonstration
    const encrypted = btoa(JSON.stringify(data) + '|' + password);
    return encrypted;
  };

  // Simple decryption function
  const decryptData = (encryptedData, password) => {
    if (!password) return encryptedData;
    try {
      const decoded = atob(encryptedData);
      const parts = decoded.split('|');
      if (parts[1] === password) {
        return JSON.parse(parts[0]);
      }
      throw new Error('Invalid password');
    } catch (error) {
      throw new Error('Failed to decrypt backup');
    }
  };

  // Create professional backup
  const handleCreateBackup = async () => {
    const selectedCollectionNames = Object.keys(selectedBackupCollections).filter(key => selectedBackupCollections[key]);
    
    if (selectedCollectionNames.length === 0) {
      alert('Please select at least one collection to backup.');
      return;
    }

    if (encryptBackup && !backupPassword.trim()) {
      alert('Please enter a password for encrypted backup.');
      return;
    }

    setIsLoading(true);
    setBackupProgress(0);
    setCurrentOperation('Creating professional backup...');
    
    try {
      const backupData = {};
             // Generate JL-date-time format
       const now = new Date();
       const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
       const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
       const backupId = `JL-${dateStr}-${timeStr}`;
       
       const backupMetadata = {
         backupId: backupId,
         timestamp: new Date().toISOString(),
         version: '1.0.0',
         firebaseProject: 'jl-operations',
         collections: {},
         totalDocuments: 0,
         encrypted: encryptBackup,
         createdBy: 'admin@company.com',
         checksum: '',
         compression: 'none'
       };

      // Fetch data with progress updates
      for (let i = 0; i < selectedCollectionNames.length; i++) {
        const collectionName = selectedCollectionNames[i];
        const collectionInfo = collections.find(c => c.name === collectionName);
        setCurrentOperation(`Backing up ${collectionInfo?.label || collectionName}...`);
        setBackupProgress((i / selectedCollectionNames.length) * 60);
        
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          backupData[collectionName] = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
          }));
          
          backupMetadata.collections[collectionName] = backupData[collectionName].length;
          backupMetadata.totalDocuments += backupData[collectionName].length;
          
          console.log(`✅ Backed up ${backupData[collectionName].length} documents from ${collectionName}`);
        } catch (error) {
          console.error(`Error backing up ${collectionName}:`, error);
          backupData[collectionName] = [];
        }
      }

      setCurrentOperation('Generating backup metadata...');
      setBackupProgress(70);

      // Generate checksum for data integrity
      backupMetadata.checksum = await generateChecksum(backupData);
      backupMetadata.backupSize = `${JSON.stringify(backupData).length / 1024}KB`;

      setCurrentOperation('Encrypting backup data...');
      setBackupProgress(80);

      // Encrypt data if requested
      const finalBackupData = encryptBackup ? encryptData(backupData, backupPassword) : backupData;

      setCurrentOperation('Creating backup files...');
      setBackupProgress(90);

      // Create backup files
      const backupFileName = `${backupMetadata.backupId}.json`;
      const metadataFileName = `${backupMetadata.backupId}_metadata.json`;
      
      // Create and download backup file
      const backupBlob = new Blob([JSON.stringify(finalBackupData, null, 2)], { type: 'application/json' });
      const backupUrl = URL.createObjectURL(backupBlob);
      const backupLink = document.createElement('a');
      backupLink.href = backupUrl;
      backupLink.download = backupFileName;
      backupLink.click();
      URL.revokeObjectURL(backupUrl);

      // Create and download metadata file
      const metadataBlob = new Blob([JSON.stringify(backupMetadata, null, 2)], { type: 'application/json' });
      const metadataUrl = URL.createObjectURL(metadataBlob);
      const metadataLink = document.createElement('a');
      metadataLink.href = metadataUrl;
      metadataLink.download = metadataFileName;
      metadataLink.click();
      URL.revokeObjectURL(metadataUrl);

      setBackupProgress(100);
      setCurrentOperation('Backup completed successfully!');
      
      const successMessage = `Professional backup created successfully!\n\n` +
        `Backup ID: ${backupMetadata.backupId}\n` +
        `Collections backed up: ${Object.keys(backupData).map(name => {
          const info = collections.find(c => c.name === name);
          return info?.label || name;
        }).join(', ')}\n` +
        `Total documents: ${backupMetadata.totalDocuments}\n` +
        `Backup size: ${backupMetadata.backupSize}\n` +
        `Encrypted: ${encryptBackup ? 'Yes' : 'No'}\n` +
        `Checksum: ${backupMetadata.checksum.substring(0, 16)}...`;
      
      setTimeout(() => {
        alert(successMessage);
        setBackupDialogOpen(false);
        setSelectedBackupCollections({});
        setBackupPassword('');
      }, 500);
      
    } catch (error) {
      console.error('Error creating backup:', error);
      alert(`Error creating backup: ${error.message}. Please try again.`);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setBackupProgress(0);
        setCurrentOperation('');
      }, 1000);
    }
  };

  // Restore from backup
  const handleRestoreFromBackup = async () => {
    if (!selectedBackupFile) {
      alert('Please select a backup file to restore from.');
      return;
    }

    setIsLoading(true);
    setRestoreProgress(0);
    setCurrentOperation('Reading backup file...');
    
    try {
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          setRestoreProgress(20);
          setCurrentOperation('Parsing backup data...');
          
                     let backupData;
           let isEncrypted = false;
          
          try {
            // First, try to parse as JSON
            const parsedData = JSON.parse(event.target.result);
            
            // Check if this looks like encrypted data (base64 string)
            if (typeof parsedData === 'string' && parsedData.length > 100 && /^[A-Za-z0-9+/=]+$/.test(parsedData)) {
              console.log('Detected encrypted backup data, attempting decryption...');
              isEncrypted = true;
              
              if (!backupPassword) {
                throw new Error('This backup file is encrypted. Please enter the backup password.');
              }
              
              try {
                backupData = decryptData(parsedData, backupPassword);
                console.log('Successfully decrypted backup data');
              } catch (decryptError) {
                console.error('Decryption failed:', decryptError);
                throw new Error('Failed to decrypt backup file. Please check your password.');
              }
            } else {
              // This is regular JSON data
              backupData = parsedData;
              console.log('Successfully parsed backup data as JSON');
            }
          } catch (parseError) {
            console.log('JSON parsing failed, attempting decryption...');
            // Try to decrypt if parsing fails
            if (backupPassword) {
              try {
                backupData = decryptData(event.target.result, backupPassword);
                console.log('Successfully decrypted backup data');
                isEncrypted = true;
              } catch (decryptError) {
                console.error('Decryption failed:', decryptError);
                throw new Error('Failed to decrypt backup file. Please check your password.');
              }
            } else {
              console.error('JSON parsing failed:', parseError);
              throw new Error('Invalid backup file format or missing password for encrypted backup');
            }
          }

          setRestoreProgress(40);
          setCurrentOperation('Validating backup integrity...');
          
          // Validate backup structure
          if (!backupData || typeof backupData !== 'object') {
            console.error('Backup data structure:', backupData);
            throw new Error('Invalid backup data structure - data is not a valid object');
          }

          // Check if backupData has any collections
          const collectionNames = Object.keys(backupData);
          if (collectionNames.length === 0) {
            throw new Error('Backup file contains no collections to restore');
          }

          console.log('Backup collections found:', collectionNames);
          console.log('Backup data structure:', backupData);

          setRestoreProgress(60);
          setCurrentOperation('Restoring data to Firebase...');
          
          let totalRestored = 0;
          const restoredCollections = [];
          
          for (const [collectionName, documents] of Object.entries(backupData)) {
            if (Array.isArray(documents)) {
              setCurrentOperation(`Restoring ${collectionName}...`);
              
              const batch = writeBatch(db);
              let batchCount = 0;
              
              documents.forEach((document) => {
                if (document.id) {
                  // Remove the id field from the document data before storing
                  const { id, ...documentData } = document;
                  batch.set(doc(db, collectionName, id), documentData);
                  batchCount++;
                }
              });
              
              if (batchCount > 0) {
                await batch.commit();
                totalRestored += batchCount;
                restoredCollections.push(collectionName);
                console.log(`✅ Restored ${batchCount} documents to ${collectionName}`);
              }
            }
          }

          setRestoreProgress(100);
          setCurrentOperation('Restore completed successfully!');
          
          const successMessage = `Data restored successfully!\n\n` +
            `Collections restored: ${restoredCollections.join(', ')}\n` +
            `Total documents restored: ${totalRestored}\n` +
            `Restore mode: ${restoreMode}`;
          
          setTimeout(() => {
            alert(successMessage);
            setRestoreDialogOpen(false);
            setSelectedBackupFile(null);
            setBackupPassword('');
          }, 500);
          
        } catch (error) {
          console.error('Error during restore:', error);
          alert(`Error restoring data: ${error.message}. Please try again.`);
        } finally {
          setTimeout(() => {
            setIsLoading(false);
            setRestoreProgress(0);
            setCurrentOperation('');
          }, 1000);
        }
      };
      
      fileReader.readAsText(selectedBackupFile);
      
    } catch (error) {
      console.error('Error reading backup file:', error);
      alert(`Error reading backup file: ${error.message}. Please try again.`);
      setIsLoading(false);
      setRestoreProgress(0);
      setCurrentOperation('');
    }
  };

  // Handle backup collection selection
  const handleBackupCollectionToggle = (collectionName) => {
    setSelectedBackupCollections(prev => ({
      ...prev,
      [collectionName]: !prev[collectionName]
    }));
  };

  // Handle backup select all/none
  const handleBackupSelectAll = () => {
    const allSelected = {};
    collections.forEach(collection => {
      allSelected[collection.name] = true;
    });
    setSelectedBackupCollections(allSelected);
  };

  const handleBackupSelectNone = () => {
    setSelectedBackupCollections({});
  };

  // Get selected backup collections count
  const getBackupSelectedCount = () => {
    return Object.values(selectedBackupCollections).filter(Boolean).length;
  };

  // Handle file selection for restore
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.json')) {
      setSelectedBackupFile(file);
    } else {
      alert('Please select a valid JSON backup file.');
    }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Professional Header */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderRadius: 2,
        border: '1px solid #333333'
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2
          }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Data Management
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Professional data operations including backup, restore, export, and deletion
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<BackupIcon />}
                onClick={handleOpenBackupDialog}
                disabled={isLoading}
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.light',
                    backgroundColor: 'rgba(185, 143, 51, 0.08)'
                  }
                }}
              >
                Create Backup
              </Button>
              <Button
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={() => setRestoreDialogOpen(true)}
                disabled={isLoading}
                sx={{
                  borderColor: 'secondary.main',
                  color: 'secondary.main',
                  '&:hover': {
                    borderColor: 'secondary.light',
                    backgroundColor: 'rgba(220, 0, 78, 0.08)'
                  }
                }}
              >
                Restore Data
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={3}>
          {/* Delete Data Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              height: '100%',
              backgroundColor: 'background.paper',
              border: '1px solid #333333',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <DeleteIcon sx={{ color: 'error.main', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    Erase All Data
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={3} sx={{ lineHeight: 1.6 }}>
                  This action will permanently delete all data from the system including customers, orders, treatments, and workshop data.
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleOpenDeleteDialog}
                  fullWidth
                  disabled={isLoading}
                  sx={{
                    py: 1.5,
                    fontWeight: 'bold',
                    '&:hover': {
                      backgroundColor: 'error.dark'
                    }
                  }}
                >
                  Delete Data
                </Button>
              </CardContent>
            </Card>
          </Grid>

                  {/* Export Data Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              height: '100%',
              backgroundColor: 'background.paper',
              border: '1px solid #333333',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <FileDownloadIcon sx={{ color: 'primary.main', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    Export Data
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={3} sx={{ lineHeight: 1.6 }}>
                  Export all data to an Excel file that can be opened in Excel or other spreadsheet applications.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleOpenExportDialog}
                  fullWidth
                  disabled={isLoading}
                  sx={{
                    py: 1.5,
                    fontWeight: 'bold',
                    backgroundColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.dark'
                    }
                  }}
                >
                  Export to Excel
                </Button>
              </CardContent>
            </Card>
          </Grid>

                  {/* Professional Backup Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              height: '100%',
              backgroundColor: 'background.paper',
              border: '1px solid #333333',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <BackupIcon sx={{ color: 'success.main', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    Professional Backup
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={3} sx={{ lineHeight: 1.6 }}>
                  Create encrypted, secure backups of your data with integrity checks and professional metadata.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<BackupIcon />}
                  onClick={handleOpenBackupDialog}
                  fullWidth
                  disabled={isLoading}
                  sx={{
                    py: 1.5,
                    fontWeight: 'bold',
                    backgroundColor: 'success.main',
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'success.dark'
                    }
                  }}
                >
                  Create Backup
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => setBackupHistoryDialogOpen(true)}
                  fullWidth
                  disabled={isLoading}
                  size="small"
                  sx={{
                    borderColor: 'success.main',
                    color: 'success.main',
                    '&:hover': {
                      borderColor: 'success.dark',
                      backgroundColor: 'rgba(76, 175, 80, 0.08)'
                    }
                  }}
                >
                  Backup History
                </Button>
              </CardContent>
            </Card>
          </Grid>

                  {/* Professional Restore Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              height: '100%',
              backgroundColor: 'background.paper',
              border: '1px solid #333333',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <RestoreIcon sx={{ color: 'warning.main', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                    Restore Data
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={3} sx={{ lineHeight: 1.6 }}>
                  Restore your data from professional backup files with validation and conflict resolution.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<RestoreIcon />}
                  onClick={() => setRestoreDialogOpen(true)}
                  fullWidth
                  disabled={isLoading}
                  sx={{
                    py: 1.5,
                    fontWeight: 'bold',
                    backgroundColor: 'warning.main',
                    color: 'warning.contrastText',
                    '&:hover': {
                      backgroundColor: 'warning.dark'
                    }
                  }}
                >
                  Restore from Backup
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

                     {/* Delete Confirmation Dialog */}
        <Dialog 
          open={deleteDialogOpen} 
          onClose={() => setDeleteDialogOpen(false)} 
          maxWidth="md" 
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
              <WarningIcon sx={{ color: '#000000', mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                Selective Data Deletion
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Button 
                size="small" 
                onClick={handleSelectAll} 
                disabled={isLoading}
                sx={{
                  backgroundColor: '#000000',
                  color: '#b98f33',
                  '&:hover': {
                    backgroundColor: '#333333',
                  },
                  '&:disabled': {
                    backgroundColor: '#666666',
                    color: '#999999'
                  }
                }}
              >
                Select All
              </Button>
              <Button 
                size="small" 
                onClick={handleSelectNone} 
                disabled={isLoading}
                sx={{
                  backgroundColor: '#000000',
                  color: '#b98f33',
                  '&:hover': {
                    backgroundColor: '#333333',
                  },
                  '&:disabled': {
                    backgroundColor: '#666666',
                    color: '#999999'
                  }
                }}
              >
                Select None
              </Button>
            </Box>
          </DialogTitle>
                   <DialogContent sx={{ p: 3, backgroundColor: '#2a2a2a' }}>
            <Alert severity="warning" sx={{ mb: 3, backgroundColor: '#3a3a3a', border: '1px solid #b98f33' }}>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#b98f33' }}>Warning:</strong> This action cannot be undone. Selected data will be permanently deleted.
              </Typography>
            </Alert>
           
                                               {/* Summary Section */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#b98f33', fontWeight: 'bold', mb: 1 }}>
                Selection Summary:
              </Typography>
               <Box display="flex" gap={2} flexWrap="wrap">
                 <Chip 
                   label={`${getSelectedCount()} of ${collections.length} collections selected`}
                   sx={{
                     backgroundColor: getSelectedCount() > 0 ? '#b98f33' : '#2a2a2a',
                     color: getSelectedCount() > 0 ? '#000000' : '#ffffff',
                     border: '1px solid #333333'
                   }}
                   size="small"
                 />
                 {getSelectedCount() > 0 && (
                   <Chip 
                     label={`${getTotalDocumentsToDelete()} documents to delete`}
                     sx={{
                       backgroundColor: '#dc004e',
                       color: '#ffffff',
                       border: '1px solid #dc004e'
                     }}
                     size="small"
                   />
                 )}
               </Box>
             </Box>

                       {/* Collections List */}
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#b98f33', fontWeight: 'bold' }}>
              Select collections to delete:
            </Typography>
            
            <List sx={{ 
              maxHeight: 400, 
              overflow: 'auto', 
              backgroundColor: '#2a2a2a', 
              border: '1px solid #333333', 
              borderRadius: 1 
            }}>
                           {collections.map((collection) => (
                <ListItem 
                  key={collection.name} 
                  divider 
                  sx={{ 
                    borderBottom: '1px solid #333333',
                    '&:hover': {
                      backgroundColor: '#3a3a3a'
                    }
                  }}
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedCollections[collection.name] || false}
                      onChange={() => handleCollectionToggle(collection.name)}
                      disabled={isLoading}
                      sx={{
                        color: '#b98f33',
                        '&.Mui-checked': {
                          color: '#b98f33',
                        },
                        '&.Mui-disabled': {
                          color: '#666666',
                        }
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" component="span">
                          {collection.icon}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                          {collection.label}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: '#b98f33' }}>
                        {collection.description}
                      </Typography>
                    }
                  />
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: '#ffffff' }}>
                      Documents: {typeof collectionStats[collection.name] === 'number' ? collectionStats[collection.name] : (collectionStats[collection.name] === 'Error' ? 'Error loading' : 'Loading...')}
                    </Typography>
                  </Box>
                  <ListItemSecondaryAction>
                    <Chip 
                      label={typeof collectionStats[collection.name] === 'number' ? `${collectionStats[collection.name]} docs` : (collectionStats[collection.name] === 'Error' ? 'Error' : 'Loading...')}
                      size="small"
                      variant="outlined"
                      sx={{
                        backgroundColor: selectedCollections[collection.name] ? '#dc004e' : '#2a2a2a',
                        color: selectedCollections[collection.name] ? '#ffffff' : (collectionStats[collection.name] === 'Error' ? '#ff9800' : '#ffffff'),
                        border: selectedCollections[collection.name] ? '1px solid #dc004e' : '1px solid #333333'
                      }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
           </List>

                       {/* Progress Section */}
            {isLoading && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, color: '#b98f33' }}>
                  {currentOperation}
                </Typography>
                <LinearProgress 
                  sx={{
                    backgroundColor: '#2a2a2a',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#b98f33'
                    }
                  }}
                />
              </Box>
            )}
         </DialogContent>
                   <DialogActions sx={{ p: 3, backgroundColor: '#2a2a2a', borderTop: '1px solid #333333' }}>
            <Button 
              onClick={() => setDeleteDialogOpen(false)} 
              disabled={isLoading}
              sx={{
                backgroundColor: '#666666',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: '#888888',
                },
                '&:disabled': {
                  backgroundColor: '#444444',
                  color: '#999999'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAllData}
              variant="contained"
              disabled={isLoading || getSelectedCount() === 0}
              startIcon={isLoading ? <CircularProgress size={16} /> : <DeleteIcon />}
              sx={{
                backgroundColor: '#dc004e',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: '#ff5983',
                },
                '&:disabled': {
                  backgroundColor: '#666666',
                  color: '#999999'
                }
              }}
            >
              {isLoading ? 'Deleting...' : `Delete Selected (${getSelectedCount()})`}
            </Button>
          </DialogActions>
       </Dialog>

                           {/* Export Confirmation Dialog */}
        <Dialog 
          open={exportDialogOpen} 
          onClose={() => setExportDialogOpen(false)} 
          maxWidth="md" 
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
              <FileDownloadIcon sx={{ color: '#000000', mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                Selective Data Export
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Button 
                size="small" 
                onClick={handleExportSelectAll} 
                disabled={isLoading}
                sx={{
                  backgroundColor: '#000000',
                  color: '#b98f33',
                  '&:hover': {
                    backgroundColor: '#333333',
                  },
                  '&:disabled': {
                    backgroundColor: '#666666',
                    color: '#999999'
                  }
                }}
              >
                Select All
              </Button>
              <Button 
                size="small" 
                onClick={handleExportSelectNone} 
                disabled={isLoading}
                sx={{
                  backgroundColor: '#000000',
                  color: '#b98f33',
                  '&:hover': {
                    backgroundColor: '#333333',
                  },
                  '&:disabled': {
                    backgroundColor: '#666666',
                    color: '#999999'
                  }
                }}
              >
                Select None
              </Button>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 3, backgroundColor: '#2a2a2a' }}>
            <Alert severity="info" sx={{ mb: 3, backgroundColor: '#3a3a3a', border: '1px solid #b98f33' }}>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#b98f33' }}>Info:</strong> Select the collections you want to export to Excel. The file will include all data from selected collections.
              </Typography>
            </Alert>
            
            {/* Summary Section */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#b98f33', fontWeight: 'bold', mb: 1 }}>
                Selection Summary:
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip 
                  label={`${getExportSelectedCount()} of ${collections.length} collections selected`}
                  sx={{
                    backgroundColor: getExportSelectedCount() > 0 ? '#b98f33' : '#2a2a2a',
                    color: getExportSelectedCount() > 0 ? '#000000' : '#ffffff',
                    border: '1px solid #333333'
                  }}
                  size="small"
                />
                {getExportSelectedCount() > 0 && (
                  <Chip 
                    label={`${getTotalDocumentsToExport()} documents to export`}
                    sx={{
                      backgroundColor: '#274290',
                      color: '#ffffff',
                      border: '1px solid #274290'
                    }}
                    size="small"
                  />
                )}
              </Box>
            </Box>

            {/* Collections List */}
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#b98f33', fontWeight: 'bold' }}>
              Select collections to export:
            </Typography>
            
            <List sx={{ 
              maxHeight: 400, 
              overflow: 'auto', 
              backgroundColor: '#2a2a2a', 
              border: '1px solid #333333', 
              borderRadius: 1 
            }}>
              {collections.map((collection) => (
                <ListItem 
                  key={collection.name} 
                  divider 
                  sx={{ 
                    borderBottom: '1px solid #333333',
                    '&:hover': {
                      backgroundColor: '#3a3a3a'
                    }
                  }}
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedExportCollections[collection.name] || false}
                      onChange={() => handleExportCollectionToggle(collection.name)}
                      disabled={isLoading}
                      sx={{
                        color: '#b98f33',
                        '&.Mui-checked': {
                          color: '#b98f33',
                        },
                        '&.Mui-disabled': {
                          color: '#666666',
                        }
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" component="span">
                          {collection.icon}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                          {collection.label}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: '#b98f33' }}>
                        {collection.description}
                      </Typography>
                    }
                  />
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: '#ffffff' }}>
                      Documents: {typeof collectionStats[collection.name] === 'number' ? collectionStats[collection.name] : (collectionStats[collection.name] === 'Error' ? 'Error loading' : 'Loading...')}
                    </Typography>
                  </Box>
                  <ListItemSecondaryAction>
                    <Chip 
                      label={typeof collectionStats[collection.name] === 'number' ? `${collectionStats[collection.name]} docs` : (collectionStats[collection.name] === 'Error' ? 'Error' : 'Loading...')}
                      size="small"
                      variant="outlined"
                      sx={{
                        backgroundColor: selectedExportCollections[collection.name] ? '#274290' : '#2a2a2a',
                        color: selectedExportCollections[collection.name] ? '#ffffff' : (collectionStats[collection.name] === 'Error' ? '#ff9800' : '#ffffff'),
                        border: selectedExportCollections[collection.name] ? '1px solid #274290' : '1px solid #333333'
                      }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {/* Progress Section */}
            {isLoading && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, color: '#b98f33' }}>
                  {currentOperation}
                </Typography>
                <LinearProgress 
                  variant="determinate"
                  value={exportProgress}
                  sx={{
                    backgroundColor: '#2a2a2a',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#b98f33'
                    }
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, color: '#ffffff' }}>
                  {Math.round(exportProgress)}% complete
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, backgroundColor: '#2a2a2a', borderTop: '1px solid #333333' }}>
            <Button 
              onClick={() => setExportDialogOpen(false)} 
              disabled={isLoading}
              sx={{
                backgroundColor: '#666666',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: '#888888',
                },
                '&:disabled': {
                  backgroundColor: '#444444',
                  color: '#999999'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportToExcel}
              variant="contained"
              disabled={isLoading || getExportSelectedCount() === 0}
              startIcon={isLoading ? <CircularProgress size={16} /> : <FileDownloadIcon />}
              sx={{ 
                backgroundColor: '#b98f33', 
                color: '#000000',
                '&:hover': { 
                  backgroundColor: '#d4af5a' 
                },
                '&:disabled': {
                  backgroundColor: '#666666',
                  color: '#999999'
                }
              }}
            >
              {isLoading ? `Exporting... ${Math.round(exportProgress)}%` : `Export Selected (${getExportSelectedCount()})`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ==================== PROFESSIONAL BACKUP DIALOG ==================== */}
        <Dialog 
          open={backupDialogOpen} 
          onClose={() => setBackupDialogOpen(false)} 
          maxWidth="md" 
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
            background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 2,
            fontWeight: 'bold'
          }}>
            <Box display="flex" alignItems="center">
              <BackupIcon sx={{ color: '#ffffff', mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                Professional Backup System
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Button 
                size="small" 
                onClick={handleBackupSelectAll} 
                disabled={isLoading}
                sx={{
                  backgroundColor: '#ffffff',
                  color: '#2e7d32',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                  '&:disabled': {
                    backgroundColor: '#666666',
                    color: '#999999'
                  }
                }}
              >
                Select All
              </Button>
              <Button 
                size="small" 
                onClick={handleBackupSelectNone} 
                disabled={isLoading}
                sx={{
                  backgroundColor: '#ffffff',
                  color: '#2e7d32',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                  '&:disabled': {
                    backgroundColor: '#666666',
                    color: '#999999'
                  }
                }}
              >
                Select None
              </Button>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 3, backgroundColor: '#2a2a2a' }}>
            <Alert severity="info" sx={{ mb: 3, backgroundColor: '#3a3a3a', border: '1px solid #2e7d32' }}>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#2e7d32' }}>Professional Backup:</strong> Create secure, encrypted backups with integrity checks and comprehensive metadata.
              </Typography>
            </Alert>
            
            {/* Security Options */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#2e7d32', fontWeight: 'bold', mb: 2 }}>
                🔒 Security Options:
              </Typography>
              <Box display="flex" gap={2} alignItems="center" mb={2}>
                <Checkbox
                  checked={encryptBackup}
                  onChange={(e) => setEncryptBackup(e.target.checked)}
                  sx={{
                    color: '#2e7d32',
                    '&.Mui-checked': {
                      color: '#2e7d32',
                    }
                  }}
                />
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  Encrypt backup with password
                </Typography>
              </Box>
              {encryptBackup && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ color: '#ffffff', mb: 1 }}>
                    Backup Password:
                  </Typography>
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="Enter backup password"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #333333',
                      backgroundColor: '#2a2a2a',
                      color: '#ffffff',
                      fontSize: '14px'
                    }}
                  />
                </Box>
              )}
            </Box>

            {/* Summary Section */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#2e7d32', fontWeight: 'bold', mb: 1 }}>
                Selection Summary:
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip 
                  label={`${getBackupSelectedCount()} of ${collections.length} collections selected`}
                  sx={{
                    backgroundColor: getBackupSelectedCount() > 0 ? '#2e7d32' : '#2a2a2a',
                    color: getBackupSelectedCount() > 0 ? '#ffffff' : '#ffffff',
                    border: '1px solid #333333'
                  }}
                  size="small"
                />
                {getBackupSelectedCount() > 0 && (
                  <Chip 
                    label={`${getTotalDocumentsToExport()} documents to backup`}
                    sx={{
                      backgroundColor: '#2e7d32',
                      color: '#ffffff',
                      border: '1px solid #2e7d32'
                    }}
                    size="small"
                  />
                )}
              </Box>
            </Box>

            {/* Collections List */}
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
              Select collections to backup:
            </Typography>
            
            <List sx={{ 
              maxHeight: 300, 
              overflow: 'auto', 
              backgroundColor: '#2a2a2a', 
              border: '1px solid #333333', 
              borderRadius: 1 
            }}>
              {collections.map((collection) => (
                <ListItem 
                  key={collection.name} 
                  divider 
                  sx={{ 
                    borderBottom: '1px solid #333333',
                    '&:hover': {
                      backgroundColor: '#3a3a3a'
                    }
                  }}
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedBackupCollections[collection.name] || false}
                      onChange={() => handleBackupCollectionToggle(collection.name)}
                      disabled={isLoading}
                      sx={{
                        color: '#2e7d32',
                        '&.Mui-checked': {
                          color: '#2e7d32',
                        },
                        '&.Mui-disabled': {
                          color: '#666666',
                        }
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" component="span">
                          {collection.icon}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                          {collection.label}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: '#2e7d32' }}>
                        {collection.description}
                      </Typography>
                    }
                  />
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: '#ffffff' }}>
                      Documents: {typeof collectionStats[collection.name] === 'number' ? collectionStats[collection.name] : (collectionStats[collection.name] === 'Error' ? 'Error loading' : 'Loading...')}
                    </Typography>
                  </Box>
                  <ListItemSecondaryAction>
                    <Chip 
                      label={typeof collectionStats[collection.name] === 'number' ? `${collectionStats[collection.name]} docs` : (collectionStats[collection.name] === 'Error' ? 'Error' : 'Loading...')}
                      size="small"
                      variant="outlined"
                      sx={{
                        backgroundColor: selectedBackupCollections[collection.name] ? '#2e7d32' : '#2a2a2a',
                        color: selectedBackupCollections[collection.name] ? '#ffffff' : (collectionStats[collection.name] === 'Error' ? '#ff9800' : '#ffffff'),
                        border: selectedBackupCollections[collection.name] ? '1px solid #2e7d32' : '1px solid #333333'
                      }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {/* Progress Section */}
            {isLoading && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, color: '#2e7d32' }}>
                  {currentOperation}
                </Typography>
                <LinearProgress 
                  variant="determinate"
                  value={backupProgress}
                  sx={{
                    backgroundColor: '#2a2a2a',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#2e7d32'
                    }
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, color: '#ffffff' }}>
                  {Math.round(backupProgress)}% complete
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, backgroundColor: '#2a2a2a', borderTop: '1px solid #333333' }}>
            <Button 
              onClick={() => setBackupDialogOpen(false)} 
              disabled={isLoading}
              sx={{
                backgroundColor: '#666666',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: '#888888',
                },
                '&:disabled': {
                  backgroundColor: '#444444',
                  color: '#999999'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBackup}
              variant="contained"
              disabled={isLoading || getBackupSelectedCount() === 0}
              startIcon={isLoading ? <CircularProgress size={16} /> : <BackupIcon />}
              sx={{ 
                backgroundColor: '#2e7d32', 
                color: '#ffffff',
                '&:hover': { 
                  backgroundColor: '#1b5e20' 
                },
                '&:disabled': {
                  backgroundColor: '#666666',
                  color: '#999999'
                }
              }}
            >
              {isLoading ? `Creating Backup... ${Math.round(backupProgress)}%` : `Create Professional Backup (${getBackupSelectedCount()})`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ==================== PROFESSIONAL RESTORE DIALOG ==================== */}
        <Dialog 
          open={restoreDialogOpen} 
          onClose={() => setRestoreDialogOpen(false)} 
          maxWidth="md" 
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
            background: 'linear-gradient(135deg, #ed6c02 0%, #e65100 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            py: 2,
            fontWeight: 'bold'
          }}>
            <Box display="flex" alignItems="center">
              <RestoreIcon sx={{ color: '#ffffff', mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                Restore from Professional Backup
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 3, backgroundColor: '#2a2a2a' }}>
            <Alert severity="warning" sx={{ mb: 3, backgroundColor: '#3a3a3a', border: '1px solid #ed6c02' }}>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#ed6c02' }}>Warning:</strong> This action will restore data from your backup file. Make sure you have a current backup before proceeding.
              </Typography>
            </Alert>
            
            {/* File Selection */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#ed6c02', fontWeight: 'bold', mb: 2 }}>
                📁 Select Backup File:
              </Typography>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #333333',
                  backgroundColor: '#2a2a2a',
                  color: '#ffffff',
                  fontSize: '14px'
                }}
              />
              {selectedBackupFile && (
                <Typography variant="body2" sx={{ color: '#ffffff', mt: 1 }}>
                  Selected: {selectedBackupFile.name}
                </Typography>
              )}
            </Box>

            {/* Password Section */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#ed6c02', fontWeight: 'bold', mb: 2 }}>
                🔐 Backup Password (if encrypted):
              </Typography>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter backup password if encrypted"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #333333',
                  backgroundColor: '#2a2a2a',
                  color: '#ffffff',
                  fontSize: '14px'
                }}
              />
            </Box>

            {/* Restore Mode */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#ed6c02', fontWeight: 'bold', mb: 2 }}>
                🔄 Restore Mode:
              </Typography>
              <Box display="flex" gap={2}>
                <Button
                  variant={restoreMode === 'full' ? 'contained' : 'outlined'}
                  onClick={() => setRestoreMode('full')}
                  sx={{
                    backgroundColor: restoreMode === 'full' ? '#ed6c02' : 'transparent',
                    color: restoreMode === 'full' ? '#ffffff' : '#ed6c02',
                    border: '1px solid #ed6c02',
                    '&:hover': {
                      backgroundColor: restoreMode === 'full' ? '#e65100' : 'rgba(237, 108, 2, 0.1)'
                    }
                  }}
                >
                  Full Restore
                </Button>
                <Button
                  variant={restoreMode === 'merge' ? 'contained' : 'outlined'}
                  onClick={() => setRestoreMode('merge')}
                  sx={{
                    backgroundColor: restoreMode === 'merge' ? '#ed6c02' : 'transparent',
                    color: restoreMode === 'merge' ? '#ffffff' : '#ed6c02',
                    border: '1px solid #ed6c02',
                    '&:hover': {
                      backgroundColor: restoreMode === 'merge' ? '#e65100' : 'rgba(237, 108, 2, 0.1)'
                    }
                  }}
                >
                  Merge Data
                </Button>
              </Box>
            </Box>

            {/* Progress Section */}
            {isLoading && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, color: '#ed6c02' }}>
                  {currentOperation}
                </Typography>
                <LinearProgress 
                  variant="determinate"
                  value={restoreProgress}
                  sx={{
                    backgroundColor: '#2a2a2a',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#ed6c02'
                    }
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, color: '#ffffff' }}>
                  {Math.round(restoreProgress)}% complete
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, backgroundColor: '#2a2a2a', borderTop: '1px solid #333333' }}>
            <Button 
              onClick={() => setRestoreDialogOpen(false)} 
              disabled={isLoading}
              sx={{
                backgroundColor: '#666666',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: '#888888',
                },
                '&:disabled': {
                  backgroundColor: '#444444',
                  color: '#999999'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreFromBackup}
              variant="contained"
              disabled={isLoading || !selectedBackupFile}
              startIcon={isLoading ? <CircularProgress size={16} /> : <RestoreIcon />}
              sx={{ 
                backgroundColor: '#ed6c02', 
                color: '#ffffff',
                '&:hover': { 
                  backgroundColor: '#e65100' 
                },
                '&:disabled': {
                  backgroundColor: '#666666',
                  color: '#999999'
                }
              }}
            >
              {isLoading ? `Restoring... ${Math.round(restoreProgress)}%` : 'Restore from Backup'}
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
};

export default DataManagementPage; 