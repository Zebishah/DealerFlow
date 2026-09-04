// import { useState } from "react";
// import { IoMdClose } from "react-icons/io";
// import { FaPlusCircle, FaMinusCircle } from "react-icons/fa";
// import { doc, setDoc } from "firebase/firestore";
// import { db } from "../../../config/firebaseConfig";
// import { toast } from "react-toastify";

// const DynamicCommissionModal = ({
//   onClose,
//   userId = null,
//   userName = null,
//   globalRule,
//   refetch,
// }) => {
//   const [loading, setLoading] = useState(false);
//   const [unitThreshold, setUnitThreshold] = useState(
//     globalRule?.minSalesCount || 0
//   );
//   const [grossThreshold, setGrossThreshold] = useState(
//     globalRule?.minAvgSalesGross || 0
//   );
//   const [bonusPercentage, setBonusPercentage] = useState(
//     globalRule?.bonusCommissionRate || 0
//   );

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);

//     const payload = {
//       minSalesCount: Number(unitThreshold),
//       minAvgSalesGross: Number(grossThreshold),
//       bonusCommissionRate: Number(bonusPercentage),
//     };

//     const path = userId
//       ? doc(db, "userCommissionRules", userId)
//       : doc(db, "commissionRules", "global");

//     try {
//       await setDoc(path, payload, { merge: true });

//       toast.success(
//         userId
//           ? "User-specific commission rule saved!"
//           : "Global commission rule saved!"
//       );
//       refetch();
//       onClose();
//     } catch (error) {
//       console.error("Error saving commission rule:", error);
//       toast.error("Failed to save commission rule.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div
//       onClick={onClose}
//       className="fixed inset-0 z-50 flex items-center justify-center w-full overflow-x-hidden overflow-y-auto outline-none focus:outline-none"
//     >
//       <div
//         onClick={(e) => e.stopPropagation()}
//         className="relative w-full max-w-[700px] mx-auto "
//       >
//         <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none pt-[90px] pb-[70px] pl-[103px] pr-[135px] z-10">
//           {/* Header */}
//           <button
//             onClick={onClose}
//             className="hover:bg-gray-100 p-1 rounded-full absolute   right-[30px] top-[41px]"
//           >
//             <IoMdClose size={24} />
//           </button>
//           <div className="flex items-center justify-start mb-8">
//             <h1 className="text-[26px] font-semibold">
//               Dynamic commission
//               {userId ? ` for ${userName}` : "(Global)"}
//             </h1>
//           </div>

//           {/* Body */}
//           <div className="space-y-6">
//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-xl mb-2">Units Sold</label>
//                 <input
//                   type="number"
//                   className="w-full p-3 border rounded-lg h-[57px] bg-white text-gray-600"
//                   value={unitThreshold}
//                   placeholder="No of Sales"
//                   onChange={(e) => setUnitThreshold(e.target.value)}
//                 />
//               </div>
//               <div>
//                 <label className="block text-xl mb-2">Gross Amount ($)</label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     className="w-full p-3 border rounded-lg pr-16 h-[57px]"
//                     value={grossThreshold}
//                     onChange={(e) => {
//                       setGrossThreshold(e.target.value);
//                     }}
//                     placeholder="Enter Gross amount"
//                   />
//                 </div>
//               </div>
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-xl mb-2">
//                   Bonus comission (%)
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     className="w-full p-3 border rounded-lg pr-16 h-[57px]"
//                     value={bonusPercentage}
//                     onChange={(e) => {
//                       setBonusPercentage(e.target.value);
//                     }}
//                     placeholder="Enter Bonus %"
//                   />
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Footer */}
//           <div className="mt-8 flex justify-end">
//             <button
//               disabled={loading}
//               onClick={handleSubmit}
//               className="bg-blue-900 text-white px-6 py-2 rounded-lg text-2xl font-medium hover:bg-blue-800 mt-[50px] transition-colors disabled:opacity-50"
//             >
//               {loading
//                 ? "Adding"
//                 : userId
//                 ? "Add Custom Commission"
//                 : "Add Global Commission"}
//             </button>
//           </div>
//         </div>
//       </div>
//       <div className="fixed inset-0 bg-black opacity-25"></div>
//     </div>
//   );
// };

// export default DynamicCommissionModal;

import { useState } from "react";
import { IoMdClose } from "react-icons/io";
import { FaPlusCircle, FaMinusCircle, FaTrash } from "react-icons/fa";
import {
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../../config/firebaseConfig";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";

const DynamicCommissionModal = ({
  onClose,
  userId = null,
  userName = null,
  globalRule,
  refetch,
}) => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState(globalRule?.rules || []);
  const [newRule, setNewRule] = useState({
    minSalesCount: 0,
    minAvgSalesGross: 0,
    bonusCommissionRate: 0,
  });

  const handleAddRule = () => {
    // if (!newRule.minSalesCount || !newRule.minAvgSalesGross) {
    //   toast.error("Please fill all required fields");
    //   return;
    // }
    const { minSalesCount, minAvgSalesGross, bonusCommissionRate } = newRule;

    if (
      minSalesCount === null ||
      minSalesCount === undefined ||
      Number.isNaN(minSalesCount) ||
      minAvgSalesGross === null ||
      minAvgSalesGross === undefined ||
      Number.isNaN(minAvgSalesGross) ||
      bonusCommissionRate === null ||
      bonusCommissionRate === undefined ||
      Number.isNaN(bonusCommissionRate)
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    setRules([...rules, { ...newRule, id: uuidv4() }]);
    setNewRule({
      minSalesCount: 0,
      minAvgSalesGross: 0,
      bonusCommissionRate: 0,
    });
  };

  const handleDeleteRule = (id) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      rules,
      // Keep existing fields for backward compatibility
      minSalesCount: rules.length > 0 ? rules[0].minSalesCount : 0,
      minAvgSalesGross: rules.length > 0 ? rules[0].minAvgSalesGross : 0,
      bonusCommissionRate: rules.length > 0 ? rules[0].bonusCommissionRate : 0,
    };

    const path = userId
      ? doc(db, "userCommissionRules", userId)
      : doc(db, "commissionRules", "global");

    try {
      await setDoc(path, payload, { merge: true });
      toast.success(
        userId
          ? "User commission rules saved!"
          : "Global commission rules saved!"
      );
      refetch();
      onClose();
    } catch (error) {
      console.error("Error saving commission rules:", error);
      toast.error("Failed to save commission rules.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center w-full overflow-x-hidden  bg-[#00000076] overflow-y-auto outline-none focus:outline-none "
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[700px] mx-auto   "
      >
        <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none pt-[40px] pb-[30px] pl-[60px] pr-[60px] z-10">
          <button
            onClick={onClose}
            className="hover:bg-gray-100 p-1 rounded-full absolute right-[30px] top-[41px]"
          >
            <IoMdClose size={24} />
          </button>
          <div className="flex items-center justify-start mb-8">
            <h1 className="text-[26px] font-semibold">
              {userId
                ? `${userName}'s Commission Rules`
                : "Global Commission Rules"}
            </h1>
          </div>

          <div className="space-y-6">
            {/* Existing Rules List */}
            {rules.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Current Rules</h3>
                <div className="space-y-3">
                  {rules.map((rule, index) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p>
                          Sales: {rule.minSalesCount} | Gross: $
                          {rule.minAvgSalesGross} | Bonus:{" "}
                          {rule.bonusCommissionRate}%
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Rule Form */}
            <div className={` ${rules.length > 0 && "border-t"}  pt-4`}>
              <h3 className="text-lg font-semibold mb-3">Add New Rule</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xl mb-2">Units Sold</label>
                  <input
                    type="number"
                    className="w-full p-3 border rounded-lg h-[57px]"
                    value={newRule.minSalesCount}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        minSalesCount: parseInt(e.target.value),
                      })
                    }
                    placeholder="No of Sales"
                  />
                </div>
                <div>
                  <label className="block text-xl mb-2">Gross Amount ($)</label>
                  <input
                    type="number"
                    className="w-full p-3 border rounded-lg h-[57px]"
                    value={newRule.minAvgSalesGross}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        minAvgSalesGross: parseFloat(e.target.value),
                      })
                    }
                    placeholder="Enter Gross amount"
                  />
                </div>
                <div>
                  <label className="block text-xl mb-2">
                    Bonus Commission (%)
                  </label>
                  <input
                    type="number"
                    className="w-full p-3 border rounded-lg h-[57px]"
                    value={newRule.bonusCommissionRate}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        bonusCommissionRate: parseFloat(e.target.value),
                      })
                    }
                    placeholder="Enter Bonus %"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddRule}
                    className="bg-[#003160] text-white px-4 py-3 rounded-lg hover:bg-blue-800 flex items-center gap-2"
                  >
                    <FaPlusCircle /> Add Rule
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              disabled={loading || rules.length === 0}
              onClick={handleSubmit}
              className="bg-[#003160] text-white px-6 py-2 rounded-lg text-2xl font-medium hover:bg-blue-800 mt-[50px] transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Rules"}
            </button>
          </div>
        </div>
      </div>
      <div className="fixed inset-0 bg-black opacity-25"></div>
    </div>
  );
};

export default DynamicCommissionModal;
