import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  IconButton as MuiIconButton,
  Box as MuiBox,
  Tooltip as MuiTooltip,
  Select,
  MenuItem,
  InputAdornment,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { calculateOrderTotal, calculateOrderCost, formatFurnitureDetails, isRapidOrder } from '../../../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates, getMaterialCompanyTaxRate } from '../../../shared/utils/materialTaxRates';
import autoTable from 'jspdf-autotable';
import { calculateInvoiceTotals, openInvoicePreview } from '../../../shared/utils/invoicePreview';

// Register the autoTable plugin
jsPDF.API.autoTable = autoTable;

const InvoicePage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    price: '',
    unit: '',
    tax: '',
    taxType: 'fixed', // 'fixed' or 'percent'
    total: '',
  });
  const [expenseList, setExpenseList] = useState([]);
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [workOrderDialogOpen, setWorkOrderDialogOpen] = useState(false);
  const [workOrderSelections, setWorkOrderSelections] = useState({});
  const [workOrderPrintToggles, setWorkOrderPrintToggles] = useState({});
  const navigate = useNavigate();
  const listContainerRef = useRef(null);

  // Function to scroll to selected order in the list
  const scrollToSelectedOrder = (orderId) => {
    if (listContainerRef.current && orderId) {
      const selectedElement = listContainerRef.current.querySelector(`[data-order-id="${orderId}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, []);

  // Handle URL parameter for order selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    
    if (orderId && orders.length > 0) {
      const orderToSelect = orders.find(order => order.id === orderId);
      if (orderToSelect) {
        setSelectedOrder(orderToSelect);
        // Scroll to the selected order after a short delay to ensure DOM is updated
        setTimeout(() => {
          scrollToSelectedOrder(orderId);
        }, 100);
      }
    }
  }, [orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch orders
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get invoice statuses to identify end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out cancelled and pending orders, include all other orders (including done)
      const excludedStatuses = statusesData.filter(status => 
        status.isEndState && (status.endStateType === 'cancelled' || status.endStateType === 'pending')
      );
      const excludedValues = excludedStatuses.map(status => status.value);

      const activeOrders = ordersData.filter(order => 
        !excludedValues.includes(order.invoiceStatus)
      );
      
      setOrders(activeOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showNotification('Error fetching orders', 'error');
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

  const formatCurrency = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  };

  // Add a formatter for full decimal precision
  const formatCurrencyFull = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.0000';
    return `$${num.toFixed(4)}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Use consistent calculation functions from orderCalculations
  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
  };

  const handleReviewAndPrint = async () => {
    if (!selectedOrder) {
      showNotification('Please select an order first', 'warning');
      return;
    }

    try {
      showNotification('Opening print preview...', 'info');
      
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      openInvoicePreview(selectedOrder, { materialTaxRates });
      showNotification('Print preview opened successfully', 'success');
    } catch (error) {
      console.error('Error generating print preview:', error);
      showNotification('Error generating print preview', 'error');
    }
  };

  const handlePrintWorkOrder = () => {
    if (!selectedOrder) {
      showNotification('Please select an order first', 'warning');
      return;
    }

    if (!selectedOrder.furnitureData || !selectedOrder.furnitureData.groups) {
      showNotification('No furniture data available', 'error');
      return;
    }

    const furnitureGroups = selectedOrder.furnitureData.groups || [];
    if (furnitureGroups.length === 0) {
      showNotification('No furniture groups found', 'error');
      return;
    }

    // Initialize selections with default "Furniture Form"
    const initialSelections = {};
    const initialPrintToggles = {};
    furnitureGroups.forEach((group, index) => {
      initialSelections[index] = 'furniture';
      initialPrintToggles[index] = true; // Default to enabled
    });
    setWorkOrderSelections(initialSelections);
    setWorkOrderPrintToggles(initialPrintToggles);
    setWorkOrderDialogOpen(true);
  };

  const handleWorkOrderFormTypeChange = (groupIndex, formType) => {
    setWorkOrderSelections(prev => ({
      ...prev,
      [groupIndex]: formType
    }));
  };

  const handleWorkOrderPrintToggleChange = (groupIndex, enabled) => {
    setWorkOrderPrintToggles(prev => ({
      ...prev,
      [groupIndex]: enabled
    }));
  };

  const handleGenerateWorkOrder = async () => {
    if (!selectedOrder) {
      showNotification('Please select an order first', 'warning');
      return;
    }

    try {
      showNotification('Generating work order...', 'info');
      
      const printWindow = window.open('', '_blank', 'width=900,height=1200');
      
      const furnitureGroups = selectedOrder.furnitureData.groups || [];
      
      // Generate HTML content for work order with separate pages for each furniture group
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Work Order - ${selectedOrder.orderDetails?.billInvoice || 'N/A'}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #000000;
              zoom: 0.8;
            }
            
            .work-order-page {
              width: 100%;
              min-height: 100vh;
              margin: 0;
              padding: 10mm;
              background-color: #ffffff;
              color: #000000;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              page-break-after: always;
              display: flex;
              flex-direction: column;
              box-sizing: border-box;
            }
            
            .work-order-page:last-child {
              page-break-after: avoid;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 3px solid #000000;
              flex-shrink: 0;
            }
            
            .logo-section {
              display: flex;
              align-items: center;
              flex: 1;
            }
            
            .logo {
              height: 40px;
              width: auto;
            }
            
            .furniture-group-title {
              flex: 2;
              text-align: center;
            }
            
            .furniture-group-title h2 {
              font-size: 1.8rem;
              font-weight: bold;
              color: #000000;
              margin: 0;
              text-transform: uppercase;
            }
            
            .furniture-details {
              font-size: 0.9rem;
              color: #666666;
              margin-top: 5px;
              text-align: center;
            }
            
            .material-code {
              font-weight: 600;
              color: #000000;
            }
            
            .foam-details {
              font-size: 0.8rem;
              color: #888888;
              margin-top: 2px;
            }
            
            .order-details {
              flex: 1;
              text-align: right;
            }
            
            .order-details .invoice-number {
              font-size: 1rem;
              font-weight: bold;
              color: #000000;
              margin: 0 0 3px 0;
            }
            
            .order-details .customer-name {
              font-size: 0.9rem;
              color: #000000;
              margin: 0 0 3px 0;
              font-weight: 500;
            }
            
            .order-details .order-date {
              font-size: 0.9rem;
              color: #666666;
              margin: 0;
            }
            
            
            .furniture-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
            }
            
            
            .work-area {
              width: 100%;
              flex: 1;
              background-color: #ffffff;
              margin-top: 15px;
            }
            
            
            
            .upholstery-type-section {
              margin-bottom: 15px;
              padding: 10px;
              background-color: #f8f9fa;
              border-radius: 8px;
              display: flex;
              align-items: stretch;
              gap: 20px;
              flex-shrink: 0;
            }
            
            .upholstery-box {
              background-color: #ffffff;
              border: 1px solid #000000;
              border-radius: 4px;
              padding: 8px;
              flex: 1;
              display: flex;
              flex-direction: column;
              min-height: 120px;
            }
            
            .upholstery-content {
              display: flex;
              align-items: flex-start;
              gap: 15px;
            }
            
            .section-title {
              font-size: 1rem;
              font-weight: bold;
              color: #000000;
              white-space: nowrap;
            }
            
            .right-column {
              display: flex;
              flex-direction: column;
              gap: 15px;
              flex: 1;
            }
            
            .section-titles-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
            }
            
            .measurement-title-section {
              background-color: #ffffff;
              border: 1px solid #000000;
              border-radius: 4px;
              padding: 8px;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              min-height: 120px;
            }
            
            .measurement-section-title {
              font-size: 1rem;
              font-weight: bold;
              color: #000000;
              margin-bottom: 5px;
            }
            
            .notes-section {
              margin-bottom: 15px;
              padding: 0;
              display: flex;
              flex-direction: row;
              gap: 20px;
              flex-shrink: 0;
              width: 100%;
            }
            
            .note-box {
              background-color: transparent;
              border: none;
              padding: 0;
              min-height: auto;
              flex: 1;
              width: 50%;
            }
            
            .note-title {
              font-size: 0.9rem;
              font-weight: bold;
              color: #000000;
              margin-bottom: 3px;
              border-bottom: 1px solid #000000;
              padding-bottom: 3px;
            }
            
            .note-content {
              font-size: 0.8rem;
              color: #333333;
              line-height: 1.3;
              min-height: auto;
              white-space: pre-wrap;
              margin-bottom: 10px;
            }
            
            .upholstery-options {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            
            .upholstery-option {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            
            .measurement-box {
              padding: 8px;
              background-color: #ffffff;
              border: 1px solid #000000;
              border-radius: 4px;
              min-height: 60px;
            }
            
            .measurement-box-title {
              font-size: 0.9rem;
              font-weight: bold;
              color: #000000;
              margin-bottom: 5px;
            }
            
            .check-box {
              width: 20px;
              height: 20px;
              border: 2px solid #000000;
              border-radius: 3px;
              background-color: #ffffff;
              position: relative;
            }
            
            .option-text {
              font-size: 0.9rem;
              color: #333333;
              font-weight: 500;
              line-height: 1.2;
            }
            
            .measurement-section {
              margin-bottom: 15px;
              padding: 10px;
              background-color: #f8f9fa;
              border: 2px solid #000000;
              border-radius: 8px;
              display: flex;
              align-items: center;
              gap: 15px;
              flex-shrink: 0;
            }
            
            .measurement-notes {
              flex: 1;
              height: 80px;
              border: 1px solid #000000;
              border-radius: 4px;
              background-color: #ffffff;
              padding: 8px;
              font-size: 0.9rem;
              color: #333333;
            }
            
            .measurement-title {
              font-size: 1rem;
              font-weight: bold;
              color: #000000;
              text-align: right;
              white-space: nowrap;
            }
            
            .measurement-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              margin-bottom: 15px;
              border: 2px solid #000000;
              border-radius: 8px;
              overflow: hidden;
              flex-shrink: 0;
            }
            
            .measurement-table th {
              background-color: #f0f0f0;
              border-right: 1px solid #000000;
              border-bottom: 1px solid #000000;
              padding: 8px;
              font-size: 0.9rem;
              font-weight: bold;
              color: #000000;
              text-align: center;
              font-family: Arial, sans-serif;
            }
            
            .measurement-table th:first-child {
              border-left: 2px solid #000000;
            }
            
            .measurement-table th:last-child {
              border-right: 2px solid #000000;
            }
            
            .measurement-table td {
              border-right: 1px solid #000000;
              border-bottom: 1px solid #000000;
              padding: 4px;
              font-size: 0.8rem;
              color: #333333;
              text-align: center;
              height: 25px;
              font-family: Arial, sans-serif;
            }
            
            .measurement-table td:first-child {
              border-left: 2px solid #000000;
            }
            
            .measurement-table td:last-child {
              border-right: 2px solid #000000;
            }
            
            .measurement-table tr:first-child th {
              border-top: 2px solid #000000;
            }
            
            .measurement-table tr:first-child th:first-child {
              border-top-left-radius: 6px;
            }
            
            .measurement-table tr:first-child th:last-child {
              border-top-right-radius: 6px;
            }
            
            .measurement-table tr:last-child td {
              border-bottom: 2px solid #000000;
            }
            
            .measurement-table tr:last-child td:first-child {
              border-bottom-left-radius: 6px;
            }
            
            .measurement-table tr:last-child td:last-child {
              border-bottom-right-radius: 6px;
            }
            
            .notes-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              margin-bottom: 0;
              border: 2px solid #000000;
              border-radius: 8px;
              overflow: hidden;
              flex: 1;
            }
            
            .notes-table th {
              background-color: #f0f0f0;
              border-right: 1px solid #000000;
              border-bottom: 1px solid #000000;
              padding: 8px;
              font-size: 0.9rem;
              font-weight: bold;
              color: #000000;
              text-align: center;
              font-family: Arial, sans-serif;
            }
            
            .notes-table th:first-child {
              border-left: 2px solid #000000;
            }
            
            .notes-table th:last-child {
              border-right: 2px solid #000000;
            }
            
            .notes-table td {
              border-right: 1px solid #000000;
              padding: 8px;
              font-size: 0.9rem;
              color: #333333;
              text-align: left;
              font-family: Arial, sans-serif;
              background-color: #ffffff;
              vertical-align: top;
            }
            
            .notes-table td:first-child {
              border-left: 2px solid #000000;
              width: 50%;
            }
            
            .notes-table td:last-child {
              border-right: 2px solid #000000;
              width: 50%;
            }
            
            .notes-table tr:first-child th {
              border-top: 2px solid #000000;
            }
            
            .notes-table tr:first-child th:first-child {
              border-top-left-radius: 6px;
            }
            
            .notes-table tr:first-child th:last-child {
              border-top-right-radius: 6px;
            }
            
            .notes-table tr:last-child td {
              border-bottom: 2px solid #000000;
            }
            
            .notes-table tr:last-child td:first-child {
              border-bottom-left-radius: 6px;
            }
            
            .notes-table tr:last-child td:last-child {
              border-bottom-right-radius: 6px;
            }
            
            .cushion-note-item {
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            
            .cushion-checkbox {
              width: 16px;
              height: 16px;
              border: 1px solid #000000;
              border-radius: 2px;
              background-color: #ffffff;
              flex-shrink: 0;
              margin-top: 2px;
            }
            
            .cushion-note-text {
              font-size: 0.9rem;
              color: #333333;
              line-height: 1.4;
            }
            
            .measurement-table td:first-child,
            .measurement-table td:nth-child(2) {
              background-color: #ffffff;
            }
            
            .measurement-table td:last-child {
              background-color: #f8f9fa;
              font-weight: 600;
              font-size: 1rem;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
                zoom: 1;
              }
              
              .work-order-page {
                box-shadow: none;
                margin: 0;
                padding: 10mm;
                width: 100%;
                min-height: 100vh;
                height: auto;
              }
              
              @page {
                margin: 0;
                size: auto;
              }
            }
            
            @media screen {
              body {
                padding: 20px;
                background-color: #f5f5f5;
              }
              
              .work-order-page {
                transform: scale(0.75);
                transform-origin: top center;
              }
            }
          </style>
        </head>
        <body>
          ${furnitureGroups.map((group, index) => {
            const formType = workOrderSelections[index] || 'furniture';
            const shouldPrint = workOrderPrintToggles[index] !== false; // Default to true if not set
            const workOrderId = `WO-${selectedOrder.id}-${index + 1}`;
            
            // Only generate HTML if print is enabled for this group
            if (!shouldPrint) {
              return '';
            }
            
                            if (formType === 'cushion') {
                                return `
                                    <div class="work-order-page">
                                        <div class="header">
                                            <div class="logo-section">
                                                <img src="/assets/images/logo-001.png" alt="JL Upholstery Logo" class="logo">
                                            </div>
                                            <div class="furniture-group-title">
                                                <h2>${group.furnitureType || 'Furniture Group'}</h2>
                                                <div class="furniture-details">
                                                    ${group.materialCode ? `<div class="material-code">${group.materialCode}</div>` : ''}
                                                    ${(group.foamThickness || group.foamNote) ? `
                                                        <div class="foam-details">
                                                            Foam${group.foamThickness ? ` (${group.foamThickness}")` : ''}${group.foamNote ? ` - ${group.foamNote}` : ''}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            <div class="order-details">
                                                <div class="invoice-number">${selectedOrder.orderDetails?.billInvoice || 'N/A'}</div>
                                                <div class="customer-name">${selectedOrder.personalInfo?.customerName || 'N/A'}</div>
                                                <div class="order-date">${formatDate(selectedOrder.createdAt)}</div>
                                            </div>
                                        </div>
                                        
                                        <div class="notes-section">
                                            <div class="note-box">
                                                <div class="note-title">General Note</div>
                                                <div class="note-content">${selectedOrder.paymentData?.notes || ''}</div>
                                            </div>
                                            <div class="note-box">
                                                <div class="note-title">Furniture Note</div>
                                                <div class="note-content">${group.customerNote || ''}</div>
                                            </div>
                                        </div>
                                        
                                        <table class="notes-table" style="width: 100%; height: calc(100vh - 300px); margin-top: 20px;">
                                            <thead>
                                                <tr>
                                                    <th>Cushions Notes<br/>ملاحظات الفرشات</th>
                                                    <th>General Note<br/>ملاحظات عامة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>
                                                        <div class="cushion-note-item">
                                                            <div class="cushion-checkbox"></div>
                                                            <div class="cushion-note-text">- التأكد من اتجاه قماش الفرشات</div>
                                                        </div>
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>`;
            } else {
              return `
            <div class="work-order-page">
              <div class="header">
                <div class="logo-section">
                  <img src="/assets/images/logo-001.png" alt="JL Upholstery Logo" class="logo">
                </div>
                <div class="furniture-group-title">
                  <h2>${group.furnitureType || 'Furniture Group'}</h2>
                  <div class="furniture-details">
                    ${group.materialCode ? `<div class="material-code">${group.materialCode}</div>` : ''}
                    ${(group.foamThickness || group.foamNote) ? `
                      <div class="foam-details">
                        Foam${group.foamThickness ? ` (${group.foamThickness}")` : ''}${group.foamNote ? ` - ${group.foamNote}` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
                <div class="order-details">
                  <div class="invoice-number">${selectedOrder.orderDetails?.billInvoice || 'N/A'}</div>
                  <div class="customer-name">${selectedOrder.personalInfo?.customerName || 'N/A'}</div>
                  <div class="order-date">${formatDate(selectedOrder.createdAt)}</div>
                </div>
              </div>
              
              <div class="notes-section">
                <div class="note-box">
                  <div class="note-title">General Note</div>
                  <div class="note-content">${selectedOrder.paymentData?.notes || ''}</div>
                </div>
                <div class="note-box">
                  <div class="note-title">Furniture Note</div>
                  <div class="note-content">${group.customerNote || ''}</div>
                </div>
              </div>
              
              <div class="upholstery-type-section">
                <div class="upholstery-box">
                  <div class="upholstery-content">
                    <div class="section-title">Upholstery Type<br/>نوع الخياطة</div>
                    <div class="upholstery-options">
                      <div class="upholstery-option">
                        <div class="check-box"></div>
                        <div class="option-text">Plain ساده</div>
                      </div>
                      <div class="upholstery-option">
                        <div class="check-box"></div>
                        <div class="option-text">Top Stitch سلفنة</div>
                      </div>
                      <div class="upholstery-option">
                        <div class="check-box"></div>
                        <div class="option-text">Piping بايبنغ</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="measurement-title-section">
                  <div class="measurement-section-title">Inner Measurement<br/>قياس الداخلي</div>
                </div>
              </div>
              
              <table class="measurement-table">
                <thead>
                  <tr>
                    <th>Quantity<br/>الكمية</th>
                    <th>Measurements<br/>القياس</th>
                    <th>Details<br/>تفاصيل الكنبة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td></td>
                    <td></td>
                    <td>قاعدة</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td>يد</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td>جنب</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td>ظهر</td>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td>خلفية</td>
                  </tr>
                </tbody>
              </table>
              
              <table class="notes-table">
                <thead>
                  <tr>
                    <th>Cushions Notes<br/>ملاحظات الفرشات</th>
                    <th>General Note<br/>ملاحظات عامة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div class="cushion-note-item">
                        <div class="cushion-checkbox"></div>
                        <div class="cushion-note-text">- التأكد من اتجاه قماش الفرشات</div>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              
            </div>`;
            }
          }).join('') || '<div class="work-order-page"><div class="furniture-section"><div class="furniture-title">No Furniture Groups Found</div></div></div>'}
        </body>
        </html>
      `;
      
      // Write the HTML content to the new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait for the content to load, then print
      printWindow.onload = () => {
        printWindow.print();
      };
      
      showNotification('Work order generated successfully', 'success');
    } catch (error) {
      console.error('Error generating work order:', error);
      showNotification('Error generating work order', 'error');
    }
  };

  const handleOpenExpenseModal = () => {
    setExpenseModalOpen(true);
    setExpenseForm({ description: '', price: '', unit: '', tax: '', taxType: 'fixed', total: '' });
    setExpenseList([]);
  };
  const handleCloseExpenseModal = () => setExpenseModalOpen(false);

  const handleExpenseInputChange = (e) => {
    const { name, value } = e.target;
    let newForm = { ...expenseForm, [name]: value };
    // Auto-calc tax and total
    const price = parseFloat(newForm.price) || 0;
    const unit = isNaN(Number(newForm.unit)) ? 1 : parseFloat(newForm.unit) || 1;
    let tax = 0;
    if (newForm.taxType === 'percent') {
      const percent = parseFloat(newForm.tax) || 0;
      tax = price * unit * percent / 100;
      newForm.taxValue = tax.toFixed(2);
    } else {
      tax = parseFloat(newForm.tax) || 0;
      newForm.taxValue = tax.toFixed(2);
    }
    newForm.total = (price * unit + tax).toFixed(2);
    setExpenseForm(newForm);
  };

  const handleTaxTypeChange = (e) => {
    const taxType = e.target.value;
    let newForm = { ...expenseForm, taxType };
    // Recalculate tax and total
    const price = parseFloat(newForm.price) || 0;
    const unit = isNaN(Number(newForm.unit)) ? 1 : parseFloat(newForm.unit) || 1;
    let tax = 0;
    if (taxType === 'percent') {
      const percent = parseFloat(newForm.tax) || 0;
      tax = price * unit * percent / 100;
      newForm.taxValue = tax.toFixed(2);
    } else {
      tax = parseFloat(newForm.tax) || 0;
      newForm.taxValue = tax.toFixed(2);
    }
    newForm.total = (price * unit + tax).toFixed(2);
    setExpenseForm(newForm);
  };

  const handleAddExpenseToList = () => {
    if (!expenseForm.description || !expenseForm.price || !expenseForm.unit) return;
    setExpenseList([
      ...expenseList,
      {
        description: expenseForm.description,
        price: parseFloat(expenseForm.price) || 0,
        unit: expenseForm.unit,
        tax: parseFloat(expenseForm.taxValue) || 0,
        taxType: expenseForm.taxType,
        total: parseFloat(expenseForm.total) || 0,
      },
    ]);
    setExpenseForm({ description: '', price: '', unit: '', tax: '', taxType: 'fixed', total: '' });
  };

  const handleDeleteExpense = (idx) => {
    setExpenseList(expenseList.filter((_, i) => i !== idx));
  };

  const handleSaveAllExpenses = async () => {
    if (!selectedOrder) return;
    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      // Merge with existing extraExpenses if any
      const prev = selectedOrder.extraExpenses || [];
      const newExpenses = [...prev, ...expenseList];
      await updateDoc(orderRef, { extraExpenses: newExpenses });
      showNotification('Extra expenses saved!', 'success');
      // Update local state so UI refreshes
      setSelectedOrder({ ...selectedOrder, extraExpenses: newExpenses });
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, extraExpenses: newExpenses } : o));
    } catch (err) {
      showNotification('Failed to save extra expenses', 'error');
    }
    setExpenseModalOpen(false);
  };


  const renderInvoiceDetails = () => {
    if (!selectedOrder) {
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          textAlign: 'center',
          p: 4,
          backgroundColor: '#ffffff',
          color: '#000000'
        }}>
          <ReceiptIcon sx={{ fontSize: 64, color: '#666666', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#000000', mb: 1 }}>
            Select an order to view invoice details
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666' }}>
            Choose an order from the list to generate and view the invoice
          </Typography>
        </Box>
      );
    }

    const totals = calculateInvoiceTotals(selectedOrder, materialTaxRates);

    return (
      <Box sx={{ 
        p: 3, 
        backgroundColor: '#ffffff',
        color: '#000000',
        minHeight: '297mm',
        width: '210mm',
        margin: '0 auto',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* PDF-Style Invoice Header */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          mb: 2,
          pb: 1.5,
          borderBottom: '1px solid #ccc'
        }}>
          {/* Left Side - Customer Info */}
          <Box sx={{ flex: 1 }}>
            {/* Customer Name - Bigger Font */}
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              mb: 1.5, 
              color: '#000000',
              fontSize: '1.5rem'
            }}>
              {selectedOrder.personalInfo?.customerName || 'N/A'}
            </Typography>
            
            {/* Other Data in Two Columns */}
            <Box sx={{ display: 'flex', gap: 4 }}>
              {/* Left Column */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 0.5, color: '#666666', fontSize: '0.8rem' }}>
                  Email: {selectedOrder.personalInfo?.email || 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5, color: '#666666', fontSize: '0.8rem' }}>
                  Phone: {selectedOrder.personalInfo?.phone || 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666666', fontSize: '0.8rem' }}>
                  Platform: {selectedOrder.orderDetails?.platform || 'N/A'}
                </Typography>
              </Box>
              
              {/* Right Column */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 0.5, color: '#666666', fontSize: '0.8rem' }}>
                  Date: {formatDate(selectedOrder.createdAt)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666666', fontSize: '0.8rem' }}>
                  Address: {selectedOrder.personalInfo?.address || 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Right Side - Logo and Invoice Number */}
          <Box sx={{ textAlign: 'right' }}>
            {/* Logo */}
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <img 
                src="/assets/images/logo-001.png" 
                alt="JL Upholstery Logo" 
                style={{ 
                  height: '60px', 
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              />
            </Box>
            {/* Invoice Number */}
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              color: '#000000',
              mb: 1
            }}>
              {selectedOrder.orderDetails?.billInvoice || 'N/A'}
            </Typography>
          </Box>
        </Box>

        {/* Items & Services Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            mb: 1.5,
            color: '#000000'
          }}>
            Items & Services
          </Typography>

          {/* Table Header */}
          <Box sx={{ 
            display: 'flex',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            color: '#000000'
          }}>
            <Box sx={{ flex: 3, p: 0.5, borderRight: '1px solid #ccc' }}>Description</Box>
            <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Price</Box>
            <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Qty</Box>
            <Box sx={{ flex: 1, p: 0.5, textAlign: 'right' }}>Total</Box>
          </Box>

          {/* Table Content */}
          {selectedOrder.furnitureData?.groups?.map((group, groupIndex) => (
            <Box key={groupIndex}>
              {/* Furniture Type Header */}
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

                             {/* Labour */}
               {group.labourPrice && parseFloat(group.labourPrice) > 0 && (
                 <Box sx={{ 
                   display: 'flex',
                   borderLeft: '1px solid #ccc',
                   borderRight: '1px solid #ccc',
                   fontSize: '0.8rem',
                   color: '#000000',
                   minHeight: '24px'
                 }}>
                   <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                     Labour {group.labourNote || ''}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${(parseFloat(group.labourPrice) || 0).toFixed(2)}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     {group.labourQnty || 1}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1)).toFixed(2)}
                   </Box>
                 </Box>
               )}

               {/* Material */}
               {group.materialPrice && parseFloat(group.materialPrice) > 0 && (
                 <Box sx={{ 
                   display: 'flex',
                   borderLeft: '1px solid #ccc',
                   borderRight: '1px solid #ccc',
                   fontSize: '0.8rem',
                   color: '#000000',
                   minHeight: '24px'
                 }}>
                   <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                     Material {group.materialCompany || ''} {group.materialCode ? `(${group.materialCode})` : ''}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${(parseFloat(group.materialPrice) || 0).toFixed(2)}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     {group.materialQnty || 1}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0)).toFixed(2)}
                   </Box>
                 </Box>
               )}

               {/* Foam */}
               {group.foamPrice && parseFloat(group.foamPrice) > 0 && (
                 <Box sx={{ 
                   display: 'flex',
                   borderLeft: '1px solid #ccc',
                   borderRight: '1px solid #ccc',
                   fontSize: '0.8rem',
                   color: '#000000',
                   minHeight: '24px'
                 }}>
                   <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                     Foam{group.foamThickness ? ` (${group.foamThickness}")` : ''}{group.foamNote ? ` - ${group.foamNote}` : ''}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${(parseFloat(group.foamPrice) || 0).toFixed(2)}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     {group.foamQnty || 1}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1)).toFixed(2)}
                   </Box>
                 </Box>
               )}

               {/* Painting */}
               {group.paintingLabour && parseFloat(group.paintingLabour) > 0 && (
                 <Box sx={{ 
                   display: 'flex',
                   borderLeft: '1px solid #ccc',
                   borderRight: '1px solid #ccc',
                   fontSize: '0.8rem',
                   color: '#000000',
                   minHeight: '24px'
                 }}>
                   <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                     Painting{group.paintingNote ? ` - ${group.paintingNote}` : ''}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${(parseFloat(group.paintingLabour) || 0).toFixed(2)}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     {group.paintingQnty || 1}
                   </Box>
                   <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     ${((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 1)).toFixed(2)}
                   </Box>
                 </Box>
               )}
            </Box>
          ))}
        </Box>

        {/* Notes and Totals Section - Compact Layout */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2,
          mb: 2
        }}>
          {/* Notes Section - Stacked Vertically */}
          <Box sx={{ flex: 1 }}>
            {/* Internal Notes */}
            <Box sx={{ mb: 1 }}>
              <Box sx={{ 
                backgroundColor: '#f8f8f8',
                p: 0.5,
                border: '1px solid #ccc',
                borderBottom: 'none',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                color: '#000000'
              }}>
                Internal Notes
              </Box>
              <Box sx={{ 
                border: '1px solid #ccc',
                minHeight: 60,
                p: 1.5,
                fontSize: '0.8rem',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>
                {selectedOrder.paymentData?.notes || ''}
              </Box>
            </Box>
            {/* Customer Notes */}
            <Box>
              <Box sx={{ 
                backgroundColor: '#f8f8f8',
                p: 0.5,
                border: '1px solid #ccc',
                borderBottom: 'none',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                color: '#000000'
              }}>
                Customer's Item Notes
              </Box>
              <Box sx={{ 
                border: '1px solid #ccc',
                minHeight: 60,
                p: 1.5,
                fontSize: '0.8rem',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>
                {selectedOrder.furnitureData?.groups?.filter(group => group.customerNote && group.customerNote.trim() !== '').map(group => (
                  <Box key={group.id || Math.random()} sx={{ mb: 1 }}>
                    <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      {group.furnitureType || 'Furniture Group'}:
                    </Box>
                    <Box sx={{ ml: 1 }}>
                      {group.customerNote}
                    </Box>
                  </Box>
                )) || ''}
              </Box>
            </Box>
          </Box>

          {/* Totals Section - Beside Notes */}
          <Box sx={{ width: 300 }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 0.5,
              fontSize: '0.8rem',
              color: '#000000'
            }}>
              <span>Items Subtotal:</span>
              <span>${totals.itemsSubtotal.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 0.5,
              fontSize: '0.8rem',
              color: '#000000'
            }}>
              <span>Tax (13% on M&F):</span>
              <span>${totals.taxAmount.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 1,
              fontSize: '0.8rem',
              color: '#000000'
            }}>
              <span>Pickup & Delivery:</span>
              <span>${totals.pickupDeliveryCost.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 1,
              fontWeight: 'bold',
              fontSize: '0.9rem',
              borderTop: '1px solid #ccc',
              pt: 0.5,
              color: '#000000'
            }}>
              <span>Grand Total:</span>
              <span>${totals.grandTotal.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 1,
              fontSize: '0.8rem',
              color: '#000000'
            }}>
              <span>Deposit Paid:</span>
              <span>-${totals.amountPaid.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              backgroundColor: '#fff3cd',
              p: 0.5,
              borderRadius: 1,
              fontWeight: 'bold',
              fontSize: '0.9rem',
              color: '#000000'
            }}>
              <span>Balance Due:</span>
              <span>${totals.balanceDue.toFixed(2)}</span>
            </Box>
          </Box>
        </Box>

        {/* Internal JL Cost Analysis */}
        <Box sx={{ mb: 2 }}>
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
          {selectedOrder.furnitureData?.groups?.map((group, groupIndex) => {
            // Check if this group has any records (Material, Foam, etc.)
            const hasMaterial = group.materialJLPrice && parseFloat(group.materialJLPrice) > 0;
            const hasFoam = group.foamJLPrice && parseFloat(group.foamJLPrice) > 0;
            const hasRecords = hasMaterial || hasFoam;
            
            // Only render the group if it has records
            if (!hasRecords) return null;
            
            return (
              <Box key={groupIndex}>
                {/* Furniture Type Header */}
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

                {/* JL Material */}
                {group.materialJLPrice && parseFloat(group.materialJLPrice) > 0 && (
                  <Box sx={{ 
                    display: 'flex',
                    border: '1px solid #ccc',
                    borderTop: 'none',
                    fontSize: '0.8rem',
                    color: '#000000',
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
                      ${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * 1.13).toFixed(2)}
                    </Box>
                  </Box>
                )}

                {/* JL Foam */}
                {group.foamJLPrice && parseFloat(group.foamJLPrice) > 0 && (
                  <Box sx={{ 
                    display: 'flex',
                    border: '1px solid #ccc',
                    borderTop: 'none',
                    fontSize: '0.8rem',
                    color: '#000000',
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

          {/* Extra Expenses in JL Table */}
          {selectedOrder.extraExpenses && selectedOrder.extraExpenses.length > 0 && (
            <>
              {/* Extra Expenses Header */}
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

              {/* Extra Expenses Items */}
              {selectedOrder.extraExpenses.map((expense, expenseIndex) => (
                <Box key={expenseIndex} sx={{ 
                  display: 'flex',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  fontSize: '0.8rem',
                  color: '#000000',
                  minHeight: '24px'
                }}>
                  <Box sx={{ flex: 2, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                    {expense.description || 'Extra Expense'}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {(parseFloat(expense.quantity) || 1).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${(parseFloat(expense.price) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${((parseFloat(expense.quantity) || 1) * (parseFloat(expense.price) || 0)).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${(((parseFloat(expense.quantity) || 1) * (parseFloat(expense.price) || 0)) * (parseFloat(expense.taxRate) || 0.13)).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${(parseFloat(expense.total) || 0).toFixed(2)}
                  </Box>
                </Box>
              ))}
            </>
          )}
        </Box>

        {/* JL Totals */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end',
          mb: 2
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
              <span style={{ color: '#000000' }}>${totals.jlSubtotalBeforeTax.toFixed(2)}</span>
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
              <span style={{ color: '#f27921' }}>${totals.jlGrandTotal.toFixed(2)}</span>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ 
          textAlign: 'center',
          mt: 4,
          pt: 2,
          borderTop: '1px solid #ccc',
          fontSize: '0.875rem',
          color: '#666666'
        }}>
          Payment is due upon receipt.
        </Box>
      </Box>
    );
  };

  // Filter out orders with "done" or "cancelled" end states
  const filteredOrders = orders.filter(order => {
    const status = order.invoiceStatus;
    // Exclude orders that have "done" or "cancelled" end state types
    return status !== 'done' && status !== 'cancelled';
  });
  
  if (loading && filteredOrders.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, width: '100%', backgroundColor: 'background.default' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Invoice Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Generate and view detailed invoices for orders • Click column headers to sort
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon sx={{ color: '#000000' }} />}
            onClick={handleReviewAndPrint}
            disabled={!selectedOrder}
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
              '&:disabled': {
                background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                border: '3px solid #666666',
                color: '#666666',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                borderRadius: '6px 6px 0 0',
                pointerEvents: 'none'
              }
            }}
          >
            Review & Print
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon sx={{ color: '#000000' }} />}
            onClick={handlePrintWorkOrder}
            disabled={!selectedOrder}
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '3px solid #000000',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
              position: 'relative',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                border: '3px solid #1a2d5a',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
              },
              '&:disabled': {
                background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                border: '3px solid #666666',
                color: '#666666',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                borderRadius: '6px 6px 0 0',
                pointerEvents: 'none'
              }
            }}
          >
            Print Work Order
          </Button>
          {selectedOrder && (
            <>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleOpenExpenseModal}
                sx={{
                  background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                  color: '#000000',
                  border: '3px solid #f27921',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                  position: 'relative',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                    border: '3px solid #e06810',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                    borderRadius: '6px 6px 0 0',
                    pointerEvents: 'none'
                  }
                }}
              >
                Add Extra Expense
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate(`/admin/workshop?orderId=${selectedOrder.id}`)}
                sx={{
                  background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                  color: '#000000',
                  border: '3px solid #f27921',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                  position: 'relative',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                    border: '3px solid #e06810',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                    borderRadius: '6px 6px 0 0',
                    pointerEvents: 'none'
                  }
                }}
              >
                Workshop
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 120px)' }}>
        {/* Orders List */}
        <Box sx={{ width: 300, flexShrink: 0 }}>
          <Paper elevation={2} sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '2px solid #333333' }}>
            <Box sx={{ p: 2, backgroundColor: 'background.paper', color: 'text.primary' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                📋 Orders ({filteredOrders.length})
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <CircularProgress sx={{ color: '#b98f33' }} />
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List ref={listContainerRef} sx={{ p: 0 }}>
                  {filteredOrders.map((order) => (
                    <React.Fragment key={order.id}>
                      <ListItem
                        data-order-id={order.id}
                        selected={selectedOrder?.id === order.id}
                        onClick={() => handleSelectOrder(order)}
                        sx={{
                          backgroundColor: selectedOrder?.id === order.id ? '#ffffff' : 'transparent',
                          borderLeft: selectedOrder?.id === order.id ? '4px solid #000000' : '4px solid transparent',
                          color: selectedOrder?.id === order.id ? '#000000' : 'inherit',
                          '& .MuiTypography-root': {
                            color: selectedOrder?.id === order.id ? '#000000 !important' : 'inherit',
                          },
                          '& .MuiChip-root': {
                            backgroundColor: selectedOrder?.id === order.id ? '#000000' : 'inherit',
                            color: selectedOrder?.id === order.id ? '#ffffff' : 'inherit',
                          },
                          '&:hover': {
                            backgroundColor: selectedOrder?.id === order.id ? '#ffffff' : '#2a2a2a',
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                                🧾 #{order.orderDetails?.billInvoice || 'N/A'}
                              </Typography>
                              <Chip 
                                label={formatCurrency(calculateInvoiceTotals(order, materialTaxRates).grandTotal)}
                                size="small" 
                                sx={{
                                  backgroundColor: '#f27921',
                                  color: 'white',
                                  fontWeight: 'bold'
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary" component="div">
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                  👤 {order.personalInfo?.customerName || 'N/A'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  📅 {formatDate(order.createdAt)}
                                </Typography>
                              </Box>
                            </Typography>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Invoice Details */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper elevation={2} sx={{ 
            height: '100%', 
            overflow: 'auto', 
            minHeight: '297mm',
            width: '100%',
            backgroundColor: '#ffffff'
          }}>
            {renderInvoiceDetails()}
          </Paper>
        </Box>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.type}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      <Dialog open={expenseModalOpen} onClose={handleCloseExpenseModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}>
          Add Extra Expense
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a' }}>
          <MuiBox sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Bill No"
              value={selectedOrder?.orderDetails?.billInvoice || ''}
              InputProps={{ readOnly: true }}
              fullWidth
              sx={{ 
                backgroundColor: '#2a2a2a',
                '& .MuiOutlinedInput-root': {
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
                '& .MuiInputLabel-root': {
                  color: '#b98f33',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
            />
            <TextField
              label="Expense Description"
              name="description"
              value={expenseForm.description}
              onChange={handleExpenseInputChange}
              fullWidth
              required
              sx={{
                '& .MuiOutlinedInput-root': {
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
                '& .MuiInputLabel-root': {
                  color: '#b98f33',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
            />
            <MuiBox sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Price"
                name="price"
                value={expenseForm.price}
                onChange={handleExpenseInputChange}
                type="number"
                fullWidth
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff',
                  },
                }}
              />
              <TextField
                label="Unit"
                name="unit"
                value={expenseForm.unit}
                onChange={handleExpenseInputChange}
                fullWidth
                required
                placeholder="e.g. 1, hour, piece"
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff',
                  },
                }}
              />
            </MuiBox>
            <MuiBox sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label={expenseForm.taxType === 'percent' ? 'Tax (%)' : 'Tax (Fixed)'}
                name="tax"
                value={expenseForm.tax}
                onChange={handleExpenseInputChange}
                type="number"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff',
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ p: 0, m: 0 }}>
                      <Select
                        value={expenseForm.taxType}
                        onChange={handleTaxTypeChange}
                        variant="standard"
                        disableUnderline
                        sx={{ 
                          minWidth: 48, 
                          maxWidth: 60, 
                          background: 'transparent', 
                          ml: 0.5, 
                          '& .MuiSelect-select': { 
                            p: 0, 
                            pr: 1, 
                            fontWeight: 'bold', 
                            color: '#b98f33' 
                          } 
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: { 
                              minWidth: 80,
                              backgroundColor: '#2a2a2a',
                              '& .MuiMenuItem-root': {
                                color: '#ffffff',
                                '&:hover': {
                                  backgroundColor: '#3a3a3a',
                                },
                              },
                            }
                          }
                        }}
                      >
                        <MenuItem value="fixed">$</MenuItem>
                        <MenuItem value="percent">%</MenuItem>
                      </Select>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Tax Value"
                name="taxValue"
                value={expenseForm.taxValue || ''}
                InputProps={{ readOnly: true, style: { color: '#b98f33', fontWeight: 'bold' } }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                }}
              />
              <TextField
                label="Total"
                name="total"
                value={expenseForm.total}
                onChange={handleExpenseInputChange}
                type="number"
                fullWidth
                InputProps={{ style: { fontWeight: 'bold', color: '#b98f33' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                }}
              />
            </MuiBox>
            <MuiBox sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <MuiTooltip title="Add to list">
                <span>
                  <MuiIconButton
                    sx={{
                      color: '#b98f33',
                      '&:hover': {
                        backgroundColor: 'rgba(185, 143, 51, 0.1)',
                      },
                    }}
                    onClick={handleAddExpenseToList}
                    disabled={!(expenseForm.description && expenseForm.price && expenseForm.unit)}
                  >
                    <AddIcon />
                  </MuiIconButton>
                </span>
              </MuiTooltip>
            </MuiBox>
            {/* List of added expenses */}
            {expenseList.length > 0 && (
              <MuiBox sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
                  Added Expenses
                </Typography>
                {expenseList.map((exp, idx) => (
                  <MuiBox key={idx} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    mb: 1, 
                    backgroundColor: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)',
                    border: '1px solid #333333',
                    p: 1, 
                    borderRadius: 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    <Typography sx={{ flex: 2, color: '#ffffff' }}>{exp.description}</Typography>
                    <Typography sx={{ flex: 1, color: '#b98f33' }}>{exp.price}</Typography>
                    <Typography sx={{ flex: 1, color: '#ffffff' }}>{exp.unit}</Typography>
                    <Typography sx={{ flex: 1, color: '#b98f33' }}>{exp.taxType === 'percent' ? `${((exp.tax / (exp.price * (isNaN(Number(exp.unit)) ? 1 : parseFloat(exp.unit) || 1))) * 100).toFixed(2)}%` : exp.tax}</Typography>
                    <Typography sx={{ flex: 1, fontWeight: 'bold', color: '#b98f33' }}>{exp.total}</Typography>
                    <MuiIconButton 
                      sx={{
                        color: '#ff6b6b',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        },
                      }}
                      onClick={() => handleDeleteExpense(idx)} 
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </MuiIconButton>
                  </MuiBox>
                ))}
              </MuiBox>
            )}
          </MuiBox>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={handleCloseExpenseModal}
            variant="outlined"
            sx={{
              borderColor: '#b98f33',
              color: '#b98f33',
              '&:hover': {
                borderColor: '#d4af5a',
                backgroundColor: 'rgba(185, 143, 51, 0.1)',
              },
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveAllExpenses} 
            disabled={expenseList.length === 0} 
            variant="contained"
            sx={{
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': {
                backgroundColor: '#d4af5a',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
              },
              '&:disabled': {
                backgroundColor: '#666666',
                color: '#999999',
                border: '2px solid #555555',
                transform: 'none',
                boxShadow: 'none',
              },
            }}
          >
            Save All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Work Order Form Type Dialog */}
      <Dialog 
        open={workOrderDialogOpen} 
        onClose={() => setWorkOrderDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: '#1a1a1a',
            border: '2px solid #333333',
            borderRadius: 2,
            boxShadow: 4
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
          color: '#000000', 
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '1.2rem',
          borderBottom: '3px solid #4CAF50',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)'
        }}>
          Select Form Type for Each Furniture Group
        </DialogTitle>
        <DialogContent sx={{ p: 3, backgroundColor: '#1a1a1a' }}>
          {selectedOrder?.furnitureData?.groups?.map((group, index) => (
            <Box key={index} sx={{ 
              mb: 2, 
              p: 2, 
              border: '2px solid #333333', 
              borderRadius: 2,
              backgroundColor: '#2a2a2a',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4,
                borderColor: '#d4af5a',
                backgroundColor: '#3a3a3a'
              }
            }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                color: '#d4af5a', 
                minWidth: '200px',
                textTransform: 'uppercase'
              }}>
                {group.furnitureType || `Furniture Group ${index + 1}`}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flex: 1, alignItems: 'center' }}>
                <Button
                  variant={workOrderSelections[index] === 'furniture' ? 'contained' : 'outlined'}
                  onClick={() => handleWorkOrderFormTypeChange(index, 'furniture')}
                  sx={{
                    background: workOrderSelections[index] === 'furniture' 
                      ? 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)'
                      : 'transparent',
                    color: workOrderSelections[index] === 'furniture' ? '#000000' : '#d4af5a',
                    borderColor: '#d4af5a',
                    border: workOrderSelections[index] === 'furniture' ? '3px solid #4CAF50' : '2px solid #d4af5a',
                    fontWeight: 'bold',
                    px: 2,
                    boxShadow: workOrderSelections[index] === 'furniture' 
                      ? 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)'
                      : 'none',
                    '&:hover': {
                      background: workOrderSelections[index] === 'furniture' 
                        ? 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)'
                        : 'linear-gradient(145deg, #f5f5f5 0%, #e8e8e8 100%)',
                      borderColor: workOrderSelections[index] === 'furniture' ? '#45a049' : '#b98f33',
                      boxShadow: workOrderSelections[index] === 'furniture' 
                        ? 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                        : '0 2px 4px rgba(0,0,0,0.2)'
                    }
                  }}
                >
                  Furniture Form
                </Button>
                
                <Button
                  variant={workOrderSelections[index] === 'cushion' ? 'contained' : 'outlined'}
                  onClick={() => handleWorkOrderFormTypeChange(index, 'cushion')}
                  sx={{
                    background: workOrderSelections[index] === 'cushion' 
                      ? 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)'
                      : 'transparent',
                    color: workOrderSelections[index] === 'cushion' ? '#000000' : '#d4af5a',
                    borderColor: '#d4af5a',
                    border: workOrderSelections[index] === 'cushion' ? '3px solid #4CAF50' : '2px solid #d4af5a',
                    fontWeight: 'bold',
                    px: 2,
                    boxShadow: workOrderSelections[index] === 'cushion' 
                      ? 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)'
                      : 'none',
                    '&:hover': {
                      background: workOrderSelections[index] === 'cushion' 
                        ? 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)'
                        : 'linear-gradient(145deg, #f5f5f5 0%, #e8e8e8 100%)',
                      borderColor: workOrderSelections[index] === 'cushion' ? '#45a049' : '#b98f33',
                      boxShadow: workOrderSelections[index] === 'cushion' 
                        ? 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                        : '0 2px 4px rgba(0,0,0,0.2)'
                    }
                  }}
                >
                  Cushion Form
                </Button>

                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                    Print:
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={workOrderPrintToggles[index] || false}
                        onChange={(e) => handleWorkOrderPrintToggleChange(index, e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#d4af5a',
                            '& + .MuiSwitch-track': {
                              backgroundColor: '#d4af5a',
                            },
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#d4af5a',
                          },
                        }}
                      />
                    }
                    label=""
                    sx={{ margin: 0 }}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ p: 3, backgroundColor: '#1a1a1a', borderTop: '1px solid #333333' }}>
          <Button
            onClick={() => setWorkOrderDialogOpen(false)}
            sx={{
              color: '#ffffff',
              fontWeight: 'bold',
              border: '2px solid #333333',
              backgroundColor: '#2a2a2a',
              '&:hover': {
                backgroundColor: '#3a3a3a',
                borderColor: '#d4af5a'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setWorkOrderDialogOpen(false);
              handleGenerateWorkOrder();
            }}
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '3px solid #4CAF50',
              fontWeight: 'bold',
              px: 3,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                border: '3px solid #45a049',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
              }
            }}
          >
            Generate Work Order
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default InvoicePage; 
