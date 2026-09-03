import { useState } from "react";
import { useAuth } from "../../AuthContext";
import { format } from "date-fns"; // Import date-fns for formatting dates
import { FaPlus } from "react-icons/fa6";
import { GrLinkNext } from "react-icons/gr";
import { IoMdClose } from "react-icons/io";
import SalesRecordTable from "../EmployeeComponents/SalesRecordTable";
import InsuranceUploadForm from "./InsuranceUploadForm";
import { toast } from "react-toastify";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "../../config/firebaseConfig";
import SaleForm1 from "./SaleForm1";
import SaleForm2 from "./SaleForm2";
const getCurrentDate = () => {
  const now = new Date();
  return format(now, "dd MMMM yyyy");
};
const EmployeeDashboard = () => {
  const [showModal, setShowModal] = useState(false);
  const [Url, setUrl] = useState(false);
  const [secondForm, setSecondForm] = useState(false);
  const [thirdForm, setThirdForm] = useState(false);
  const [firstForm, setFirstForm] = useState(false);
  const { currentUser } = useAuth();

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { hour12: false }); // Format: HH:mm:ss
  };
  const [formData, setFormData] = useState({
    saleId: "",
    customerName: "",
    vehicleMake: "",
    vehicleModel: "",
    stockNumber: "",
    VIN: "",
    leadSource: "",
    salePrice: "",
    unitCost: "",
    warCost: "",
    warr: "",
    gap: "",
    gapCost: "",
    admin: "",
    pac: "",
    safety: "",
    financeProvider: "", // Add this new field
    saleType: "", // this is the new field as well , individual or wholesale
    reserve: "",
    grossProfit: "",
    saleDate: getCurrentDate(),
    intermediateDate: getCurrentDate(),
    intermediateTime: getCurrentTime(),
    saleTime: getCurrentTime(), // Only stores the time (HH:mm:ss)
    InsuranceStatus: false,
    FundStatus: false,

    //addiontal cost on sales perosn side
    otherCostItems: [], // Array to store other cost items

    // Add wholesale specific fields
    year: "",
    dealershipPurchase: "",
    dealershipSold: "",
    profitLoss: "",
    dateVehicleReceived: "",
    dateVehicleSold: "",
    vehiclePurchasePrice: "",
    vehicleSoldPrice: "",
    auction: "",
  });
  const [files, setFiles] = useState([]);

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;

    setFormData((prevData) => {
      // Check if the saleType is being changed and if it's 'wholesale'
      if (id === "saleType" && value === "wholesale") {
        // Nullify financeProvider when saleType is "wholesale"
        return {
          ...prevData,
          [id]: value,
          financeProvider: "", // Nullify financeProvider when wholesale is selected
          leadSource: "", // Nullify leadSource when wholesale is selected
        };
      }

      return {
        ...prevData,
        [id]: type === "checkbox" ? checked : value,
      };
    });
  };

  const generateSaleId = () => {
    const timestamp = Date.now(); // Get current timestamp
    const randomNum = Math.floor(Math.random() * 10000); // Generate a random number from 0 to 9999
    return timestamp + randomNum; // Combine timestamp and random number
  };
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);

  // const handleUpload = async () => {
  //   if (files.length > 0) {
  //     setLoading(true);
  //     const saleId = generateSaleId();
  //     const documentURLsArray = [];

  //     for (const fileObj of files) {
  //       const file = fileObj.file;
  //       const uniqueFileName = `${saleId}_${file.name}`;

  //       const storageRef = ref(storage, `files/${uniqueFileName}`);

  //       const metadata = {
  //         contentType: file.type,
  //       };

  //       const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  //       await new Promise((resolve, reject) => {
  //         uploadTask.on(
  //           "state_changed",
  //           (snapshot) => {
  //             // console.log(
  //             //   "Upload progress:",
  //             //   (snapshot.bytesTransferred / snapshot.totalBytes) * 100 + "%"
  //             // );
  //           },
  //           (error) => {
  //             console.error("Error uploading file:", error);
  //             reject(error);
  //           },
  //           async () => {
  //             const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
  //             documentURLsArray.push(downloadURL);
  //             resolve();
  //           }
  //         );
  //       });
  //     }

  //     const saleRefCommission = doc(db, "sales", currentUser.uid);
  //     const docSnapCommission = await getDoc(saleRefCommission);
  //     const allSales = docSnapCommission.exists()
  //       ? docSnapCommission.data().sales || []
  //       : [];

  //     const currentMonth = new Date().toLocaleString("default", {
  //       month: "long",
  //       year: "numeric",
  //     });

  //     const monthlyIndividualSales = allSales.filter((sale) => {
  //       if (!sale.saleDate || sale.saleType !== "individual") return false;
  //       try {
  //         const d = new Date(sale.saleDate);
  //         const saleMonth = d.toLocaleString("default", {
  //           month: "long",
  //           year: "numeric",
  //         });
  //         return saleMonth === currentMonth;
  //       } catch {
  //         return false;
  //       }
  //     });

  //     const specificRuleSnap = await getDoc(
  //       doc(db, "userCommissionRules", currentUser.uid)
  //     );
  //     const globalRuleSnap = await getDoc(doc(db, "commissionRules", "global"));

  //     const rule = specificRuleSnap.exists()
  //       ? specificRuleSnap.data()
  //       : globalRuleSnap.exists()
  //       ? globalRuleSnap.data()
  //       : {};

  //     const minSalesCount = rule.minSalesCount || 0;
  //     const minAvgSalesGross = rule.minAvgSalesGross || 0;
  //     const bonusCommissionRate = rule.bonusCommissionRate || 0;
  //     const baseCommissionRate = rule.baseCommissionRate || 25;

  //     const sortedSales = [...monthlyIndividualSales].sort((a, b) => {
  //       return new Date(a.saleDate) - new Date(b.saleDate);
  //     });

  //     const selectedSales = sortedSales.slice(0, minSalesCount);

  //     const totalGross = selectedSales.reduce(
  //       (sum, sale) => sum + parseFloat(sale.salesGross || 0),
  //       0
  //     );

  //     const totalSales = monthlyIndividualSales.length;
  //     const avgGross =
  //       selectedSales.length > 0 ? totalGross / selectedSales.length : 0;

  //     const qualifies =
  //       totalSales >= minSalesCount && avgGross >= minAvgSalesGross;

  //     const commissionRate =
  //       baseCommissionRate + (qualifies ? bonusCommissionRate : 0);

  //     // Once all files are uploaded and URLs are collected
  //     const updatedFormData = {
  //       ...formData,
  //       InsuranceStatus: true,
  //       documentUrl: documentURLsArray, // Save array of URLs
  //       saleId,
  //       addedById: currentUser?.uid || "SalesPerson",
  //       addedByName: currentUser?.name || "SalesPerson",
  //       salesRep: currentUser?.name || "SalesPerson",
  //       commissionRate,
  //     };

  //     const saleRef = doc(db, "sales", currentUser.uid);
  //     const docSnap = await getDoc(saleRef);

  //     if (!docSnap.exists()) {
  //       // Create a new document if it does not exist
  //       await setDoc(saleRef, {
  //         sales: [updatedFormData],
  //       });
  //     } else {
  //       // Update the existing document
  //       await updateDoc(saleRef, {
  //         sales: arrayUnion(updatedFormData),
  //       });
  //     }

  //     // Reset formData and form state after upload
  //     setLoading(false);
  //     setFiles([]);
  //     setFormData({
  //       saleId: "",
  //       customerName: "",
  //       vehicleMake: "",
  //       vehicleModel: "",
  //       stockNumber: "",
  //       VIN: "",
  //       leadSource: "",
  //       salePrice: "",
  //       unitCost: "",
  //       warCost: "",
  //       warr: "",
  //       gap: "",
  //       financeProvider: "", // Add this new field
  //       saleType: "", // this is the new field as well , individual or wholesale
  //       gapCost: "",
  //       admin: "",
  //       pac: "",
  //       safety: "",
  //       reserve: "",
  //       grossProfit: "",
  //       intermediateDate: getCurrentDate(),
  //       intermediateTime: getCurrentTime(),
  //       saleDate: getCurrentDate(),
  //       saleTime: getCurrentTime(), // Only stores the time (HH:mm:ss)
  //       InsuranceStatus: false,
  //       FundStatus: false,
  //       otherCostItems: [],

  //       // Add wholesale specific fields

  //       year: "",
  //       dealershipPurchase: "",
  //       dealershipSold: "",
  //       profitLoss: "",
  //       dateVehicleReceived: "",
  //       dateVehicleSold: "",
  //       vehiclePurchasePrice: "",
  //       vehicleSoldPrice: "",
  //       auction: "",
  //     });
  //     setThirdForm(false);
  //     toast.success("New Sale Added Successfully");
  //   }
  // };

  const handleUpload = async () => {
    if (files.length > 0) {
      setLoading(true);
      const saleId = generateSaleId();
      const documentURLsArray = [];

      // Upload all files first
      for (const fileObj of files) {
        const file = fileObj.file;
        const uniqueFileName = `${saleId}_${file.name}`;
        const storageRef = ref(storage, `files/${uniqueFileName}`);
        const metadata = { contentType: file.type };
        const uploadTask = uploadBytesResumable(storageRef, file, metadata);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            () => {}, // Progress handler can remain empty
            (error) => {
              console.error("Error uploading file:", error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              documentURLsArray.push(downloadURL);
              resolve();
            }
          );
        });
      }

      // Get the user's sales data
      const saleRefCommission = doc(db, "sales", currentUser.uid);
      const docSnapCommission = await getDoc(saleRefCommission);
      const allSales = docSnapCommission.exists()
        ? docSnapCommission.data().sales || []
        : [];

      // Filter for current month's individual sales
      const currentMonth = new Date().toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      const monthlyIndividualSales = allSales.filter((sale) => {
        if (!sale.saleDate || sale.saleType !== "individual") return false;
        try {
          const d = new Date(sale.saleDate);
          const saleMonth = d.toLocaleString("default", {
            month: "long",
            year: "numeric",
          });
          return saleMonth === currentMonth;
        } catch {
          return false;
        }
      });

      // Get commission rules (check user-specific first, then global)
      const specificRuleSnap = await getDoc(
        doc(db, "userCommissionRules", currentUser.uid)
      );
      const globalRuleSnap = await getDoc(doc(db, "commissionRules", "global"));

      // Extract rules array (support both old single rule and new array format)
      let rules = [];
      if (specificRuleSnap.exists()) {
        rules = specificRuleSnap.data().rules || [specificRuleSnap.data()]; // Fallback to single rule
      } else if (globalRuleSnap.exists()) {
        rules = globalRuleSnap.data().rules || [globalRuleSnap.data()]; // Fallback to single rule
      } else {
        // Default rule if none exist
        rules = [
          {
            minSalesCount: 0,
            minAvgSalesGross: 0,
            bonusCommissionRate: 0,
            baseCommissionRate: 25,
          },
        ];
      }

      // Sort sales chronologically to evaluate most recent sales first
      const sortedSales = [...monthlyIndividualSales].sort((a, b) => {
        return new Date(a.saleDate) - new Date(b.saleDate);
      });

      // Find all qualifying rules
      const qualifyingRules = rules
        .map((rule) => {
          const requiredCount = rule.minSalesCount || 0;
          const requiredGross = rule.minAvgSalesGross || 0;

          // Get the most recent sales up to the required count
          const candidateSales = sortedSales.slice(0, requiredCount);
          const totalGross = candidateSales.reduce(
            (sum, sale) => sum + parseFloat(sale.salesGross || 0),
            0
          );
          const avgGross =
            candidateSales.length > 0 ? totalGross / candidateSales.length : 0;

          // Check if rule conditions are met
          const qualifies =
            candidateSales.length >= requiredCount && avgGross >= requiredGross;

          return {
            ...rule,
            qualifies,
            avgGross,
            salesCount: candidateSales.length,
          };
        })
        .filter((rule) => rule.qualifies);

      // Select the best rule (highest bonusCommissionRate among qualifying rules)
      let bestRule;
      if (qualifyingRules.length > 0) {
        // Sort by bonusCommissionRate descending, then by requirements (more stringent first)
        qualifyingRules.sort((a, b) => {
          if (b.bonusCommissionRate !== a.bonusCommissionRate) {
            return b.bonusCommissionRate - a.bonusCommissionRate;
          }
          // If bonus rates are equal, prefer rules with higher requirements
          if (b.minSalesCount !== a.minSalesCount) {
            return b.minSalesCount - a.minSalesCount;
          }
          return b.minAvgSalesGross - a.minAvgSalesGross;
        });
        bestRule = qualifyingRules[0];
      }
      // else {
      //   // No qualifying rules - use the rule with the highest potential bonus
      //   // that the user is closest to achieving
      //   rules.sort((a, b) => {
      //     // First sort by how close the user is to meeting the requirements
      //     const aSalesDiff = Math.max(0, a.minSalesCount - sortedSales.length);
      //     const bSalesDiff = Math.max(0, b.minSalesCount - sortedSales.length);

      //     if (aSalesDiff !== bSalesDiff) {
      //       return aSalesDiff - bSalesDiff;
      //     }

      //     // Then by bonus rate
      //     return b.bonusCommissionRate - a.bonusCommissionRate;
      //   });
      //   bestRule = rules[0];
      // }
      console.log("bestRule", bestRule);
      // Calculate commission rate
      // const commissionRate =
      //   (bestRule.baseCommissionRate || 25) +
      //   (bestRule.qualifies ? bestRule.bonusCommissionRate || 0 : 0);
      let commissionRate = 25; // Default base commission
      if (bestRule) {
        commissionRate =
          (bestRule.baseCommissionRate || 25) +
          (bestRule.bonusCommissionRate || 0);
      }

      // Prepare the sale data with calculated commission
      const updatedFormData = {
        ...formData,
        InsuranceStatus: true,
        documentUrl: documentURLsArray,
        saleId,
        addedById: currentUser?.uid || "SalesPerson",
        addedByName: currentUser?.name || "SalesPerson",
        salesRep: currentUser?.name || "SalesPerson",
        commissionRate,
        appliedRule: bestRule
          ? {
              minSalesCount: bestRule.minSalesCount,
              minAvgSalesGross: bestRule.minAvgSalesGross,
              bonusCommissionRate: bestRule.bonusCommissionRate,
              baseCommissionRate: bestRule.baseCommissionRate || 25,
              qualifies: true,
            }
          : {
              qualifies: false,
            },
      };

      // Update the sales document
      const saleRef = doc(db, "sales", currentUser.uid);
      const docSnap = await getDoc(saleRef);

      if (!docSnap.exists()) {
        await setDoc(saleRef, { sales: [updatedFormData] });
      } else {
        await updateDoc(saleRef, { sales: arrayUnion(updatedFormData) });
      }

      // Reset form and state
      setLoading(false);
      setFiles([]);
      setFormData({
        saleId: "",
        customerName: "",
        vehicleMake: "",
        vehicleModel: "",
        stockNumber: "",
        VIN: "",
        leadSource: "",
        salePrice: "",
        unitCost: "",
        warCost: "",
        warr: "",
        gap: "",
        financeProvider: "",
        saleType: "",
        gapCost: "",
        admin: "",
        pac: "",
        safety: "",
        reserve: "",
        grossProfit: "",
        intermediateDate: getCurrentDate(),
        intermediateTime: getCurrentTime(),
        saleDate: getCurrentDate(),
        saleTime: getCurrentTime(),
        InsuranceStatus: false,
        FundStatus: false,
        otherCostItems: [],
        year: "",
        dealershipPurchase: "",
        dealershipSold: "",
        profitLoss: "",
        dateVehicleReceived: "",
        dateVehicleSold: "",
        vehiclePurchasePrice: "",
        vehicleSoldPrice: "",
        auction: "",
      });
      setThirdForm(false);
      toast.success("New Sale Added Successfully");
    }
  };

  const handleLaterUpload = async () => {
    try {
      setLoading2(true);
      const saleId = generateSaleId();

      // Get the user's sales data
      const saleRefCommission = doc(db, "sales", currentUser.uid);
      const docSnapCommission = await getDoc(saleRefCommission);
      const allSales = docSnapCommission.exists()
        ? docSnapCommission.data().sales || []
        : [];

      // Filter for current month's individual sales
      const currentMonth = new Date().toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      const monthlyIndividualSales = allSales.filter((sale) => {
        if (!sale.saleDate || sale.saleType !== "individual") return false;
        try {
          const d = new Date(sale.saleDate);
          const saleMonth = d.toLocaleString("default", {
            month: "long",
            year: "numeric",
          });
          return saleMonth === currentMonth;
        } catch {
          return false;
        }
      });

      // Get commission rules (check user-specific first, then global)
      const specificRuleSnap = await getDoc(
        doc(db, "userCommissionRules", currentUser.uid)
      );
      const globalRuleSnap = await getDoc(doc(db, "commissionRules", "global"));

      // Extract rules array (support both old single rule and new array format)
      let rules = [];
      if (specificRuleSnap.exists()) {
        rules = specificRuleSnap.data().rules || [specificRuleSnap.data()]; // Fallback to single rule
      } else if (globalRuleSnap.exists()) {
        rules = globalRuleSnap.data().rules || [globalRuleSnap.data()]; // Fallback to single rule
      } else {
        // Default rule if none exist
        rules = [
          {
            minSalesCount: 0,
            minAvgSalesGross: 0,
            bonusCommissionRate: 0,
            baseCommissionRate: 25,
          },
        ];
      }

      // Sort sales chronologically to evaluate most recent sales first
      const sortedSales = [...monthlyIndividualSales].sort((a, b) => {
        return new Date(a.saleDate) - new Date(b.saleDate);
      });

      console.log("sortedSales", sortedSales);

      console.log("rules", rules);

      // Find all qualifying rules
      const qualifyingRules = rules
        .map((rule) => {
          const requiredCount = rule.minSalesCount || 0;
          const requiredGross = rule.minAvgSalesGross || 0;

          // Get the most recent sales up to the required count
          const candidateSales = sortedSales.slice(0, requiredCount);
          console.log("candidateSales", candidateSales);
          const totalGross = candidateSales.reduce(
            (sum, sale) => sum + parseFloat(sale.salesGross || 0),
            0
          );

          const avgGross =
            candidateSales.length > 0 ? totalGross / candidateSales.length : 0;
          console.log("avgGross", avgGross);

          // Check if rule conditions are met
          const qualifies =
            candidateSales.length >= requiredCount && avgGross >= requiredGross;

          return {
            ...rule,
            qualifies,
            avgGross,
            salesCount: candidateSales.length,
          };
        })
        .filter((rule) => rule.qualifies);

      // Select the best rule (highest bonusCommissionRate among qualifying rules)
      let bestRule;
      if (qualifyingRules.length > 0) {
        // Sort by bonusCommissionRate descending, then by requirements (more stringent first)
        qualifyingRules.sort((a, b) => {
          if (b.bonusCommissionRate !== a.bonusCommissionRate) {
            return b.bonusCommissionRate - a.bonusCommissionRate;
          }
          // If bonus rates are equal, prefer rules with higher requirements
          if (b.minSalesCount !== a.minSalesCount) {
            return b.minSalesCount - a.minSalesCount;
          }
          return b.minAvgSalesGross - a.minAvgSalesGross;
        });
        bestRule = qualifyingRules[0];
      }
      // else {
      //   // No qualifying rules - use the rule with the highest potential bonus
      //   // that the user is closest to achieving
      //   rules.sort((a, b) => {
      //     // First sort by how close the user is to meeting the requirements
      //     const aSalesDiff = Math.max(0, a.minSalesCount - sortedSales.length);
      //     const bSalesDiff = Math.max(0, b.minSalesCount - sortedSales.length);

      //     if (aSalesDiff !== bSalesDiff) {
      //       return aSalesDiff - bSalesDiff;
      //     }

      //     // Then by bonus rate
      //     return b.bonusCommissionRate - a.bonusCommissionRate;
      //   });
      //   bestRule = rules[0];
      // }

      console.log("qualifyingRules", qualifyingRules);

      console.log("bestRule", bestRule);

      // Calculate commission rate
      // const commissionRate =
      //   (bestRule.baseCommissionRate || 25) +
      //   (bestRule.qualifies ? bestRule.bonusCommissionRate || 0 : 0);
      let commissionRate = 25; // Default base commission
      if (bestRule) {
        commissionRate =
          (bestRule.baseCommissionRate || 25) +
          (bestRule.bonusCommissionRate || 0);
      }

      // Prepare the sale data
      const updatedFormData = {
        ...formData,
        saleId,
        addedById: currentUser?.uid || "SalesPerson",
        addedByName: currentUser?.name || "SalesPerson",
        salesRep: currentUser?.name || "SalesPerson",
        commissionRate,
        appliedRule: bestRule
          ? {
              minSalesCount: bestRule.minSalesCount,
              minAvgSalesGross: bestRule.minAvgSalesGross,
              bonusCommissionRate: bestRule.bonusCommissionRate,
              baseCommissionRate: bestRule.baseCommissionRate || 25,
              qualifies: true,
            }
          : {
              qualifies: false,
            },
      };

      // Update the sales document
      const saleRef = doc(db, "sales", currentUser.uid);
      const docSnap = await getDoc(saleRef);

      if (!docSnap.exists()) {
        await setDoc(saleRef, { sales: [updatedFormData] });
      } else {
        await updateDoc(saleRef, { sales: arrayUnion(updatedFormData) });
      }

      // Reset form and state
      setLoading2(false);
      setFiles([]);
      setFormData({
        saleId: "",
        customerName: "",
        vehicleMake: "",
        vehicleModel: "",
        stockNumber: "",
        VIN: "",
        leadSource: "",
        salePrice: "",
        unitCost: "",
        warCost: "",
        warr: "",
        gap: "",
        gapCost: "",
        admin: "",
        financeProvider: "",
        saleType: "",
        pac: "",
        safety: "",
        reserve: "",
        grossProfit: "",
        intermediateDate: getCurrentDate(),
        intermediateTime: getCurrentTime(),
        saleDate: getCurrentDate(),
        saleTime: getCurrentTime(),
        InsuranceStatus: false,
        FundStatus: false,
        otherCostItems: [],
        year: "",
        dealershipPurchase: "",
        dealershipSold: "",
        profitLoss: "",
        dateVehicleReceived: "",
        dateVehicleSold: "",
        vehiclePurchasePrice: "",
        vehicleSoldPrice: "",
        auction: "",
      });
      setThirdForm(false);
      toast.success("New Sale Added Successfully");
    } catch (error) {
      console.error("Error adding sale: ", error);
      toast.error("Failed to add sale");
    } finally {
      setFiles([]);
    }
  };
  // const handleLaterUpload = async () => {
  //   try {
  //     setLoading2(true);
  //     const saleId = generateSaleId(); // Generate a unique sale ID

  //     const saleRefCommission = doc(db, "sales", currentUser.uid);
  //     const docSnapCommission = await getDoc(saleRefCommission);
  //     const allSales = docSnapCommission.exists()
  //       ? docSnapCommission.data().sales || []
  //       : [];

  //     const currentMonth = new Date().toLocaleString("default", {
  //       month: "long",
  //       year: "numeric",
  //     });

  //     const monthlyIndividualSales = allSales.filter((sale) => {
  //       if (!sale.saleDate || sale.saleType !== "individual") return false;
  //       try {
  //         const d = new Date(sale.saleDate);
  //         const saleMonth = d.toLocaleString("default", {
  //           month: "long",
  //           year: "numeric",
  //         });
  //         return saleMonth === currentMonth;
  //       } catch {
  //         return false;
  //       }
  //     });

  //     const specificRuleSnap = await getDoc(
  //       doc(db, "userCommissionRules", currentUser.uid)
  //     );
  //     const globalRuleSnap = await getDoc(doc(db, "commissionRules", "global"));

  //     const rule = specificRuleSnap.exists()
  //       ? specificRuleSnap.data()
  //       : globalRuleSnap.exists()
  //       ? globalRuleSnap.data()
  //       : {};

  //     const minSalesCount = rule.minSalesCount || 0;
  //     const minAvgSalesGross = rule.minAvgSalesGross || 0;
  //     const bonusCommissionRate = rule.bonusCommissionRate || 0;
  //     const baseCommissionRate = rule.baseCommissionRate || 25;

  //     // === 🔍 Step 3: Calculate sales summary
  //     // const totalSales = monthlyIndividualSales.length;
  //     // const totalGross = monthlyIndividualSales.reduce(
  //     //   (sum, sale) => sum + parseFloat(sale.salesGross || 0),
  //     //   0
  //     // );
  //     // const avgGross = totalSales > 0 ? totalGross / totalSales : 0;
  //     const sortedSales = [...monthlyIndividualSales].sort((a, b) => {
  //       return new Date(a.saleDate) - new Date(b.saleDate);
  //     });

  //     const selectedSales = sortedSales.slice(0, minSalesCount);

  //     const totalGross = selectedSales.reduce(
  //       (sum, sale) => sum + parseFloat(sale.salesGross || 0),
  //       0
  //     );

  //     const totalSales = monthlyIndividualSales.length;
  //     const avgGross =
  //       selectedSales.length > 0 ? totalGross / selectedSales.length : 0;

  //     const qualifies =
  //       totalSales >= minSalesCount && avgGross >= minAvgSalesGross;

  //     const commissionRate =
  //       baseCommissionRate + (qualifies ? bonusCommissionRate : 0);

  //     const updatedFormData = {
  //       ...formData,
  //       saleId, // Add the sale ID here
  //       addedById: currentUser?.uid || "SalesPerson",
  //       addedByName: currentUser?.name || "SalesPerson",
  //       salesRep: currentUser?.name || "SalesPerson",
  //       commissionRate,
  //     };
  //     const saleRef = doc(db, "sales", currentUser?.uid);
  //     const docSnap = await getDoc(saleRef);

  //     if (!docSnap.exists()) {
  //       await setDoc(saleRef, {
  //         sales: [updatedFormData],
  //       });
  //     } else {
  //       // Update the existing document
  //       await updateDoc(saleRef, {
  //         sales: arrayUnion(updatedFormData),
  //       });
  //     }
  //     setLoading2(false);
  //     setFiles([]);
  //     setFormData({
  //       saleId: "",
  //       customerName: "",
  //       vehicleMake: "",
  //       vehicleModel: "",
  //       stockNumber: "",
  //       VIN: "",
  //       leadSource: "",
  //       salePrice: "",
  //       unitCost: "",
  //       warCost: "",
  //       warr: "",
  //       gap: "",
  //       gapCost: "",
  //       admin: "",
  //       financeProvider: "", // Add this new field
  //       saleType: "",
  //       pac: "",
  //       safety: "",
  //       reserve: "",
  //       grossProfit: "",
  //       intermediateDate: getCurrentDate(),
  //       intermediateTime: getCurrentTime(),
  //       saleDate: getCurrentDate(),
  //       saleTime: getCurrentTime(), // Only stores the time (HH:mm:ss)
  //       InsuranceStatus: false,
  //       FundStatus: false,
  //       otherCostItems: [],

  //       // Add wholesale specific fields
  //       year: "",
  //       dealershipPurchase: "",
  //       dealershipSold: "",
  //       profitLoss: "",
  //       dateVehicleReceived: "",
  //       dateVehicleSold: "",
  //       vehiclePurchasePrice: "",
  //       vehicleSoldPrice: "",
  //       auction: "",
  //     });
  //     setThirdForm(false);
  //     toast.success("New Sale Added Successfully");
  //   } catch (error) {
  //     console.error("Error adding sale: ", error);
  //   } finally {
  //     setFiles([]);
  //   }
  // };

  return (
    <>
      <div className="flex items-start justify-start w-full px-12 py-8 overflow-y-auto h-full ">
        <div className="flex flex-col w-full h-full ">
          <div className="flex flex-row items-center justify-between w-full mb-4">
            <h1 className="text-2xl font-semibold">Previously Added Sales</h1>
            <div className="">
              {" "}
              <button
                type="button"
                className="flex flex-row px-10 py-3 text-xl font-bold text-white bg-[#003160] rounded-full cursor-pointer gap-x-3 hover:bg-blue-900 transition-all ease-in-out duration-300"
                onClick={() => setShowModal(true)}
              >
                Add New Sale
                <FaPlus size={25} />
              </button>
            </div>
          </div>
          <SalesRecordTable setShowModal={setShowModal} />
        </div>
      </div>

      {showModal ? (
        <SaleForm1
          setShowModal={setShowModal}
          setSecondForm={setSecondForm}
          handleInputChange={handleInputChange}
          formData={formData}
          setFormData={setFormData}
        />
      ) : null}
      {secondForm ? (
        <SaleForm2
          setShowModal={setShowModal}
          setSecondForm={setSecondForm}
          handleInputChange={handleInputChange}
          formData={formData}
          setThirdForm={setThirdForm}
          setFormData={setFormData}
          setFirstForm={setFirstForm}
        />
      ) : null}
      {thirdForm ? (
        <InsuranceUploadForm
          formData={formData}
          setFormData={setFormData}
          handleUpload={handleUpload}
          handleLaterUpload={handleLaterUpload}
          setThirdForm={setThirdForm}
          files={files}
          setFiles={setFiles}
          setSecondForm={setSecondForm}
          loading={loading}
          loading2={loading2}
        />
      ) : null}
    </>
  );
};

export default EmployeeDashboard;
