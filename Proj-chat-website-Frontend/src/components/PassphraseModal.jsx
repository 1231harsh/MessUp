import { useState } from "react";

const PassphraseModal = ({ visible, onSubmit, onCancel }) => {
  const [passphrase, setPassphrase] = useState("");

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-lg font-bold mb-4">
          Enter your encryption passphrase
        </h2>
        <input
          type="password"
          className="w-full p-2 border rounded"
          placeholder="Your secret passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <div className="flex justify-end mt-4 gap-2">
          <button
            className="px-4 py-2 bg-gray-300 rounded"
            onClick={() => onCancel()}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => onSubmit(passphrase)}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default PassphraseModal;
