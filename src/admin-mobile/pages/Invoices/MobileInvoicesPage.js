import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  MenuItem,
  InputAdornment,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useInvoiceOrders } from '../../../shared/hooks/useInvoiceOrders';
import { calculateOrderTotal } from '../../../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../../shared/utils/materialTaxRates';
import { openInvoicePreview } from '../../../shared/utils/invoicePreview';

const normalizeSearchValue = (value) => (value ? value.toString().toLowerCase() : '');

const formatCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 'N/A';
  }

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const resolveFinancialStyles = (financialStatus) => {
  const normalized = (financialStatus || '').toLowerCase();

  if (normalized.includes('paid') && !normalized.includes('partial')) {
    return {
      bgcolor: 'rgba(76, 175, 80, 0.18)',
      color: '#4CAF50',
      borderColor: 'rgba(76, 175, 80, 0.5)'
    };
  }

  if (normalized.includes('partial')) {
    return {
      bgcolor: 'rgba(255, 152, 0, 0.22)',
      color: '#FF9800',
      borderColor: 'rgba(255, 152, 0, 0.45)'
    };
  }

  if (normalized.includes('not') || normalized.includes('due') || normalized.includes('pending')) {
    return {
      bgcolor: 'rgba(244, 67, 54, 0.2)',
      color: '#F44336',
      borderColor: 'rgba(244, 67, 54, 0.45)'
    };
  }

  if (normalized.includes('no deposit')) {
    return {
      bgcolor: 'rgba(158, 158, 158, 0.18)',
      color: '#BDBDBD',
      borderColor: 'rgba(158, 158, 158, 0.4)'
    };
  }

  return {
    bgcolor: 'rgba(185, 143, 51, 0.2)',
    color: '#b98f33',
    borderColor: 'rgba(185, 143, 51, 0.45)'
  };
};

const extractAmount = (...values) => {
  for (const raw of values) {
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const getFinancialStatus = (order) => {
  const explicit = order?.orderDetails?.financialStatus;
  if (explicit) {
    return explicit;
  }

  const deposit = extractAmount(order?.paymentData?.deposit, order?.paymentDetails?.deposit);
  const amountPaid = extractAmount(order?.paymentData?.amountPaid, order?.paymentDetails?.amountPaid);

  if (deposit <= 0) {
    return amountPaid > 0 ? 'Partial Payment' : 'No Deposit';
  }

  if (amountPaid >= deposit && deposit > 0) {
    return 'Deposit Paid';
  }

  if (amountPaid > 0 && amountPaid < deposit) {
    return 'Deposit Partially Paid';
  }

  return 'Deposit Not Paid';
};

const MobileInvoicesPage = () => {
  const { orders, loading, error, refresh } = useInvoiceOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [materialTaxRates, setMaterialTaxRates] = useState({});

  useEffect(() => {
    let isMounted = true;

    const loadTaxRates = async () => {
      try {
        const rates = await fetchMaterialCompanyTaxRates();
        if (isMounted) {
          setMaterialTaxRates(rates || {});
        }
      } catch (loadError) {
        console.error('Failed to load material tax rates:', loadError);
      }
    };

    loadTaxRates();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleStatusChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleInvoicePreview = (order) => {
    try {
      openInvoicePreview(order, { materialTaxRates });
    } catch (previewError) {
      console.error('Error opening invoice preview:', previewError);
    }
  };

  const statusFilters = useMemo(() => {
    const uniqueStatuses = new Set();

    orders.forEach((order) => {
      uniqueStatuses.add(order?.invoiceStatus || 'Pending');
    });

    return [
      { label: 'All', value: 'all' },
      ...Array.from(uniqueStatuses).map((status) => ({
        label: status,
        value: status
      }))
    ];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = normalizeSearchValue(searchTerm.trim());

    return orders.filter((order) => {
      const invoiceNumber = normalizeSearchValue(order?.orderDetails?.billInvoice);
      const customerName = normalizeSearchValue(order?.personalInfo?.customerName);
      const companyName = normalizeSearchValue(order?.personalInfo?.companyName || order?.personalInfo?.corporateName);
      const email = normalizeSearchValue(order?.personalInfo?.email);
      const phone = normalizeSearchValue(order?.personalInfo?.phone);
      const status = order?.invoiceStatus || 'Pending';

      const matchesSearch =
        !search ||
        invoiceNumber.includes(search) ||
        customerName.includes(search) ||
        companyName.includes(search) ||
        email.includes(search) ||
        phone.includes(search);

      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        p: 2,
        boxShadow: '0 12px 24px rgba(0, 0, 0, 0.4)',
        border: '1px solid #333333'
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography
          variant="h5"
          sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 600, color: '#b98f33' }}
        >
          Invoices
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'Source Sans Pro, sans-serif', color: 'text.secondary' }}
        >
          Manage customer invoices on the go.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search invoices, customers, or order numbers"
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#b98f33' }} />
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              fontFamily: 'Source Sans Pro, sans-serif',
              backgroundColor: '#2a2a2a',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              '& fieldset': {
                borderColor: '#333333'
              },
              '&:hover fieldset': {
                borderColor: '#b98f33'
              },
              '&.Mui-focused fieldset': {
                borderColor: '#b98f33',
                boxShadow: '0 0 0 1px rgba(185, 143, 51, 0.35)'
              }
            }
          }}
        />

        <FormControl
          size="small"
          sx={{
            minWidth: 150,
            '& .MuiInputLabel-root': {
              color: '#b98f33',
              fontFamily: 'Source Sans Pro, sans-serif'
            },
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#2a2a2a',
              borderRadius: 2,
              fontFamily: 'Source Sans Pro, sans-serif',
              '& fieldset': {
                borderColor: '#333333'
              },
              '&:hover fieldset': {
                borderColor: '#b98f33'
              },
              '&.Mui-focused fieldset': {
                borderColor: '#b98f33',
                boxShadow: '0 0 0 1px rgba(185, 143, 51, 0.35)'
              }
            },
            '& .MuiSelect-icon': {
              color: '#b98f33'
            }
          }}
        >
          <InputLabel id="mobile-invoice-status-filter-label">Status</InputLabel>
          <Select
            labelId="mobile-invoice-status-filter-label"
            value={statusFilter}
            label="Status"
            onChange={handleStatusChange}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2a2a2a',
                  color: '#ffffff'
                }
              }
            }}
          >
            {statusFilters.map(({ label, value }) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error.message || 'Something went wrong while loading invoices.'}
        </Alert>
      )}

      {!loading && !error && filteredOrders.length === 0 && (
        <Alert severity="info" icon={<InfoIcon />} sx={{ borderRadius: 2 }}>
          No invoices match your filters yet.
        </Alert>
      )}

      {!loading &&
        !error &&
        filteredOrders.map((order) => {
          const invoiceNumber = order?.orderDetails?.billInvoice || 'N/A';
          const customerLabel =
            order?.personalInfo?.customerName ||
            order?.personalInfo?.companyName ||
            order?.personalInfo?.corporateName ||
            'Unknown customer';
          const status = order?.invoiceStatus || 'Pending';
          const totalAmount = formatCurrency(calculateOrderTotal(order));
          const financialStatus = getFinancialStatus(order);
          const financialStyles = resolveFinancialStyles(financialStatus);

          return (
            <Card
              key={order.id}
              sx={{
                borderRadius: 3,
                border: '1px solid #333333',
                boxShadow: '0 10px 18px rgba(0, 0, 0, 0.45)',
                backgroundColor: '#2a2a2a'
              }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 2
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.4,
                    flex: '1 1 0'
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: 'Playfair Display, serif',
                      fontWeight: 700,
                      color: '#b98f33',
                      lineHeight: 1.1
                    }}
                  >
                    {invoiceNumber}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: 'Source Sans Pro, sans-serif',
                      fontWeight: 700,
                      color: '#b98f33',
                      lineHeight: 1.15
                    }}
                  >
                    {customerLabel}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: 'Source Sans Pro, sans-serif',
                      color: 'text.secondary',
                      fontWeight: 600,
                      lineHeight: 1.15
                    }}
                  >
                    {totalAmount}
                  </Typography>
                </Box>

                <Stack direction="column" spacing={0.6} alignItems="flex-end">
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'Source Sans Pro, sans-serif',
                      color: '#ffffff',
                      fontWeight: 600,
                      letterSpacing: '0.6px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {status || 'Unknown'}
                  </Typography>
                  <Chip
                    label={financialStatus}
                    sx={{
                      bgcolor: financialStyles.bgcolor,
                      color: financialStyles.color,
                      fontFamily: 'Source Sans Pro, sans-serif',
                      fontWeight: 600,
                      height: 24,
                      border: `1px solid ${financialStyles.borderColor || 'transparent'}`
                    }}
                  />
                  <Tooltip title="Preview invoice">
                    <IconButton
                      onClick={() => handleInvoicePreview(order)}
                      sx={{
                        bgcolor: '#f27921',
                        color: '#000000',
                        border: '2px solid rgba(0,0,0,0.35)',
                        boxShadow: '0 6px 12px rgba(0,0,0,0.45)',
                        '&:hover': {
                          bgcolor: '#d86612',
                          boxShadow: '0 8px 16px rgba(0,0,0,0.55)'
                        },
                        mt: 0.5
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
    </Box>
  );
};

export default MobileInvoicesPage;

