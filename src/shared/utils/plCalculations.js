// P&L calculation utilities
import { calculateOrderProfit } from './orderCalculations';

/**
 * Calculate time-based allocation for cross-month orders
 */
export const calculateTimeBasedAllocation = (order) => {
  const startDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
  const endDate = order.statusUpdatedAt?.toDate ? order.statusUpdatedAt.toDate() : startDate;
  
  const allocations = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    
    let daysInThisMonth = 0;
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    if (currentDate >= monthStart && currentDate <= monthEnd) {
      const periodStart = new Date(Math.max(currentDate, monthStart));
      const periodEnd = new Date(Math.min(end, monthEnd));
      daysInThisMonth = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    if (daysInThisMonth > 0) {
      const totalDays = Math.ceil((end - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const percentage = daysInThisMonth / totalDays;
      
      allocations.push({
        monthKey,
        percentage: percentage * 100,
        days: daysInThisMonth,
        totalDays
      });
    }
    
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }
  
  return allocations;
};

/**
 * Process orders for P&L data structure
 */
export const processOrdersForPL = (orders, materialTaxRates = {}) => {
  const monthlyData = {};
  const quarterlyData = {};
  const yearlyData = {};
  const crossMonthOrders = [];

  orders.forEach(order => {
    const profitData = calculateOrderProfit(order, materialTaxRates);
    
    // Use allocation dates if available, otherwise fall back to created/status dates
    let startDate, endDate;
    
    if (order.allocation?.dateRange?.startDate && order.allocation?.dateRange?.endDate) {
      startDate = order.allocation.dateRange.startDate.toDate ? 
        order.allocation.dateRange.startDate.toDate() : 
        new Date(order.allocation.dateRange.startDate);
      endDate = order.allocation.dateRange.endDate.toDate ? 
        order.allocation.dateRange.endDate.toDate() : 
        new Date(order.allocation.dateRange.endDate);
    } else {
      startDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      endDate = order.statusUpdatedAt?.toDate ? order.statusUpdatedAt.toDate() : startDate;
    }
    
    // Check if order spans multiple months OR has manual allocation
    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();
    const endMonth = endDate.getMonth();
    const endYear = endDate.getFullYear();
    
    const isCrossMonth = (startYear !== endYear) || (startMonth !== endMonth);
    const hasManualAllocation = order.allocation?.method === 'manual' && order.allocation?.allocations;
    
    console.log(`Order ${order.id}:`, {
      isCrossMonth,
      hasManualAllocation,
      allocation: order.allocation,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    if (isCrossMonth || hasManualAllocation) {
      crossMonthOrders.push({
        ...order,
        startDate,
        endDate,
        profitData,
        allocation: order.allocation || null
      });
    } else {
      // Single month order
      const monthKey = `${startYear}-${String(startMonth + 1).padStart(2, '0')}`;
      const quarterKey = `${startYear}-Q${Math.floor(startMonth / 3) + 1}`;
      const yearKey = `${startYear}`;
      
      addToPeriodData(monthlyData, monthKey, profitData);
      addToPeriodData(quarterlyData, quarterKey, profitData);
      addToPeriodData(yearlyData, yearKey, profitData);
    }
  });

  // Process cross-month orders with allocations
  console.log('Processing cross-month orders:', crossMonthOrders.length);
  crossMonthOrders.forEach(order => {
    console.log(`Processing order ${order.id} allocation:`, order.allocation);
    
    if (order.allocation && order.allocation.allocations) {
      console.log(`Order ${order.id} has ${order.allocation.allocations.length} allocations`);
      
      order.allocation.allocations.forEach(allocation => {
        const profitData = {
          revenue: order.profitData.revenue * (allocation.percentage / 100),
          cost: order.profitData.cost * (allocation.percentage / 100),
          profit: order.profitData.profit * (allocation.percentage / 100)
        };
        
        console.log(`Allocation for ${allocation.monthKey}:`, {
          percentage: allocation.percentage,
          revenue: profitData.revenue,
          cost: profitData.cost,
          profit: profitData.profit
        });
        
        addToPeriodData(monthlyData, allocation.monthKey, profitData);
        
        // Add to quarterly and yearly data
        const [year, month] = allocation.monthKey.split('-');
        const quarterKey = `${year}-Q${Math.floor((parseInt(month) - 1) / 3) + 1}`;
        const yearKey = year;
        
        addToPeriodData(quarterlyData, quarterKey, profitData);
        addToPeriodData(yearlyData, yearKey, profitData);
      });
    } else {
      console.log(`Order ${order.id} has no allocation data`);
    }
  });

  return {
    monthly: monthlyData,
    quarterly: quarterlyData,
    yearly: yearlyData,
    crossMonthOrders
  };
};

/**
 * Add profit data to period tracking
 */
export const addToPeriodData = (data, key, profitData) => {
  if (!data[key]) {
    data[key] = {
      revenue: 0,
      costs: 0,
      profit: 0,
      orderCount: 0,
      profitMargin: 0
    };
  }
  
  data[key].revenue += profitData.revenue;
  data[key].costs += profitData.cost;
  data[key].profit += profitData.profit;
  data[key].orderCount += 1;
  data[key].profitMargin = data[key].revenue > 0 ? (data[key].profit / data[key].revenue) * 100 : 0;
};

/**
 * Calculate trend analysis
 */
export const calculateTrends = (periodData, currentPeriod) => {
  const periods = Object.keys(periodData).sort();
  const currentIndex = periods.indexOf(currentPeriod);
  
  if (currentIndex <= 0) return null;
  
  const current = periodData[currentPeriod];
  const previous = periodData[periods[currentIndex - 1]];
  
  if (!current || !previous) return null;
  
  return {
    revenue: {
      change: current.revenue - previous.revenue,
      percentage: previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0
    },
    profit: {
      change: current.profit - previous.profit,
      percentage: previous.profit !== 0 ? ((current.profit - previous.profit) / Math.abs(previous.profit)) * 100 : 0
    },
    margin: {
      change: current.profitMargin - previous.profitMargin,
      percentage: previous.profitMargin !== 0 ? ((current.profitMargin - previous.profitMargin) / Math.abs(previous.profitMargin)) * 100 : 0
    }
  };
};

/**
 * Get period comparison data
 */
export const getPeriodComparison = (periodData, periodType, selectedYear, selectedMonth = null) => {
  const currentPeriod = periodType === 'monthly' 
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
    : periodType === 'quarterly'
    ? `${selectedYear}-Q${Math.floor(selectedMonth / 3) + 1}`
    : `${selectedYear}`;
  
  const current = periodData[periodType][currentPeriod];
  if (!current) return null;
  
  // Get previous period
  let previousPeriod;
  if (periodType === 'monthly') {
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    previousPeriod = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
  } else if (periodType === 'quarterly') {
    const prevQuarter = Math.floor(selectedMonth / 3) === 0 ? 3 : Math.floor(selectedMonth / 3);
    const prevYear = Math.floor(selectedMonth / 3) === 0 ? selectedYear - 1 : selectedYear;
    previousPeriod = `${prevYear}-Q${prevQuarter}`;
  } else {
    previousPeriod = `${selectedYear - 1}`;
  }
  
  const previous = periodData[periodType][previousPeriod];
  
  return {
    current,
    previous,
    trends: previous ? calculateTrends(periodData[periodType], currentPeriod) : null
  };
};

/**
 * Calculate year-to-date totals
 */
export const calculateYTD = (periodData, year) => {
  const ytd = {
    revenue: 0,
    costs: 0,
    profit: 0,
    orderCount: 0
  };
  
  Object.keys(periodData).forEach(periodKey => {
    if (periodKey.startsWith(`${year}-`)) {
      const period = periodData[periodKey];
      ytd.revenue += period.revenue;
      ytd.costs += period.costs;
      ytd.profit += period.profit;
      ytd.orderCount += period.orderCount;
    }
  });
  
  ytd.profitMargin = ytd.revenue > 0 ? (ytd.profit / ytd.revenue) * 100 : 0;
  
  return ytd;
};

/**
 * Format currency with proper precision
 */
export const formatCurrency = (amount) => {
  return `$${parseFloat(amount).toFixed(2)}`;
};

/**
 * Format percentage
 */
export const formatPercentage = (value) => {
  return `${parseFloat(value).toFixed(1)}%`;
};

/**
 * Get trend indicator
 */
export const getTrendIndicator = (current, previous) => {
  if (!previous || previous === 0) return 'neutral';
  return current > previous ? 'up' : current < previous ? 'down' : 'neutral';
};

/**
 * Calculate profit margin
 */
export const calculateProfitMargin = (revenue, profit) => {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
};

 