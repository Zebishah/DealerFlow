import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "./config/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import PropTypes from "prop-types";
import { sendEmailVerification, signOut } from "firebase/auth";
import { toast } from "react-toastify";

export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(
    JSON.parse(localStorage.getItem("currentUser")) || null
  );
  const [isEmailVerified, setIsEmailVerified] = useState(
    JSON.parse(localStorage.getItem("isEmailVerified")) || false
  );
  const [loading, setLoading] = useState(true);
  // console.log(currentUser);
  const getUserInfo = async (uid) => {
    // console.log(uid);

    const queryCollection = async (collectionName) => {
      const q = query(collection(db, collectionName), where("uid", "==", uid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }))[0];
      } else {
        return null;
      }
    };

    let userData = await queryCollection("admins");
    if (userData) {
      // console.log("User Data from admins:", userData);
      return userData;
    }

    userData = await queryCollection("employees");
    if (userData) {
      // console.log("User Data from employees:", userData);
      return userData;
    }

    userData = await queryCollection("virtual-assistants");
    if (userData) {
      // console.log("User Data from virtual-assistants:", userData);
      return userData;
    }

    // console.log("No such document!");
    return null;
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          setIsEmailVerified(user.emailVerified);
          const userData = await getUserInfo(user.uid);
          setCurrentUser(userData);

          // Store in localStorage
          localStorage.setItem("currentUser", JSON.stringify(userData));
          localStorage.setItem(
            "isEmailVerified",
            JSON.stringify(user.emailVerified)
          );

          // Optional: If you have a userType
          localStorage.setItem("userType", userData?.userType || "");

          setLoading(false);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setCurrentUser(null);
          setIsEmailVerified(false);
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setIsEmailVerified(false);
        setLoading(false);

        // Clear localStorage
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isEmailVerified");
        localStorage.removeItem("userType");
      }
    });

    return () => unsubscribe(); // Clean up subscription
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsEmailVerified(false);

      // Clear the current user from localStorage
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isEmailVerified");
      localStorage.removeItem("userType");

      // console.log("User signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const verifyEmail = async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      // console.log("Email verification sent!");
    } catch (error) {
      toast.error("Error sending email verification:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isEmailVerified,
        handleLogout,
        loading,
        verifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
