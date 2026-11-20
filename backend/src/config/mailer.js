
const nodemailer = require("nodemailer");

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send OTP email
const sendOTPEmail = async (email, otp, purpose) => {

  const subjects = {
    registration: "Verify Your SARATHI Account",
    login: "Your SARATHI Login OTP",
    "password-reset": "Reset Your SARATHI Password"
  };

  const messages = {
    registration: "Use this OTP to verify your email address and complete your SARATHI registration.",
    login: "Use this OTP to securely log in to your SARATHI account.",
    "password-reset": "Use this OTP to verify your identity and reset your SARATHI password."
  };

  if (!subjects[purpose]) {
    throw new Error("Invalid email purpose");
  }

  const mailOptions = {
    from: {
      name: "SARATHI",
      address: process.env.EMAIL_USER
    },

    to: email,

    subject: subjects[purpose],

    text: `
SARATHI - More Than Just Delivery

${messages[purpose]}

Your verification code is: ${otp}

This OTP expires in 5 minutes.

If you did not request this code, please ignore this email.
    `,

    html: `
      <div style="
        max-width: 500px;
        margin: 30px auto;
        padding: 30px;
        font-family: Arial, sans-serif;
        border: 1px solid #eeeeee;
        border-radius: 15px;
        background: #ffffff;
      ">

        <h1 style="
          color: #171717;
          font-size: 30px;
        ">
          SARATHI<span style="color: #eab308;">.</span>
        </h1>

        <p style="
          color: #888888;
          font-size: 12px;
          letter-spacing: 2px;
        ">
          MORE THAN JUST DELIVERY
        </p>

        <h2 style="color: #171717;">
          ${subjects[purpose]}
        </h2>

        <p style="color: #666666; line-height: 1.7;">
          ${messages[purpose]}
        </p>

        <div style="
          margin: 25px 0;
          padding: 22px;
          background: #fff6d8;
          border-radius: 10px;
          text-align: center;
        ">

          <h1 style="
            color: #171717;
            font-size: 35px;
            letter-spacing: 10px;
            margin: 0;
          ">
            ${otp}
          </h1>

        </div>

        <p style="color: #777777; font-size: 13px;">
          This verification code expires in 5 minutes.
        </p>

        <p style="color: #777777; font-size: 13px;">
          Never share your OTP with anyone.
        </p>

        <hr style="border: 0; border-top: 1px solid #eeeeee;">

        <p style="
          color: #999999;
          font-size: 11px;
          text-align: center;
        ">
          © 2026 SARATHI. All rights reserved.
        </p>

      </div>
    `
  };

  const result = await transporter.sendMail(mailOptions);

  console.log("OTP email sent successfully:", result.messageId);

  return result;
};

// Verify Gmail SMTP connection
const verifyMailer = async () => {
  try {
    await transporter.verify();
    console.log("SARATHI Gmail SMTP connected successfully");
  } catch (error) {
    console.error("Gmail SMTP connection failed:", error.message);
    throw error;
  }
};

module.exports = {
  transporter,
  sendOTPEmail,
  verifyMailer
};
