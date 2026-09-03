import Modal from "react-modal";

Modal.setAppElement("#root"); // Set this to the root element of your app

const DocumentModal = ({ isOpen, onRequestClose, fileURL }) => {
  // console.log(fileURL);
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Document Viewer"
      className="fixed inset-0 z-50 flex items-center justify-center w-screen h-screen mx-auto my-auto"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 z-50"
    >
      <div className="w-[80%] h-[95%] justify-center items-center mx-auto my-auto overflow-hidden bg-white rounded-lg shadow-lg ">
        <div className="flex justify-end p-4">
          <button
            onClick={onRequestClose}
            className="text-lg font-bold text-gray-700 hover:text-gray-900"
          >
            &times;
          </button>
        </div>
        <div className="flex items-center justify-center h-[95%] px-4 pb-4 w-full">
          {fileURL && (
            <iframe
              src={fileURL}
              title="Document Preview"
              className="w-full h-full border-2 border-black rounded-lg"
              type="application/pdf"
            ></iframe>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DocumentModal;
