import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { auth, db } from "../../config/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryAllCollections = async () => {
    const collections = ["admins", "employees", "virtual-assistants"];
    for (let col of collections) {
      const q = query(collection(db, col), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        // Get the first document (should only be one if emails are unique)
        const userDoc = querySnapshot.docs[0];
        const uid = userDoc.id;
        // Now fetch the user's details using the UID
        const userRef = doc(db, col, uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          return { ...userSnapshot.data(), id: uid, collection: col };
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Prevent multiple submissions
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let userData = await queryAllCollections();

      if (!userData) {
        toast.error("This email is not registered.");
        return;
      }
      await sendPasswordResetEmail(auth, email);
      toast.success("Check your email account for reset instructions.");
      setTimeout(() => {
        navigate("/signIn");
      }, 5000);
    } catch (err) {
      console.error("Error resetting password:", err);
      if (err.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please try again later.");
      } else if (err.code === "auth/invalid-email") {
        toast.error("Invalid email address.");
      } else {
        toast.error("Error sending reset email. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main
        id="content"
        role="main"
        className="flex items-center justify-center w-screen h-screen p-6 bg-blue-700"
      >
        <div className="bg-white w-[30%] border-2 border-indigo-300 shadow-lg mt-7 rounded-xl dark:bg-white dark:border-gray-700">
          <div className="p-4 sm:p-7">
            <div className="text-center">
              <h1 className="block text-2xl font-bold text-gray-800 dark:text-gray-800">
                Forgot password?
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-600">
                Remember your password?
                <Link
                  className="font-medium text-blue-600 decoration-2 hover:underline"
                  to={"/signIn"}
                >
                  Login here
                </Link>
              </p>
            </div>
            <div className="mt-5">
              <form onSubmit={(e) => handleSubmit(e)}>
                <div className="grid gap-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block mb-2 ml-1 text-sm font-bold dark:text-gray-800"
                    >
                      Email address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                        aria-describedby="email-error"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white transition-all bg-blue-500 border border-transparent rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    Reset password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default ForgotPassword;
