// Shared order calculation utilities to ensure consistency across all pages
import { getMaterialCompanyTaxRate } from './materialTaxRates';

/**
 * Calculate pickup & delivery cost based on service type
 */
export const calculatePickupDeliveryCost = (baseCost, serviceType) => {
  const cost = parseFloat(baseCost) || 0;
  let result;
  
  switch (serviceType) {
    case 'pickup':
    case 'delivery':
      result = cost; // Single service
      break;
    case 'both':
      result = cost * 2; // Both services
      break;
    default:
      result = cost;
  }
  

  
  return result;
};

/**
 * Ensure consistent payment data structure
 */
export const normalizePaymentData = (paymentData) => {
  return {
    deposit: parseFloat(paymentData?.deposit) || 0,
    amountPaid: parseFloat(paymentData?.amountPaid) || 0,
    pickupDeliveryEnabled: paymentData?.pickupDeliveryEnabled || false,
    pickupDeliveryCost: paymentData?.pickupDeliveryCost || '',
    pickupDeliveryServiceType: paymentData?.pickupDeliveryServiceType || 'both', // Default to both for backward compatibility
    notes: paymentData?.notes || '',
    paymentHistory: paymentData?.paymentHistory || [],
    customerNotes: paymentData?.customerNotes || '',
    generalNotes: paymentData?.generalNotes || ''
  };
};

/**
 * Validate payment data integrity
 */
export const validatePaymentData = (paymentData) => {
  const normalized = normalizePaymentData(paymentData);
  
  const errors = [];
  
  if (normalized.amountPaid < 0) {
    errors.push('Amount paid cannot be negative');
  }
  
  if (normalized.deposit < 0) {
    errors.push('Deposit amount cannot be negative');
  }
  
  if (normalized.pickupDeliveryCost && parseFloat(normalized.pickupDeliveryCost) < 0) {
    errors.push('Pickup/delivery cost cannot be negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized
  };
};

/**
 * Calculate total order value including tax (13% on materials and foam)
 * This is the customer-facing total that should match the invoice
 */
export const calculateOrderTotal = (order) => {
  let itemsSubtotal = 0;
  let taxableAmount = 0;
  
  // Add furniture costs (supports both old and new field structures)
  const furnitureGroups = order.furnitureData?.groups || order.furnitureGroups || [];
  if (furnitureGroups.length > 0) {
    furnitureGroups.forEach(group => {
      // Material costs
      const materialTotal = (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0);
      itemsSubtotal += materialTotal;
      taxableAmount += materialTotal; // Materials are taxable
      
      // Labour costs (not taxable)
      itemsSubtotal += (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 0);
      
      // Foam costs (if enabled) - taxable
      if (group.foamEnabled || group.foamPrice > 0) {
        const foamTotal = (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
        itemsSubtotal += foamTotal;
        taxableAmount += foamTotal; // Foam is taxable
      }
      
      // Painting costs (if enabled) - not taxable (labour)
      if (group.paintingEnabled || group.paintingLabour > 0) {
        const paintingTotal = (parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 0);
        itemsSubtotal += paintingTotal;
        // Painting is labour, so not taxable
      }
      
      // Legacy support for old field names
      if (group.labourWork && !group.labourPrice) {
        itemsSubtotal += (parseFloat(group.labourWork) || 0) * (parseInt(group.quantity) || 1);
      }
    });
  }

  // Calculate tax (13% on materials and foam)
  const taxAmount = taxableAmount * 0.13;
  
  // Add pickup & delivery cost (not taxable)
  if (order.paymentData?.pickupDeliveryEnabled) {
    const baseCost = parseFloat(order.paymentData.pickupDeliveryCost) || 0;
    const serviceType = order.paymentData.pickupDeliveryServiceType || 'both';
    const calculatedCost = calculatePickupDeliveryCost(baseCost, serviceType);
    

    
    itemsSubtotal += calculatedCost;
  }

  // Return total including tax
  return itemsSubtotal + taxAmount;
};

/**
 * Calculate total order value WITHOUT tax (for internal calculations)
 */
export const calculateOrderTotalWithoutTax = (order) => {
  let total = 0;
  
  // Add furniture costs (supports both old and new field structures)
  const furnitureGroups = order.furnitureData?.groups || order.furnitureGroups || [];
  if (furnitureGroups.length > 0) {
    furnitureGroups.forEach(group => {
      // Material costs
      total += (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0);
      
      // Labour costs  
      total += (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 0);
      
      // Foam costs (if enabled)
      if (group.foamEnabled || group.foamPrice > 0) {
        total += (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
      }
      
      // Painting costs (if enabled)
      if (group.paintingEnabled || group.paintingLabour > 0) {
        total += (parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 0);
      }
      
      // Legacy support for old field names
      if (group.labourWork && !group.labourPrice) {
        total += (parseFloat(group.labourWork) || 0) * (parseInt(group.quantity) || 1);
      }
    });
  }

  // Add pickup & delivery cost
  if (order.paymentData?.pickupDeliveryEnabled) {
    const baseCost = parseFloat(order.paymentData.pickupDeliveryCost) || 0;
    const serviceType = order.paymentData.pickupDeliveryServiceType || 'both';
    total += calculatePickupDeliveryCost(baseCost, serviceType);
  }

  return total;
};

/**
 * Calculate tax amount for an order
 */
export const calculateOrderTax = (order) => {
  let taxableAmount = 0;
  
  // Handle both regular orders (furnitureData.groups) and corporate orders (furnitureGroups)
  const furnitureGroups = order.furnitureData?.groups || order.furnitureGroups || [];
  
  furnitureGroups.forEach(group => {
      // Materials are taxable
      taxableAmount += (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0);
      
      // Foam is taxable
      if (group.foamEnabled || group.foamPrice > 0) {
        taxableAmount += (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
      }
    });
  
  return taxableAmount * 0.13; // 13% tax rate - Note: This is customer-facing tax, not JL internal tax
};

/**
 * Get detailed cost breakdown for display
 */
export const getOrderCostBreakdown = (order) => {
  const breakdown = {
    material: 0,
    labour: 0,
    foam: 0,
    painting: 0,
    pickupDelivery: 0,
    total: 0
  };

  // Handle both regular orders (furnitureData.groups) and corporate orders (furnitureGroups)
  const furnitureGroups = order.furnitureData?.groups || order.furnitureGroups || [];
  
  furnitureGroups.forEach((group, groupIndex) => {
      // Material costs
      const materialPrice = parseFloat(group.materialPrice) || 0;
      const materialQnty = parseFloat(group.materialQnty) || 0;
      const materialTotal = materialPrice * materialQnty;
      breakdown.material += materialTotal;
      
      
      // Labour costs
      breakdown.labour += (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 0);
      
      // Foam costs
      if (group.foamEnabled || group.foamPrice > 0) {
        breakdown.foam += (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
      }
      
      // Painting costs
      if (group.paintingEnabled || group.paintingLabour > 0) {
        breakdown.painting += (parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 0);
      }
      
      // Legacy support
      if (group.labourWork && !group.labourPrice) {
        breakdown.labour += (parseFloat(group.labourWork) || 0) * (parseInt(group.quantity) || 1);
      }
    });

  // Pickup & delivery - handle both regular and corporate orders
  const paymentData = order.orderType === 'corporate' ? order.paymentDetails : order.paymentData;
  if (paymentData?.pickupDeliveryEnabled) {
    const baseCost = parseFloat(paymentData.pickupDeliveryCost) || 0;
    const serviceType = paymentData.pickupDeliveryServiceType || 'both';
    breakdown.pickupDelivery = calculatePickupDeliveryCost(baseCost, serviceType);
  }

  breakdown.total = breakdown.material + breakdown.labour + breakdown.foam + breakdown.painting + breakdown.pickupDelivery;
  
  return breakdown;
};

/**
 * Calculate JL internal costs (actual costs to the business)
 */
export const calculateOrderCost = (order, materialTaxRates = {}) => {
  let totalCost = 0;

  const furnitureGroups = order.furnitureData?.groups || order.furnitureGroups || [];
  if (furnitureGroups.length > 0) {
    furnitureGroups.forEach(group => {
      // JL Material costs with tax
      const jlMaterialPrice = parseFloat(group.materialJLPrice) || 0;
      const jlMaterialQnty = parseFloat(group.materialJLQnty) || 0;
      const jlMaterialSubtotal = jlMaterialPrice * jlMaterialQnty;
      
      // Get tax rate from material company settings
      const taxRate = getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates);
      
      const materialTax = jlMaterialSubtotal * taxRate;
      const materialTotal = jlMaterialSubtotal + materialTax;
      totalCost += materialTotal;

      // JL Foam costs (no tax)
      const jlFoamPrice = parseFloat(group.foamJLPrice) || 0;
      const foamQnty = parseFloat(group.foamQnty) || 1;
      totalCost += jlFoamPrice * foamQnty;

      // Other expenses (no tax)
      totalCost += parseFloat(group.otherExpenses) || 0;

      // Shipping costs (no tax)
      totalCost += parseFloat(group.shipping) || 0;
    });
  }

  // Add extra expenses
  if (order.extraExpenses && Array.isArray(order.extraExpenses)) {
    const extraExpensesTotal = order.extraExpenses.reduce((sum, exp) => {
      return sum + (parseFloat(exp.total) || 0);
    }, 0);
    totalCost += extraExpensesTotal;
  }

  return totalCost;
};

/**
 * Calculate profit and profit percentage
 * Revenue includes tax (customer-facing total)
 * Cost includes tax (internal JL costs with tax)
 */
export const calculateOrderProfit = (order, materialTaxRates = {}) => {
  const revenue = calculateOrderTotal(order); // Includes tax
  const cost = calculateOrderCost(order, materialTaxRates); // Includes tax with dynamic tax rates
  const profit = revenue - cost;
  const profitPercentage = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    revenue,
    cost,
    profit,
    profitPercentage
  };
};

/**
 * Format furniture details for display across all pages
 */
export const formatFurnitureDetails = (furnitureGroup) => {
  const details = [];
  
  if (furnitureGroup.furnitureType) {
    details.push(`Type: ${furnitureGroup.furnitureType}`);
  }
  
  if (furnitureGroup.materialCompany) {
    details.push(`Material: ${furnitureGroup.materialCompany}`);
  }
  
  if (furnitureGroup.materialCode) {
    details.push(`Code: ${furnitureGroup.materialCode}`);
  }
  
  // Material details
  if (furnitureGroup.materialQnty && furnitureGroup.materialPrice) {
    details.push(`Material: ${furnitureGroup.materialQnty} × $${furnitureGroup.materialPrice}`);
  }
  
  // Labour details
  if (furnitureGroup.labourQnty && furnitureGroup.labourPrice) {
    details.push(`Labour: ${furnitureGroup.labourQnty} × $${furnitureGroup.labourPrice}`);
  }
  
  // Foam details
  if (furnitureGroup.foamQnty && furnitureGroup.foamPrice) {
    details.push(`Foam: ${furnitureGroup.foamQnty} × $${furnitureGroup.foamPrice}`);
  }
  
  // Legacy support
  if (furnitureGroup.quantity && furnitureGroup.labourWork && !furnitureGroup.labourPrice) {
    details.push(`Qty: ${furnitureGroup.quantity}, Labour: $${furnitureGroup.labourWork}`);
  }
  
  if (furnitureGroup.labourNote) {
    details.push(`Note: ${furnitureGroup.labourNote}`);
  }
  
  return details.length > 0 ? details.join(' | ') : 'No details available';
};

/**
 * Check if order was created with fast order feature
 */
export const isRapidOrder = (order) => {
  return order.isRapidOrder === true;
};

/**
 * Get order status with proper formatting
 */
export const getOrderStatus = (order) => {
  return order.status || 'pending';
};

/**
 * Calculate deposit status
 * Uses tax-inclusive total for accurate payment tracking
 */
export const getDepositStatus = (order) => {
  const total = calculateOrderTotal(order); // Includes tax
  const deposit = parseFloat(order.paymentData?.deposit) || 0;
  const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
  
  return {
    total,
    deposit,
    amountPaid,
    remaining: total - amountPaid,
    isDepositPaid: amountPaid >= deposit,
    isFullyPaid: amountPaid >= total
  };
}; 