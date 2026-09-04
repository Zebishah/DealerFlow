import { ToastContainer } from "react-toastify";
import { useAuth } from "../../AuthContext";
import "react-toastify/dist/ReactToastify.css";
const AdminDashboard = () => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen loading-spinner">
        {/* Spinner */}
        <div className="w-16 h-16 border-4 rounded-full border-t-transparent border-gray-900/50 animate-spin"></div>
      </div>
    ); // or you can display a fallback UI or redirect
  }
  return (
    <div className="flex items-start justify-start h-full p-6">
      <div className="flex flex-col items-center justify-center">
        <h1>Login As : {currentUser.userType} </h1>
        <p>Email : {currentUser.email}</p>
        <p>Name : {currentUser.name}</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
