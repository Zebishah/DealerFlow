import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../../config/firebaseConfig";

const LeadSource = () => {
  const [leads, setLeads] = useState([]);
  const [inputLead, setInputLead] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "leads"));
        const fetchedLeads = querySnapshot.docs.map(
          (doc) => doc.data().leadName
        );
        setLeads(fetchedLeads);
      } catch (error) {
        console.error("Error fetching leads: ", error);
        toast.error("Failed to fetch leads: " + error.message);
      }
    };

    fetchLeads();
  }, [showForm]);

  const handleInput = (e) => {
    const leadInput = e.target.value;
    setInputLead(leadInput);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (inputLead === "") {
      toast.error("Lead Source cannot be empty", "Lead Source cannot be empty");
      return;
    }
    const lowerCaseLead = inputLead.toLowerCase();
    const CapitalizedLead =
      lowerCaseLead.charAt(0).toUpperCase() + lowerCaseLead.slice(1);

    const isDuplicate = leads.includes(CapitalizedLead);
    if (isDuplicate) {
      toast.error("Lead Source already Exist", "Lead Source already Exist");
      return;
    }

    setLeads([...leads, CapitalizedLead]);

    try {
      await addDoc(collection(db, "leads"), {
        leadName: CapitalizedLead,
        createdAt: new Date(),
      });
      toast.success("Lead Source added successfully!");

      setLeads([...leads, CapitalizedLead]);
    } catch (error) {
      toast.error("Error adding lead: " + error.message);
    }
    setShowForm(false);
    setInputLead("");
  };
  const handleShowForm = () => {
    setShowForm(true);
  };
  return (
    <div className=" w-full h-full  p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-center">Lead Source</h1>
        <button
          className="bg-[#003160] text-white px-10 py-2  rounded-full text-[24px]"
          onClick={handleShowForm}
        >
          Add lead source <span>+</span>
        </button>
      </div>
      <div>
        <ul className="py-10 px-6">
          {leads.map((lead, index) => {
            return (
              <li className="text-[20px] list-disc font-medium " key={index}>
                {lead}
              </li>
            );
          })}
        </ul>
      </div>
      {showForm && (
        <div className="w-[786px]">
          <form
            onSubmit={handleFormSubmit}
            className="flex flex-col w-full items-end"
          >
            <label
              htmlFor="lead-source"
              className="text-[20px] font-medium self-start"
            >
              New lead Source
            </label>
            <input
              type="text"
              name="lead-source"
              id="lead-source"
              value={inputLead}
              placeholder="Leads source"
              className=" block border-2 w-full border-[#adadadc6]   p-3 rounded-md my-2"
              onChange={handleInput}
            />
            <input
              type="submit"
              value="Upload"
              className=" bg-[#003160] text-white  py-2 px-8  text-[20px] rounded-md mt-8"
            />
          </form>
        </div>
      )}
    </div>
  );
};

export default LeadSource;
