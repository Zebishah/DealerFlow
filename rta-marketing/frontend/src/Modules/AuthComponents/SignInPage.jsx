import { useState } from "react";
import { toast } from "react-toastify";
import { auth, db } from "../../config/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import "react-toastify/dist/ReactToastify.css";
import logo from "../../images/rta-logo.png";
import { Eye, EyeOff } from "lucide-react";
const SignInPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // State to manage loading
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const handleForgotPassword = (e) => {
    e.preventDefault(); // Prevent form submission when clicking forgot password
    navigate("/forgotPassword");
  };
  const LoginUser = async (e) => {
    e.preventDefault();
    setLoading(true); // Set loading to true when starting the login process

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      // console.log("User signed in:", user);

      const queryCollection = async (collectionName) => {
        const q = query(
          collection(db, collectionName),
          where("uid", "==", user.uid)
        );
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
      toast.success("You signed in successfully");
      // Check in "admins" collection
      let userData = await queryCollection("admins");
      if (userData) {
        navigate("/AdminLayout");
      }

      // Check in "employees" collection
      userData = await queryCollection("employees");
      if (userData) {
        navigate("/EmployeeLayout");
      }

      // Check in "virtual-assistants" collection
      userData = await queryCollection("virtual-assistants");
      if (userData) {
        navigate("/VirtualAssistantLayout");
      }

      // console.log(currentUser);
    } catch (error) {
      console.error("Error signing in:", error.message);
      toast.error("Sign-in failed: " + error.message);
    } finally {
      setLoading(false); // Reset loading to false when the process is done
    }
  };

  return (
    <div className="flex flex-col justify-center items-center w-screen bg-[#061861] h-screen">
      <div className="flex flex-col items-center w-[50%] justify-center bg-white rounded-md shadow-lg gap-y-12 p-10">
        <img src={logo} className="max-w-[220px]" />
        <div className="flex flex-col items-center justify-center w-full gap-y-8">
          <h1 className="text-2xl font-bold text-black">Login Form</h1>
          <div className="flex flex-col items-center justify-center w-full">
            <form
              className="w-[45%] flex flex-col items-center justify-center gap-y-6"
              onSubmit={LoginUser}
              noValidate
            >
              <input
                type="text"
                name="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 border-gray-300 rounded-md border-1 placeholder:text-gray-500"
                placeholder="Email"
              />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  name="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-md placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none pr-12"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="flex flex-col items-center justify-center w-full gap-y-5">
                <div className="flex flex-col items-end justify-end w-full">
                  <button
                    type="button"
                    className="text-black cursor-pointer"
                    onClick={handleForgotPassword} // Handle forgot password navigation
                  >
                    Forgot Password?
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center w-full p-4 text-white bg-blue-400 rounded-md shadow-lg cursor-pointer"
                    disabled={loading} // Disable the button when loading
                  >
                    {loading ? (
                      <svg
                        className="w-5 h-5 text-white animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8V12H4z"
                        ></path>
                      </svg>
                    ) : (
                      "Login"
                    )}
                  </button>
                </div>

                <div className="flex flex-col items-end justify-end w-full">
                  <p className="text-black cursor-pointer">Not a member?</p>
                  <Link to={"/signUp"} className="w-full">
                    <button className="bg-[#004e81] rounded-md text-white shadow-lg p-4 w-full">
                      Sign Up
                    </button>
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
