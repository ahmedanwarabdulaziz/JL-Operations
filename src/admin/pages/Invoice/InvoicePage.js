import React, { useState, useEffect } from 'react';
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
import { calculateOrderTotal, calculateOrderCost, calculateOrderTax, getOrderCostBreakdown, formatFurnitureDetails, isRapidOrder, calculatePickupDeliveryCost } from '../../../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates, getMaterialCompanyTaxRate } from '../../../shared/utils/materialTaxRates';
import autoTable from 'jspdf-autotable';

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
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
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
  const calculateInvoiceTotals = (order) => {
    const revenue = calculateOrderTotal(order); // Includes tax
    const cost = calculateOrderCost(order, materialTaxRates); // Includes tax with dynamic tax rates
    const taxAmount = calculateOrderTax(order);
    

    
    const pickupDeliveryCost = order.paymentData?.pickupDeliveryEnabled ? 
      calculatePickupDeliveryCost(
        parseFloat(order.paymentData.pickupDeliveryCost) || 0,
        order.paymentData.pickupDeliveryServiceType || 'both'
      ) : 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    const balanceDue = revenue - amountPaid;

    // Calculate JL internal costs properly
    let jlSubtotalBeforeTax = 0;
    let jlGrandTotal = 0;

    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        // JL Material costs
        if (group.materialJLPrice && parseFloat(group.materialJLPrice) > 0) {
          const qty = parseFloat(group.materialJLQnty) || 0;
          const price = parseFloat(group.materialJLPrice) || 0;
          const subtotal = qty * price;
          jlSubtotalBeforeTax += subtotal;
          
          // Get tax rate from material company settings
          const taxRate = getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates);
          jlGrandTotal += subtotal + (subtotal * taxRate);
        }

        // JL Foam costs (no tax)
        if (group.foamJLPrice && parseFloat(group.foamJLPrice) > 0) {
          const qty = parseFloat(group.foamQnty) || 1;
          const price = parseFloat(group.foamJLPrice) || 0;
          const subtotal = qty * price;
          jlSubtotalBeforeTax += subtotal;
          jlGrandTotal += subtotal; // No tax on foam
        }

        // JL Painting costs (no tax - labour) - EXCLUDED from JL cost calculations
        // if (group.paintingLabour && parseFloat(group.paintingLabour) > 0) {
        //   const qty = parseFloat(group.paintingQnty) || 1;
        //   const price = parseFloat(group.paintingLabour) || 0;
        //   const subtotal = qty * price;
        //   jlSubtotalBeforeTax += subtotal;
        //   jlGrandTotal += subtotal; // No tax on labour
        // }

        // Other expenses
        if (group.otherExpenses && parseFloat(group.otherExpenses) > 0) {
          const expense = parseFloat(group.otherExpenses) || 0;
          jlSubtotalBeforeTax += expense;
          jlGrandTotal += expense;
        }

        // Shipping
        if (group.shipping && parseFloat(group.shipping) > 0) {
          const shipping = parseFloat(group.shipping) || 0;
          jlSubtotalBeforeTax += shipping;
          jlGrandTotal += shipping;
        }
      });
    }

    // Add extra expenses
    if (order.extraExpenses && order.extraExpenses.length > 0) {
      order.extraExpenses.forEach(exp => {
        const expenseTotal = parseFloat(exp.total) || 0;
        jlSubtotalBeforeTax += expenseTotal;
        jlGrandTotal += expenseTotal;
      });
    }

    return {
      itemsSubtotal: revenue - taxAmount - pickupDeliveryCost, // Subtract pickupDeliveryCost from itemsSubtotal
      taxAmount,
      pickupDeliveryCost,
      grandTotal: revenue, // Grand total includes pickup & delivery
      amountPaid,
      balanceDue,
      jlGrandTotal,
      extraExpensesTotal: 0, // Will be calculated separately if needed
      jlSubtotalBeforeTax,
    };
  };

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
      const totals = calculateInvoiceTotals(selectedOrder);
      
      // Generate HTML content that matches the review panel exactly
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice - ${selectedOrder.orderDetails?.billInvoice || 'N/A'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 12px;
              background-color: #ffffff;
              color: #000000;
            }
            .invoice-container {
              max-width: 210mm;
              margin: 0 auto;
              padding: 12px;
              background-color: #ffffff;
              color: #000000;
              min-height: 297mm;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 1px solid #ccc;
            }
            .customer-info {
              flex: 1;
            }
            .customer-name {
              font-size: 1.5rem;
              font-weight: bold;
              color: #274290;
              margin-bottom: 8px;
            }
            .customer-details {
              display: flex;
              gap: 16px;
            }
            .detail-column {
              flex: 1;
            }
            .detail-item {
              font-size: 0.8rem;
              color: #666666;
              margin-bottom: 4px;
            }
            .invoice-number {
              text-align: right;
            }
            .invoice-number h1 {
              font-size: 1.5rem;
              font-weight: bold;
              color: #274290;
              margin: 0 0 4px 0;
            }
            .logo {
              height: 45px;
              width: auto;
              margin-bottom: 8px;
            }
            .section-title {
              font-size: 1.1rem;
              font-weight: bold;
              color: #274290;
              margin-bottom: 8px;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            .table th {
              background-color: #f0f0f0;
              border: 1px solid #ccc;
              padding: 4px 8px;
              font-size: 0.8rem;
              font-weight: bold;
              text-align: left;
            }
            .table td {
              border: 1px solid #ccc;
              padding: 2px 4px;
              font-size: 0.8rem;
              text-align: left;
            }
            .furniture-group-header {
              background-color: #f8f8f8;
              font-weight: bold;
              font-size: 0.8rem;
              padding: 2px 4px;
            }
            .notes-totals-section {
              display: flex;
              gap: 16px;
              margin-bottom: 16px;
            }
            .notes-section {
              flex: 1;
            }
            .notes-header {
              background-color: #f8f8f8;
              padding: 4px 8px;
              border: 1px solid #ccc;
              border-bottom: none;
              font-weight: bold;
              font-size: 0.8rem;
            }
            .notes-content {
              border: 1px solid #ccc;
              min-height: 60px;
              padding: 12px;
              font-size: 0.8rem;
              background-color: #ffffff;
            }
            .notes-item {
              margin-bottom: 8px;
            }
            .totals-section {
              width: 300px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: 0.8rem;
            }
            .total-row.grand-total {
              border-top: 1px solid #ccc;
              padding-top: 4px;
              margin-bottom: 8px;
              font-weight: bold;
              font-size: 0.9rem;
            }
            .total-row.balance-due {
              background-color: #fff3cd;
              padding: 4px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 0.9rem;
            }
            .jl-section {
              margin-top: 16px;
            }
            .jl-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            .jl-table th {
              background-color: #f0f0f0;
              border: 1px solid #ccc;
              padding: 4px 8px;
              font-size: 0.8rem;
              font-weight: bold;
              text-align: left;
            }
            .jl-table td {
              border: 1px solid #ccc;
              padding: 2px 4px;
              font-size: 0.8rem;
              text-align: left;
            }
            .jl-totals {
              width: 300px;
              background-color: #f0f0f0;
              border: 1px solid #999;
              padding: 12px;
              margin-top: 8px;
            }
            .jl-total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: 0.8rem;
            }
            .jl-total-row.grand-total {
              border-top: 1px solid #ccc;
              padding-top: 4px;
              margin-bottom: 8px;
              font-weight: bold;
              font-size: 0.9rem;
            }
            .footer {
              margin-top: 12px;
              padding-top: 8px;
              text-align: center;
              font-size: 0.8rem;
              color: #666666;
              border-top: 1px solid #ccc;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .invoice-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <!-- Header -->
            <div class="header">
              <div class="customer-info">
                <div class="customer-name">${selectedOrder.personalInfo?.customerName || 'N/A'}</div>
                <div class="customer-details">
                  <div class="detail-column">
                    <div class="detail-item">Email: ${selectedOrder.personalInfo?.email || 'N/A'}</div>
                    <div class="detail-item">Phone: ${selectedOrder.personalInfo?.phone || 'N/A'}</div>
                    <div class="detail-item">Platform: ${selectedOrder.orderDetails?.platform || 'N/A'}</div>
                  </div>
                  <div class="detail-column">
                    <div class="detail-item">Date: ${formatDate(selectedOrder.createdAt)}</div>
                    <div class="detail-item">Address: ${selectedOrder.personalInfo?.address || 'N/A'}</div>
                  </div>
                </div>
              </div>
              <div class="invoice-number">
                <img src="/assets/images/logo-001.png" alt="JL Upholstery Logo" class="logo">
                <h1>${selectedOrder.orderDetails?.billInvoice || 'N/A'}</h1>
              </div>
            </div>

            <!-- Items & Services -->
            <div class="section-title">Items & Services</div>
            <table class="table">
              <thead>
                <tr>
                  <th style="flex: 3">Description</th>
                  <th style="flex: 1; text-align: right">Price</th>
                  <th style="flex: 1; text-align: right">Qty</th>
                  <th style="flex: 1; text-align: right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${selectedOrder.furnitureData?.groups?.map(group => `
                  <tr class="furniture-group-header">
                    <td colspan="4">${group.furnitureType || 'Furniture Group'}</td>
                  </tr>
                  ${group.labourPrice && parseFloat(group.labourPrice) > 0 ? `
                    <tr>
                      <td>Labour ${group.labourNote || ''}</td>
                      <td style="text-align: right">$${(parseFloat(group.labourPrice) || 0).toFixed(2)}</td>
                      <td style="text-align: right">${group.labourQnty || 1}</td>
                      <td style="text-align: right">$${((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1)).toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  ${group.materialPrice && parseFloat(group.materialPrice) > 0 ? `
                    <tr>
                      <td>Material ${group.materialCompany || ''} ${group.materialCode ? `(${group.materialCode})` : ''}</td>
                      <td style="text-align: right">$${(parseFloat(group.materialPrice) || 0).toFixed(2)}</td>
                      <td style="text-align: right">${group.materialQnty || 1}</td>
                      <td style="text-align: right">$${((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1)).toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  ${group.foamPrice && parseFloat(group.foamPrice) > 0 ? `
                    <tr>
                      <td>Foam${group.foamThickness ? ` (${group.foamThickness}")` : ''}${group.foamNote ? ` - ${group.foamNote}` : ''}</td>
                      <td style="text-align: right">$${(parseFloat(group.foamPrice) || 0).toFixed(2)}</td>
                      <td style="text-align: right">${group.foamQnty || 1}</td>
                      <td style="text-align: right">$${((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1)).toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  ${group.paintingLabour && parseFloat(group.paintingLabour) > 0 ? `
                    <tr>
                      <td>Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}</td>
                      <td style="text-align: right">$${(parseFloat(group.paintingLabour) || 0).toFixed(2)}</td>
                      <td style="text-align: right">${group.paintingQnty || 1}</td>
                      <td style="text-align: right">$${((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 1)).toFixed(2)}</td>
                    </tr>
                  ` : ''}
                `).join('') || ''}
              </tbody>
            </table>

            <!-- Notes and Totals Section -->
            <div class="notes-totals-section">
              <div class="notes-section">
                <div class="notes-item">
                  <div class="notes-header">Internal Notes</div>
                  <div class="notes-content">${selectedOrder.paymentData?.generalNotes || ''}</div>
                </div>
                <div class="notes-item">
                  <div class="notes-header">Customer's Item Notes</div>
                  <div class="notes-content">${selectedOrder.paymentData?.customerNotes || ''}</div>
                </div>
              </div>
              <div class="totals-section">
                <div class="total-row">
                  <span>Items Subtotal:</span>
                  <span>$${totals.itemsSubtotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Tax (13% on M&F):</span>
                  <span>$${totals.taxAmount.toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Pickup & Delivery:</span>
                  <span>$${totals.pickupDeliveryCost.toFixed(2)}</span>
                </div>
                <div class="total-row grand-total">
                  <span>Grand Total:</span>
                  <span>$${totals.grandTotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Deposit Paid:</span>
                  <span>-$${totals.amountPaid.toFixed(2)}</span>
                </div>
                <div class="total-row balance-due">
                  <span>Balance Due:</span>
                  <span>$${totals.balanceDue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- Internal JL Cost Analysis -->
            <div class="jl-section">
              <div class="section-title">Internal JL Cost Analysis</div>
              <table class="jl-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th style="text-align: right">Qty</th>
                    <th style="text-align: right">Unit Price</th>
                    <th style="text-align: right">Subtotal</th>
                    <th style="text-align: right">TAX</th>
                    <th style="text-align: right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedOrder.furnitureData?.groups?.map(group => {
                    const hasMaterial = group.materialJLPrice && parseFloat(group.materialJLPrice) > 0;
                    const hasFoam = group.foamJLPrice && parseFloat(group.foamJLPrice) > 0;
                    const hasRecords = hasMaterial || hasFoam;
                    
                    if (!hasRecords) return '';
                    
                    return `
                      <tr class="furniture-group-header">
                        <td colspan="6">${group.furnitureType || 'Furniture Group'}</td>
                      </tr>
                      ${hasMaterial ? `
                        <tr>
                          <td>Material (${group.materialCode || 'N/A'})</td>
                          <td style="text-align: right">${(parseFloat(group.materialJLQnty) || 0).toFixed(2)}</td>
                          <td style="text-align: right">$${(parseFloat(group.materialJLPrice) || 0).toFixed(2)}</td>
                          <td style="text-align: right">$${((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)).toFixed(2)}</td>
                          <td style="text-align: right">$${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates)).toFixed(2)}</td>
                          <td style="text-align: right">$${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * 1.13).toFixed(2)}</td>
                        </tr>
                      ` : ''}
                      ${hasFoam ? `
                        <tr>
                          <td>Foam</td>
                          <td style="text-align: right">${(parseFloat(group.foamQnty) || 1).toFixed(2)}</td>
                          <td style="text-align: right">$${(parseFloat(group.foamJLPrice) || 0).toFixed(2)}</td>
                          <td style="text-align: right">$${((parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)).toFixed(2)}</td>
                          <td style="text-align: right">$0.00</td>
                          <td style="text-align: right">$${((parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)).toFixed(2)}</td>
                        </tr>
                      ` : ''}
                    `;
                  }).join('') || ''}
                  ${selectedOrder.extraExpenses && selectedOrder.extraExpenses.length > 0 ? `
                    <tr class="furniture-group-header">
                      <td colspan="6">Extra Expenses</td>
                    </tr>
                    ${selectedOrder.extraExpenses.map(expense => `
                      <tr>
                        <td>${expense.description || 'Extra Expense'}</td>
                        <td style="text-align: right">${(parseFloat(expense.quantity) || 1).toFixed(2)}</td>
                        <td style="text-align: right">$${(parseFloat(expense.price) || 0).toFixed(2)}</td>
                        <td style="text-align: right">$${((parseFloat(expense.quantity) || 1) * (parseFloat(expense.price) || 0)).toFixed(2)}</td>
                        <td style="text-align: right">$${(((parseFloat(expense.quantity) || 1) * (parseFloat(expense.price) || 0)) * (parseFloat(expense.taxRate) || 0.13)).toFixed(2)}</td>
                        <td style="text-align: right">$${(parseFloat(expense.total) || 0).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  ` : ''}
                </tbody>
              </table>
              <div class="jl-totals">
                <div class="jl-total-row">
                  <span>Subtotal (Before Tax):</span>
                  <span>$${totals.jlSubtotalBeforeTax.toFixed(2)}</span>
                </div>
                <div class="jl-total-row grand-total">
                  <span>Grand Total (JL Internal Cost):</span>
                  <span>$${totals.jlGrandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              Payment is due upon receipt.
            </div>
          </div>
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
      
      showNotification('Print preview opened successfully', 'success');
    } catch (error) {
      console.error('Error generating print preview:', error);
      showNotification('Error generating print preview', 'error');
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

    const totals = calculateInvoiceTotals(selectedOrder);

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
              color: '#274290',
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
              color: '#274290',
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
            color: '#274290'
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
                     ${((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1)).toFixed(2)}
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
                {selectedOrder.paymentData?.generalNotes || ''}
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
                {selectedOrder.paymentData?.customerNotes || ''}
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
            color: '#274290'
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
              <span style={{ color: '#274290' }}>${totals.jlSubtotalBeforeTax.toFixed(2)}</span>
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
          {selectedOrder && (
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
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 200px)' }}>
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
                <List sx={{ p: 0 }}>
                  {filteredOrders.map((order) => (
                    <React.Fragment key={order.id}>
                      <ListItem
                        selected={selectedOrder?.id === order.id}
                        onClick={() => handleSelectOrder(order)}
                        sx={{
                          '&.Mui-selected': {
                            backgroundColor: '#3a3a3a',
                            borderLeft: '4px solid #b98f33',
                            '&:hover': {
                              backgroundColor: '#3a3a3a',
                            },
                          },
                          '&:hover': {
                            backgroundColor: '#2a2a2a',
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
                                label={formatCurrency(calculateInvoiceTotals(order).grandTotal)} 
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
    </Box>
  );
};

export default InvoicePage; 
