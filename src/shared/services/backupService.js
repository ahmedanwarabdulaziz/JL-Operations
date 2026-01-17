import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  generateBackupId,
  encryptBackupData,
  generateChecksum,
  formatBackupSize,
  sanitizeFileName
} from '../utils/backupUtils';

/**
 * Process data for Excel export (handles special cases like orders)
 * @param {Array} data - Collection data
 * @param {string} collectionName - Name of the collection
 * @returns {Array} Processed data ready for Excel
 */
const processDataForExcel = (data, collectionName) => {
  if (data.length === 0) {
    return [];
  }

  if (collectionName === 'orders' || collectionName === 'corporate-orders') {
    // Special handling for orders - more organized format
    return data.map(order => {
      const getValue = (obj, path) => {
        try {
          return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : '';
          }, obj) || '';
        } catch (e) {
          return '';
        }
      };

      const formatDate = (dateValue) => {
        try {
          if (!dateValue) return '';
          if (dateValue && dateValue.toDate) {
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

      const formatFurnitureGroups = (groups) => {
        try {
          if (!groups || !Array.isArray(groups)) return '';
          return groups.map((group, index) => {
            const parts = [];
            parts.push(`Group ${index + 1}:`);
            if (group.furnitureType) parts.push(`Type: ${group.furnitureType}`);
            if (group.materialCompany) parts.push(`Material: ${group.materialCompany}`);
            if (group.quantity) parts.push(`Qty: ${group.quantity}`);
            if (group.labourWork) parts.push(`Labour: $${group.labourWork}`);
            if (group.cost) parts.push(`Cost: $${group.cost}`);
            if (group.description) parts.push(`Desc: ${group.description}`);
            if (group.dimensions) parts.push(`Dimensions: ${group.dimensions}`);
            if (group.color) parts.push(`Color: ${group.color}`);
            if (group.finish) parts.push(`Finish: ${group.finish}`);
            if (group.notes) parts.push(`Notes: ${group.notes}`);
            return parts.join(', ');
          }).join(' | ');
        } catch (e) {
          return '';
        }
      };

      // Handle both regular orders (furnitureData.groups) and corporate orders (furnitureGroups)
      let furnitureGroups = [];
      if (collectionName === 'corporate-orders') {
        // Corporate orders have furnitureGroups at root level
        furnitureGroups = order.furnitureGroups || [];
      } else {
        // Regular orders have furnitureData.groups
        furnitureGroups = getValue(order, 'furnitureData.groups') || [];
      }

      return {
        'Order ID': order.id || '',
        'Order Type': collectionName === 'corporate-orders' ? 'Corporate' : 'Regular',
        'Order Date': formatDate(order.createdAt),
        'Last Updated': formatDate(order.updatedAt),
        'Customer Name': getValue(order, 'personalInfo.customerName') || getValue(order, 'personalInfo.name') || getValue(order, 'corporateCustomer.name') || '',
        'Customer Phone': getValue(order, 'personalInfo.phone') || getValue(order, 'corporateCustomer.phone') || '',
        'Customer Email': getValue(order, 'personalInfo.email') || getValue(order, 'corporateCustomer.email') || '',
        'Customer Address': getValue(order, 'personalInfo.address') || getValue(order, 'corporateCustomer.address') || '',
        'Bill Invoice': getValue(order, 'orderDetails.billInvoice') || '',
        'Description': getValue(order, 'orderDetails.description') || '',
        'Platform': getValue(order, 'orderDetails.platform') || '',
        'Start Date': getValue(order, 'orderDetails.startDate') || '',
        'Timeline': getValue(order, 'orderDetails.timeline') || '',
        'Furniture Groups Count': furnitureGroups.length || 0,
        'Furniture Details': formatFurnitureGroups(furnitureGroups),
        'Deposit Amount': getValue(order, 'paymentData.deposit') || '',
        'Amount Paid': getValue(order, 'paymentData.amountPaid') || '',
        'Pickup/Delivery': getValue(order, 'paymentData.pickupDeliveryEnabled') ? 'Yes' : 'No',
        'Pickup/Delivery Cost': getValue(order, 'paymentData.pickupDeliveryCost') || '',
        'Notes': getValue(order, 'paymentData.notes') || '',
        'Status': order.status || getValue(order, 'orderDetails.status') || '',
        'Total Amount': getValue(order, 'totalAmount') || '',
        'Priority': getValue(order, 'priority') || '',
        'Assigned To': getValue(order, 'assignedTo') || '',
      };
    });
  }

  // Process other collections
  return data.map(item => {
    const processedItem = {};
    Object.keys(item).forEach(key => {
      try {
        const value = item[key];
        if (typeof value === 'object' && value !== null) {
          if (value && value.toDate) {
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
};

/**
 * Create Excel workbook from data
 * @param {Object} allData - Data organized by collection name
 * @param {Array} collections - Collection metadata array
 * @returns {Object} XLSX workbook
 */
const createExcelWorkbook = (allData, collections) => {
  const workbook = XLSX.utils.book_new();

  Object.keys(allData).forEach(collectionName => {
    const collectionInfo = collections.find(c => c.name === collectionName);
    const data = allData[collectionName];

    if (data.length === 0) {
      const headers = ['No Data Available'];
      const emptyData = [['This collection is empty']];
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...emptyData]);
      XLSX.utils.book_append_sheet(workbook, worksheet, collectionName);
    } else {
      const processedData = processDataForExcel(data, collectionName);
      const worksheet = XLSX.utils.json_to_sheet(processedData);

      // Set column widths
      if (processedData.length > 0) {
        const headers = Object.keys(processedData[0] || {});
        const columnWidths = headers.map(header => {
          const maxLength = Math.max(
            header.length,
            ...processedData.map(row => String(row[header] || '').length)
          );
          return { width: Math.min(Math.max(maxLength + 2, 10), 50) };
        });
        worksheet['!cols'] = columnWidths;
      }

      const sheetName = collectionName === 'orders' ? 'Orders' : 
                       collectionName === 'corporate-orders' ? 'Corporate Orders' : 
                       collectionName;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  });

  return workbook;
};

/**
 * Create unified backup (Excel + JSON + ZIP + Storage)
 * @param {Object} options - Backup options
 * @param {Array} options.selectedCollections - Array of collection names to backup
 * @param {Array} options.collections - Collection metadata array
 * @param {boolean} options.encrypt - Whether to encrypt the backup
 * @param {string} options.password - Encryption password (if encrypt is true)
 * @param {boolean} options.createZip - Whether to create ZIP archive
 * @param {boolean} options.uploadToStorage - Whether to upload to Firebase Storage
 * @param {Function} options.onProgress - Progress callback (progress, message)
 * @returns {Promise<Object>} Backup result with metadata and file URLs
 */
export const createUnifiedBackup = async ({
  selectedCollections,
  collections,
  encrypt = false,
  password = '',
  createZip = true,
  uploadToStorage = true,
  onProgress = () => {}
}) => {
  try {
    const backupId = generateBackupId();
    const allData = {};
    let totalDocuments = 0;

    // Step 1: Fetch data from Firestore
    onProgress(0, 'Fetching data from Firestore...');
    
    for (let i = 0; i < selectedCollections.length; i++) {
      const collectionName = selectedCollections[i];
      const collectionInfo = collections.find(c => c.name === collectionName);
      const progress = (i / selectedCollections.length) * 30;
      onProgress(progress, `Fetching ${collectionInfo?.label || collectionName}...`);

      try {
        const snapshot = await getDocs(collection(db, collectionName));
        allData[collectionName] = snapshot.docs.map(document => ({
          id: document.id,
          ...document.data()
        }));
        totalDocuments += allData[collectionName].length;
        console.log(`✅ Fetched ${allData[collectionName].length} documents from ${collectionName}`);
      } catch (error) {
        console.error(`❌ Error fetching ${collectionName}:`, error);
        allData[collectionName] = [];
      }
    }

    // Step 2: Generate checksum
    onProgress(35, 'Generating data integrity checksum...');
    const checksum = await generateChecksum(allData);

    // Step 3: Create backup metadata
    const backupMetadata = {
      backupId: backupId,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      firebaseProject: 'jl-operation',
      collections: {},
      totalDocuments: totalDocuments,
      encrypted: encrypt,
      checksum: checksum,
      compression: createZip ? 'zip' : 'none',
      createdBy: 'system'
    };

    // Add collection counts to metadata
    Object.keys(allData).forEach(collectionName => {
      backupMetadata.collections[collectionName] = allData[collectionName].length;
    });

    // Step 4: Generate Excel workbook
    onProgress(40, 'Generating Excel workbook...');
    const workbook = createExcelWorkbook(allData, collections);
    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const excelFileName = `backup_${backupId}.xlsx`;

    // Step 5: Prepare JSON backup data
    onProgress(50, 'Preparing JSON backup data...');
    const jsonBackupData = {
      metadata: backupMetadata,
      data: allData
    };

    // Step 6: Encrypt if requested
    let finalJsonData = jsonBackupData;
    if (encrypt && password) {
      onProgress(55, 'Encrypting backup data...');
      const encryptedData = encryptBackupData(allData, password);
      finalJsonData = {
        metadata: backupMetadata,
        data: encryptedData
      };
    }

    const jsonString = JSON.stringify(finalJsonData, null, 2);
    const jsonBuffer = new TextEncoder().encode(jsonString);
    const jsonFileName = `backup_${backupId}.json`;

    // Step 7: Create ZIP archive if requested
    let zipBuffer = null;
    let zipFileName = null;
    if (createZip) {
      onProgress(60, 'Creating ZIP archive...');
      const zip = new JSZip();
      zip.file(excelFileName, excelBuffer);
      zip.file(jsonFileName, jsonBuffer);
      zip.file('metadata.json', JSON.stringify(backupMetadata, null, 2));
      
      zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      zipFileName = `backup_${backupId}.zip`;
    }

    // Step 8: Upload to Firebase Storage if requested
    let storageUrls = {};
    if (uploadToStorage) {
      onProgress(70, 'Uploading to Firebase Storage...');
      const storagePath = `backups/${backupId}/`;

      // Upload Excel file
      const excelRef = ref(storage, `${storagePath}${excelFileName}`);
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await uploadBytes(excelRef, excelBlob);
      storageUrls.excel = await getDownloadURL(excelRef);

      // Upload JSON file
      const jsonRef = ref(storage, `${storagePath}${jsonFileName}`);
      const jsonBlob = new Blob([jsonBuffer], { type: 'application/json' });
      await uploadBytes(jsonRef, jsonBlob);
      storageUrls.json = await getDownloadURL(jsonRef);

      // Upload ZIP if created
      if (zipBuffer) {
        const zipRef = ref(storage, `${storagePath}${zipFileName}`);
        const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
        await uploadBytes(zipRef, zipBlob);
        storageUrls.zip = await getDownloadURL(zipRef);
      }

      // Upload metadata
      const metadataRef = ref(storage, `${storagePath}metadata.json`);
      const metadataBlob = new Blob([new TextEncoder().encode(JSON.stringify(backupMetadata, null, 2))], { type: 'application/json' });
      await uploadBytes(metadataRef, metadataBlob);
      storageUrls.metadata = await getDownloadURL(metadataRef);

      // Step 9: Save backup metadata to Firestore
      onProgress(85, 'Saving backup metadata...');
      await addDoc(collection(db, 'backups'), {
        ...backupMetadata,
        storageUrls: storageUrls,
        fileSizes: {
          excel: formatBackupSize(excelBuffer.length),
          json: formatBackupSize(jsonBuffer.length),
          zip: zipBuffer ? formatBackupSize(zipBuffer.length) : null
        },
        createdAt: serverTimestamp(),
        status: 'completed'
      });
    }

    // Step 10: Download files to user's computer
    onProgress(90, 'Preparing files for download...');
    
    const downloadFile = (buffer, fileName, mimeType) => {
      const blob = new Blob([buffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sanitizeFileName(fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    if (createZip && zipBuffer) {
      // Download ZIP file
      downloadFile(zipBuffer, zipFileName, 'application/zip');
    } else {
      // Download separate files
      downloadFile(excelBuffer, excelFileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      downloadFile(jsonBuffer, jsonFileName, 'application/json');
    }

    onProgress(100, 'Backup completed successfully!');

    return {
      success: true,
      backupId: backupId,
      metadata: backupMetadata,
      storageUrls: storageUrls,
      fileSizes: {
        excel: formatBackupSize(excelBuffer.length),
        json: formatBackupSize(jsonBuffer.length),
        zip: zipBuffer ? formatBackupSize(zipBuffer.length) : null
      }
    };

  } catch (error) {
    console.error('Backup creation error:', error);
    throw new Error(`Failed to create backup: ${error.message}`);
  }
};

/**
 * Fetch backup history from Firestore
 * @returns {Promise<Array>} Array of backup metadata
 */
export const fetchBackupHistory = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'backups'));
    const backups = [];
    
    snapshot.forEach(doc => {
      backups.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by timestamp descending (newest first)
    backups.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return backups;
  } catch (error) {
    console.error('Error fetching backup history:', error);
    throw new Error(`Failed to fetch backup history: ${error.message}`);
  }
};
