import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { toast } from "react-toastify";

// Fetch sales data with real-time updates
export const fetchSalesData = (
  setSales,
  setAllSales,
  setFilteredClients,
  setUid
) => {
  try {
    const salesCollection = collection(db, "sales");
    return onSnapshot(salesCollection, (querySnapshot) => {
      const salesData = [];
      const uIds = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;
        uIds.push(id);
        const dataWithId = data.sales.map((el) => ({
          documentId: doc.id,
          ...el,
        }));
        const dataObject = {
          sales: dataWithId,
          id: id,
        };
        salesData.push(dataObject);
        setUid(uIds);
      });

      setSales(salesData);
      const allSales = salesData.flatMap((item) => item.sales);
      setAllSales(allSales);
      setFilteredClients(allSales);
    });
  } catch (error) {
    console.error("Error setting up sales data listener: ", error);
    toast.error("Error fetching sales data");
  }
};

// Fetch leads data
export const fetchLeads = async (setLeadSources) => {
  try {
    const querySnapshot = await getDocs(collection(db, "leads"));
    const fetchedLeads = querySnapshot.docs.map((doc) => doc.data().leadName);
    setLeadSources(fetchedLeads);
  } catch (error) {
    console.error("Error fetching leads: ", error);
    toast.error("Failed to fetch leads: " + error.message);
  }
};

// Fetch sales persons
export const fetchSalesPerson = async (uId, setSalesPerson) => {
  try {
    if (uId && uId.length > 0) {
      const SalePersonsRef = collection(db, "employees");
      const queryPromises = uId.map((source) => {
        const q = query(SalePersonsRef, where("uid", "==", source));
        return getDocs(q);
      });
      const querySnapshots = await Promise.all(queryPromises);
      const results = [];
      querySnapshots.forEach((snapshot) => {
        snapshot.forEach((doc) => {
          const { name, uid } = doc.data();
          results.push({ name, uid });
        });
      });
      setSalesPerson(results);
    }
  } catch (error) {
    console.error("Error fetching Sale Persons: ", error);
    toast.error("Failed to fetch Sales Person: " + error.message);
  }
};

// Apply filters to sales data
export const applySalesFilters = (
  allSales,
  startDate,
  endDate,
  selectedLeadSource,
  selectedSalesPerson,
  setFilteredClients
) => {
  let filtered = [...allSales];

  if (startDate && endDate) {
    filtered = filtered.filter((sale) => {
      const saleDate = new Date(sale.saleDate);
      return saleDate >= startDate && saleDate <= endDate;
    });
  }

  if (selectedLeadSource) {
    filtered = filtered.filter(
      (sale) => sale.leadSource === selectedLeadSource
    );
  }

  if (selectedSalesPerson) {
    filtered = filtered.filter(
      (sale) => sale.documentId === selectedSalesPerson
    );
  }

  setFilteredClients(filtered);
};

// Handle pagination calculations
export const getPaginationData = (
  filteredClients,
  rowsPerPage,
  currentPage
) => {
  const totalPages = Math.ceil(filteredClients.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);

  return {
    totalPages,
    currentClients,
    startIndex,
    endIndex,
  };
};
