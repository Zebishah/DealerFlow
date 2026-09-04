import React, { useEffect, useRef, useState } from "react";
import { FaCircleCheck } from "react-icons/fa6";
import { db } from "../../config/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import logo from "../../images/rta-logo.png";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useSalesData } from "../../SalesDataContext";
import { Loader } from "../../Utils/Loader";

const TVScreen = () => {
  const [SalesPersons, setSalesPersons] = useState(null);
  const [updatedSalesPerson, setUpdatedSalesPerson] = useState([]);
  const [sortedSalesPerson, setSortedSalesPerson] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalSalestarget, setTotalSalestarget] = useState(0);
  const [totalCompletedSales, setTotalCompletedSales] = useState(0);
  const [midMonthSales, setMidMonthSales] = useState(0);
  const [sortedCardsPerson, setSortedCardsPerson] = useState([]);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [totalLeadsCount, setTotalLeads] = useState(0);
  const { salesData, loading, selectedMonth, setSelectedMonth } =
    useSalesData();

  useEffect(() => {
    setSelectedMonth(() => {
      const today = new Date();
      return today.toISOString().slice(0, 7);
    });
  }, [setSelectedMonth]);

  // Fetch salesOrder from Firebase
  useEffect(() => {
    const fetchSortedSalesPerson = async () => {
      try {
        const docRef = doc(db, "settings", "salesOrder");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSortedCardsPerson(docSnap.data().order);
        }
      } catch (error) {
        console.error("Error fetching sorted sales persons: ", error);
      }
    };
    fetchSortedSalesPerson();
  }, []);

  useEffect(() => {
    if (SalesPersons && SalesPersons.length > 0) {
      if (sortedCardsPerson && sortedCardsPerson.length > 0) {
        // Merge strategy: preserve existing order + add new salespersons at the end
        const existingIds = new Set(sortedCardsPerson.map((p) => p.uid));
        const newSalesPersons = SalesPersons.filter(
          (p) => !existingIds.has(p.uid)
        );

        if (newSalesPersons.length > 0) {
          const merged = [...sortedCardsPerson, ...newSalesPersons];
          setSortedCardsPerson(merged);
          saveOrderToFirebase(merged);
        }
      } else {
        // Initial setup if no existing order
        setSortedCardsPerson([...SalesPersons]);
        saveOrderToFirebase([...SalesPersons]);
      }
    }
  }, [SalesPersons, sortedCardsPerson]);

  useEffect(() => {
    if (salesData?.length > 0) {
      // Compute total target
      const totalTarget = salesData.reduce((total, person) => {
        return total + (person.target || 0);
      }, 0);

      // Compute total completed sales
      const totalSalesCount = salesData.reduce((total, person) => {
        return total + (person.salesCompleted || 0);
      }, 0);

      // Compute mid-month sales total
      const midMonthSalesTotal = salesData.reduce((total, person) => {
        return total + (person.midMonth || 0);
      }, 0);

      setTotalSalestarget(totalTarget);
      setTotalCompletedSales(totalSalesCount);
      setMidMonthSales(midMonthSalesTotal);
    }
  }, [salesData]);

  const [leads, setLeads] = useState([]);

  const fetchSalesPerson = () => {
    try {
      const SalePersonsRef = collection(db, "employees");
      const q = query(SalePersonsRef, where("userType", "==", "Employee"));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const results = [];
        querySnapshot.forEach((doc) => {
          const SalePerson = doc.data();
          // Skip if user is marked as deleted
          if (SalePerson.isDeleted) return;
          const { password, ...rest } = SalePerson;
          results.push(rest);
        });
        setSalesPersons(results);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching Sale Persons: ", error);
      toast.error("Failed to fetch Sales Person: " + error.message);
      return () => { };
    }
  };

  useEffect(() => {
    const unsubscribe = fetchSalesPerson();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribeEmployees = setupEmployeesListener();
    return () => {
      unsubscribeEmployees && unsubscribeEmployees();
    };
  }, []);

  const setupEmployeesListener = () => {
    try {
      const employeesCollection = collection(db, "employees");
      return onSnapshot(
        employeesCollection,
        (querySnapshot) => {
          let totalLeadsCount = 0;
          const currentMonth = new Date().getMonth(); // Get current month (0-indexed)
          const currentYear = new Date().getFullYear(); // Get current year

          querySnapshot.forEach((doc) => {
            const employeeData = doc.data();
            const { leads } = employeeData;

            if (leads && Array.isArray(leads)) {
              const filteredLeads = leads.filter((lead) => {
                if (!lead.timestamp) return false;

                try {
                  // Support both Firestore Timestamp and plain date/number/string
                  const leadDate =
                    typeof lead.timestamp?.toDate === "function"
                      ? lead.timestamp.toDate()
                      : new Date(lead.timestamp);

                  if (Number.isNaN(leadDate.getTime())) return false;

                  return (
                    leadDate.getMonth() === currentMonth &&
                    leadDate.getFullYear() === currentYear
                  );
                } catch {
                  return false;
                }
              });

              totalLeadsCount += filteredLeads.length; // Count only leads from the current month
            }
          });

          setTotalLeads(totalLeadsCount);
        },
        (error) => {
          console.error("Error in employees listener:", error);
          toast.error("Error loading employee data");
        }
      );
    } catch (error) {
      console.error("Error setting up employees listener:", error);
      return null;
    }
  };

  // This is the key fix - properly fetching sales for the current month
  const fetchSales = () => {
    if (SalesPersons && SalesPersons.length > 0) {
      const unsubscribeList = SalesPersons.map((person) => {
        const salesRef = doc(db, "sales", person.uid);

        return onSnapshot(salesRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            let leadSource = "--";
            let sales = 0;
            let filteredSales = [];

            if (data?.sales?.length > 0) {
              // Get current month and year
              const today = new Date();
              const currentMonth = today.getMonth();
              const currentYear = today.getFullYear();

              // Filter sales by current month and year
              filteredSales = data.sales.filter((sale) => {
                if (sale.saleType === "wholesale") return false;
                if (!sale.intermediateDate) return false;
                const saleDate = new Date(sale.intermediateDate);
                return (
                  saleDate.getMonth() === currentMonth &&
                  saleDate.getFullYear() === currentYear
                );
              });

              const leadSourceTemp = filteredSales.map(
                (sale) => sale.leadSource
              );
              leadSource = [...new Set(leadSourceTemp)].join(",");
              sales = filteredSales.length;
            }

            // Update the specific user's sales data
            setUpdatedSalesPerson((prev) => {
              const newData = [...prev];
              const index = newData.findIndex((p) => p.uid === person.uid);

              if (index !== -1) {
                newData[index] = {
                  ...newData[index],
                  leadSource: leadSource,
                  totalSales: sales,
                  sales: filteredSales || [],
                };
              } else {
                newData.push({
                  ...person,
                  leadSource: leadSource,
                  totalSales: sales,
                  sales: filteredSales || [],
                });
              }

              return newData;
            });
          } else {
            // Handle case where sales doc doesn't exist for this user
            setUpdatedSalesPerson((prev) => {
              const newData = [...prev];
              const index = newData.findIndex((p) => p.uid === person.uid);

              if (index !== -1) {
                newData[index] = {
                  ...newData[index],
                  leadSource: "--",
                  totalSales: 0,
                  sales: [],
                };
              } else {
                newData.push({
                  ...person,
                  leadSource: "--",
                  totalSales: 0,
                  sales: [],
                });
              }

              return newData;
            });
          }
        });
      });

      return () => {
        unsubscribeList.forEach((unsubscribe) => unsubscribe());
      };
    }
    return () => { };
  };

  useEffect(() => {
    const unsubscribe = fetchSales();
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [SalesPersons]);

  // Merge sales data with employee data and sort
  useEffect(() => {
    if (updatedSalesPerson.length > 0) {
      const mergedSalesPersons = updatedSalesPerson.map((person) => {
        const matchingSalesData = (salesData || []).find(
          (sale) => sale?.userId === person?.uid
        );

        return {
          ...person,
          midMonthSales: matchingSalesData ? matchingSalesData.midMonth : 0,
          salesCompleted: matchingSalesData
            ? matchingSalesData.salesCompleted
            : 0,
          target: matchingSalesData ? matchingSalesData.target : 0,
        };
      });

      // Sort based on total sales
      const sortedSalesPersons = mergedSalesPersons.sort(
        (a, b) => (b.totalSales || 0) - (a.totalSales || 0)
      );

      setSortedSalesPerson(sortedSalesPersons);

      const totalSalesCount = mergedSalesPersons.reduce((total, person) => {
        return total + (person?.totalSales || 0);
      }, 0);

      setTotalSales(totalSalesCount);
    }
  }, [updatedSalesPerson, salesData]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "leads"),
      (snapshot) => {
        const fetchedLeads = snapshot.docs.map((doc) => doc.data().leadName);
        setLeads(fetchedLeads);
      },
      (error) => {
        console.error("Error fetching leads: ", error);
        toast.error("Failed to fetch leads: " + error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  function getFormattedDate() {
    const date = new Date();

    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.getFullYear();

    const suffix = (day) => {
      if (day > 3 && day < 21) return "th";
      switch (day % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };

    return `${day}${suffix(day)} ${month}, ${year}`;
  }

  if (!SalesPersons) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <Loader />
      </div>
    );
  }

  // Function to save order to Firebase
  const saveOrderToFirebase = async (order) => {
    try {
      // Filter out any stale entries that no longer exist in SalesPersons
      const validOrder = order.filter((p) =>
        SalesPersons?.some((sp) => sp.uid === p.uid)
      );
      await setDoc(doc(db, "settings", "salesOrder"), { order: validOrder });
    } catch (error) {
      console.error("Error saving order: ", error);
    }
  };

  // Function to handle drag start with visual feedback
  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = "move";
    // Set some visual feedback when dragging starts
    e.target.classList.add("dragging");
    dragItem.current = index;
  };

  // Function to handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOverItem.current = index;

    // Add visual indicator for drop position
    const cards = document.querySelectorAll(".person-card");
    cards.forEach((card) => card.classList.remove("drag-over"));
    cards[index].classList.add("drag-over");
  };

  // Function to handle drag end
  const handleDragEnd = (e) => {
    e.target.classList.remove("dragging");
    // Remove visual indicators
    const cards = document.querySelectorAll(".person-card");
    cards.forEach((card) => card.classList.remove("drag-over"));
  };

  // Function to handle drop
  const handleDrop = (e) => {
    e.preventDefault();

    // Copy current order
    const copyItems = [...sortedCardsPerson];

    // Remove dragged item
    const draggedItemContent = copyItems[dragItem.current];

    // Only proceed with the swap if both positions are valid
    if (dragItem.current !== null && dragOverItem.current !== null) {
      // Remove the dragged item
      copyItems.splice(dragItem.current, 1);

      // Insert at new position
      copyItems.splice(dragOverItem.current, 0, draggedItemContent);

      // Update state and save to Firebase
      setSortedCardsPerson(copyItems);
      saveOrderToFirebase(copyItems);
    }

    // Reset refs
    dragItem.current = null;
    dragOverItem.current = null;

    // Remove visual indicators
    e.target.classList.remove("drag-over");
    document.querySelectorAll(".person-card").forEach((card) => {
      card.classList.remove("dragging");
      card.classList.remove("drag-over");
    });
  };

  // This is a key fix - find sales data for each person
  const getPersonWithSales = (person) => {
    // Find this person's sales data from updatedSalesPerson
    const personWithSales = updatedSalesPerson.find(
      (p) => p.uid === person.uid
    );
    const personSalesData = salesData.find((sd) => sd.userId === person.uid);

    if (personWithSales) {
      return {
        ...person,
        sales: personWithSales.sales || [],
        totalSales: personWithSales.totalSales || 0,
        target: personSalesData ? personSalesData.target : 0,
        salesCompleted: personSalesData ? personSalesData.salesCompleted : 0,
        midMonthSales: personSalesData ? personSalesData.midMonth : 0,
      };
    }

    return {
      ...person,
      sales: [],
      totalSales: 0,
      target: personSalesData ? personSalesData.target : 0,
      salesCompleted: personSalesData ? personSalesData.salesCompleted : 0,
      midMonthSales: personSalesData ? personSalesData.midMonth : 0,
    };
  };

  // Determine which array to render cards from and ensure each person has their sales data
  const displayPersons = (
    sortedCardsPerson?.length > 0 ? sortedCardsPerson : SalesPersons || []
  )
    .map((person) => getPersonWithSales(person))
    .filter((p) => SalesPersons?.some((sp) => sp.uid === p.uid)); // Ensure only valid salespersons

  return (
    <div>
      <div className=" min-h-screen  w-full  px-12 mx-auto">
        <header className="flex justify-between items-top pt-6 pb-2">
          <div className=" flex  gap-8  items-center justify-center">
            <Link to="/">
              <img src={logo} className="max-w-[220px]" alt="RTA Logo" />
            </Link>
            <p className="text-2xl font-bold">
              People we have helped this month
            </p>
          </div>
          <div className="flex items-center gap-5 mb-5 ">
            <div className="text-xl font-bold ">{getFormattedDate()}</div>
            <div className="flex justify-end gap-5">
              <StatButton
                label={`${midMonthSales}/${Math.ceil(totalSalestarget / 2)}`}
                duration="Mid-Month"
                color="bg-[#003160]"
              />
              <StatButton
                label={`${totalCompletedSales}/${totalSalestarget}`}
                duration="End-Month"
                color="bg-[#1FABFA]"
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-3 mb-8  max-w-[1500px] ">
          <InfoCard
            title="Total Leads"
            value={totalLeadsCount}
            src="icon-1.png"
          />
          <InfoCard title="Total Sales" value={totalSales} src="icon-2.png" />
          <InfoCard
            title="Conversion Rate"
            value={`${
              totalLeadsCount === 0
                ? 0
                : ((totalSales / totalLeadsCount) * 100).toFixed(2)
            }%`}
            src="icon-4.png"
          />
        </div>

        {/* People Grid */}
        <div className="flex flex-row gap-4 flex-wrap">
          {displayPersons.map((person, index) => (
            <div
              key={person.uid}
              className="person-card cursor-move"
              draggable="true"
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            >
              <PersonCard
                name={person?.name}
                uid={person?.uid}
                sales={person?.sales || []}
                target={person?.target || 0}
                isDeleted={person?.isDeleted || false}
                salesCompleted={person?.salesCompleted || 0}
                midMonthSales={person?.midMonthSales || 0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Add CSS for drag-and-drop visual feedback */}
      <style jsx>{`
        .person-card.dragging {
          opacity: 0.6;
          transform: scale(0.98);
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
          z-index: 1000;
        }

        .person-card.drag-over {
          border: 2px dashed #3498db;
          transform: scale(1.01);
          transition: transform 0.2s;
        }
      `}</style>
    </div>
  );
};

const InfoCard = ({ title, value, src, delegate = null }) => {
  let leadSources = "";
  if (delegate) {
    leadSources = delegate.join(",");
  }

  return (
    <div className="bg-white rounded-lg shadow-custom-drop flex items-center  py-4  px-6 justify-between  max-w-[400px]">
      <div className="text-xl font-bold ">{title}</div>
      <div className="text-xl  font-bold">{value}</div>
    </div>
  );
};

const StatButton = ({ label, color, duration }) => (
  <button
    className={` text-white flex  gap-2   justify-center items-center px-5 py-3 rounded-lg font-bold ${color}`}
  >
    <p className="text-xl "> {label}</p>
    <span className="text-xl">{duration}</span>
  </button>
);

const ClientCard = ({
  name,
  company,
  grossProfit,
  leadSource,
  InsuranceStatus,
  FundStatus,
  vehicleModel,
  saleType,
}) => {
  const [limit, setLimit] = useState([]);

  React.useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "SalesLimit"));
      const fetchedLimits = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        limit: doc.data().limit,
      }));

      setLimit(fetchedLimits);
    } catch (error) {
      console.error("Error fetching leads: ", error);
      toast.error("Failed to fetch leads: " + error.message);
    }
  };

  // Determine card color based on status
  let color = "";
  if (FundStatus && InsuranceStatus) {
    color = "#10C900";
  } else if (InsuranceStatus && !FundStatus) {
    color = "#0E376C";
  } else {
    color = "#6636C0";
  }

  return (
    <div
      className="p-2 rounded-lg shadow-md w-full max-w-[185px] xl:max-w-none text-white flex justify-between items-center flex-col"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-center justify-between gap-4 w-full p-1">
        <div className="flex items-center gap-1">
          <h3 className="font-semibold">{name}</h3>
        </div>

        {grossProfit >= Number(limit[0]?.limit) ? <FaCircleCheck /> : null}
      </div>

      <div className="fle flex-col gap-4 w-full p-1">
        <p className="text-sm">
          {company} {vehicleModel}
        </p>

        <div className="w-full">
          <p className="text-sm w-full text-end">{leadSource}</p>
        </div>
      </div>
    </div>
  );
};

const PersonCard = ({
  name,
  uid,
  sales,
  target,
  salesCompleted,
  isDeleted,
  midMonthSales,
}) => {
  return (
    <div className="bg-white p-4 rounded-lg border border-[#989898] m-1 shadow-lg w-[95vw] h-fit overflow-auto masonry-item">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-4">{name}</h2>

        <div className="flex justify-end space-x-2 mb-4">
          <button className="px-4 py-2 bg-[#003160] text-white rounded-lg">
            {midMonthSales}/{Math.ceil(target / 2)} Mid - Month
          </button>
          <button className="px-4 py-2 bg-[#1FABFA] text-white rounded-lg">
            {salesCompleted}/{target} End - Month
          </button>
        </div>
      </div>

      <div className="grid masonry-2 gap-4">
        {sales && sales.length > 0 ? (
          sales.map((sale, idx) => (
            <ClientCard
              key={idx}
              name={
                sale.saleType === "wholesale"
                  ? sale.dealershipPurchase
                  : sale.customerName
              }
              company={sale.vehicleMake}
              vehicleModel={sale.vehicleModel}
              leadSource={sale.leadSource}
              FundStatus={sale.FundStatus}
              InsuranceStatus={sale.InsuranceStatus}
              grossProfit={sale.grossProfit}
              saleType={sale.saleType}
            />
          ))
        ) : (
          <div className="flex items-center justify-center w-full h-full col-span-4 row-span-4">
            No sales yet
          </div>
        )}
      </div>
    </div>
  );
};

export default TVScreen;
