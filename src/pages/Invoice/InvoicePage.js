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
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { calculateOrderTotal, calculateOrderCost, calculateOrderTax, getOrderCostBreakdown, formatFurnitureDetails, isRapidOrder, calculatePickupDeliveryCost } from '../../utils/orderCalculations';
import { fetchMaterialCompanyTaxRates, getMaterialCompanyTaxRate } from '../../utils/materialTaxRates';
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
          
          // Painting
          if (group.paintingLabour && parseFloat(group.paintingLabour) > 0) {
            doc.rect(leftMargin, currentY, pageWidth, 6, 'S');
            doc.setFont('helvetica', 'normal');
            const paintingDesc = `Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}`;
            doc.text(paintingDesc, leftMargin + 2, currentY + 4);
            doc.text(`$${(parseFloat(group.paintingLabour) || 0).toFixed(2)}`, leftMargin + 120, currentY + 4);
            doc.text(`${group.paintingQnty || 1}`, leftMargin + 145, currentY + 4);
            doc.text(`$${((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 1)).toFixed(2)}`, leftMargin + 165, currentY + 4);
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
            const jlTax = jlSubtotal * getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates);
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
          mb: 3,
          pb: 2,
          borderBottom: '1px solid #ccc'
        }}>
          {/* Left Side - Customer Info */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, color: '#000000' }}>
              Name: {selectedOrder.personalInfo?.customerName || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, color: '#000000' }}>
              Email: {selectedOrder.personalInfo?.email || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, color: '#000000' }}>
              Phone: {selectedOrder.personalInfo?.phone || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, color: '#000000' }}>
              Platform: {selectedOrder.orderDetails?.platform || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#000000' }}>
              Address: {selectedOrder.personalInfo?.address || 'N/A'}
            </Typography>
          </Box>

          {/* Right Side - Invoice Number and Date */}
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              color: '#274290',
              mb: 1
            }}>
              {selectedOrder.orderDetails?.billInvoice || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#666666' }}>
              {formatDate(selectedOrder.createdAt)}
            </Typography>
          </Box>
        </Box>

        {/* Items & Services Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            mb: 2,
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
            fontSize: '0.875rem',
            color: '#000000'
          }}>
            <Box sx={{ flex: 3, p: 1, borderRight: '1px solid #ccc' }}>Description</Box>
            <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>Price</Box>
            <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>Qty</Box>
            <Box sx={{ flex: 1, p: 1, textAlign: 'right' }}>Total</Box>
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
                fontSize: '0.875rem',
                color: '#000000'
              }}>
                <Box sx={{ flex: 6, p: 1 }}>
                  {group.furnitureType || 'Furniture Group'}
                </Box>
              </Box>

              {/* Labour */}
              {group.labourPrice && parseFloat(group.labourPrice) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  fontSize: '0.875rem',
                  color: '#000000'
                }}>
                  <Box sx={{ flex: 3, p: 1, borderRight: '1px solid #ccc' }}>
                    Labour {group.labourNote ? group.labourNote : 'without piping design'}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    ${(parseFloat(group.labourPrice) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    {group.labourQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, textAlign: 'right' }}>
                    ${((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1)).toFixed(2)}
                  </Box>
                </Box>
              )}

              {/* Material */}
              {group.materialPrice && parseFloat(group.materialPrice) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  fontSize: '0.875rem',
                  color: '#000000'
                }}>
                  <Box sx={{ flex: 3, p: 1, borderRight: '1px solid #ccc' }}>
                    Material {group.materialCompany || ''} {group.materialCode ? `(${group.materialCode})` : ''}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    ${(parseFloat(group.materialPrice) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    {group.materialQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, textAlign: 'right' }}>
                    ${((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1)).toFixed(2)}
                  </Box>
                </Box>
              )}

              {/* Foam */}
              {group.foamPrice && parseFloat(group.foamPrice) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  fontSize: '0.875rem',
                  color: '#000000'
                }}>
                  <Box sx={{ flex: 3, p: 1, borderRight: '1px solid #ccc' }}>
                    Foam{group.foamThickness ? ` (${group.foamThickness}")` : ''}{group.foamNote ? ` - ${group.foamNote}` : ''}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    ${(parseFloat(group.foamPrice) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    {group.foamQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, textAlign: 'right' }}>
                    ${((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1)).toFixed(2)}
                  </Box>
                </Box>
              )}

              {/* Painting */}
              {group.paintingLabour && parseFloat(group.paintingLabour) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  fontSize: '0.875rem',
                  color: '#000000'
                }}>
                  <Box sx={{ flex: 3, p: 1, borderRight: '1px solid #ccc' }}>
                    Painting{group.paintingNote ? ` - ${group.paintingNote}` : ''}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    ${(parseFloat(group.paintingLabour) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    {group.paintingQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, textAlign: 'right' }}>
                    ${((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 1)).toFixed(2)}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* Totals Section */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end',
          mb: 3
        }}>
          <Box sx={{ width: 300 }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 1,
              fontSize: '0.875rem',
              color: '#000000'
            }}>
              <span>Items Subtotal:</span>
              <span>${totals.itemsSubtotal.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 1,
              fontSize: '0.875rem',
              color: '#000000'
            }}>
              <span>Tax (13% on M&F):</span>
              <span>${totals.taxAmount.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 2,
              fontSize: '0.875rem',
              color: '#000000'
            }}>
              <span>Pickup & Delivery:</span>
              <span>${totals.pickupDeliveryCost.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 2,
              fontWeight: 'bold',
              fontSize: '1rem',
              borderTop: '1px solid #ccc',
              pt: 1,
              color: '#000000'
            }}>
              <span>Grand Total:</span>
              <span>${totals.grandTotal.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 2,
              fontSize: '0.875rem',
              color: '#000000'
            }}>
              <span>Deposit Paid:</span>
              <span>-${totals.amountPaid.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              backgroundColor: '#fff3cd',
              p: 1,
              borderRadius: 1,
              fontWeight: 'bold',
              fontSize: '1rem',
              color: '#000000'
            }}>
              <span>Balance Due:</span>
              <span>${totals.balanceDue.toFixed(2)}</span>
            </Box>
          </Box>
        </Box>

        {/* Notes Section */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2,
          mb: 3
        }}>
          {/* Internal Notes */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ 
              backgroundColor: '#f8f8f8',
              p: 1,
              border: '1px solid #ccc',
              borderBottom: 'none',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              color: '#000000'
            }}>
              Internal Notes
            </Box>
            <Box sx={{ 
              border: '1px solid #ccc',
              minHeight: 80,
              p: 2,
              fontSize: '0.875rem',
              backgroundColor: '#ffffff',
              color: '#000000'
            }}>
              {selectedOrder.paymentData?.generalNotes || ''}
            </Box>
          </Box>

          {/* Customer Notes */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ 
              backgroundColor: '#f8f8f8',
              p: 1,
              border: '1px solid #ccc',
              borderBottom: 'none',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              color: '#000000'
            }}>
              Customer's Item Notes
            </Box>
            <Box sx={{ 
              border: '1px solid #ccc',
              minHeight: 80,
              p: 2,
              fontSize: '0.875rem',
              backgroundColor: '#ffffff',
              color: '#000000'
            }}>
              {selectedOrder.paymentData?.customerNotes || ''}
            </Box>
          </Box>
        </Box>

        {/* Internal JL Cost Analysis */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            mb: 2,
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
            fontSize: '0.875rem',
            color: '#000000'
          }}>
            <Box sx={{ flex: 2, p: 1, borderRight: '1px solid #ccc' }}>Component</Box>
            <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>Qty</Box>
            <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>Unit Price</Box>
            <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>Subtotal</Box>
            <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>TAX</Box>
            <Box sx={{ flex: 1, p: 1, textAlign: 'right' }}>Line Total</Box>
          </Box>

          {/* JL Table Content */}
          {selectedOrder.furnitureData?.groups?.map((group, groupIndex) => (
            <Box key={groupIndex}>
              {/* Furniture Type Header */}
              <Box sx={{ 
                display: 'flex',
                backgroundColor: '#f8f8f8',
                border: '1px solid #ccc',
                borderTop: 'none',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                color: '#000000'
              }}>
                <Box sx={{ flex: 6, p: 1 }}>
                  {group.furnitureType || 'Furniture Group'}
                </Box>
              </Box>

              {/* JL Material */}
              {group.materialJLPrice && parseFloat(group.materialJLPrice) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  fontSize: '0.875rem',
                  color: '#000000'
                }}>
                  <Box sx={{ flex: 2, p: 1, borderRight: '1px solid #ccc' }}>
                    Material ({group.materialCode || 'N/A'})
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    {(parseFloat(group.materialJLQnty) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    ${(parseFloat(group.materialJLPrice) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    ${((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, borderRight: '1px solid #ccc', textAlign: 'right' }}>
                    ${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates)).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, p: 1, textAlign: 'right' }}>
                    ${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * 1.13).toFixed(2)}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* JL Totals */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end',
          mb: 3
        }}>
          <Box sx={{ 
            width: 300,
            backgroundColor: '#f0f0f0',
            border: '1px solid #999',
            p: 2
          }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 1,
              fontWeight: 'bold',
              fontSize: '0.875rem',
              color: '#000000'
            }}>
              <span>Subtotal (Before Tax):</span>
              <span style={{ color: '#274290' }}>${totals.jlSubtotalBeforeTax.toFixed(2)}</span>
            </Box>
            <Box sx={{ 
              borderTop: '1px solid #ccc',
              pt: 1,
              display: 'flex', 
              justifyContent: 'space-between',
              fontWeight: 'bold',
              fontSize: '1rem',
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

      <Box sx={{ display: 'flex', gap: 3, height: '70vh' }}>
        {/* Orders List */}
        <Box sx={{ width: 300, flexShrink: 0 }}>
          <Paper elevation={2} sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '2px solid #333333' }}>
            <Box sx={{ p: 2, backgroundColor: 'background.paper', color: 'text.primary' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                📋 Orders ({orders.length})
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <CircularProgress sx={{ color: '#b98f33' }} />
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