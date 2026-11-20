require("dotenv").config();

const { verifyMailer, sendOTPEmail } =
  require("./src/config/mailer");

const testEmail = async () => {
  try {
    await verifyMailer();

    console.log("Gmail configuration is working!");

    // Sends a test OTP email
    await sendOTPEmail(
      process.env.EMAIL_USER,
      "123456",
      "registration"
    );

    console.log("Test email delivered successfully!");

  } catch (error) {
    console.error("Email test failed:", error.message);
  }
};

testEmail();