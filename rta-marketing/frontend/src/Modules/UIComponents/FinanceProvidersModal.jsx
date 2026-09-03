import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  startAfter,
  limit,
  where,
  Timestamp,
} from "firebase/firestore";

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
  Box,
  TablePagination,
  CircularProgress,
  Snackbar,
  Alert,
  InputAdornment,
} from "@mui/material";
import {
  ArrowDownToDotIcon,
  CirclePlus,
  DeleteIcon,
  EditIcon,
  SearchIcon,
} from "lucide-react";
import { db } from "../../config/firebaseConfig";
import { useAuth } from "../../AuthContext";

const FinanceProviderManager = () => {
  // State variables
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [totalProviders, setTotalProviders] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Fetch providers
  useEffect(() => {
    fetchProviders();
  }, [page, rowsPerPage, searchTerm]);

  const fetchProviders = async () => {
    try {
      setLoading(true);

      // Create a query based on search term
      let q;
      if (searchTerm) {
        q = query(
          collection(db, "financeProviders"),
          where("name", ">=", searchTerm),
          where("name", "<=", searchTerm + "\uf8ff"),
          orderBy("name"),
          limit(rowsPerPage)
        );
      } else {
        q = query(
          collection(db, "financeProviders"),
          orderBy("createdAt", "desc"),
          limit(rowsPerPage)
        );
      }

      const querySnapshot = await getDocs(q);
      const providersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProviders(providersData);

      // Get total count for pagination
      const countSnapshot = await getDocs(collection(db, "financeProviders"));
      setTotalProviders(countSnapshot.size);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching providers: ", error);
      setSnackbar({
        open: true,
        message: "Error fetching finance providers",
        severity: "error",
      });
      setLoading(false);
    }
  };

  // Modal handlers
  const handleOpen = () => {
    setOpen(true);
    setName("");
    setEditId(null);
  };

  const handleClose = () => {
    setOpen(false);
    setName("");
    setEditId(null);
  };

  // CRUD operations
  const handleSubmit = async () => {
    if (!name.trim()) {
      setSnackbar({
        open: true,
        message: "Provider name cannot be empty",
        severity: "error",
      });
      return;
    }

    try {
      setLoading(true);

      if (editId) {
        // Update operation
        await updateDoc(doc(db, "financeProviders", editId), {
          name: name,
          updatedAt: Timestamp.now(),
        });

        setSnackbar({
          open: true,
          message: "Finance provider updated successfully",
          severity: "success",
        });
      } else {
        // Create operation
        await addDoc(collection(db, "financeProviders"), {
          name: name,
          addedBy: currentUser?.userType,
          userId: currentUser?.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        setSnackbar({
          open: true,
          message: "Finance provider added successfully",
          severity: "success",
        });
      }

      handleClose();
      fetchProviders();
    } catch (error) {
      console.error("Error saving provider: ", error);
      setSnackbar({
        open: true,
        message: `Error ${editId ? "updating" : "adding"} finance provider`,
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (provider) => {
    setName(provider.name);
    setEditId(provider.id);
    setOpen(true);
  };

  const handleDelete = async (id) => {
    if (
      window.confirm("Are you sure you want to delete this finance provider?")
    ) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, "financeProviders", id));
        fetchProviders();
        setSnackbar({
          open: true,
          message: "Finance provider deleted successfully",
          severity: "success",
        });
        handleClose();
      } catch (error) {
        console.error("Error deleting provider: ", error);
        setSnackbar({
          open: true,
          message: "Error deleting finance provider",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleString();
  };

  // Search handler
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Snackbar close handler
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <div>
      {/* Button to open the modal */}
      <div className="flex justify-end ">
        <Button
          variant="contained"
          sx={{ color: "white", backgroundColor: "#011c64", mb: 2 }}
          startIcon={<CirclePlus />}
          onClick={handleOpen}
        >
          Finance Providers
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editId ? "Edit Finance Provider" : "Finance Providers Management"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, mt: 1 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Provider Name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading && editId ? (
                <CircularProgress size={24} />
              ) : editId ? (
                "Update"
              ) : (
                "Add"
              )}
            </Button>

            <TextField
              placeholder="Search providers..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Updated At</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2">
                        No finance providers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell>{provider.name}</TableCell>
                      <TableCell>{formatDate(provider.createdAt)}</TableCell>
                      <TableCell>{formatDate(provider.updatedAt)}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(provider)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(provider.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalProviders}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default FinanceProviderManager;
