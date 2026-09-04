/* eslint-disable react/prop-types */
import { FaFilePdf } from "react-icons/fa6";
import { IoArrowBack, IoDocumentText } from "react-icons/io5";
import { IoMdImage } from "react-icons/io";
import { IoMdClose } from "react-icons/io";
import { useDropzone } from "react-dropzone";
import { FaCheckCircle } from "react-icons/fa";
import { useState } from "react";

const InsuranceUploadForm = ({
  setThirdForm,
  handleUpload,
  handleLaterUpload,
  files,
  setFiles,
  setSecondForm,
  loading,
  loading2,
}) => {
  const handleFileChange = (event) => {
    const Localfiles = Array.from(event.target.files);

    if (Localfiles.length > 0) {
      const updatedFiles = Localfiles.map((file) => ({
        name: file.name,
        fileType: file.type,
        file: file,
      }));

      // setFiles(updatedFiles);
      setFiles((prevFiles) => [...prevFiles, ...updatedFiles]);
    }
  };

  const renderFileIcon = (fileType) => {
    if (fileType.includes("pdf")) {
      return <FaFilePdf size={20} className="text-red-700 mr-2" />;
    } else if (fileType.includes("image")) {
      return <IoMdImage size={20} className="text-blue-600 mr-2" />;
    } else {
      return <IoDocumentText size={20} className="text-blue-600 mr-2" />;
    }
  };
  // console.log(files);

  const handleGoBack = () => {
    //code here
    setSecondForm(true);
    setThirdForm(false);
    setShowModal(true);
  };

  const onDrop = (acceptedFiles) => {
    const updatedFiles = acceptedFiles.map((file) => ({
      name: file.name,
      fileType: file.type,
      file: file,
    }));
    setFiles((prevFiles) => [...prevFiles, ...updatedFiles]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const handleMultipleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);

    if (newFiles.length > 0) {
      const updatedFiles = newFiles.map((file) => ({
        name: file.name,
        fileType: file.type,
        file: file,
      }));

      // Append new files to existing files
      setFiles((prevFiles) => [...prevFiles, ...updatedFiles]);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center w-full overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
      <div className="relative w-[45%] mx-auto my-6">
        <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none">
          <div className="flex items-center justify-between p-5 border-b border-solid rounded-t border-blueGray-200">
            <h1 className="w-full font-bold text-2xl text-center font-radios">
              Insurance Policy
            </h1>
            <button
              className="float-right ml-auto font-semibold leading-none text-black border-0 outline-none focus:outline-none"
              onClick={() => setThirdForm(false)}
            >
              <span className="block cursor-pointer text-4xl text-black outline-none focus:outline-none">
                <IoMdClose />
              </span>
            </button>
          </div>
          <div className="relative flex flex-col items-center justify-center w-full h-full p-6 gap-y-5">
            <div className="w-[65%] flex flex-col gap-y-4">
              <div className="self-start  flex gap-4">
                <button
                  onClick={() => {
                    handleGoBack();
                    // console.log("go to second");
                  }}
                >
                  <IoArrowBack size={20} />
                </button>
                <h1 className="w-full mb-1 text-xl font-extrabold text-black text-start font-radios">
                  Gross Profit Calculator
                </h1>
              </div>
              <div {...getRootProps()} style={{ cursor: "pointer" }}>
                <input {...getInputProps()} />
                <label
                  htmlFor="uploadFile1"
                  className="bg-white text-gray-500 font-semibold text-base rounded max-w-md h-52 flex flex-col items-center justify-center cursor-pointer border-2 border-gray-300 border-dashed mx-auto font-[sans-serif]"
                >
                  {files.length === 0 ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-11 mb-2 fill-gray-500"
                        viewBox="0 0 32 32"
                      >
                        <path
                          d="M23.75 11.044a7.99 7.99 0 0 0-15.5-.009A8 8 0 0 0 9 27h3a1 1 0 0 0 0-2H9a6 6 0 0 1-.035-12 1.038 1.038 0 0 0 1.1-.854 5.991 5.991 0 0 1 11.862 0A1.08 1.08 0 0 0 23 13a6 6 0 0 1 0 12h-3a1 1 0 0 0 0 2h3a8 8 0 0 0 .75-15.956z"
                          data-original="#000000"
                        />
                        <path
                          d="M20.293 19.707a1 1 0 0 0 1.414-1.414l-5-5a1 1 0 0 0-1.414 0l-5 5a1 1 0 0 0 1.414 1.414L15 16.414V29a1 1 0 0 0 2 0V16.414z"
                          data-original="#000000"
                        />
                      </svg>
                      Upload file
                      <p className="text-xs text-center px-2 font-medium text-gray-400 mt-2">
                        PNG, JPG, SVG, WEBP, and GIF are allowed.
                      </p>
                    </>
                  ) : (
                    <div className="w-full flex flex-col justify-center items-center gap-2">
                      <FaCheckCircle />
                      <p className="font-semibold text-center text-[12px]">
                        Files selected successfully...
                      </p>
                      <p className="font-light text-center text-[11px]">
                        Click outside to close modal...
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Display Selected Files */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <p
                      key={index}
                      className="flex items-center text-sm font-medium text-gray-700"
                    >
                      {renderFileIcon(file.fileType)}
                      {file.name}
                    </p>
                  ))}
                </div>
              )}
              {files.length > 0 ? (
                <div>
                  <label
                    htmlFor="selectMore"
                    className="flex gap-1 text-gray-500 font-bold cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mb-2 w-5 fill-gray-500"
                      viewBox="0 0 32 32"
                    >
                      <path
                        d="M23.75 11.044a7.99 7.99 0 0 0-15.5-.009A8 8 0 0 0 9 27h3a1 1 0 0 0 0-2H9a6 6 0 0 1-.035-12 1.038 1.038 0 0 0 1.1-.854 5.991 5.991 0 0 1 11.862 0A1.08 1.08 0 0 0 23 13a6 6 0 0 1 0 12h-3a1 1 0 0 0 0 2h3a8 8 0 0 0 .75-15.956z"
                        data-original="#000000"
                      />
                      <path
                        d="M20.293 19.707a1 1 0 0 0 1.414-1.414l-5-5a1 1 0 0 0-1.414 0l-5 5a1 1 0 0 0 1.414 1.414L15 16.414V29a1 1 0 0 0 2 0V16.414z"
                        data-original="#000000"
                      />
                    </svg>
                    Add More
                  </label>
                  <input
                    type="file"
                    id="selectMore"
                    onChange={handleMultipleFileChange}
                    multiple
                    className="hidden"
                  />
                </div>
              ) : null}

              <div className="flex flex-row justify-end w-full gap-x-4">
                <button
                  className="inline-block px-5 py-3 mt-3 font-medium text-white bg-indigo-600 rounded shadow-md shadow-indigo-500/20 hover:bg-indigo-700"
                  onClick={handleLaterUpload}
                  disabled={loading} // Disable if loading
                >
                  {loading2 ? (
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
                    "Add Insurance Later"
                  )}
                </button>

                <button
                  className={`inline-block px-5 py-3 mt-3 font-medium text-white rounded shadow-md shadow-indigo-500/20 ${
                    files.length > 0
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-gray-600 cursor-not-allowed"
                  }`}
                  onClick={handleUpload}
                  disabled={files.length === 0 || loading} // Disable if no files or loading
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
                    "Upload Insurance"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsuranceUploadForm;
