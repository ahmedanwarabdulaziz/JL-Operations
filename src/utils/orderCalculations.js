// Shared order calculation utilities to ensure consistency across all pages

/**
 * Calculate total order value including all components
 * Works with both old and new order structures
 */
export const calculateOrderTotal = (order) => {
  let total = 0;
  
  // Add furniture costs (supports both old and new field structures)
  if (order.furnitureData?.groups) {
    order.furnitureData.groups.forEach(group => {
      // Material costs
      total += (parseFloat(group.materialPrice) || 0) * (parseInt(group.materialQnty) || 0);
      
      // Labour costs  
      total += (parseFloat(group.labourPrice) || 0) * (parseInt(group.labourQnty) || 0);
      
      // Foam costs (if enabled)
      if (group.foamEnabled || group.foamPrice > 0) {
        total += (parseFloat(group.foamPrice) || 0) * (parseInt(group.foamQnty) || 0);
      }
      
      // Legacy support for old field names
      if (group.labourWork && !group.labourPrice) {
        total += (parseFloat(group.labourWork) || 0) * (parseInt(group.quantity) || 1);
      }
    });
  }

  // Add pickup & delivery cost
  if (order.paymentData?.pickupDeliveryEnabled) {
    total += parseFloat(order.paymentData.pickupDeliveryCost) || 0;
  }

  return total;
};

/**
 * Get detailed cost breakdown for display
 */
export const getOrderCostBreakdown = (order) => {
  const breakdown = {
    material: 0,
    labour: 0,
    foam: 0,
    pickupDelivery: 0,
    total: 0
  };

  if (order.furnitureData?.groups) {
    order.furnitureData.groups.forEach(group => {
      // Material costs
      breakdown.material += (parseFloat(group.materialPrice) || 0) * (parseInt(group.materialQnty) || 0);
      
      // Labour costs
      breakdown.labour += (parseFloat(group.labourPrice) || 0) * (parseInt(group.labourQnty) || 0);
      
      // Foam costs
      if (group.foamEnabled || group.foamPrice > 0) {
        breakdown.foam += (parseFloat(group.foamPrice) || 0) * (parseInt(group.foamQnty) || 0);
      }
      
      // Legacy support
      if (group.labourWork && !group.labourPrice) {
        breakdown.labour += (parseFloat(group.labourWork) || 0) * (parseInt(group.quantity) || 1);
      }
    });
  }

  // Pickup & delivery
  if (order.paymentData?.pickupDeliveryEnabled) {
    breakdown.pickupDelivery = parseFloat(order.paymentData.pickupDeliveryCost) || 0;
  }

  breakdown.total = breakdown.material + breakdown.labour + breakdown.foam + breakdown.pickupDelivery;
  
  return breakdown;
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
 */
export const getDepositStatus = (order) => {
  const total = calculateOrderTotal(order);
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