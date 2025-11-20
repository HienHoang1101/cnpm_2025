import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err);
    // Do not exit the process; allow service to start for local integration checks.
    return;
  }
};

export default connectDB;
