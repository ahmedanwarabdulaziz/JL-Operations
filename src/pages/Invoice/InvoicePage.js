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
  ArrowBack as BackIcon,
  Receipt as ReceiptIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { calculateOrderTotal, getOrderCostBreakdown, formatFurnitureDetails, isRapidOrder } from '../../utils/orderCalculations';
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
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

  const calculateInvoiceTotals = (order) => {
    let itemsSubtotal = 0;
    let taxableAmount = 0;
    let jlGrandTotal = 0;
    let jlSubtotalBeforeTax = 0;

    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        const qntyFoam = parseFloat(group.foamQnty) || 1;
        // Customer-facing calculations
        const labourPrice = parseFloat(group.labourPrice) || 0;
        const labourQnty = parseFloat(group.labourQnty) || 1;
        const labourTotal = labourPrice * labourQnty;
        itemsSubtotal += labourTotal;

        const materialPrice = parseFloat(group.materialPrice) || 0;
        const materialQnty = parseFloat(group.materialQnty) || 1;
        const materialTotal = materialPrice * materialQnty;
        itemsSubtotal += materialTotal;
        taxableAmount += materialTotal; // Materials are taxable

        const foamPrice = parseFloat(group.foamPrice) || 0;
        const foamTotal = foamPrice * qntyFoam;
        itemsSubtotal += foamTotal;
        taxableAmount += foamTotal; // Foam is taxable

        // JL Internal calculations - FIXED FIELD NAMES
        const jlMaterialPrice = parseFloat(group.materialJLPrice) || 0;
        const jlQuantity = parseFloat(group.materialJLQnty) || 0;
        const jlMaterialTotal = jlMaterialPrice * jlQuantity;
        jlSubtotalBeforeTax += jlMaterialTotal;
        
        // Get tax rate from material company (default 13%)
        const materialCompany = group.materialCompany;
        let taxRate = 0.13; // Default tax rate
        if (materialCompany && materialCompany.toLowerCase().includes('charlotte')) {
          taxRate = 0.02; // Special rate for Charlotte
        }
        
        const materialTax = jlMaterialTotal * taxRate;
        const materialLineTotal = jlMaterialTotal + materialTax;
        jlGrandTotal += materialLineTotal;

        const jlFoamPrice = parseFloat(group.foamJLPrice) || 0;
        const jlFoamTotal = jlFoamPrice * qntyFoam;
        jlSubtotalBeforeTax += jlFoamTotal;
        jlGrandTotal += jlFoamTotal;

        const otherExpenses = parseFloat(group.otherExpenses) || 0;
        jlSubtotalBeforeTax += otherExpenses;
        jlGrandTotal += otherExpenses;

        const shipping = parseFloat(group.shipping) || 0;
        jlSubtotalBeforeTax += shipping;
        jlGrandTotal += shipping;
      });
    }

    // Add extraExpenses to JL Subtotal and JL Grand Total
    let extraExpensesTotal = 0;
    let extraExpensesSubtotal = 0;
    if (order.extraExpenses && Array.isArray(order.extraExpenses)) {
      extraExpensesTotal = order.extraExpenses.reduce((sum, exp) => sum + (parseFloat(exp.total) || 0), 0);
      extraExpensesSubtotal = order.extraExpenses.reduce((sum, exp) => {
        const price = parseFloat(exp.price) || 0;
        const unit = isNaN(Number(exp.unit)) ? 1 : parseFloat(exp.unit) || 1;
        return sum + price * unit;
      }, 0);
      jlSubtotalBeforeTax += extraExpensesSubtotal;
      jlGrandTotal += extraExpensesTotal;
    }

    const taxAmount = taxableAmount * 0.13; // 13% tax on materials and foam
    const pickupDeliveryCost = (parseFloat(order.paymentData?.pickupDeliveryCost) || 0) * 2;
    const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    const balanceDue = grandTotal - amountPaid;

    return {
      itemsSubtotal,
      taxAmount,
      pickupDeliveryCost,
      grandTotal,
      amountPaid,
      balanceDue,
      jlGrandTotal,
      extraExpensesTotal,
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
      showNotification('Generating PDF preview...', 'info');
      
      const doc = new jsPDF();
      const totals = calculateInvoiceTotals(selectedOrder);
      
      // Page margins
      const leftMargin = 15;
      const rightMargin = 195;
      const pageWidth = 180;
      
      let currentY = 20;
      
      // Header Section - Customer Info (Left) and Invoice Number (Right)
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      // Left side - Customer Info
      doc.text(`Name:`, leftMargin, currentY);
      doc.text(`${selectedOrder.personalInfo?.customerName || 'N/A'}`, leftMargin + 25, currentY);
      currentY += 6;
      
      doc.text(`Email:`, leftMargin, currentY);
      doc.text(`${selectedOrder.personalInfo?.email || 'N/A'}`, leftMargin + 25, currentY);
      currentY += 6;
      
      doc.text(`Phone:`, leftMargin, currentY);
      doc.text(`${selectedOrder.personalInfo?.phone || 'N/A'}`, leftMargin + 25, currentY);
      currentY += 6;
      
      doc.text(`Platform:`, leftMargin, currentY);
      doc.text(`${selectedOrder.orderDetails?.platform || 'N/A'}`, leftMargin + 25, currentY);
      currentY += 6;
      
      doc.text(`Address:`, leftMargin, currentY);
      const address = selectedOrder.personalInfo?.address || 'N/A';
      doc.text(address, leftMargin + 25, currentY);
      
      // Right side - Invoice Number and Date
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(`${selectedOrder.orderDetails?.billInvoice || 'N/A'}`, rightMargin - 20, 25, { align: 'right' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(selectedOrder.createdAt), rightMargin - 20, 35, { align: 'right' });
      
      // Horizontal line separator
      currentY = 50;
      doc.setLineWidth(0.5);
      doc.line(leftMargin, currentY, rightMargin, currentY);
      
      currentY += 15;
      
      // Items & Services Section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Items & Services', leftMargin, currentY);
      currentY += 10;
      
      // Table headers
      const tableY = currentY;
      doc.setFillColor(230, 230, 230);
      doc.rect(leftMargin, tableY, pageWidth, 8, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.rect(leftMargin, tableY, pageWidth, 8, 'S');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Description', leftMargin + 2, tableY + 5);
      doc.text('Price', leftMargin + 120, tableY + 5);
      doc.text('Qty', leftMargin + 145, tableY + 5);
      doc.text('Total', leftMargin + 165, tableY + 5);
      
      currentY = tableY + 8;
      
      // Table content
      if (selectedOrder.furnitureData?.groups) {
        selectedOrder.furnitureData.groups.forEach(group => {
          // Furniture type header
          doc.setFillColor(245, 245, 245);
          doc.rect(leftMargin, currentY, pageWidth, 6, 'F');
          doc.rect(leftMargin, currentY, pageWidth, 6, 'S');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`${group.furnitureType || 'Furniture Group'}`, leftMargin + 2, currentY + 4);
          currentY += 6;
          
          // Labour
          if (group.labourPrice && parseFloat(group.labourPrice) > 0) {
            doc.rect(leftMargin, currentY, pageWidth, 6, 'S');
            doc.setFont('helvetica', 'normal');
            const labourDesc = `Labour ${group.labourNote ? group.labourNote : 'without piping design'}`;
            doc.text(labourDesc, leftMargin + 2, currentY + 4);
            doc.text(`$${(parseFloat(group.labourPrice) || 0).toFixed(2)}`, leftMargin + 120, currentY + 4);
            doc.text(`${group.labourQnty || 1}`, leftMargin + 145, currentY + 4);
            doc.text(`$${((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1)).toFixed(2)}`, leftMargin + 165, currentY + 4);
            currentY += 6;
          }
          
          // Material
          if (group.materialPrice && parseFloat(group.materialPrice) > 0) {
            doc.rect(leftMargin, currentY, pageWidth, 6, 'S');
            doc.setFont('helvetica', 'normal');
            const materialDesc = `Material ${group.materialCompany || ''} ${group.materialCode ? `(${group.materialCode})` : ''}`;
            doc.text(materialDesc, leftMargin + 2, currentY + 4);
            doc.text(`$${(parseFloat(group.materialPrice) || 0).toFixed(2)}`, leftMargin + 120, currentY + 4);
            doc.text(`${group.materialQnty || 1}`, leftMargin + 145, currentY + 4);
            doc.text(`$${((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1)).toFixed(2)}`, leftMargin + 165, currentY + 4);
            currentY += 6;
          }
          
          // Foam
          if (group.foamPrice && parseFloat(group.foamPrice) > 0) {
            doc.rect(leftMargin, currentY, pageWidth, 6, 'S');
            doc.setFont('helvetica', 'normal');
            const foamDesc = `Foam${group.foamThickness ? ` (${group.foamThickness}")` : ''}${group.foamNote ? ` - ${group.foamNote}` : ''}`;
            doc.text(foamDesc, leftMargin + 2, currentY + 4);
            doc.text(`$${(parseFloat(group.foamPrice) || 0).toFixed(2)}`, leftMargin + 120, currentY + 4);
            doc.text(`${group.foamQnty || 1}`, leftMargin + 145, currentY + 4);
            doc.text(`$${((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1)).toFixed(2)}`, leftMargin + 165, currentY + 4);
            currentY += 6;
          }
        });
      }
      
      currentY += 10;
      
      // Totals Section (Right aligned)
      const totalsX = 120;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      doc.text('Items Subtotal:', totalsX, currentY);
      doc.text(`$${totals.itemsSubtotal.toFixed(2)}`, rightMargin - 10, currentY, { align: 'right' });
      currentY += 5;
      
      doc.text('Tax (13% on M&F):', totalsX, currentY);
      doc.text(`$${totals.taxAmount.toFixed(2)}`, rightMargin - 10, currentY, { align: 'right' });
      currentY += 5;
      
      doc.text('Pickup & Delivery:', totalsX, currentY);
      doc.text(`$${totals.pickupDeliveryCost.toFixed(2)}`, rightMargin - 10, currentY, { align: 'right' });
      currentY += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Grand Total:', totalsX, currentY);
      doc.text(`$${totals.grandTotal.toFixed(2)}`, rightMargin - 10, currentY, { align: 'right' });
      currentY += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text('Deposit Paid:', totalsX, currentY);
      doc.text(`-$${totals.amountPaid.toFixed(2)}`, rightMargin - 10, currentY, { align: 'right' });
      currentY += 8;
      
      // Balance Due with highlight
      doc.setFillColor(255, 255, 200);
      doc.rect(totalsX - 5, currentY - 4, 75, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Balance Due:', totalsX, currentY);
      doc.text(`$${totals.balanceDue.toFixed(2)}`, rightMargin - 10, currentY, { align: 'right' });
      
      currentY += 20;
      
      // Notes Section (Two columns)
      const notesY = currentY;
      const col1X = leftMargin;
      const col2X = 110;
      const colWidth = 85;
      const notesHeight = 25;
      
      // Internal Notes
      doc.setFillColor(245, 245, 245);
      doc.rect(col1X, notesY, colWidth, 8, 'F');
      doc.rect(col1X, notesY, colWidth, notesHeight, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Internal Notes', col1X + 2, notesY + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const internalNotes = selectedOrder.paymentData?.generalNotes || '';
      if (internalNotes.trim()) {
        doc.text(internalNotes, col1X + 2, notesY + 12);
      }
      
      // Customer's Item Notes
      doc.setFillColor(245, 245, 245);
      doc.rect(col2X, notesY, colWidth, 8, 'F');
      doc.rect(col2X, notesY, colWidth, notesHeight, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text("Customer's Item Notes", col2X + 2, notesY + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const customerNotes = selectedOrder.paymentData?.customerNotes || '';
      if (customerNotes.trim()) {
        doc.text(customerNotes, col2X + 2, notesY + 12);
      }
      
      currentY = notesY + notesHeight + 15;
      
      // Internal JL Cost Analysis
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Internal JL Cost Analysis', leftMargin, currentY);
      currentY += 10;
      
      // JL Table headers
      doc.setFillColor(230, 230, 230);
      doc.rect(leftMargin, currentY, pageWidth, 8, 'F');
      doc.rect(leftMargin, currentY, pageWidth, 8, 'S');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Component', leftMargin + 2, currentY + 5);
      doc.text('Qty', leftMargin + 60, currentY + 5);
      doc.text('Unit Price', leftMargin + 80, currentY + 5);
      doc.text('Subtotal', leftMargin + 110, currentY + 5);
      doc.text('TAX', leftMargin + 140, currentY + 5);
      doc.text('Line Total', leftMargin + 160, currentY + 5);
      
      currentY += 8;
      
      // JL Content
      if (selectedOrder.furnitureData?.groups) {
        selectedOrder.furnitureData.groups.forEach(group => {
          // Furniture type header
          doc.setFillColor(245, 245, 245);
          doc.rect(leftMargin, currentY, pageWidth, 6, 'F');
          doc.rect(leftMargin, currentY, pageWidth, 6, 'S');
          doc.setFont('helvetica', 'bold');
          doc.text(`${group.furnitureType || 'Furniture Group'}`, leftMargin + 2, currentY + 4);
          currentY += 6;
          
          // JL Material
          if (group.materialJLPrice && parseFloat(group.materialJLPrice) > 0) {
            doc.rect(leftMargin, currentY, pageWidth, 6, 'S');
            doc.setFont('helvetica', 'normal');
            const jlQty = parseFloat(group.materialJLQnty) || 0;
            const jlPrice = parseFloat(group.materialJLPrice) || 0;
            const jlSubtotal = jlQty * jlPrice;
            const jlTax = jlSubtotal * 0.13; // 13% tax
            const jlTotal = jlSubtotal + jlTax;
            
            doc.text(`Material (${group.materialCode || 'N/A'})`, leftMargin + 2, currentY + 4);
            doc.text(`${jlQty.toFixed(2)}`, leftMargin + 60, currentY + 4);
            doc.text(`$${jlPrice.toFixed(2)}`, leftMargin + 80, currentY + 4);
            doc.text(`$${jlSubtotal.toFixed(2)}`, leftMargin + 110, currentY + 4);
            doc.text(`$${jlTax.toFixed(2)}`, leftMargin + 140, currentY + 4);
            doc.text(`$${jlTotal.toFixed(2)}`, leftMargin + 160, currentY + 4);
            currentY += 6;
          }
        });
      }
      
      currentY += 10;
      
      // JL Totals Section with enhanced styling
      const totalsBoxWidth = 95;
      const totalsBoxHeight = 20;
      const totalsBoxX = rightMargin - totalsBoxWidth; // Right-align the box
      
      // Background box for totals
      doc.setFillColor(240, 240, 240);
      doc.rect(totalsBoxX, currentY, totalsBoxWidth, totalsBoxHeight, 'F');
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(1);
      doc.rect(totalsBoxX, currentY, totalsBoxWidth, totalsBoxHeight, 'S');
      
      // JL Subtotal (Before Tax)
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Subtotal (Before Tax):', totalsBoxX + 5, currentY + 7);
      doc.setTextColor(39, 66, 144); // Blue color for amount
      doc.text(`$${totals.jlSubtotalBeforeTax.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 5, currentY + 7, { align: 'right' });
      
      // Separator line
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(totalsBoxX + 5, currentY + 9, totalsBoxX + totalsBoxWidth - 5, currentY + 9);
      
      // JL Grand Total
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Grand Total (JL Internal Cost):', totalsBoxX + 5, currentY + 16);
      doc.setTextColor(242, 121, 33); // Orange color for grand total
      doc.text(`$${totals.jlGrandTotal.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 5, currentY + 16, { align: 'right' });
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      currentY += totalsBoxHeight;
      
      currentY += 20;
      
      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Payment is due upon receipt.', 105, currentY, { align: 'center' });
      
      // Open PDF in new window for review and printing
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
      
      showNotification('PDF opened for review. You can now print from your browser.', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showNotification('Failed to generate PDF', 'error');
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
          p: 4
        }}>
          <ReceiptIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select an order to view invoice details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose an order from the list to generate and view the invoice
          </Typography>
        </Box>
      );
    }

    const totals = calculateInvoiceTotals(selectedOrder);
    console.log('DEBUG JL Subtotal Before Tax:', totals.jlSubtotalBeforeTax);
    console.log('DEBUG JL Grand Total:', totals.jlGrandTotal);

    return (
      <Box sx={{ p: 3 }}>
        {/* Invoice Header Card */}
        <Card sx={{ mb: 3, border: '2px solid #e3f2fd' }}>
          <CardContent sx={{ p: 0 }}>
            {/* Header */}
            <Box sx={{
              backgroundColor: '#274290',
              color: 'white',
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReceiptIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Customer Information
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                #{selectedOrder.orderDetails?.billInvoice || 'N/A'}
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {/* Left Column */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      👤 Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: '1.1rem' }}>
                      {selectedOrder.personalInfo?.customerName || 'N/A'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      ✉️ Email
                    </Typography>
                    <Typography variant="body1">
                      {selectedOrder.personalInfo?.email || 'N/A'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      📍 Address
                    </Typography>
                    <Typography variant="body1">
                      {selectedOrder.personalInfo?.address || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>

                {/* Right Column */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      📞 Phone
                    </Typography>
                    <Typography variant="body1">
                      {selectedOrder.personalInfo?.phone || 'N/A'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      🏪 Platform
                    </Typography>
                    <Typography variant="body1">
                      {selectedOrder.orderDetails?.platform || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>

        {/* Section 2: Items & Services */}
        <Card sx={{ mb: 3, border: '2px solid #e3f2fd' }}>
          <CardContent sx={{ p: 0 }}>
            {/* Header */}
            <Box sx={{
              backgroundColor: '#274290',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center'
            }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                📋 Items & Services
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ p: 3 }}>
              <TableContainer>
                <Table sx={{ width: '100%' }}>
                  <TableHead sx={{ backgroundColor: '#274290' }}>
                    <TableRow>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '40%' }}>Description</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Qty</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Unit Price</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Tax</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedOrder.furnitureData?.groups?.map((group, index) => (
                      <React.Fragment key={index}>
                        <TableRow sx={{ backgroundColor: 'grey.100' }}>
                          <TableCell colSpan={5}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#274290' }}>
                              🪑 {group.furnitureType || 'Furniture Group'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                        
                        {/* Material */}
                        {group.materialPrice && parseFloat(group.materialPrice) > 0 && (
                          <TableRow sx={{ '& td': { py: 0.5 } }}>
                            <TableCell>
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                Material - {group.materialCompany} {group.materialCode ? `(${group.materialCode})` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {group.materialQnty || 1}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(group.materialPrice)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1) * 0.13)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                {formatCurrency((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1) * 1.13)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Foam */}
                        {group.foamPrice && parseFloat(group.foamPrice) > 0 && (
                          <TableRow sx={{ '& td': { py: 0.5 } }}>
                            <TableCell>
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                Foam{group.foamThickness ? ` - ${group.foamThickness}" thick` : ''}{group.foamNote ? ` - ${group.foamNote}` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {group.foamQnty || 1}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(group.foamPrice)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1) * 0.13)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                {formatCurrency((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1) * 1.13)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Labour */}
                        {group.labourPrice && parseFloat(group.labourPrice) > 0 && (
                          <TableRow sx={{ '& td': { py: 0.5 } }}>
                            <TableCell>
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                Labour{group.labourNote ? ` - ${group.labourNote}` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {group.labourQnty || 1}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(group.labourPrice)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(0)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                {formatCurrency((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1))}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body1" color="text.secondary">
                            No items found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totals */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Paper elevation={1} sx={{ p: 2, minWidth: 300 }}>
                  <Table sx={{ width: 'auto' }}>
                    <TableBody>
                      {/* Subtotal Group */}
                      <TableRow sx={{ '& td': { py: 0.5 } }}>
                        <TableCell><Typography variant="body1">Items Subtotal:</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body1">{formatCurrency(totals.itemsSubtotal)}</Typography></TableCell>
                      </TableRow>
                      <TableRow sx={{ '& td': { py: 0.5 } }}>
                        <TableCell><Typography variant="body1">Tax (13% on M&F):</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body1">{formatCurrency(totals.taxAmount)}</Typography></TableCell>
                      </TableRow>
                      <TableRow sx={{ '& td': { py: 0.5 } }}>
                        <TableCell><Typography variant="body1">Pickup & Delivery:</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body1">{formatCurrency(totals.pickupDeliveryCost)}</Typography></TableCell>
                      </TableRow>
                      
                      {/* Grand Total Group */}
                      <TableRow sx={{ borderTop: 2, borderColor: 'grey.300', '& td': { py: 1 } }}>
                        <TableCell><Typography variant="h6" sx={{ fontWeight: 'bold' }}>Grand Total:</Typography></TableCell>
                        <TableCell align="right"><Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatCurrency(totals.grandTotal)}</Typography></TableCell>
                      </TableRow>
                      <TableRow sx={{ '& td': { py: 0.5 } }}>
                        <TableCell><Typography variant="body1">Amount Paid:</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body1" color="success.main">-{formatCurrency(totals.amountPaid)}</Typography></TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: 'grey.200', '& td': { py: 1 } }}>
                        <TableCell><Typography variant="h6" sx={{ fontWeight: 'bold' }}>Balance Due:</Typography></TableCell>
                        <TableCell align="right"><Typography variant="h6" sx={{ fontWeight: 'bold', color: 'grey.800' }}>{formatCurrency(totals.balanceDue)}</Typography></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Section 3: Notes */}
        <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
          {/* Customer Notes Card */}
          <Card sx={{ 
            flex: 1, 
            border: '2px solid #e3f2fd'
          }}>
            <CardContent sx={{ p: 0 }}>
              {/* Header */}
              <Box sx={{
                backgroundColor: '#274290',
                color: 'white',
                p: 2,
                display: 'flex',
                alignItems: 'center'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  💬 Customer Notes
                </Typography>
              </Box>

              {/* Content */}
              <Box sx={{ p: 3 }}>
                {selectedOrder.paymentData?.customerNotes?.trim() && (
                  <Typography variant="body1" sx={{ 
                    p: 2, 
                    backgroundColor: '#f5f5f5', 
                    borderRadius: 1, 
                    border: '1px solid #e0e0e0',
                    minHeight: 120,
                    whiteSpace: 'pre-wrap',
                    color: 'text.primary'
                  }}>
                    {selectedOrder.paymentData.customerNotes}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* General Notes Card */}
          <Card sx={{ 
            flex: 1, 
            border: '2px solid #e3f2fd'
          }}>
            <CardContent sx={{ p: 0 }}>
              {/* Header */}
              <Box sx={{
                backgroundColor: '#274290',
                color: 'white',
                p: 2,
                display: 'flex',
                alignItems: 'center'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  📝 General Notes
                </Typography>
              </Box>

              {/* Content */}
              <Box sx={{ p: 3 }}>
                {selectedOrder.paymentData?.generalNotes?.trim() && (
                  <Typography variant="body1" sx={{ 
                    p: 2, 
                    backgroundColor: '#f5f5f5', 
                    borderRadius: 1, 
                    border: '1px solid #e0e0e0',
                    minHeight: 120,
                    whiteSpace: 'pre-wrap',
                    color: 'text.primary'
                  }}>
                    {selectedOrder.paymentData.generalNotes}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Section 4: Internal JL Cost Analysis */}
        <Card sx={{ border: '2px solid #e3f2fd' }}>
          <CardContent sx={{ p: 0 }}>
            {/* Header */}
            <Box sx={{
              backgroundColor: '#274290',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center'
            }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                🏭 Internal JL Cost Analysis
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ p: 3 }}>
              <TableContainer>
                <Table sx={{ width: '100%' }}>
                  <TableHead sx={{ backgroundColor: '#274290' }}>
                    <TableRow>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '40%' }}>Description</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Qty</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Unit Price</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Tax</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold', width: '15%' }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedOrder.furnitureData?.groups?.map((group, index) => (
                      <React.Fragment key={index}>
                        {console.log('JL GROUP:', JSON.stringify(group, null, 2))}
                        <TableRow sx={{ backgroundColor: 'grey.200' }}>
                          <TableCell colSpan={5}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'grey.700' }}>
                              {group.furnitureType || 'Furniture Group'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                        {/* JL Material Row */}
                        {group.materialJLPrice && parseFloat(group.materialJLPrice) > 0 && (
                          (() => {
                            const qty = parseFloat(group.materialJLQnty) || 0;
                            const price = parseFloat(group.materialJLPrice) || 0;
                            const subtotal = qty * price;
                            let taxRate = 0.13;
                            if (group.materialCompany && group.materialCompany.toLowerCase().includes('charlotte')) {
                              taxRate = 0.02;
                            }
                            const tax = subtotal * taxRate;
                            const total = subtotal + tax;
                            return (
                              <TableRow>
                                <TableCell>Material ({group.materialCompany || ''} {group.materialCode ? `- ${group.materialCode}` : ''})</TableCell>
                                <TableCell align="right">{qty}</TableCell>
                                <TableCell align="right">{formatCurrency(price)}</TableCell>
                                <TableCell align="right">{formatCurrency(tax)}</TableCell>
                                <TableCell align="right">{formatCurrency(total)}</TableCell>
                              </TableRow>
                            );
                          })()
                        )}
                        {/* JL Foam Row */}
                        {group.foamJLPrice && parseFloat(group.foamJLPrice) > 0 && (
                          (() => {
                            const qty = parseFloat(group.foamQnty) || 1;
                            const price = parseFloat(group.foamJLPrice) || 0;
                            const subtotal = qty * price;
                            const tax = 0; // Foam has 0% tax for JL
                            const total = subtotal + tax;
                            return (
                              <TableRow>
                                <TableCell>Foam{group.foamThickness ? ` (${group.foamThickness}")` : ''}</TableCell>
                                <TableCell align="right">{qty}</TableCell>
                                <TableCell align="right">{formatCurrency(price)}</TableCell>
                                <TableCell align="right">{formatCurrency(tax)}</TableCell>
                                <TableCell align="right">{formatCurrency(total)}</TableCell>
                              </TableRow>
                            );
                          })()
                        )}
                        {/* Other Expenses Row */}
                        {group.otherExpenses && parseFloat(group.otherExpenses) > 0 && (
                          <TableRow>
                            <TableCell>{group.expensesNote || 'Other Expense'}</TableCell>
                            <TableCell align="right">1</TableCell>
                            <TableCell align="right">{formatCurrency(group.otherExpenses)}</TableCell>
                            <TableCell align="right">{formatCurrency(0)}</TableCell>
                            <TableCell align="right">{formatCurrency(group.otherExpenses)}</TableCell>
                          </TableRow>
                        )}
                        {/* Shipping Row */}
                        {group.shipping && parseFloat(group.shipping) > 0 && (
                          <TableRow>
                            <TableCell>Shipping</TableCell>
                            <TableCell align="right">1</TableCell>
                            <TableCell align="right">{formatCurrency(group.shipping)}</TableCell>
                            <TableCell align="right">{formatCurrency(0)}</TableCell>
                            <TableCell align="right">{formatCurrency(group.shipping)}</TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body1" color="text.secondary">
                            No items for JL Cost Analysis
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {selectedOrder.extraExpenses && selectedOrder.extraExpenses.length > 0 && (
                      <React.Fragment>
                        <TableRow>
                          <TableCell colSpan={5} sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', color: 'grey.800' }}>
                            Other Expenses
                          </TableCell>
                        </TableRow>
                        {selectedOrder.extraExpenses.map((exp, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{exp.description}</TableCell>
                            <TableCell align="right">{exp.unit}</TableCell>
                            <TableCell align="right">{formatCurrency(exp.price)}</TableCell>
                            <TableCell align="right">{formatCurrency(exp.tax)}</TableCell>
                            <TableCell align="right">{formatCurrency(exp.total)}</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* JL Totals */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Paper elevation={1} sx={{ p: 2, minWidth: 300, backgroundColor: 'grey.200' }}>
                  <Table sx={{ width: 'auto' }}>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'grey.700' }}>
                            Subtotal (Before Tax):
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {formatCurrency(totals.jlSubtotalBeforeTax)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'grey.700' }}>
                            Grand Total (JL Internal Cost):
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'grey.700' }}>
                            {formatCurrency(totals.jlGrandTotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, width: '100%', backgroundColor: 'white' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#274290' }}>
            Invoice Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Generate and view detailed invoices for orders • Click column headers to sort
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/')}
            variant="outlined"
            sx={{
              borderColor: '#274290',
              color: '#274290',
              '&:hover': {
                borderColor: '#1e2d5a',
                backgroundColor: 'rgba(39, 66, 144, 0.04)'
              }
            }}
          >
            Back to Dashboard
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handleReviewAndPrint}
            disabled={!selectedOrder}
            sx={{
              backgroundColor: '#274290',
              '&:hover': {
                backgroundColor: '#1e2d5a'
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
                backgroundColor: '#f27921',
                '&:hover': {
                  backgroundColor: '#e65100'
                }
              }}
            >
              Add Extra Expense
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, height: '70vh' }}>
        {/* Orders List */}
        <Box sx={{ width: 300, flexShrink: 0 }}>
          <Paper elevation={2} sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '2px solid #e3f2fd' }}>
            <Box sx={{ p: 2, backgroundColor: '#274290', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                📋 Orders ({orders.length})
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <CircularProgress sx={{ color: '#274290' }} />
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {orders.map((order) => (
                    <React.Fragment key={order.id}>
                      <ListItem
                        button
                        selected={selectedOrder?.id === order.id}
                        onClick={() => handleSelectOrder(order)}
                        sx={{
                          '&.Mui-selected': {
                            backgroundColor: '#e3f2fd',
                            borderLeft: '4px solid #274290',
                            '&:hover': {
                              backgroundColor: '#e3f2fd',
                            },
                          },
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#274290' }}>
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
            width: '100%'
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
        <DialogTitle sx={{ color: 'primary.main', fontWeight: 'bold' }}>Add Extra Expense</DialogTitle>
        <DialogContent>
          <MuiBox sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Bill No"
              value={selectedOrder?.orderDetails?.billInvoice || ''}
              InputProps={{ readOnly: true }}
              fullWidth
              sx={{ backgroundColor: 'grey.100' }}
            />
            <TextField
              label="Expense Description"
              name="description"
              value={expenseForm.description}
              onChange={handleExpenseInputChange}
              fullWidth
              required
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
              />
              <TextField
                label="Unit"
                name="unit"
                value={expenseForm.unit}
                onChange={handleExpenseInputChange}
                fullWidth
                required
                placeholder="e.g. 1, hour, piece"
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
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ p: 0, m: 0 }}>
                      <Select
                        value={expenseForm.taxType}
                        onChange={handleTaxTypeChange}
                        variant="standard"
                        disableUnderline
                        sx={{ minWidth: 48, maxWidth: 60, background: 'transparent', ml: 0.5, '& .MuiSelect-select': { p: 0, pr: 1, fontWeight: 'bold', color: '#274290' } }}
                        MenuProps={{
                          PaperProps: {
                            sx: { minWidth: 80 }
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
                InputProps={{ readOnly: true, style: { color: '#274290', fontWeight: 'bold' } }}
                fullWidth
              />
              <TextField
                label="Total"
                name="total"
                value={expenseForm.total}
                onChange={handleExpenseInputChange}
                type="number"
                fullWidth
                InputProps={{ style: { fontWeight: 'bold', color: '#f27921' } }}
              />
            </MuiBox>
            <MuiBox sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <MuiTooltip title="Add to list">
                <span>
                  <MuiIconButton
                    color="primary"
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
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                  Added Expenses
                </Typography>
                {expenseList.map((exp, idx) => (
                  <MuiBox key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, backgroundColor: 'grey.50', p: 1, borderRadius: 1 }}>
                    <Typography sx={{ flex: 2 }}>{exp.description}</Typography>
                    <Typography sx={{ flex: 1 }}>{exp.price}</Typography>
                    <Typography sx={{ flex: 1 }}>{exp.unit}</Typography>
                    <Typography sx={{ flex: 1 }}>{exp.taxType === 'percent' ? `${((exp.tax / (exp.price * (isNaN(Number(exp.unit)) ? 1 : parseFloat(exp.unit) || 1))) * 100).toFixed(2)}%` : exp.tax}</Typography>
                    <Typography sx={{ flex: 1, fontWeight: 'bold', color: '#f27921' }}>{exp.total}</Typography>
                    <MuiIconButton color="error" onClick={() => handleDeleteExpense(idx)} size="small">
                      <DeleteIcon fontSize="small" />
                    </MuiIconButton>
                  </MuiBox>
                ))}
              </MuiBox>
            )}
          </MuiBox>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExpenseModal}>Cancel</Button>
          <Button onClick={handleSaveAllExpenses} disabled={expenseList.length === 0} variant="contained" color="primary">
            Save All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoicePage; 