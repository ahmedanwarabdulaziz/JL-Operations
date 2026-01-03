import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton as MuiIconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { Grid } from '@mui/material';

import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Chair as ChairIcon,
  LocalShipping as ShippingIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Business as BusinessIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  Close as CloseIcon,
  LocationOn as LocationIcon,
  Send as SendIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, where, getDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { calculateOrderProfit, calculateOrderTotal, calculateOrderTax, getOrderCostBreakdown, calculatePickupDeliveryCost } from '../../../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../../shared/utils/materialTaxRates';
import { formatCurrency } from '../../../shared/utils/plCalculations';
import { formatDate } from '../../../shared/utils/plCalculations';
import { normalizeAllocation } from '../../../shared/utils/allocationUtils';
import { formatCorporateInvoiceForInvoice } from '../../../utils/invoiceNumberUtils';
import { formatDateOnly } from '../../../utils/dateUtils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import InvoicePreviewDialog from '../../../shared/components/InvoicePreviewDialog';
import { sendCompletionEmailWithGmail } from '../../../services/emailService';

const EndDonePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [customerInvoiceDialogOpen, setCustomerInvoiceDialogOpen] = useState(false);
  const [customerInvoiceData, setCustomerInvoiceData] = useState(null);
  const [allOrdersData, setAllOrdersData] = useState([]); // Store all fetched orders for cost lookup
  const [invoicePreviewDialogOpen, setInvoicePreviewDialogOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [completionEmailDialog, setCompletionEmailDialog] = useState({
    open: false,
    sendEmail: true,
    includeReview: true
  });
  const [selectedOrderForEmail, setSelectedOrderForEmail] = useState(null);
  const [sendingCompletionEmail, setSendingCompletionEmail] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  // Fetch orders with "done" end state
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // First get all invoice statuses to identify "done" end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvoiceStatuses(statusesData);

      // Get all orders from regular orders, done-orders, corporate-orders (with status closed), and customer-invoices (T-invoices) collections
      const [ordersRef, doneOrdersRef, corporateOrdersRef, customerInvoicesRef] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'done-orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'customer-invoices'), orderBy('invoiceNumber', 'desc')))
      ]);

      const ordersData = ordersRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'individual'
      }));

      const doneOrdersData = doneOrdersRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter corporate orders to only include closed ones (check invoiceStatus end states)
      const doneStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'done'
      );
      const doneStatusValues = doneStatuses.map(status => status.value);
      
      const corporateOrdersData = corporateOrdersRef.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          orderType: 'corporate'
        }))
        .filter(order => {
          // Use invoiceStatus to determine if closed
          if (order.invoiceStatus) {
            return doneStatusValues.includes(order.invoiceStatus);
          }
          return false;
        });

      // Process customer invoices (T-invoices) - include all as they're already completed invoices
      const customerInvoicesData = customerInvoicesRef.docs.map(doc => {
        const data = doc.data();
        // Deep clone to ensure all nested objects are preserved
        const invoiceData = {
          id: doc.id,
          ...data,
          source: 'customer-invoices',
          orderType: 'customer',
          status: 'closed', // T-invoices are considered closed/completed
          // Explicitly preserve nested objects
          calculations: data.calculations ? { ...data.calculations } : {},
          items: Array.isArray(data.items) ? [...data.items] : [],
          headerSettings: data.headerSettings ? { ...data.headerSettings } : {},
          paidAmount: data.paidAmount || 0,
          originalOrderId: data.originalOrderId || null,
          originalOrderNumber: data.originalOrderNumber || null,
          invoiceNumber: data.invoiceNumber || null,
          customerInfo: data.customerInfo ? { ...data.customerInfo } : {},
          personalInfo: data.personalInfo ? { ...data.personalInfo } : {},
          customerName: data.customerName || data.customerInfo?.customerName || null
        };
        
        return invoiceData;
      });
      

      // Create sets to track orders that have corresponding T-invoices
      const ordersWithTInvoices = new Set(); // Order IDs
      const billInvoicesWithTInvoices = new Set(); // Bill invoice numbers
      
      customerInvoicesData.forEach(tInvoice => {
        // Track by originalOrderId
        if (tInvoice.originalOrderId) {
          ordersWithTInvoices.add(tInvoice.originalOrderId);
        }
        // Track by originalOrderNumber (billInvoice from original order)
        if (tInvoice.originalOrderNumber) {
          billInvoicesWithTInvoices.add(tInvoice.originalOrderNumber);
        }
        // Also check by billInvoice in orderDetails (fallback)
        if (tInvoice.orderDetails?.billInvoice && !tInvoice.originalOrderNumber) {
          billInvoicesWithTInvoices.add(tInvoice.orderDetails.billInvoice);
        }
      });

      // Filter out orders that have corresponding T-invoices (by ID or billInvoice)
      const filteredOrdersData = ordersData.filter(order => 
        !ordersWithTInvoices.has(order.id) && 
        !(order.orderDetails?.billInvoice && billInvoicesWithTInvoices.has(order.orderDetails.billInvoice))
      );
      const filteredDoneOrdersData = doneOrdersData.filter(order => 
        !ordersWithTInvoices.has(order.id) && 
        !(order.orderDetails?.billInvoice && billInvoicesWithTInvoices.has(order.orderDetails.billInvoice))
      );

      // Combine all collections (excluding orders that have T-invoices)
      const allOrders = [...filteredOrdersData, ...filteredDoneOrdersData, ...corporateOrdersData, ...customerInvoicesData];
      
      // Store all orders data for cost lookup in calculateOrderTotals
      setAllOrdersData([...ordersData, ...doneOrdersData]);

      // Reuse doneStatusValues already calculated above for filtering

      const doneOrders = allOrders.filter(order => {
        // T-invoices from customer-invoices collection are always included (they're completed invoices)
        if (order.source === 'customer-invoices') {
          return true;
        }
        // For regular orders, check invoiceStatus
        if (order.invoiceStatus) {
          return doneStatusValues.includes(order.invoiceStatus);
        }
        // For corporate orders, ONLY check invoiceStatus (not status field)
        if (order.orderType === 'corporate') {
          if (order.invoiceStatus) {
            return doneStatusValues.includes(order.invoiceStatus);
          }
          // Corporate orders without invoiceStatus should not be shown
          return false;
        }
        // For orders moved to done-orders collection (not corporate orders), check status field
        if (order.status === 'done') {
          return true;
        }
        return false;
      });

      // Fetch material tax rates
      const taxRates = await fetchMaterialCompanyTaxRates();
      setMaterialTaxRates(taxRates);
      
      setOrders(doneOrders);
      setFilteredOrders(doneOrders);
    } catch (error) {
      showError('Failed to fetch completed orders');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle search
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    if (!searchValue.trim()) {
      setFilteredOrders(orders);
      return;
    }

    const filtered = orders.filter(order => {
      const searchLower = searchValue.toLowerCase();
      
      // Search in common fields
      if (order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in individual order fields
      if (order.personalInfo?.customerName?.toLowerCase().includes(searchLower) ||
          order.personalInfo?.phone?.includes(searchValue) ||
          order.personalInfo?.email?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in corporate order fields
      if (order.corporateCustomer?.corporateName?.toLowerCase().includes(searchLower) ||
          order.contactPerson?.name?.toLowerCase().includes(searchLower) ||
          order.contactPerson?.phone?.includes(searchValue) ||
          order.contactPerson?.email?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      return false;
    });

    setFilteredOrders(filtered);
  };

  // Handle row expansion
  const handleRowToggle = (orderId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(orderId)) {
      newExpandedRows.delete(orderId);
    } else {
      newExpandedRows.add(orderId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Get status info
  const getStatusInfo = (status) => {
    const statusObj = invoiceStatuses.find(s => s.value === status);
    return statusObj || { label: status, color: '#666' };
  };

  // Calculate invoice total (same as CustomerInvoicesPage)
  const calculateInvoiceTotal = (invoice) => {
    // Use the saved total from invoice calculations if available
    if (invoice.calculations?.total !== undefined) {
      return invoice.calculations.total;
    }

    // Fallback: calculate manually if saved total is not available
    const subtotal = invoice.items?.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (quantity * price);
    }, 0) || 0;

    const taxRate = parseFloat(invoice.headerSettings?.taxPercentage) || 0;
    const taxAmount = (subtotal * taxRate) / 100;

    const ccFeeEnabled = invoice.headerSettings?.creditCardFeeEnabled || false;
    const ccFeeRate = parseFloat(invoice.headerSettings?.creditCardFeePercentage) || 0;
    const ccFeeAmount = ccFeeEnabled ? (subtotal * ccFeeRate) / 100 : 0;

    return subtotal + taxAmount + ccFeeAmount;
  };

  // Calculate order totals
  const calculateOrderTotals = (order) => {
    // Check if this is a corporate invoice
    if (order.orderType === 'corporate') {
      // Calculate revenue from furnitureGroups (corporate invoice structure)
      const furnitureGroups = order.furnitureGroups || [];
      let subtotal = 0;

      // Calculate subtotal from furniture groups
      furnitureGroups.forEach(group => {
        if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
          subtotal += (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0);
        }
        if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
          subtotal += (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 0);
        }
        if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
          subtotal += (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
        }
        if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
          subtotal += (parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 0);
        }
      });

      // Calculate delivery cost
      const paymentDetails = order.paymentDetails || {};
      let delivery = 0;
      if (paymentDetails.pickupDeliveryEnabled) {
        const pickupCost = parseFloat(paymentDetails.pickupDeliveryCost) || 0;
        const serviceType = paymentDetails.pickupDeliveryServiceType;
        if (serviceType === 'both') {
          delivery = pickupCost * 2;
        } else {
          delivery = pickupCost;
        }
      }

      // Calculate tax (13% on subtotal + delivery)
      const taxAmount = (subtotal + delivery) * 0.13;
      const creditCardFeeEnabled = paymentDetails.creditCardFeeEnabled || false;
      const creditCardFeeRate = parseFloat(paymentDetails.creditCardFeePercentage) || 0;
      const creditCardFeeAmount = creditCardFeeEnabled ? (subtotal + delivery + taxAmount) * (creditCardFeeRate / 100) : 0;
      const revenue = subtotal + delivery + taxAmount + creditCardFeeAmount;

      // Calculate cost
      let cost = 0;
      try {
        const profitData = calculateOrderProfit(order, materialTaxRates);
        cost = profitData.cost;
      } catch (e) {
        // If calculation fails, cost remains 0
      }

      const profit = revenue - cost;

      return {
        revenue,
        cost,
        profit
      };
    }

    // Check if this is a T-invoice (customer invoice)
    // PRIMARY CHECK: source === 'customer-invoices' (this is the most reliable)
    const isTInvoice = order.source === 'customer-invoices';
    
    // SECONDARY CHECK: Check invoice number format (backup)
    const invoiceNum = order.invoiceNumber || order.orderDetails?.billInvoice || '';
    const hasTFormat = invoiceNum && String(invoiceNum).trim().toUpperCase().startsWith('T-');
    const isTInvoiceByFormat = hasTFormat && !isTInvoice; // Only use if source check failed
    
    const finalIsTInvoice = isTInvoice || isTInvoiceByFormat;
    
    if (finalIsTInvoice) {
      // For T-invoices, use the same calculation method as CustomerInvoicesPage
      const revenue = calculateInvoiceTotal(order);
      
      // Try to get cost from original order
      let cost = 0;
      
      // If T-invoice has allocation data with original cost, use that
      if (order.allocation && order.allocation.originalCost !== undefined) {
        cost = parseFloat(order.allocation.originalCost) || 0;
      } 
      // If T-invoice has originalOrderId, try to fetch cost from original order
      else if (order.originalOrderId) {
        // Try to find the original order in the already-fetched orders
        const originalOrder = allOrdersData.find(o => o.id === order.originalOrderId);
        if (originalOrder) {
          // Calculate cost from original order
          try {
            const profitData = calculateOrderProfit(originalOrder, materialTaxRates);
            cost = profitData.cost;
          } catch (e) {
          }
        }
      }
      
      // If still no cost, try to calculate from T-invoice items (if they have cost data)
      if (cost === 0 && order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item.cost !== undefined && item.cost !== null) {
            cost += parseFloat(item.cost) || 0;
          }
        });
      }
      
      // Final fallback: try to calculate cost using standard function on T-invoice
      if (cost === 0) {
        try {
          const profitData = calculateOrderProfit(order, materialTaxRates);
          cost = profitData.cost;
        } catch (e) {
        }
      }
      
      const profit = revenue - cost;
      
      return {
        revenue,
        cost,
        profit
      };
    }
    
    // For regular orders, use standard calculation
    const profitData = calculateOrderProfit(order, materialTaxRates);
    return {
      revenue: profitData.revenue,
      cost: profitData.cost,
      profit: profitData.profit
    };
  };

  // Get allocation info
  const getAllocationInfo = (order) => {
    if (!order.allocation) return null;
    
    // Normalize allocation to handle both old and new formats
    const profitData = calculateOrderProfit(order, materialTaxRates);
    const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
    
    if (!normalizedAllocation || !normalizedAllocation.allocations) return null;
    
    // Filter out allocations with 0% or very small percentages (< 0.01%)
    const validAllocations = normalizedAllocation.allocations.filter(
      alloc => alloc && (alloc.percentage || 0) > 0.01
    );
    
    // Only return allocation info if there are valid allocations with actual percentages
    if (!validAllocations || validAllocations.length === 0) return null;
    
    const totalAllocations = validAllocations.length;
    const appliedAt = normalizedAllocation.appliedAt;
    const originalRevenue = profitData.revenue;
    
    return {
      totalAllocations,
      originalRevenue,
      appliedAt: typeof appliedAt === 'string' ? new Date(appliedAt) : (appliedAt?.toDate ? appliedAt.toDate() : new Date(appliedAt))
    };
  };

  // Format date
  const formatDateDisplay = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString();
  };

  // Check if invoice number is T- format
  const isTFormatInvoice = (invoiceNumber) => {
    if (!invoiceNumber) return false;
    const str = String(invoiceNumber).trim();
    return str.toUpperCase().startsWith('T-');
  };

  // Calculate invoice totals for dialog display
  const calculateInvoiceTotals = (order) => {
    if (!order) return { 
      grandTotal: 0, 
      amountPaid: 0, 
      balanceDue: 0,
      subtotal: 0,
      taxAmount: 0
    };
    
    // Check if this is a T-invoice
    const isTInvoice = order.source === 'customer-invoices' || 
                      (order.invoiceNumber && isTFormatInvoice(order.invoiceNumber)) ||
                      (order.orderDetails?.billInvoice && isTFormatInvoice(order.orderDetails.billInvoice));
    
    // For T-invoices, use stored calculations if available
    if (isTInvoice && order.calculations) {
      const grandTotal = order.calculations.total || 0;
      const taxAmount = order.calculations.taxAmount || 0;
      const subtotal = order.calculations.subtotal || 0;
      
      return {
        grandTotal: grandTotal,
        subtotal: subtotal,
        taxAmount: taxAmount,
        amountPaid: order.orderType === 'corporate' 
          ? (order.paymentDetails?.amountPaid || 0)
          : (order.paidAmount || order.paymentData?.amountPaid || 0),
        balanceDue: grandTotal - (order.orderType === 'corporate' 
          ? (order.paymentDetails?.amountPaid || 0)
          : (order.paidAmount || order.paymentData?.amountPaid || 0))
      };
    }
    
    const total = calculateOrderTotal(order);
    const taxAmount = calculateOrderTax(order);
    const subtotal = total - taxAmount;
    const amountPaid = order.orderType === 'corporate' 
      ? (parseFloat(order.paymentDetails?.amountPaid || 0))
      : (parseFloat(order.paymentData?.amountPaid || 0));
    const balanceDue = total - amountPaid;
    
    return {
      grandTotal: total,
      subtotal: subtotal,
      taxAmount: taxAmount,
      amountPaid: amountPaid,
      balanceDue: balanceDue
    };
  };

  // Transform corporate invoice data to match CustomerInvoicePreviewContent format
  const transformCorporateInvoiceData = (order) => {
    if (!order || order.orderType !== 'corporate') return order;

    // Calculate corporate invoice totals
    const furnitureGroups = order.furnitureGroups || [];
    let subtotal = 0;

    // Calculate subtotal from furniture groups
    furnitureGroups.forEach(group => {
      if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
        subtotal += (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0);
      }
      if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
        subtotal += (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 0);
      }
      if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
        subtotal += (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
      }
      if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
        subtotal += (parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 0);
      }
    });

    // Calculate delivery cost
    const paymentDetails = order.paymentDetails || {};
    let delivery = 0;
    if (paymentDetails.pickupDeliveryEnabled) {
      const pickupCost = parseFloat(paymentDetails.pickupDeliveryCost) || 0;
      const serviceType = paymentDetails.pickupDeliveryServiceType;
      if (serviceType === 'both') {
        delivery = pickupCost * 2;
      } else {
        delivery = pickupCost;
      }
    }

    // Calculate tax (13% on subtotal + delivery)
    const taxAmount = (subtotal + delivery) * 0.13;
    const creditCardFeeEnabled = paymentDetails.creditCardFeeEnabled || false;
    const creditCardFeeRate = parseFloat(paymentDetails.creditCardFeePercentage) || 0;
    const creditCardFeeAmount = creditCardFeeEnabled ? (subtotal + delivery + taxAmount) * (creditCardFeeRate / 100) : 0;
    const total = subtotal + delivery + taxAmount + creditCardFeeAmount;

    // Convert furniture groups to items format
    const items = [];
    furnitureGroups.forEach((group, groupIndex) => {
      const groupName = group.furnitureType || group.name || `Furniture Group ${groupIndex + 1}`;
      
      // Material item
      if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
        const materialName = group.materialCode 
          ? `${group.materialCompany || 'Material'} - ${group.materialCode}`
          : (group.materialCompany || 'Material');
        items.push({
          id: `item-${groupIndex}-material`,
          name: materialName,
          price: parseFloat(group.materialPrice) || 0,
          quantity: parseFloat(group.materialQnty) || 0
        });
      }
      
      // Labour item
      if (group.labourPrice && parseFloat(group.labourPrice) > 0) {
        const labourName = group.labourNote ? `Labour Work - ${group.labourNote}` : 'Labour Work';
        items.push({
          id: `item-${groupIndex}-labour`,
          name: labourName,
          price: parseFloat(group.labourPrice) || 0,
          quantity: parseFloat(group.labourQnty) || 1
        });
      }
      
      // Foam item
      if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
        const foamName = group.foamNote ? `Foam - ${group.foamNote}` : 'Foam';
        items.push({
          id: `item-${groupIndex}-foam`,
          name: foamName,
          price: parseFloat(group.foamPrice) || 0,
          quantity: parseFloat(group.foamQnty) || 0
        });
      }
      
      // Painting item
      if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
        const paintingName = group.paintingNote ? `Painting - ${group.paintingNote}` : 'Painting';
        items.push({
          id: `item-${groupIndex}-painting`,
          name: paintingName,
          price: parseFloat(group.paintingLabour) || 0,
          quantity: parseFloat(group.paintingQnty) || 0
        });
      }
    });

    // Add pickup/delivery as an item if enabled
    if (paymentDetails.pickupDeliveryEnabled && delivery > 0) {
      items.push({
        id: 'item-delivery',
        name: 'Pickup & Delivery',
        price: parseFloat(delivery.toFixed(2)),
        quantity: 1
      });
    }

    // Transform furniture groups to have name property for preview component
    const transformedGroups = furnitureGroups.map((group, index) => ({
      ...group,
      name: group.furnitureType || group.name || `Furniture Group ${index + 1}`
    }));

    return {
      ...order,
      customerInfo: {
        customerName: order.corporateCustomer?.corporateName || 'N/A',
        phone: order.contactPerson?.phone || '',
        email: order.contactPerson?.email || order.corporateCustomer?.email || '',
        address: order.corporateCustomer?.address || ''
      },
      items: items,
      furnitureGroups: transformedGroups,
      calculations: {
        subtotal: parseFloat((subtotal + delivery).toFixed(2)), // Include delivery in subtotal for display
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        creditCardFeeAmount: parseFloat(creditCardFeeAmount.toFixed(2)),
        total: parseFloat(total.toFixed(2))
      },
      headerSettings: {
        taxPercentage: 13,
        creditCardFeeEnabled: creditCardFeeEnabled,
        creditCardFeePercentage: creditCardFeeRate
      },
      paidAmount: parseFloat(paymentDetails.amountPaid || 0),
      invoiceNumber: order.orderDetails?.billInvoice || order.invoiceNumber || order.id,
      createdAt: order.createdAt || order.closedAt || order.completedAt || order.statusUpdatedAt || order.updatedAt || new Date()
    };
  };

  // Handle view invoice dialog
  const handleViewInvoice = (order) => {
    try {
      // For customer invoices (T-invoices) and corporate invoices, show in popup dialog
      if (order.source === 'customer-invoices' || order.orderType === 'corporate') {
        // Transform corporate invoice data if needed
        const invoiceData = order.orderType === 'corporate' 
          ? transformCorporateInvoiceData(order)
          : order;
        setCustomerInvoiceData(invoiceData);
        setCustomerInvoiceDialogOpen(true);
        return;
      }
      
      // For regular orders, use InvoicePreviewDialog (same as /admin/invoices)
      setPreviewOrder(order);
      setInvoicePreviewDialogOpen(true);
    } catch (error) {
      showError('Error opening invoice: ' + error.message);
    }
  };

  // Handle send completion email
  const handleSendCompletionEmail = (order) => {
    setSelectedOrderForEmail(order);
    setCompletionEmailDialog({
      open: true,
      sendEmail: true,
      includeReview: true
    });
  };

  // Handle completion email cancel
  const handleCompletionEmailCancel = () => {
    setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false });
    setSelectedOrderForEmail(null);
  };

  // Parse invoice number to extract numeric value
  const parseInvoiceNumberValue = (value) => {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/\d+/);
    if (!match) return null;
    const parsed = parseInt(match[0], 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  // Clear invoice number references from related orders
  const clearInvoiceNumberReferences = async (invoice) => {
    const invoiceNumber = invoice?.invoiceNumber || invoice?.orderDetails?.billInvoice;
    const parsedNumber = parseInvoiceNumberValue(invoiceNumber);
    const originalOrderId = invoice?.originalOrderId;

    if (!parsedNumber && !invoiceNumber) {
      return;
    }

    const collectionsToCheck = [
      { name: 'orders', id: originalOrderId },
      { name: 'corporate-orders', id: originalOrderId },
      { name: 'done-orders', id: originalOrderId }
    ];

    for (const { name, id } of collectionsToCheck) {
      if (!id) continue;

      try {
        const referenceDocRef = doc(db, name, id);
        const referenceSnapshot = await getDoc(referenceDocRef);

        if (referenceSnapshot.exists()) {
          const data = referenceSnapshot.data();
          const existingNumber = data?.orderDetails?.billInvoice;
          const existingParsed = parseInvoiceNumberValue(existingNumber);

          // Check if the invoice number matches (either exact match or parsed match)
          if (existingNumber === invoiceNumber || existingParsed === parsedNumber) {
            await updateDoc(referenceDocRef, {
              'orderDetails.billInvoice': null,
              'orderDetails.lastUpdated': new Date()
            });
          }
        }
      } catch (error) {
        console.error(`Error clearing invoice number from ${name}/${id}:`, error);
      }
    }
  };

  // Handle delete invoice
  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    try {
      setDeleting(true);
      
      // Determine which collections might contain this invoice
      const collectionsToCheck = [];
      
      if (invoiceToDelete.source === 'customer-invoices') {
        collectionsToCheck.push('customer-invoices');
      } else if (invoiceToDelete.orderType === 'corporate') {
        collectionsToCheck.push('corporate-orders');
      } else {
        // For individual orders, check both orders and done-orders
        collectionsToCheck.push('orders', 'done-orders');
      }

      // Check if this is a T-invoice (starts with T-)
      const invoiceNumber = invoiceToDelete.invoiceNumber || invoiceToDelete.orderDetails?.billInvoice;
      const isTInvoice = invoiceNumber && String(invoiceNumber).startsWith('T-');
      const originalOrderId = invoiceToDelete.originalOrderId || invoiceToDelete.id;

      // Delete from all possible collections (to ensure complete deletion)
      const deletePromises = collectionsToCheck.map(async (collectionName) => {
        try {
          const docRef = doc(db, collectionName, invoiceToDelete.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            await deleteDoc(docRef);
            console.log(`Deleted from ${collectionName}`);
          }
        } catch (error) {
          // Ignore if not found in this collection
          console.log(`Order not found in ${collectionName}, continuing...`);
        }
      });

      await Promise.all(deletePromises);

      // If it's a T-invoice, restore the original order by removing hasTInvoice flag
      if (isTInvoice && originalOrderId) {
        try {
          const orderRef = doc(db, 'orders', originalOrderId);
          const orderDoc = await getDoc(orderRef);
          
          if (orderDoc.exists()) {
            await updateDoc(orderRef, {
              hasTInvoice: false,
              tInvoiceId: null
            });
          }
        } catch (orderError) {
          console.error('Error restoring original order:', orderError);
          // Don't fail the deletion if order update fails
        }
      }

      // Clear invoice number references from related orders
      await clearInvoiceNumberReferences(invoiceToDelete);

      // Update local state
      setOrders(prev => prev.filter(order => order.id !== invoiceToDelete.id));
      setFilteredOrders(prev => prev.filter(order => order.id !== invoiceToDelete.id));

      showSuccess('Invoice deleted successfully');
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showError('Failed to delete invoice: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Handle delete button click
  const handleDeleteClick = (order) => {
    setInvoiceToDelete(order);
    setDeleteDialogOpen(true);
  };

  // Handle completion email confirm
  const handleCompletionEmailConfirm = async () => {
    if (!selectedOrderForEmail) return;

    try {
      setSendingCompletionEmail(true);
      setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false });
      
      // Prepare order data for email
      const orderDataForEmail = selectedOrderForEmail.orderType === 'corporate' ? {
        corporateCustomer: selectedOrderForEmail.corporateCustomer,
        contactPerson: selectedOrderForEmail.contactPerson,
        orderDetails: selectedOrderForEmail.orderDetails,
        furnitureData: {
          groups: selectedOrderForEmail.furnitureData?.groups || selectedOrderForEmail.furnitureGroups || []
        },
        paymentData: selectedOrderForEmail.paymentData
      } : {
        personalInfo: selectedOrderForEmail.personalInfo,
        orderDetails: selectedOrderForEmail.orderDetails,
        furnitureData: {
          groups: selectedOrderForEmail.furnitureData?.groups || selectedOrderForEmail.furnitureGroups || []
        },
        paymentData: selectedOrderForEmail.paymentData
      };

      // Get customer email
      const customerEmail = selectedOrderForEmail.orderType === 'corporate' 
        ? selectedOrderForEmail.contactPerson?.email || selectedOrderForEmail.corporateCustomer?.email
        : selectedOrderForEmail.personalInfo?.email || selectedOrderForEmail.customerInfo?.email;

      if (!customerEmail) {
        showError('Customer email not found. Cannot send completion email.');
        setSendingCompletionEmail(false);
        return;
      }

      // Progress callback for email sending
      const onEmailProgress = (message) => {
        console.log('📧 Completion email progress:', message);
        showSuccess(`📧 ${message}`);
      };

      // Send the completion email
      const emailResult = await sendCompletionEmailWithGmail(
        orderDataForEmail, 
        customerEmail, 
        completionEmailDialog.includeReview,
        onEmailProgress
      );
      
      if (emailResult.success) {
        showSuccess('✅ Completion email sent successfully!');
      } else {
        showError(`❌ Failed to send completion email: ${emailResult.message}`);
      }
    } catch (error) {
      console.error('Error sending completion email:', error);
      showError(`Failed to send completion email: ${error.message}`);
    } finally {
      setSendingCompletionEmail(false);
      setSelectedOrderForEmail(null);
    }
  };

  // Handle print invoice
  const handlePrintInvoice = (order) => {
    handleReviewInvoice(order);
  };

  // Handle review/print preview
  const handleReviewInvoice = (order) => {
    try {
      // Calculate order totals properly
      const taxAmount = calculateOrderTax(order);
      const pickupDeliveryCost = order.paymentData?.pickupDeliveryEnabled ? 
        calculatePickupDeliveryCost(
          parseFloat(order.paymentData.pickupDeliveryCost) || 0,
          order.paymentData.pickupDeliveryServiceType || 'both'
        ) : 0;
      
      const breakdown = getOrderCostBreakdown(order);
      const itemsSubtotal = breakdown.material + breakdown.labour + breakdown.foam + breakdown.painting;
      const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
      
      // Convert order to invoice format
      // Create customerInfo from order data
      let customerInfo = {};
      if (order.orderType === 'corporate') {
        customerInfo = {
          customerName: order.corporateCustomer?.corporateName || 'N/A',
          phone: order.contactPerson?.phone || '',
          email: order.contactPerson?.email || order.corporateCustomer?.email || '',
          address: order.corporateCustomer?.address || ''
        };
      } else {
        customerInfo = {
          customerName: order.personalInfo?.customerName || 'N/A',
          phone: order.personalInfo?.phone || '',
          email: order.personalInfo?.email || '',
          address: order.personalInfo?.address || ''
        };
      }

      const invoiceData = {
        invoiceNumber: order.orderDetails?.billInvoice || order.id,
        customerInfo: customerInfo,
        personalInfo: order.personalInfo || {},
        corporateCustomer: order.corporateCustomer || {},
        contactPerson: order.contactPerson || {},
        orderDetails: order.orderDetails || {},
        calculations: {
          subtotal: parseFloat(itemsSubtotal.toFixed(2)),
          taxAmount: parseFloat(taxAmount.toFixed(2)),
          total: parseFloat(grandTotal.toFixed(2)),
          paidAmount: order.orderType === 'corporate' 
            ? (parseFloat(order.paymentDetails?.amountPaid || 0))
            : (parseFloat(order.paymentData?.amountPaid || 0)),
          creditCardFeeAmount: 0
        },
        headerSettings: {
          taxPercentage: 13,
          creditCardFeeEnabled: false
        },
        items: [],
        furnitureData: order.furnitureData || { groups: [] }
      };

      // Convert furniture groups to invoice items
      if (order.furnitureData?.groups) {
        order.furnitureData.groups.forEach(group => {
          // Add material item
          if (group.materialPrice && group.materialQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Material`,
              price: parseFloat(group.materialPrice || 0),
              quantity: parseFloat(group.materialQnty || 0)
            });
          }
          
          // Add labour item
          if (group.labourPrice && group.labourQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Labour`,
              price: parseFloat(group.labourPrice || 0),
              quantity: parseFloat(group.labourQnty || 0)
            });
          }
          
          // Add foam item if enabled
          if ((group.foamEnabled || group.foamPrice) && group.foamQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Foam`,
              price: parseFloat(group.foamPrice || 0),
              quantity: parseFloat(group.foamQnty || 0)
            });
          }
          
          // Add painting item if enabled
          if ((group.paintingEnabled || group.paintingLabour) && group.paintingQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Painting`,
              price: parseFloat(group.paintingLabour || 0),
              quantity: parseFloat(group.paintingQnty || 0)
            });
          }
        });
      }
      
      // Add pickup/delivery as an item if enabled
      if (order.paymentData?.pickupDeliveryEnabled && pickupDeliveryCost > 0) {
        invoiceData.items.push({
          name: 'Pickup & Delivery',
          price: parseFloat(pickupDeliveryCost.toFixed(2)),
          quantity: 1
        });
      }

      // Navigate to print invoice page
      navigate('/admin/customer-invoices/print', {
        state: { invoiceData }
      });
    } catch (error) {
      showError('Failed to open invoice preview: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
          <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
          Completed Orders
        </Typography>
        <Typography variant="body1" sx={{ color: '#ffffff' }}>
          All orders that have been successfully completed and allocated
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search completed orders..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#b98f33' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => handleSearch('')} sx={{ color: '#b98f33' }}>
                  <RefreshIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: '#2a2a2a',
              '&:hover fieldset': { borderColor: '#b98f33' },
              '&.Mui-focused fieldset': { borderColor: '#b98f33' }
            },
            '& .MuiInputBase-input': {
              color: '#ffffff'
            },
            '& .MuiInputLabel-root': {
              color: '#b98f33'
            }
          }}
        />
      </Box>

      {/* Orders Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#b98f33' }}>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Revenue</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Cost</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Profit</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Completed</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Alert severity="info">
                      {searchTerm ? 'No completed orders found matching your search' : 'No completed orders found'}
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <React.Fragment key={order.id}>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                        <Box>
                          #{order.invoiceNumber || order.orderDetails?.billInvoice || order.id}
                          {order.source === 'customer-invoices' && (order.originalOrderNumber || order.originalOrderId) && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#b98f33', fontStyle: 'italic', mt: 0.5 }}>
                              Original: #{order.originalOrderNumber || order.orderDetails?.billInvoice || 'N/A'}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                              {order.orderType === 'corporate' 
                                ? order.corporateCustomer?.corporateName || 'Unknown Corporate'
                                : order.source === 'customer-invoices'
                                ? order.personalInfo?.customerName || order.customerName || 'Unknown Customer'
                                : order.personalInfo?.customerName || 'Unknown Customer'
                              }
                            </Typography>
                            {order.orderType === 'corporate' && (
                              <Chip
                                icon={<BusinessIcon />}
                                label="Corporate"
                                size="small"
                                sx={{
                                  backgroundColor: '#f27921',
                                  color: 'white',
                                  fontSize: '0.7rem',
                                  height: '20px'
                                }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: '#b98f33' }}>
                            {order.orderType === 'corporate'
                              ? order.contactPerson?.phone || 'No Phone'
                              : order.personalInfo?.phone || 'No Phone'
                            }
                          </Typography>
                        </Box>
                      </TableCell>
                      {(() => {
                        const totals = calculateOrderTotals(order);
                        return (
                          <>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                                {formatCurrency(totals.revenue)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                                {formatCurrency(totals.cost)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                                {formatCurrency(totals.profit)}
                              </Typography>
                            </TableCell>
                          </>
                        );
                      })()}
                      <TableCell>
                        <Chip
                          label={getStatusInfo(order.invoiceStatus).label}
                          size="small"
                          sx={{
                            backgroundColor: getStatusInfo(order.invoiceStatus).color,
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                                             <TableCell>
                         <Typography variant="body2" sx={{ color: '#ffffff' }}>
                           {formatDateDisplay(order.completedAt || order.statusUpdatedAt || order.updatedAt)}
                         </Typography>
                       </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Tooltip title="View Invoice">
                            <IconButton
                              size="small"
                              onClick={() => handleViewInvoice(order)}
                              sx={{ 
                                color: '#b98f33',
                                backgroundColor: 'rgba(185, 143, 51, 0.2)',
                                '&:hover': {
                                  backgroundColor: 'rgba(185, 143, 51, 0.3)',
                                  color: '#d4af5a'
                                }
                              }}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Send Completion Email">
                            <IconButton
                              size="small"
                              onClick={() => handleSendCompletionEmail(order)}
                              sx={{ 
                                color: '#b98f33',
                                backgroundColor: 'rgba(185, 143, 51, 0.2)',
                                '&:hover': {
                                  backgroundColor: 'rgba(185, 143, 51, 0.3)',
                                  color: '#d4af5a'
                                }
                              }}
                            >
                              <SendIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Invoice">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(order)}
                              sx={{ 
                                color: '#ff4444',
                                backgroundColor: 'rgba(255, 68, 68, 0.2)',
                                '&:hover': {
                                  backgroundColor: 'rgba(255, 68, 68, 0.3)',
                                  color: '#ff6666'
                                }
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                          <MuiIconButton
                            size="small"
                            onClick={() => handleRowToggle(order.id)}
                            sx={{ color: '#b98f33' }}
                          >
                            {expandedRows.has(order.id) ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </MuiIconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                        <Collapse in={expandedRows.has(order.id)} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Card sx={{ mb: 2 }}>
                              <CardContent>
                                {/* Customer Information */}
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <PersonIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Customer Information
                                  </Typography>
                                  <Card sx={{ 
                                    background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                    color: 'white',
                                    boxShadow: 3,
                                    border: '1px solid #333333'
                                  }}>
                                    <CardContent>
                                      <Grid container spacing={3}>
                                        {order.orderType === 'corporate' ? (
                                          <>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.corporateCustomer?.corporateName || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Corporate Name
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.contactPerson?.name || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Contact Person
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.contactPerson?.phone || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Phone Number
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.contactPerson?.email || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Email Address
                                                </Typography>
                                              </Box>
                                            </Grid>
                                          </>
                                        ) : (
                                          <>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.personalInfo?.customerName || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Customer Name
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.personalInfo?.phone || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Phone Number
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.personalInfo?.email || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Email Address
                                                </Typography>
                                              </Box>
                                            </Grid>
                                          </>
                                        )}
                                        <Grid item xs={12}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.orderType === 'corporate' 
                                                ? order.corporateCustomer?.address || 'N/A'
                                                : order.personalInfo?.address || 'N/A'
                                              }
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Delivery Address
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </CardContent>
                                  </Card>
                                </Box>

                                {/* Financial Summary */}
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Financial Summary
                                  </Typography>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).revenue)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Revenue
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).cost)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Cost
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).profit)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Profit
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                  </Grid>
                                </Box>

                                {/* Allocation Information */}
                                {getAllocationInfo(order) && (
                                  <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                      <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                      Financial Allocation Details
                                    </Typography>
                                    <Card sx={{ 
                                      background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                      color: 'white',
                                      boxShadow: 3,
                                      border: '1px solid #333333'
                                    }}>
                                      <CardContent>
                                        <Grid container spacing={3}>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {getAllocationInfo(order).totalAllocations}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Month(s) Allocated
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {formatCurrency(getAllocationInfo(order).originalRevenue)}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Original Revenue
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {formatDateDisplay(getAllocationInfo(order).appliedAt)}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Applied Date
                                              </Typography>
                                            </Box>
                                          </Grid>
                                        </Grid>
                                      </CardContent>
                                    </Card>
                                  </Box>
                                )}

                                {/* Completion Details */}
                                <Box>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Completion Details
                                  </Typography>
                                  <Card sx={{ 
                                    background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                    color: 'white',
                                    boxShadow: 3,
                                    border: '1px solid #333333'
                                  }}>
                                    <CardContent>
                                      <Grid container spacing={3}>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                                                                         <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                               {formatDateDisplay(order.completedAt || order.statusUpdatedAt || order.updatedAt)}
                                             </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Order Completed
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                                                                         <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                               {formatDateDisplay(order.statusUpdatedAt || order.updatedAt || order.completedAt)}
                                             </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Status Updated
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </CardContent>
                                  </Card>
                                </Box>
                              </CardContent>
                            </Card>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View Invoice Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {(() => {
            if (!selectedInvoice) return 'Invoice - N/A';
            const invoiceNumber = selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice;
            const isTInvoice = invoiceNumber && isTFormatInvoice(invoiceNumber);
            const status = selectedInvoice.status === 'closed' ? 'Closed' : 'Completed';
            return `Invoice #${formatCorporateInvoiceForInvoice(invoiceNumber) || 'N/A'} - ${status} Invoice`;
          })()}
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (() => {
            const isTInvoice = selectedInvoice.source === 'customer-invoices' || 
                              (selectedInvoice.invoiceNumber && isTFormatInvoice(selectedInvoice.invoiceNumber)) ||
                              (selectedInvoice.orderDetails?.billInvoice && isTFormatInvoice(selectedInvoice.orderDetails.billInvoice));
            
            // Get items based on invoice type - check all possible locations
            let invoiceItems = [];
            let furnitureGroups = [];
            
            // Check all possible locations for items/furniture data
            // For T-invoices: use items array with furnitureGroups for grouping
            // For corporate invoices: use furnitureGroups with material/labour/foam/painting data
            
            if (isTInvoice && selectedInvoice.items && Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0) {
              // T-invoice: use items array
              invoiceItems = selectedInvoice.items.filter(item => item && !item.isGroup && (item.name || item.description));
            } else {
              // Corporate invoice or regular order: use furnitureGroups
              if (selectedInvoice.furnitureGroups && Array.isArray(selectedInvoice.furnitureGroups) && selectedInvoice.furnitureGroups.length > 0) {
                furnitureGroups = selectedInvoice.furnitureGroups.filter(group => group && (
                  group.furnitureType || 
                  group.materialPrice || 
                  group.labourPrice || 
                  group.foamPrice || 
                  group.paintingLabour ||
                  group.materialCode
                ));
              } else if (selectedInvoice.furnitureData?.groups && Array.isArray(selectedInvoice.furnitureData.groups) && selectedInvoice.furnitureData.groups.length > 0) {
                furnitureGroups = selectedInvoice.furnitureData.groups.filter(group => group && (
                  group.furnitureType || 
                  group.furnitureName ||
                  group.materialPrice || 
                  group.labourPrice || 
                  group.foamPrice || 
                  group.paintingLabour
                ));
              }
            }
            
            return (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Customer Information</Typography>
                    <Typography><strong>Name:</strong> {selectedInvoice.orderType === 'corporate' 
                      ? (selectedInvoice.corporateCustomer?.corporateName || selectedInvoice.customerInfo?.customerName || selectedInvoice.originalCustomerInfo?.customerName || 'N/A')
                      : (selectedInvoice.personalInfo?.customerName || selectedInvoice.customerInfo?.customerName || selectedInvoice.originalCustomerInfo?.customerName || 'N/A')
                    }</Typography>
                    <Typography><strong>Phone:</strong> {selectedInvoice.orderType === 'corporate'
                      ? (selectedInvoice.contactPerson?.phone || selectedInvoice.customerInfo?.phone || selectedInvoice.originalCustomerInfo?.phone || 'N/A')
                      : (selectedInvoice.personalInfo?.phone || selectedInvoice.customerInfo?.phone || selectedInvoice.originalCustomerInfo?.phone || 'N/A')
                    }</Typography>
                    <Typography><strong>Email:</strong> {selectedInvoice.orderType === 'corporate'
                      ? (selectedInvoice.contactPerson?.email || selectedInvoice.customerInfo?.email || selectedInvoice.originalCustomerInfo?.email || 'N/A')
                      : (selectedInvoice.personalInfo?.email || selectedInvoice.customerInfo?.email || selectedInvoice.originalCustomerInfo?.email || 'N/A')
                    }</Typography>
                    <Typography><strong>Address:</strong> {selectedInvoice.orderType === 'corporate'
                      ? (selectedInvoice.corporateCustomer?.address || selectedInvoice.customerInfo?.address || selectedInvoice.originalCustomerInfo?.address || 'N/A')
                      : (selectedInvoice.personalInfo?.address || selectedInvoice.customerInfo?.address || selectedInvoice.originalCustomerInfo?.address || 'N/A')
                    }</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Invoice Details</Typography>
                    <Typography><strong>Invoice #:</strong> {formatCorporateInvoiceForInvoice(selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice) || 'N/A'}</Typography>
                    <Typography><strong>Status:</strong> 
                      <Chip
                        label={selectedInvoice.status === 'closed' ? 'Closed' : 'Completed'}
                        size="small"
                        color={selectedInvoice.status === 'closed' ? 'success' : 'success'}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography><strong>Date Completed:</strong> {formatDateDisplay(selectedInvoice.closedAt || selectedInvoice.completedAt || selectedInvoice.statusUpdatedAt || selectedInvoice.updatedAt)}</Typography>
                    <Typography><strong>Subtotal:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).subtotal)}</Typography>
                    <Typography><strong>Tax (13%):</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).taxAmount)}</Typography>
                    <Typography><strong>Total Amount:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).grandTotal)}</Typography>
                    <Typography><strong>Amount Paid:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).amountPaid)}</Typography>
                  </Grid>
                  
                  {/* Invoice Items */}
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mb: 1, mt: 2, fontWeight: 'bold', color: '#274290' }}>Items & Services</Typography>
                    <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid #ddd' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Description</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Price</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Qty</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            // For T-invoices: combine items with furnitureGroups
                            if (isTInvoice && invoiceItems.length > 0) {
                              const furnitureGroups = selectedInvoice.furnitureGroups || [];
                              const rows = [];
                              
                              // Group items by furniture group
                              const itemsByGroup = {};
                              invoiceItems.forEach(item => {
                                const match = item.id?.match(/item-(\d+)-/);
                                const groupIndex = match ? parseInt(match[1]) : -1;
                                if (groupIndex >= 0 && groupIndex < furnitureGroups.length) {
                                  if (!itemsByGroup[groupIndex]) {
                                    itemsByGroup[groupIndex] = [];
                                  }
                                  itemsByGroup[groupIndex].push(item);
                                }
                              });
                              
                              // Render groups with items
                              if (furnitureGroups.length > 0 && Object.keys(itemsByGroup).length > 0) {
                                furnitureGroups.forEach((group, groupIndex) => {
                                  // Group header
                                  rows.push(
                                    <TableRow key={`group-${groupIndex}`} sx={{ backgroundColor: '#f8f9fa' }}>
                                      <TableCell colSpan={4} sx={{ fontWeight: 'bold', color: '#274290', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', py: 1 }}>
                                        {group.name || `Furniture Group ${groupIndex + 1}`}
                                      </TableCell>
                                    </TableRow>
                                  );
                                  
                                  // Items in this group
                                  const groupItems = itemsByGroup[groupIndex] || [];
                                  groupItems.forEach((item, itemIndex) => (
                                    rows.push(
                                      <TableRow key={item.id || `item-${groupIndex}-${itemIndex}`}>
                                        <TableCell sx={{ color: '#333333' }}>{item.name || item.description}</TableCell>
                                        <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(item.price || 0)}</TableCell>
                                        <TableCell align="center" sx={{ color: '#333333' }}>{item.quantity || item.qty || 1}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                          {formatCurrency((parseFloat(item.price || 0) * parseFloat(item.quantity || item.qty || 1)))}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  ));
                                });
                                
                                // Add ungrouped items
                                const ungroupedItems = invoiceItems.filter(item => {
                                  const match = item.id?.match(/item-(\d+)-/);
                                  const groupIndex = match ? parseInt(match[1]) : -1;
                                  return groupIndex < 0 || groupIndex >= furnitureGroups.length;
                                });
                                
                                ungroupedItems.forEach((item, index) => (
                                  rows.push(
                                    <TableRow key={item.id || `ungrouped-${index}`}>
                                      <TableCell sx={{ color: '#333333' }}>{item.name || item.description}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(item.price || 0)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{item.quantity || item.qty || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(item.price || 0) * parseFloat(item.quantity || item.qty || 1)))}
                                      </TableCell>
                                    </TableRow>
                                  )
                                ));
                                
                                return rows;
                              } else {
                                // Fallback: show items without grouping
                                return invoiceItems.map((item, index) => (
                                  <TableRow key={item.id || `item-${index}`}>
                                    <TableCell sx={{ color: '#333333' }}>{item.name || item.description}</TableCell>
                                    <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(item.price || 0)}</TableCell>
                                    <TableCell align="center" sx={{ color: '#333333' }}>{item.quantity || item.qty || 1}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                      {formatCurrency((parseFloat(item.price || 0) * parseFloat(item.quantity || item.qty || 1)))}
                                    </TableCell>
                                  </TableRow>
                                ));
                              }
                            } else if (furnitureGroups.length > 0) {
                              // Corporate invoices: render from furnitureGroups (matching TaxedInvoicesPage style)
                              const rows = [];
                              furnitureGroups.forEach((group, groupIndex) => {
                                // Furniture Group Header
                                if (group.furnitureType) {
                                  rows.push(
                                    <TableRow key={`group-header-${groupIndex}`} sx={{ backgroundColor: '#f8f9fa' }}>
                                      <TableCell colSpan={4} sx={{ fontWeight: 'bold', color: '#274290', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', py: 1 }}>
                                        {group.furnitureType}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Material
                                if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
                                  const materialName = group.materialCode 
                                    ? `${group.materialCompany || 'Material'} - ${group.materialCode}`
                                    : (group.materialCompany || 'Material');
                                  rows.push(
                                    <TableRow key={`material-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{materialName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.materialPrice)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.materialQnty || group.materialQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty || group.materialQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Labour
                                if (group.labourPrice && parseFloat(group.labourPrice) > 0) {
                                  const labourName = group.labourNote ? `Labour Work - ${group.labourNote}` : 'Labour Work';
                                  rows.push(
                                    <TableRow key={`labour-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{labourName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.labourPrice)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.labourQnty || group.labourQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty || group.labourQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Foam
                                if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
                                  const foamName = group.foamNote ? `Foam - ${group.foamNote}` : 'Foam';
                                  rows.push(
                                    <TableRow key={`foam-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{foamName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.foamPrice)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.foamQnty || group.foamQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty || group.foamQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Painting
                                if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
                                  const paintingName = group.paintingNote ? `Painting - ${group.paintingNote}` : 'Painting';
                                  rows.push(
                                    <TableRow key={`painting-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{paintingName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.paintingLabour)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.paintingQnty || group.paintingQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty || group.paintingQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                              });
                              
                              return rows.length > 0 ? rows : (
                                <TableRow>
                                  <TableCell colSpan={4} align="center" sx={{ fontStyle: 'italic', color: '#666', py: 3 }}>
                                    No items found
                                  </TableCell>
                                </TableRow>
                              );
                            } else {
                              return (
                                <TableRow>
                                  <TableCell colSpan={4} align="center" sx={{ fontStyle: 'italic', color: '#666', py: 3 }}>
                                    No items found
                                    <Box sx={{ mt: 2, fontSize: '0.75rem', color: '#999', textAlign: 'left', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                                      <Typography variant="caption" component="div">
                                        <strong>Debug Info:</strong><br/>
                                        Source: {selectedInvoice.source || 'N/A'}<br/>
                                        Order Type: {selectedInvoice.orderType || 'N/A'}<br/>
                                        Has items array: {selectedInvoice.items ? `Yes (${selectedInvoice.items.length} items)` : 'No'}<br/>
                                        Has furnitureGroups: {selectedInvoice.furnitureGroups ? `Yes (${selectedInvoice.furnitureGroups.length} groups)` : 'No'}<br/>
                                        Has furnitureData: {selectedInvoice.furnitureData ? 'Yes' : 'No'}<br/>
                                        Invoice Number: {selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice || 'N/A'}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                          })()}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </Grid>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button 
            onClick={() => selectedInvoice && handlePrintInvoice(selectedInvoice)}
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{ backgroundColor: '#b98f33' }}
          >
            Print Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Customer Invoice Preview Dialog */}
      <Dialog
        open={customerInvoiceDialogOpen}
        onClose={() => setCustomerInvoiceDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            backgroundColor: '#f5f5f5'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          color: '#b98f33'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Invoice Preview - {customerInvoiceData ? formatCorporateInvoiceForInvoice(customerInvoiceData.invoiceNumber) : 'N/A'}
          </Typography>
          <IconButton onClick={() => setCustomerInvoiceDialogOpen(false)} sx={{ color: '#b98f33' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: '#f5f5f5' }}>
          {customerInvoiceData && (
            <CustomerInvoicePreviewContent 
              invoiceData={customerInvoiceData}
              onClose={() => setCustomerInvoiceDialogOpen(false)}
              showSuccess={showSuccess}
              showError={showError}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog for Regular Orders (same as /admin/invoices) */}
      <InvoicePreviewDialog
        open={invoicePreviewDialogOpen}
        onClose={() => {
          setInvoicePreviewDialogOpen(false);
          setPreviewOrder(null);
        }}
        order={previewOrder}
        materialTaxRates={materialTaxRates}
      />

      {/* Completion Email Dialog */}
      <Dialog
        open={completionEmailDialog.open}
        onClose={handleCompletionEmailCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            borderRadius: 2,
            border: '2px solid #b98f33',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: '#2a2a2a', 
          color: '#ffffff',
          borderBottom: '2px solid #b98f33',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <span style={{ fontSize: '24px' }}>📧</span>
          Send Completion Email
        </DialogTitle>
        
        <DialogContent sx={{ mt: 2 }}>
          {/* Order and Customer Info in Big Font */}
          <Box sx={{ 
            p: 3, 
            backgroundColor: '#2a2a2a', 
            borderRadius: 1, 
            borderLeft: '4px solid #b98f33',
            mb: 3,
            textAlign: 'center'
          }}>
            <Typography variant="h4" sx={{ 
              color: '#b98f33', 
              mb: 2, 
              fontWeight: 'bold',
              fontSize: '2rem'
            }}>
              Order: {selectedOrderForEmail?.orderDetails?.billInvoice || selectedOrderForEmail?.invoiceNumber || selectedOrderForEmail?.id || 'N/A'}
            </Typography>
            <Typography variant="h4" sx={{ 
              color: '#ffffff', 
              fontWeight: 'bold',
              fontSize: '2rem'
            }}>
              Customer: {selectedOrderForEmail?.orderType === 'corporate' 
                ? (selectedOrderForEmail?.corporateCustomer?.corporateName || selectedOrderForEmail?.contactPerson?.name || 'N/A')
                : (selectedOrderForEmail?.personalInfo?.customerName || selectedOrderForEmail?.customerInfo?.customerName || 'N/A')}
            </Typography>
          </Box>

          {/* Email Options */}
          <Box sx={{ 
            p: 2, 
            backgroundColor: '#2a2a2a', 
            borderRadius: 1, 
            borderLeft: '4px solid #b98f33',
            mb: 2
          }}>
            <Typography variant="h6" sx={{ color: '#b98f33', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              📧 Email Options
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={completionEmailDialog.sendEmail}
                  onChange={(e) => setCompletionEmailDialog(prev => ({ ...prev, sendEmail: e.target.checked }))}
                  sx={{
                    color: '#b98f33',
                    '&.Mui-checked': {
                      color: '#b98f33',
                    },
                  }}
                />
              }
              label="Send completion email to customer"
              sx={{ 
                color: '#ffffff',
                mb: 1,
                '& .MuiFormControlLabel-label': {
                  fontWeight: 500
                }
              }}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={completionEmailDialog.includeReview}
                  onChange={(e) => setCompletionEmailDialog(prev => ({ ...prev, includeReview: e.target.checked }))}
                  sx={{
                    color: '#b98f33',
                    '&.Mui-checked': {
                      color: '#b98f33',
                    },
                  }}
                />
              }
              label="Include Google review request"
              sx={{ 
                color: '#ffffff',
                '& .MuiFormControlLabel-label': {
                  fontWeight: 500
                }
              }}
            />
            
            <Typography variant="body2" sx={{ 
              mt: 1, 
              color: '#cccccc', 
              fontStyle: 'italic',
              fontSize: '13px'
            }}>
              The email will include a warm thank you message, treatment care instructions, and a review request.
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCompletionEmailCancel}
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
            onClick={handleCompletionEmailConfirm}
            disabled={!completionEmailDialog.sendEmail || sendingCompletionEmail}
            variant="contained"
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#ffffff',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(145deg, #e5c070 0%, #c9a045 50%, #9d7a2f 100%)',
              },
              '&:disabled': {
                background: '#666666',
                color: '#999999'
              }
            }}
          >
            {sendingCompletionEmail ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Invoice Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            borderRadius: 2,
            border: '2px solid #ff4444',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: '#2a2a2a', 
          color: '#ffffff',
          borderBottom: '2px solid #ff4444',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DeleteIcon sx={{ color: '#ff4444' }} />
          Delete Invoice
        </DialogTitle>
        
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="error" sx={{ mb: 2, backgroundColor: '#2a2a2a', color: '#ff4444', border: '1px solid #ff4444' }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
              ⚠️ Warning: This action cannot be undone!
            </Typography>
            <Typography variant="body2">
              You are about to permanently delete this invoice. This will remove the invoice from the system completely.
            </Typography>
          </Alert>
          
          <Box sx={{ 
            p: 2, 
            backgroundColor: '#2a2a2a', 
            borderRadius: 1, 
            borderLeft: '4px solid #ff4444',
            mb: 2
          }}>
            <Typography variant="body2" sx={{ color: '#cccccc', mb: 1 }}>
              <strong>Invoice Number:</strong> {invoiceToDelete?.invoiceNumber || invoiceToDelete?.orderDetails?.billInvoice || invoiceToDelete?.id || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#cccccc', mb: 1 }}>
              <strong>Customer:</strong> {invoiceToDelete?.orderType === 'corporate' 
                ? (invoiceToDelete?.corporateCustomer?.corporateName || invoiceToDelete?.contactPerson?.name || 'N/A')
                : (invoiceToDelete?.personalInfo?.customerName || invoiceToDelete?.customerInfo?.customerName || 'N/A')}
            </Typography>
            <Typography variant="body2" sx={{ color: '#cccccc' }}>
              <strong>Type:</strong> {invoiceToDelete?.source === 'customer-invoices' ? 'Customer Invoice (T-Invoice)' 
                : invoiceToDelete?.orderType === 'corporate' ? 'Corporate Order' 
                : 'Individual Order'}
            </Typography>
          </Box>
          
          <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
            Are you sure you want to delete this invoice permanently?
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
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
            onClick={handleDeleteInvoice}
            disabled={deleting}
            variant="contained"
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            sx={{
              backgroundColor: '#ff4444',
              color: '#ffffff',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: '#ff6666',
              },
              '&:disabled': {
                backgroundColor: '#666666',
                color: '#999999'
              }
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Customer Invoice Preview Component (same as PrintInvoicePage)
const CustomerInvoicePreviewContent = ({ invoiceData, onClose, showSuccess, showError }) => {
  const invoiceRef = React.useRef(null);

  // Calculate paid amount
  const getPaidAmount = (invoice) => {
    return invoice.paidAmount || invoice.calculations?.paidAmount || 0;
  };

  // Calculate balance
  const calculateBalance = (invoice) => {
    const total = invoice.calculations?.total || 0;
    const paid = getPaidAmount(invoice);
    return total - paid;
  };

  // Company information
  const companyInfo = {
    name: 'JL Operations',
    logo: 'JL',
    tagline: 'Upholstery',
    fullName: 'JLUPHOLSTERY',
    address: '322 Etheridge ave, Milton, ON CANADA L9E 1H7',
    phone: '(555) 123-4567',
    email: 'JL@JLupholstery.com',
    website: 'JLUPHOLSTERY.COM',
    taxNumber: '798633319-RT0001'
  };

  // Handle print
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      showError('Unable to open print window. Pop-up might be blocked.');
      return;
    }

    // Get the invoice content HTML
    const invoiceContent = invoiceRef.current.innerHTML;
    const printStyles = `
      <style>
        @page { margin: 0.5in; size: letter; }
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #f5f5f5; padding: 8px; border: 1px solid #ddd; }
        td { padding: 8px; border: 1px solid #ddd; }
      </style>
    `;
    
    printWindow.document.write(printStyles + invoiceContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Handle save as PDF
  const handleSaveAsPDF = async () => {
    if (!invoiceRef.current) {
      showError('Invoice content not found');
      return;
    }

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF('p', 'mm', 'letter');
      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const margin = 12.7;
      const contentWidth = pageWidth - (margin * 2);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      const fileName = `Invoice ${formatCorporateInvoiceForInvoice(invoiceData.invoiceNumber) || 'N/A'}.pdf`;
      pdf.save(fileName);
      showSuccess('PDF saved successfully!');
    } catch (error) {
      showError('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Action Buttons */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: 2,
        mb: 2,
        px: 2
      }}>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          sx={{ backgroundColor: '#b98f33', '&:hover': { backgroundColor: '#a67d2a' } }}
        >
          Print Invoice
        </Button>
        <Button
          variant="contained"
          startIcon={<PdfIcon />}
          onClick={handleSaveAsPDF}
          sx={{ 
            backgroundColor: '#dc3545', 
            '&:hover': { backgroundColor: '#c82333' } 
          }}
        >
          Save as PDF
        </Button>
      </Box>

      {/* Invoice Content */}
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        <Paper 
          ref={invoiceRef}
          elevation={3} 
          sx={{ 
            p: 4, 
            width: '100%',
            mx: 'auto',
            backgroundColor: 'white',
            maxWidth: '8.5in'
          }}
        >
          {/* Invoice Header Image */}
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img 
              src="/assets/images/invoice-headers/Invoice Header.png" 
              alt="Invoice Header" 
              style={{ 
                width: '100%',
                height: 'auto',
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </Box>

          {/* Invoice Information Row */}
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Left Side - Customer Information */}
            <Box sx={{ flex: 1, mr: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'black', mb: 2 }}>
                Invoice to:
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: 'black' }}>
                {invoiceData.customerInfo?.customerName || 'N/A'}
              </Typography>
              {invoiceData.customerInfo?.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <PhoneIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                  <Typography variant="body1" sx={{ color: 'black' }}>
                    {invoiceData.customerInfo.phone}
                  </Typography>
                </Box>
              )}
              {invoiceData.customerInfo?.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <EmailIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                  <Typography variant="body1" sx={{ color: 'black' }}>
                    {invoiceData.customerInfo.email}
                  </Typography>
                </Box>
              )}
              {invoiceData.customerInfo?.address && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                  <LocationIcon sx={{ mr: 1, fontSize: '16px', color: '#666666', mt: 0.2 }} />
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-line', color: 'black' }}>
                    {invoiceData.customerInfo.address}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Right Side - Invoice Details */}
            <Box sx={{ minWidth: '250px', flexShrink: 0 }}>
              <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                <strong>Date:</strong> {formatDateOnly(invoiceData.createdAt)}
              </Typography>
              <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                <strong>Invoice #</strong> {formatCorporateInvoiceForInvoice(invoiceData.invoiceNumber)}
              </Typography>
              <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                <strong>Tax #</strong> {companyInfo.taxNumber}
              </Typography>
            </Box>
          </Box>

          {/* Items Table */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ border: '2px solid #333333', borderRadius: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ width: '66.67%', padding: '8px 16px', textAlign: 'left', fontWeight: 'bold', color: '#333333', backgroundColor: '#f5f5f5', border: 'none', borderBottom: '2px solid #333333', borderRight: '1px solid #ddd', fontSize: '14px', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', fontWeight: 'bold', color: '#333333', backgroundColor: '#f5f5f5', border: 'none', borderBottom: '2px solid #333333', borderRight: '1px solid #ddd', fontSize: '14px', textTransform: 'uppercase' }}>Price</th>
                    <th style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', fontWeight: 'bold', color: '#333333', backgroundColor: '#f5f5f5', border: 'none', borderBottom: '2px solid #333333', borderRight: '1px solid #ddd', fontSize: '14px', textTransform: 'uppercase' }}>Unit</th>
                    <th style={{ width: '11.11%', padding: '8px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333333', backgroundColor: '#f5f5f5', border: 'none', borderBottom: '2px solid #333333', fontSize: '14px', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const furnitureGroups = invoiceData.furnitureGroups || [];
                    const items = invoiceData.items || [];
                    const rows = [];
                    
                    if (furnitureGroups.length === 0 && items.length === 0) {
                      rows.push(
                        <tr key="no-items">
                          <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#666666', fontStyle: 'italic', border: 'none' }}>
                            No items found
                          </td>
                        </tr>
                      );
                    } else {
                      const itemsByGroup = {};
                      items.forEach(item => {
                        const match = item.id?.match(/item-(\d+)-/);
                        const groupIndex = match ? parseInt(match[1]) : -1;
                        if (groupIndex >= 0) {
                          if (!itemsByGroup[groupIndex]) {
                            itemsByGroup[groupIndex] = [];
                          }
                          itemsByGroup[groupIndex].push(item);
                        } else {
                          // Ungrouped items go to index -1
                          if (!itemsByGroup[-1]) {
                            itemsByGroup[-1] = [];
                          }
                          itemsByGroup[-1].push(item);
                        }
                      });
                      
                      // If we have furnitureGroups, display them with their items
                      if (furnitureGroups.length > 0) {
                        furnitureGroups.forEach((group, groupIndex) => {
                          const groupName = group.name || group.furnitureType || `Furniture Group ${groupIndex + 1}`;
                          rows.push(
                            <tr key={`group-${groupIndex}`} style={{ backgroundColor: '#f8f9fa' }}>
                              <td colSpan="4" style={{ padding: '10px 16px', fontWeight: 'bold', color: '#274290', border: 'none', borderBottom: '1px solid #ddd', fontSize: '14px', textTransform: 'uppercase' }}>
                                {groupName}
                              </td>
                            </tr>
                          );
                          
                          const groupItems = itemsByGroup[groupIndex] || [];
                          
                          // If no items found for this group, try to display from furnitureGroup directly (for corporate invoices)
                          if (groupItems.length === 0 && (group.materialPrice || group.labourPrice || group.foamPrice || group.paintingLabour)) {
                            // Material
                            if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
                              const materialName = group.materialCode 
                                ? `${group.materialCompany || 'Material'} - ${group.materialCode}`
                                : (group.materialCompany || 'Material');
                              rows.push(
                                <tr key={`material-${groupIndex}`} style={{ borderBottom: '1px solid #ddd' }}>
                                  <td style={{ width: '66.67%', padding: '8px 16px', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px' }}>
                                    {materialName}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    ${parseFloat(group.materialPrice || 0).toFixed(2)}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    {group.materialQnty || group.materialQuantity || 1}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333333', border: 'none', fontSize: '14px' }}>
                                    ${((parseFloat(group.materialPrice || 0) * parseFloat(group.materialQnty || group.materialQuantity || 1))).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            }
                            
                            // Labour
                            if (group.labourPrice && parseFloat(group.labourPrice) > 0) {
                              const labourName = group.labourNote ? `Labour Work - ${group.labourNote}` : 'Labour Work';
                              rows.push(
                                <tr key={`labour-${groupIndex}`} style={{ borderBottom: '1px solid #ddd' }}>
                                  <td style={{ width: '66.67%', padding: '8px 16px', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px' }}>
                                    {labourName}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    ${parseFloat(group.labourPrice || 0).toFixed(2)}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    {group.labourQnty || group.labourQuantity || 1}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333333', border: 'none', fontSize: '14px' }}>
                                    ${((parseFloat(group.labourPrice || 0) * parseFloat(group.labourQnty || group.labourQuantity || 1))).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            }
                            
                            // Foam
                            if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
                              const foamName = group.foamNote ? `Foam - ${group.foamNote}` : 'Foam';
                              rows.push(
                                <tr key={`foam-${groupIndex}`} style={{ borderBottom: '1px solid #ddd' }}>
                                  <td style={{ width: '66.67%', padding: '8px 16px', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px' }}>
                                    {foamName}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    ${parseFloat(group.foamPrice || 0).toFixed(2)}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    {group.foamQnty || group.foamQuantity || 1}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333333', border: 'none', fontSize: '14px' }}>
                                    ${((parseFloat(group.foamPrice || 0) * parseFloat(group.foamQnty || group.foamQuantity || 1))).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            }
                            
                            // Painting
                            if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
                              const paintingName = group.paintingNote ? `Painting - ${group.paintingNote}` : 'Painting';
                              rows.push(
                                <tr key={`painting-${groupIndex}`} style={{ borderBottom: '1px solid #ddd' }}>
                                  <td style={{ width: '66.67%', padding: '8px 16px', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px' }}>
                                    {paintingName}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    ${parseFloat(group.paintingLabour || 0).toFixed(2)}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    {group.paintingQnty || group.paintingQuantity || 1}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333333', border: 'none', fontSize: '14px' }}>
                                    ${((parseFloat(group.paintingLabour || 0) * parseFloat(group.paintingQnty || group.paintingQuantity || 1))).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            }
                          } else {
                            // Display items from items array
                            groupItems.forEach((item, itemIndex) => {
                              rows.push(
                                <tr key={item.id || `item-${groupIndex}-${itemIndex}`} style={{ borderBottom: '1px solid #ddd' }}>
                                  <td style={{ width: '66.67%', padding: '8px 16px', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px' }}>
                                    {item.name}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    ${parseFloat(item.price || 0).toFixed(2)}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                    {item.quantity || 0}
                                  </td>
                                  <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333333', border: 'none', fontSize: '14px' }}>
                                    ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            });
                          }
                        });
                      }
                      
                      // Display ungrouped items (items with groupIndex -1 or no match)
                      if (itemsByGroup[-1] && itemsByGroup[-1].length > 0) {
                        itemsByGroup[-1].forEach((item, itemIndex) => {
                          rows.push(
                            <tr key={item.id || `ungrouped-${itemIndex}`} style={{ borderBottom: '1px solid #ddd' }}>
                              <td style={{ width: '66.67%', padding: '8px 16px', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px' }}>
                                {item.name}
                              </td>
                              <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                ${parseFloat(item.price || 0).toFixed(2)}
                              </td>
                              <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'center', color: '#333333', border: 'none', borderRight: '1px solid #eee', fontSize: '14px', fontWeight: '500' }}>
                                {item.quantity || 0}
                              </td>
                              <td style={{ width: '11.11%', padding: '8px 16px', textAlign: 'right', fontWeight: 'bold', color: '#333333', border: 'none', fontSize: '14px' }}>
                                ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                              </td>
                            </tr>
                          );
                        });
                      }
                    }
                    return rows;
                  })()}
                </tbody>
              </table>
            </Box>
            
            {/* Terms and Totals Section */}
            <Box sx={{ mt: 1, display: 'flex', width: '100%', gap: 4 }}>
              {/* Left Side - Terms */}
              <Box sx={{ flex: '0 0 50%', maxWidth: '50%' }}>
                <Box sx={{ backgroundColor: '#cc820d', color: 'white', p: 1, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white', textAlign: 'center', textTransform: 'uppercase' }}>
                    Terms and Conditions
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                      Payment by Cheque: <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666' }}>(for corporates only)</span>
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'black' }}>
                      Mail to: {companyInfo.address}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                      Payment by direct deposit:
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'black' }}>
                      Transit Number: 07232
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'black' }}>
                      Institution Number: 010
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'black' }}>
                      Account Number: 1090712
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                      Payment by e-transfer:
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'black' }}>
                      {companyInfo.email}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Right Side - Totals */}
              <Box sx={{ flex: '1', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: '300px', maxWidth: '400px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ color: 'black' }}>Subtotal:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                      ${invoiceData.calculations?.subtotal?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ color: 'black' }}>Tax Rate:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                      {(invoiceData.headerSettings?.taxPercentage || 0)}%
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ color: 'black' }}>Tax Due:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                      ${invoiceData.calculations?.taxAmount?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  {invoiceData.headerSettings?.creditCardFeeEnabled && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1" sx={{ color: 'black' }}>Credit Card Fee:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                        ${invoiceData.calculations?.creditCardFeeAmount?.toFixed(2) || '0.00'}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, backgroundColor: '#4CAF50', color: 'white', p: 1, borderRadius: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>Paid:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                      ${getPaidAmount(invoiceData).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, backgroundColor: calculateBalance(invoiceData) >= 0 ? '#cc820d' : '#4CAF50', color: 'white', p: 1, borderRadius: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>Balance:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                      ${calculateBalance(invoiceData).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#2c2c2c', color: 'white', p: 1, borderRadius: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>Total:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                      ${invoiceData.calculations?.total?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Signature Section */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', mt: 4, mb: 4 }}>
            <Box sx={{ textAlign: 'center', minWidth: 300, mr: 8 }}>
              <Typography variant="body2" sx={{ color: 'black', mb: 2 }}>
                Signature
              </Typography>
              <Box sx={{ width: 250, height: 1, backgroundColor: 'black', mb: 1, margin: '0 auto' }} />
              <Typography variant="h6" sx={{ color: 'black', fontFamily: '"Brush Script MT", "Lucida Handwriting", "Kalam", cursive', fontSize: '1.5rem', fontWeight: 'normal', textAlign: 'center' }}>
                Ahmed Albaghdadi
              </Typography>
            </Box>
          </Box>

          {/* Invoice Footer Image */}
          <Box sx={{ mt: 6, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img 
              src="/assets/images/invoice-headers/invoice Footer.png" 
              alt="Invoice Footer" 
              style={{ 
                width: '100%',
                height: 'auto',
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default EndDonePage; 
