import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Loader } from "./Loader";

// Import your Auth context

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) {
    // Render a loading spinner or some placeholder UI
    return <Loader />;
  }
  if (!currentUser) {
    // Redirect to the login page if user is not authenticated
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;
