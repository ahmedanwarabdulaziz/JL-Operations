/**
 * Allocation utilities for migration and normalization
 * Handles conversion between old and new allocation formats
 */

/**
 * Convert Firestore Timestamp to ISO string
 */
const timestampToISO = (timestamp) => {
  if (!timestamp) return new Date().toISOString();
  
  // If it's already a Firestore Timestamp object
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  
  // If it has seconds property (Firestore Timestamp)
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  
  // If it's already a string
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  
  // If it's a Date object
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  // Default: return current date
  return new Date().toISOString();
};

/**
 * Extract month and year from allocation item
 * Handles both old and new formats
 */
const extractMonthYear = (allocation) => {
  // New format: has month and year directly
  if (allocation.month !== undefined && allocation.year !== undefined) {
    // Ensure month is 1-indexed (1-12)
    let month = Number(allocation.month);
    let year = Number(allocation.year);
    
    // Validate values are numbers
    if (isNaN(month) || isNaN(year)) {
      console.warn('Invalid month/year (NaN):', { month: allocation.month, year: allocation.year });
      return null;
    }
    
    // If month is 0-11 (0-indexed), convert to 1-indexed
    if (month >= 0 && month <= 11 && month !== 12) {
      month = month + 1;
    }
    
    // Final validation
    if (month < 1 || month > 12 || year <= 0 || !Number.isFinite(month) || !Number.isFinite(year)) {
      console.warn('Invalid month/year range:', { month, year, original: { month: allocation.month, year: allocation.year } });
      return null;
    }
    
    return {
      month: month,
      year: year
    };
  }
  
  // Old format: extract from monthKey (e.g., "2024-01" or "2024-1")
  if (allocation.monthKey) {
    const parts = allocation.monthKey.split('-');
    if (parts.length >= 2) {
      let month = parseInt(parts[1], 10);
      const year = parseInt(parts[0], 10);
      
      // Validate parsed values
      if (isNaN(month) || isNaN(year)) {
        console.warn('Invalid month/year from monthKey (NaN):', allocation.monthKey);
        return null;
      }
      
      // monthKey format should be "YYYY-MM" where MM is 01-12 (1-indexed)
      // But check if it might be 0-indexed (00-11)
      // If month is 0, it's definitely 0-indexed (January in 0-indexed)
      // If month is 12, it's definitely 1-indexed (December in 1-indexed)
      // Otherwise, assume it's 1-indexed if it's 1-12, or convert if 0-11
      if (month === 0) {
        month = 1; // Convert 0-indexed January to 1-indexed
      } else if (month >= 1 && month <= 12) {
        // Already 1-indexed, keep as is
      } else if (month > 12) {
        // Invalid
        console.warn(`Invalid month in monthKey: ${allocation.monthKey}, month parsed as: ${month}`);
        return null;
      }
      
      // Final validation
      if (month < 1 || month > 12 || year <= 0 || !Number.isFinite(month) || !Number.isFinite(year)) {
        console.warn('Invalid month/year range from monthKey:', { month, year, monthKey: allocation.monthKey });
        return null;
      }
      
      return {
        month: month,
        year: year
      };
    }
  }
  
  return null;
};

/**
 * Normalize allocation item to new format
 */
const normalizeAllocationItem = (allocation, totalRevenue, totalCost, totalProfit) => {
  const monthYear = extractMonthYear(allocation);
  if (!monthYear) {
    console.warn('Could not extract month/year from allocation:', allocation);
    return null;
  }
  
  // Calculate values if not present (for old format)
  let revenue = allocation.revenue;
  let cost = allocation.cost;
  let profit = allocation.profit;
  
  // If values are missing, calculate from percentage
  if (revenue === undefined && totalRevenue !== undefined && allocation.percentage !== undefined) {
    revenue = totalRevenue * (allocation.percentage / 100);
  }
  if (cost === undefined && totalCost !== undefined && allocation.percentage !== undefined) {
    cost = totalCost * (allocation.percentage / 100);
  }
  if (profit === undefined && revenue !== undefined && cost !== undefined) {
    profit = revenue - cost;
  }
  
  return {
    month: monthYear.month,
    year: monthYear.year,
    percentage: allocation.percentage || 0,
    revenue: revenue || 0,
    cost: cost || 0,
    profit: profit || 0
  };
};

/**
 * Migrate old allocation format to new simplified format
 * @param {Object} oldAllocation - Old allocation object
 * @param {Object} profitData - Order profit data { revenue, cost, profit }
 * @returns {Object} New allocation format
 */
export const migrateAllocation = (oldAllocation, profitData = {}) => {
  if (!oldAllocation || !oldAllocation.allocations) {
    return null;
  }
  
  const totalRevenue = profitData.revenue || oldAllocation.originalRevenue || 0;
  const totalCost = profitData.cost || oldAllocation.originalCost || 0;
  const totalProfit = profitData.profit || oldAllocation.originalProfit || (totalRevenue - totalCost);
  
  // Normalize allocations array
  const normalizedAllocations = oldAllocation.allocations
    .map(alloc => normalizeAllocationItem(alloc, totalRevenue, totalCost, totalProfit))
    .filter(alloc => alloc !== null);
  
  // Get appliedAt - convert from timestamp if needed
  const appliedAt = timestampToISO(oldAllocation.appliedAt);
  
  return {
    allocations: normalizedAllocations,
    appliedAt: appliedAt
  };
};

/**
 * Check if allocation is in old format
 */
export const isOldAllocationFormat = (allocation) => {
  if (!allocation) return false;
  
  // Old format indicators:
  // - Has dateRange
  // - Has method
  // - Has originalRevenue/originalCost/originalProfit
  // - Has recalculatedAt or calculatedAt
  // - appliedAt is a Firestore Timestamp (has .seconds)
  return !!(
    allocation.dateRange ||
    allocation.method ||
    allocation.originalRevenue !== undefined ||
    allocation.originalCost !== undefined ||
    allocation.originalProfit !== undefined ||
    allocation.recalculatedAt ||
    allocation.calculatedAt ||
    (allocation.appliedAt && (allocation.appliedAt.seconds !== undefined || typeof allocation.appliedAt.toDate === 'function'))
  );
};

/**
 * Normalize allocation to new format (handles both old and new)
 */
export const normalizeAllocation = (allocation, profitData = {}) => {
  if (!allocation) return null;
  
  const totalRevenue = profitData.revenue || allocation.originalRevenue || 0;
  const totalCost = profitData.cost || allocation.originalCost || 0;
  const totalProfit = profitData.profit || allocation.originalProfit || (totalRevenue - totalCost);
  
  // Normalize all allocation items to ensure they have month/year
  const normalizedAllocations = (allocation.allocations || [])
    .map(alloc => {
      // Always use extractMonthYear to ensure consistent format
      // This handles cases where month/year might be missing or in wrong format
      const monthYear = extractMonthYear(alloc);
      
      if (!monthYear) {
        console.warn('Could not extract month/year from allocation item:', alloc);
        return null;
      }
      
      // Use extracted month/year, ensuring they're correct and valid numbers
      let month = Number(monthYear.month);
      let year = Number(monthYear.year);
      
      // Validate month and year are valid numbers
      if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year <= 0 || !Number.isFinite(month) || !Number.isFinite(year)) {
        console.warn('Invalid month/year after extraction:', { month: monthYear.month, year: monthYear.year, allocation: alloc });
        return null;
      }
      
      // Calculate values if not present
      const revenue = alloc.revenue !== undefined 
        ? alloc.revenue 
        : totalRevenue * ((alloc.percentage || 0) / 100);
      const cost = alloc.cost !== undefined 
        ? alloc.cost 
        : totalCost * ((alloc.percentage || 0) / 100);
      const profit = alloc.profit !== undefined 
        ? alloc.profit 
        : revenue - cost;
      
      return {
        month: month,
        year: year,
        percentage: alloc.percentage || 0,
        revenue: revenue,
        cost: cost,
        profit: profit
      };
    })
    .filter(alloc => alloc !== null);
  
  // Get appliedAt - convert from timestamp if needed
  const appliedAt = typeof allocation.appliedAt === 'string' 
    ? allocation.appliedAt 
    : timestampToISO(allocation.appliedAt);
  
  return {
    allocations: normalizedAllocations,
    appliedAt: appliedAt
  };
};

/**
 * Create new allocation object
 * @param {Array} allocations - Array of { month, year, percentage }
 * @param {Object} profitData - { revenue, cost, profit }
 * @returns {Object} New allocation format
 */
export const createAllocation = (allocations, profitData) => {
  const totalRevenue = profitData.revenue || 0;
  const totalCost = profitData.cost || 0;
  const totalProfit = profitData.profit || (totalRevenue - totalCost);
  
  const normalizedAllocations = allocations.map(alloc => ({
    month: alloc.month,
    year: alloc.year,
    percentage: alloc.percentage,
    revenue: totalRevenue * (alloc.percentage / 100),
    cost: totalCost * (alloc.percentage / 100),
    profit: totalProfit * (alloc.percentage / 100)
  }));
  
  return {
    allocations: normalizedAllocations,
    appliedAt: new Date().toISOString()
  };
};

/**
 * Get monthKey from month and year
 */
export const getMonthKey = (month, year) => {
  return `${year}-${String(month).padStart(2, '0')}`;
};

/**
 * Extract monthKey from allocation item (for backward compatibility)
 */
export const getMonthKeyFromAllocation = (allocation) => {
  if (allocation.monthKey) return allocation.monthKey;
  if (allocation.month !== undefined && allocation.year !== undefined) {
    return getMonthKey(allocation.month, allocation.year);
  }
  return null;
};
