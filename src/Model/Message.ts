import mongoose from "mongoose";

const Message = new mongoose.Schema(
    {
        message: {
            type: String,
            required: false,
        },
        image: {
            type: String,
            required: false,
            default: ""
        },
        users: Array,
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Message", Message);
