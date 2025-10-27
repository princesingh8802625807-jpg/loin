require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();

app.get('/favicon.ico', (req, res) => res.status(204).end());

// --------------------
// 🧩 Middlewares
// --------------------
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// --------------------
// 🧠 Global Error Class
// --------------------
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    Error.captureStackTrace(this, this.constructor);
  }
}

// --------------------
// ⚙️ Async Handler Wrapper
// --------------------
const catchAsync = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --------------------
// 💾 MongoDB Connection
// --------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1); // stop server if DB fails
});

// --------------------
// 📦 Schema & Model
// --------------------
const feedbackSchema = new mongoose.Schema({
  name: String,
  vehicle: String,
  phone: String,
  answers: [String],
  submittedAt: { type: Date, default: Date.now },
});
const Feedback = mongoose.model("Feedback", feedbackSchema);

// --------------------
// 📧 Gmail Transporter
// --------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.COMPANY_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify email connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("📧 Email server ready to send messages");
  }
});

// --------------------
// 📨 API: Send Feedback
// --------------------
app.post("/send-feedback", catchAsync(async (req, res, next) => {
  const { name, vehicle, phone, answers } = req.body;

  if (!name || !vehicle || !phone || !answers) {
    return next(new AppError("Incomplete data. All fields required.", 400));
  }

  // Save feedback
  const newFeedback = new Feedback({ name, vehicle, phone, answers });
  await newFeedback.save();

  // Questions list
  const questions = [
    "How would you rate your overall interaction & experience with workshop?",
    "How would you rate the quality of maintenance & repair work done on your car?",
    "How would you rate the condition or cleanliness of your car on return?",
    "How would you rate the explanation given by service advisor on the work done of your car?",
    "How would you rate the Service Delivery process of your car after servicing?",
    "How would you rate the overall cleanliness of the Dealer Facility?",
    "Did you receive the car as per promised Date & Time?",
    "Were all the work reported by you completed?",
    "Were the repair charges reasonable with respect to the work done?",
    "Was the Pre Road Test conducted with you before opening the Repair Order?",
    "Did Service Advisor open your Repair Order in which device format?",
    "How do you rate the courtesy & behaviour of the person who came to pick & drop your vehicle?",
    "Was the vehicle picked & dropped as per committed time?",
    "Did the SA inform you about the Estimate of Repair & Cost?",
    "How would you rate the support provided by workshop in getting Insurance claim?",
    "How would you rate the quality of Bodyshop repair work done on your car?",
    "Did the Workshop provide you regular updates about your vehicle status on WhatsApp Group?",
    "Were you provided the Final Road Test during delivery of the Vehicle?",
  ];

  // Email content
  const feedbackHTML = `
    <h2>Hyundai Customer Feedback</h2>
    <p><b>Name:</b> ${name}</p>
    <p><b>Vehicle No:</b> ${vehicle}</p>
    <p><b>Phone:</b> ${phone}</p>
    <hr/>
    <h3>📝 Feedback Summary</h3>
    <ol>
      ${answers.map((ans, i) => `<li><b>${questions[i]}</b><br/>Answer: ${ans || "Not Answered"}</li>`).join("")}
    </ol>
    <p>🕒 Submitted on: ${new Date().toLocaleString()}</p>
  `;

  // Send email
  try {
    await transporter.sendMail({
      from: `"Hyundai Feedback" <${process.env.COMPANY_EMAIL}>`,
      to: process.env.COMPANY_EMAIL,
      subject: `New Feedback from ${name} (${vehicle})`,
      html: feedbackHTML,
    });
  } catch (emailError) {
    console.error("❌ Email sending failed:", emailError);
    return next(new AppError("Feedback saved but email sending failed", 500));
  }

  res.status(200).json({
    success: true,
    message: "Feedback saved and email sent successfully",
  });
}));

// --------------------
// 🧭 404 Route Handler
// --------------------
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// --------------------
// 🛡️ Global Error Handler
// --------------------
app.use((err, req, res, next) => {
  console.error("🔥 Error caught:", err);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message || "Internal Server Error",
    // Optional stack trace (only in development)
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// --------------------
// 🚀 Start Server
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// --------------------
// 🧯 Uncaught Errors
// --------------------
process.on("uncaughtException", err => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", err => {
  console.error("❌ Unhandled Promise Rejection:", err);
  process.exit(1);
});
