// import React from "react";

// const LeadsPages = () => {
//   return <div>LeadsPages</div>;
// };

// export default LeadsPages;

import { useState } from "react";
import HeaderComponent from "../VirtualAssistantComponents/components/HeaderComponent";
import LeadsPageVA from "../VirtualAssistantComponents/components/LeadsTableAll";
import UploadLeadModal from "../VirtualAssistantComponents/components/UploadLeadModal";
import UpperCards from "../VirtualAssistantComponents/components/UpperCards";
import { LeadSourceModal } from "./SalesHeader";
import { useAuth } from "../../AuthContext";
import LeadTabs from "./components/LeadTabs";

// import HeaderComponent from "../components/HeaderComponent";
// import LeadsPageVA from "../components/LeadsTableAll.jsx";
// import UpperCards from "../components/UpperCards";
// import UploadLeadModal from "../components/UploadLeadModal";

const LeadsPages = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leadSources, setLeadSources] = useState([]);
  const [SalesPerson, setSalesPerson] = useState([""]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const { currentUser } = useAuth();

  return (
    <div className="flex flex-col gap-y-8 w-full h-full">
      <HeaderComponent
        title="Leads"
        buttonText="Upload New Lead"
        showButton={true}
        onButtonClick={() => setIsModalOpen(true)}
        className=""
        showModal={showModal}
        setShowModal={setShowModal}
      />
      <UpperCards
        leadSources={leadSources}
        SalesPerson={SalesPerson}
        totalLeads={totalLeads}
      />
      {currentUser.userType === "Admin" ? (
        <LeadTabs
          leadSources={leadSources}
          setLeadSources={setLeadSources}
          SalesPerson={SalesPerson}
          setSalesPerson={setSalesPerson}
          setTotalLeads={setTotalLeads}
        />
      ) : (
        <LeadsPageVA
          leadSources={leadSources}
          setLeadSources={setLeadSources}
          SalesPerson={SalesPerson}
          setSalesPerson={setSalesPerson}
          setTotalLeads={setTotalLeads}
        />
      )}

      <UploadLeadModal
        isOpen={isModalOpen}
        leadSources={leadSources}
        SalesPerson={SalesPerson}
        onClose={() => setIsModalOpen(false)}
      />
      <LeadSourceModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};

export default LeadsPages;
