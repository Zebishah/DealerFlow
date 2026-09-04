import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebaseConfig";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { Loader } from "../../Utils/Loader";

const SalesPersonPage = () => {
  const [SalesPersons, setSalesPerson] = useState([]);
  const [updatedSalesPerson, setUpdatedSalesPerson] = useState(null);
  const [searchTerm, setSearchTerm] = useState(""); // Add state for search term

  const fetchSalesPerson = async () => {
    try {
      const SalePersonsRef = collection(db, "employees");

      const q = query(SalePersonsRef, where("userType", "==", "Employee"));

      const querySnapshot = await getDocs(q);

      const results = [];

      querySnapshot.forEach((doc) => {
        const SalePerson = doc.data();

        const { password, ...rest } = SalePerson;

        results.push(rest);
      });

      setSalesPerson(results);
    } catch (error) {
      console.error("Error fetching Sale Persons: ", error);
      toast.error("Failed to fetch Sales Person: " + error.message);
    }
  };

  useEffect(() => {
    fetchSalesPerson();
  }, []);

  const fetchSales = async () => {
    try {
      if (SalesPersons.length > 0) {
        const UpdatedSalesPersonTemp = await Promise.all(
          SalesPersons.map(async (person) => {
            const salesRef = doc(db, "sales", person.uid);
            const docSnap = await getDoc(salesRef);

            if (docSnap.exists()) {
              const data = docSnap.data();
              let leadSource = "--";
              let sales = 0;

              if (data?.sales.length > 0) {
                const leadSourceTemp = data.sales.map(
                  (sale) => sale.leadSource
                );
                leadSource = [...new Set(leadSourceTemp)].join(",");
                sales = data.sales.length;
              }

              return {
                ...person,
                leadSource: leadSource,
                totalSales: sales,
                sales: data?.sales || null,
              };
            } else {
              return {
                ...person,
                leadSource: "--",
                totalSales: 0,
                sales: [],
              };
            }
          })
        );

        setUpdatedSalesPerson(UpdatedSalesPersonTemp);
      }
    } catch (error) {
      console.error("Error fetching sales data: ", error);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [SalesPersons]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredSalesPersons = updatedSalesPerson?.filter((person) =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!updatedSalesPerson) {
    return <Loader />;
  }

  return (
    <div className="w-full min-h-screen p-10 px-14 bg-[#f3f3f3] pt-20">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-center">Sales Person</h1>
        <div className="">
          <div className="relative w-full">
            <FaSearch className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400 outline-none border-none text-sm " />

            <input
              type="text"
              className="w-full pl-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0E376C] pr-8"
              placeholder="Search by Name to Filter..."
            />
          </div>
        </div>
      </div>
      <div className="py-8 flex gap-5 flex-wrap justify-between h-full">
        {filteredSalesPersons?.length > 0
          ? filteredSalesPersons.map((person, index) => (
              <div
                className="bg-[white] p-8 rounded-lg mb-8 mt-2 flex basis-[47%] flex-col gap-2 items-start shadow-md"
                key={`${person?.name}-${index}`}
              >
                <h3 className="text-[18px] font-medium capitalize">
                  {person.name}
                </h3>
                <p className="text-[16px] text-[#2E2E2E] font-normal">
                  Total Leads:{" "}
                  <span className="font-medium text-black">{0}</span>
                </p>

                <p className="text-[16px] text-[#2E2E2E] font-normal">
                  Lead Sources:{" "}
                  <span className="font-medium text-black">
                    {person.leadSource}
                  </span>
                </p>
                <p className="text-[16px] text-[#2E2E2E] font-normal">
                  Total Sales :{" "}
                  <span className="font-medium text-black">
                    {person.totalSales}
                  </span>
                </p>
                <p className="text-[16px] text-[#2E2E2E] font-normal">
                  Conversion :{" "}
                  <span className="font-medium text-black">{"27%"}</span>
                </p>
                <Link
                  className="mt-4 px-4 py-2 rounded-md bg-[#0E376C] text-white text-[18px] font-medium"
                  to={`/AdminLayout/sale/${person.uid}?leads=${person.totalSales}&sales=${person.totalSales}&name=${person.name}`}
                >
                  View More
                </Link>
              </div>
            ))
          : "No salespersons found"}
      </div>
    </div>
  );
};

export default SalesPersonPage;
