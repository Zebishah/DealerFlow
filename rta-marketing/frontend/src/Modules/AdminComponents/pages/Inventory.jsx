import { useState, useEffect, useMemo } from 'react';
import { parse } from 'csv-parse/browser/esm';
import { db } from '../../../config/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Paper,
    Button,
    Box,
    Typography,
    Grid,
    CircularProgress,
    Alert,
    TextField,
    TablePagination,
    Snackbar,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import { MdDownload, MdRefresh, MdVisibility } from 'react-icons/md';

const Inventory = () => {
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [csvData, setCsvData] = useState([]);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [loadingCsv, setLoadingCsv] = useState(false);
    const [triggeringJob, setTriggeringJob] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [openModal, setOpenModal] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState('');
    const apiUrl = import.meta.env.VITE_BLOCK_USER_API;

    // Fetch latest_inventory document
    useEffect(() => {
        setLoading(true);
        const logRef = doc(db, 'ftp_download_logs', 'latest_inventory');
        const unsubscribe = onSnapshot(
            logRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const logData = { id: docSnap.id, ...docSnap.data() };
                    setLog(logData);
                    loadCsvData(logData);
                } else {
                    setLog(null);
                    setCsvData([]);
                    setCsvHeaders([]);
                }
                setLoading(false);
            },
            (err) => {
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    //FORMAT NUMBERS IN CSV
    // Format numeric columns cleanly
    const formatValue = (header, value) => {
        if (value == null || value === '') return '-';

        // Columns you want to format to 2 decimals
        const numericFields = ['COSTS', 'PURCHASEPRICE', 'TOTALINVESTED'];

        if (numericFields.includes(header)) {
            const num = parseFloat(value);
            if (isNaN(num)) return value;
            return num.toFixed(2);
        }

        if (header === 'ODOMETER') {
            const num = parseFloat(value);
            if (isNaN(num)) return value;
            return num.toLocaleString();
        }

        return value;
    };

    // Load CSV data
    const loadCsvData = async (logData) => {
        if (!logData?.downloadUrl) return;

        setLoadingCsv(true);
        setError(null);

        try {
            const response = await fetch(logData.downloadUrl);
            if (!response.ok) throw new Error('Failed to fetch CSV');
            const text = await response.text();

            parse(text, { columns: true, skip_empty_lines: true, trim: true }, (err, records) => {
                if (err) throw new Error(`Failed to parse CSV: ${err.message}`);
                if (records && records.length > 0) {
                    setCsvHeaders(Object.keys(records[0]));
                    setCsvData(records);
                } else {
                    setCsvHeaders([]);
                    setCsvData([]);
                }
                setLoadingCsv(false);
            });
        } catch (err) {
            setError(err.message);
            setLoadingCsv(false);
        }
    };

    // Handle Download
    const handleDownload = () => {
        if (!log?.downloadUrl) return;
        const link = document.createElement('a');
        link.href = log.downloadUrl;
        link.download = log.fileName || 'inventory.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Handle Manual Trigger
    const handleManualTrigger = async () => {
        setTriggeringJob(true);
        setError(null);

        try {
            const response = await fetch(`${apiUrl}/trigger-ftp-download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: import.meta.env.VITE_APP_API_SECRET_TOKEN,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to trigger FTP download');
            }

            setSnackbar({
                open: true,
                message: data.message,
                severity: data.status === 'success' ? 'success' : 'error',
            });
            setTriggeringJob(false);
        } catch (err) {
            setError(err.message);
            setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
            setTriggeringJob(false);
        }
    };

    // Handle Search
    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    // Handle Sorting
    const handleSort = (key) => {
        const isAsc = sortConfig.key === key && sortConfig.direction === 'asc';
        setSortConfig({ key, direction: isAsc ? 'desc' : 'asc' });
        setPage(0);
    };

    // Filter and Sort Data
    const filteredAndSortedData = useMemo(() => {
        let filteredData = [...csvData];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredData = filteredData.filter((row) =>
                ['VIN', 'STOCKNUMBER', 'MAKE', 'MODEL', 'TRIM'].some((key) =>
                    row[key]?.toLowerCase().includes(query)
                )
            );
        }

        if (sortConfig.key) {
            filteredData.sort((a, b) => {
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';
                if (sortConfig.key === 'YEAR' || sortConfig.key === 'ODOMETER') {
                    const aNum = parseFloat(aValue) || 0;
                    const bNum = parseFloat(bValue) || 0;
                    return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
                }
                return sortConfig.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            });
        }

        return filteredData;
    }, [csvData, searchQuery, sortConfig]);

    // Paginate Data with Row Numbers
    const paginatedData = useMemo(() => {
        const start = page * rowsPerPage;
        const end = start + rowsPerPage;
        return filteredAndSortedData.slice(start, end).map((row, index) => ({
            ...row,
            rowNumber: start + index + 1,
        }));
    }, [filteredAndSortedData, page, rowsPerPage]);

    // Handle Pagination
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Truncate long text
    const truncateText = (text, maxLength = 50) => {
        if (!text || text.length <= maxLength) return text;
        return `${text.slice(0, maxLength)}...`;
    };

    // Handle Modal
    const handleOpenModal = (options) => {
        setSelectedOptions(options);
        setOpenModal(true);
    };

    const handleCloseModal = () => {
        setOpenModal(false);
        setSelectedOptions('');
    };

    // Handle Snackbar Close
    const handleSnackbarClose = () => {
        setSnackbar({ open: false, message: '', severity: 'info' });
    };

    return (
        <div className="flex flex-col gap-y-8 w-full h-full">
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
                    Inventory Management
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Header Info & Actions */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Grid container spacing={3} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Latest System Fetch
                            </Typography>
                            <Typography variant="h6">
                                {loading ? (
                                    'Loading...'
                                ) : log?.downloadTimestamp ? (
                                    new Date(log.downloadTimestamp).toLocaleString()
                                ) : (
                                    'No data'
                                )}
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" color="text.secondary">
                                FTP Last Modified
                            </Typography>
                            <Typography variant="h6">
                                {loading ? (
                                    'Loading...'
                                ) : log?.ftpLastModified ? (
                                    new Date(log.ftpLastModified).toLocaleString()
                                ) : (
                                    'No data'
                                )}
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                <Button
                                    variant="contained"
                                    startIcon={<MdRefresh />}
                                    onClick={handleManualTrigger}
                                    disabled={triggeringJob}
                                    sx={{
                                        backgroundColor: '#003160',
                                        '&:hover': { backgroundColor: '#00254d' },
                                    }}
                                >
                                    {triggeringJob ? 'Refreshing...' : 'Refresh'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<MdDownload />}
                                    onClick={handleDownload}
                                    disabled={!log?.downloadUrl}
                                >
                                    Download CSV
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Search Bar */}
                <Box sx={{ mb: 3 }}>
                    <TextField
                        label="Search Inventory"
                        variant="outlined"
                        value={searchQuery}
                        onChange={handleSearch}
                        fullWidth
                        placeholder="Search by VIN, Make, Model, or Stock Number"
                        sx={{ maxWidth: 500 }}
                    />
                </Box>

                {/* CSV Data Table */}
                {loading || loadingCsv ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                        <CircularProgress />
                    </Box>
                ) : csvData.length === 0 ? (
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="body1" color="text.secondary" textAlign="center">
                            No inventory data available
                        </Typography>
                    </Paper>
                ) : (
                    <>
                        <TableContainer component={Paper}>
                            <Table stickyHeader aria-label="inventory table">
                                <TableHead>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                backgroundColor: '#003160',
                                                color: 'white',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Row
                                        </TableCell>
                                        {csvHeaders.map((header) => (
                                            <TableCell
                                                key={header}
                                                sx={{
                                                    backgroundColor: '#003160',
                                                    color: 'white',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                }}
                                                sortDirection={sortConfig.key === header ? sortConfig.direction : false}
                                            >
                                                <TableSortLabel
                                                    active={sortConfig.key === header}
                                                    direction={sortConfig.key === header ? sortConfig.direction : 'asc'}
                                                    onClick={() => handleSort(header)}
                                                    sx={{ color: 'white !important' }}
                                                >
                                                    {header}
                                                </TableSortLabel>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedData.map((row) => (
                                        <TableRow
                                            key={row.rowNumber}
                                            sx={{
                                                '&:hover': { backgroundColor: '#f5f5f5' },
                                                backgroundColor:
                                                    row.ISVERFIED === 'NO' ? 'rgba(255, 0, 0, 0.1)' : 'inherit',
                                            }}
                                        >
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.rowNumber}</TableCell>

                                            {csvHeaders.map((header) => (
                                                <TableCell
                                                    key={header}
                                                    sx={{
                                                        whiteSpace: 'nowrap',
                                                        ...(header === 'OPTIONS'
                                                            ? {
                                                                width: 200,
                                                                maxWidth: 200,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: 1,
                                                            }
                                                            : {
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }),
                                                    }}
                                                >
                                                    {header === 'OPTIONS' && row[header] ? (
                                                        <>
                                                            <span
                                                                style={{
                                                                    flex: 1,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                }}
                                                            >
                                                                {truncateText(row[header])}
                                                            </span>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenModal(row[header])}
                                                                aria-label="View options"
                                                            >
                                                                <MdVisibility />
                                                            </IconButton>
                                                        </>
                                                    ) : (
                                                        formatValue(header, row[header])
                                                    )}

                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>

                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[10, 25, 50]}
                            component="div"
                            count={filteredAndSortedData.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </>
                )}

                {csvData.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Total Records: {filteredAndSortedData.length}
                        </Typography>
                    </Box>
                )}

                {/* Options Modal */}
                <Dialog open={openModal} onClose={handleCloseModal} maxWidth="sm" fullWidth>
                    <DialogTitle>Vehicle Options</DialogTitle>
                    <DialogContent dividers>
                        {selectedOptions ? (
                            <List dense>
                                {selectedOptions.split(';').map((option, index) => (
                                    <ListItem key={index}>
                                        <ListItemText primary={option.trim()} />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography>No options available</Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseModal} color="primary">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Snackbar for Trigger Feedback */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleSnackbarClose}
                >
                    <Alert severity={snackbar.severity} onClose={handleSnackbarClose}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </div>
    );
};

export default Inventory;