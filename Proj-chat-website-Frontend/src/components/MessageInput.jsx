  import { useRef, useState } from "react";
  import { Camera, Mic, Plus, Send, X, Image, Smile } from "lucide-react";

  const MessageInput = ({ onSendMessage }) => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageChange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !file.type.startsWith("image/")) return;

      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setShowDrawer(false);
    };

    const removeImage = () => {
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!text.trim() && !imageFile) return;

      onSendMessage(text, imageFile);

      setText("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const drawerOptions = [
      { id: "camera", icon: <Camera size={20} />, label: "Camera", color: "text-blue-600" },
      {
        id: "gallery",
        icon: <Image size={20} />,
        label: "Photo & Video",
        color: "text-green-600",
        onClick: () => fileInputRef.current?.click(),
      },
    ];

    return (
      <div className="p-4 bg-gradient-to-r from-base-100 to-base-50 border-t border-base-300/50">
        {imagePreview && (
          <div className="mb-4 flex items-center gap-3">
            <div className="relative group">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-xl border-2 border-base-300/50 shadow-md"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors group-hover:scale-110 transform duration-200"
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
            <div className="text-sm text-base-content/60">
              <p className="font-medium">Image ready to send</p>
              <p className="text-xs">Click send or add a message</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className={`relative flex items-center bg-base-200/80 backdrop-blur-sm rounded-2xl border-2 transition-all duration-200 ${
              isFocused ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-base-300/50'
            }`}>
              <input
                type="text"
                className="flex-1 px-4 py-3 bg-transparent rounded-2xl focus:outline-none placeholder:text-base-content/50 text-base-content"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />

              {/* Fixed icon alignment container */}
              <div className="flex items-center gap-1 pr-3">
                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-base-300/80 transition-all duration-200 group flex items-center justify-center"
                  title="Emoji"
                >
                  <Smile size={18} className="text-base-content/60 group-hover:text-base-content transition-colors" />
                </button>

                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-base-300/80 transition-all duration-200 group relative flex items-center justify-center"
                  onClick={() => setShowDrawer(!showDrawer)}
                  title="Attach"
                >
                  <Plus size={18} className={`text-base-content/60 group-hover:text-base-content transition-all duration-200 ${showDrawer ? 'rotate-45' : ''}`} />
                </button>
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />

            {showDrawer && (
              <div className="absolute bottom-full right-0 mb-2 bg-base-100 rounded-xl shadow-xl border border-base-300/50 p-2 min-w-48 backdrop-blur-sm">
                {drawerOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={option.onClick}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-base-200/80 transition-all duration-200 text-left group"
                  >
                    <div className={`${option.color} group-hover:scale-110 transition-transform duration-200`}>
                      {option.icon}
                    </div>
                    <span className="text-sm font-medium text-base-content group-hover:text-base-content/80">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className={`p-3 rounded-full transition-all duration-200 flex items-center justify-center shadow-lg ${
              text.trim() || imageFile
                ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-content hover:shadow-xl hover:scale-105 transform'
                : 'bg-base-300/80 text-base-content/60 cursor-not-allowed'
            }`}
            disabled={!text.trim() && !imageFile}
            title={text.trim() || imageFile ? "Send message" : "Send voice message"}
          >
            {text.trim() || imageFile? (
              <Send size={20} className="transform translate-x-0.5" />
            ) : (
              <Mic size={20} />
            )}
          </button>
        </form>
      </div>
    );
  };

  export default MessageInput;
