
import { useState } from "react";
import axios from "axios";
import {
  X, ArrowRight, UserRound, Store, Bike,
  Mail, Lock, Phone, User, ArrowLeft, ShieldCheck
} from "lucide-react";
import "./AuthModal.css";

const API = "http://localhost:5000/api/auth";

const roles = [
  { value: "customer", label: "Customer", icon: UserRound },
  { value: "merchant", label: "Merchant", icon: Store },
  { value: "delivery", label: "Delivery Partner", icon: Bike }
];

export default function AuthModal({ onClose, initialMode = "register" }) {
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState("");
  const [step, setStep] = useState("role");
  const [loginMethod, setLoginMethod] = useState("password");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: ""
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });

  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetForm, setResetForm] = useState({ password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const updateForm = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const updateLoginForm = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
  };

  const saveSession = (data) => {
    if (!data.token) {
      throw new Error("The server did not return an access token.");
    }

    sessionStorage.setItem("sarathiToken", data.token);

    if (data.user) {
      localStorage.setItem("sarathiUser", JSON.stringify(data.user));
    }
  };

  // REGISTRATION
  const register = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/register`, {
        ...form,
        role
      });

      setMessage(response.data.message || "OTP sent to your Gmail.");
      setStep("otp");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // VERIFY REGISTRATION OTP
  const verifyOTP = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/verify-email`, {
        email: form.email,
        otp
      });

      if (response.data.token) {
        saveSession(response.data);
      }

      setMessage(response.data.message || "Email verified successfully.");
      setStep("success");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "OTP verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // PASSWORD LOGIN
  const login = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/login`, loginForm);

      saveSession(response.data);
      setMessage("Login successful.");
      setStep("success");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Login failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD: REQUEST RESET OTP
  const requestPasswordReset = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/forgot-password`, {
        email: loginForm.email
      });
      setOtp("");
      setResetToken("");
      setStep("resetOtp");
      setMessage(
        response.data.message ||
        "If an eligible account exists, a password-reset OTP has been sent."
      );
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Unable to request password reset."
      );
    } finally {
      setLoading(false);
    }
  };

  // VERIFY PASSWORD-RESET OTP
  const verifyPasswordResetOTP = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/verify-reset-otp`, {
        email: loginForm.email,
        otp
      });

      const token = response.data.resetToken || response.data.token;
      if (!token) {
        throw new Error("The server did not return a password-reset token.");
      }

      setResetToken(token);
      setOtp("");
      setStep("resetPassword");
      setMessage("OTP verified. Choose a new password.");
    } catch (error) {
      setMessage(
        error.response?.data?.message || error.message || "OTP verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // SAVE NEW PASSWORD
  const submitNewPassword = async (e) => {
    e.preventDefault();
    setMessage("");

    if (resetForm.password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/reset-password`, {
        resetToken,
        password: resetForm.password
      });

      setLoginForm((current) => ({
        ...current,
        password: ""
      }));
      setResetForm({ password: "", confirmPassword: "" });
      setResetToken("");
      setMode("login");
      setLoginMethod("password");
      setStep("role");
      setMessage(response.data.message || "Password reset successfully. Please log in.");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Unable to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  // REQUEST LOGIN OTP
  const requestLoginOTP = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/request-login-otp`,
        { email: loginForm.email }
      );

      setMessage(
        response.data.message ||
        "If your account is eligible, an OTP has been sent to your Gmail."
      );

      setOtp("");
      setStep("loginOtp");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        "Unable to request OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // VERIFY LOGIN OTP
  const verifyLoginOTP = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/verify-login-otp`,
        {
          email: loginForm.email,
          otp
        }
      );

      saveSession(response.data);
      setMessage("Login successful.");
      setStep("success");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        "Invalid or expired OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  // RESEND LOGIN OTP
  const resendLoginOTP = async () => {
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/request-login-otp`,
        { email: loginForm.email }
      );

      setMessage(
        response.data.message || "OTP request processed."
      );
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        "Unable to resend OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchToRegister = () => {
    setMode("register");
    setStep("role");
    setMessage("");
    setOtp("");
  };

  const switchToLogin = () => {
    setMode("login");
    setStep("role");
    setLoginMethod("password");
    setMessage("");
    setOtp("");
  };

  const closeModal = () => {
    if (!loading) onClose();
  };

  return (
    <div className="auth-overlay" onClick={closeModal}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>

        <button className="auth-close" onClick={closeModal}>
          <X size={21} />
        </button>

        <div className="auth-brand">
          SARATHI<span>.</span>
        </div>

        {/* ROLE SELECTION */}
        {step === "role" && mode === "register" && (
          <>
            <div className="auth-heading">
              <h2>Join SARATHI</h2>
              <p>Choose how you want to use our platform.</p>
            </div>

            <div className="auth-role-list">
              {roles.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    type="button"
                    key={item.value}
                    className={`auth-role-option ${
                      role === item.value ? "selected" : ""
                    }`}
                    onClick={() => setRole(item.value)}
                  >
                    <span className="auth-role-icon">
                      <Icon size={23} />
                    </span>
                    <span>{item.label}</span>
                    <ArrowRight size={18} />
                  </button>
                );
              })}
            </div>

            <button
              className="auth-primary-button"
              disabled={!role}
              onClick={() => {
                setStep("register");
                setMessage("");
              }}
            >
              Continue <ArrowRight size={17} />
            </button>

            <p className="auth-switch">
              Already have an account?{" "}
              <button onClick={switchToLogin}>Login</button>
            </p>
          </>
        )}

        {/* LOGIN SCREEN */}
        {step === "role" && mode === "login" && (
          <>
            <div className="auth-heading">
              <h2>Welcome back</h2>
              <p>Login to your SARATHI account.</p>
            </div>

            <div className="auth-login-tabs">
              <button
                type="button"
                className={loginMethod === "password" ? "active" : ""}
                onClick={() => {
                  setLoginMethod("password");
                  setMessage("");
                }}
              >
                Password
              </button>

              <button
                type="button"
                className={loginMethod === "otp" ? "active" : ""}
                onClick={() => {
                  setLoginMethod("otp");
                  setMessage("");
                }}
              >
                Gmail OTP
              </button>
            </div>

            {loginMethod === "password" ? (
              <>
              <form className="auth-form" onSubmit={login}>
                <label>
                  Gmail address
                  <span className="auth-input">
                    <Mail size={18} />
                    <input
                      type="email"
                      name="email"
                      value={loginForm.email}
                      onChange={updateLoginForm}
                      placeholder="example@gmail.com"
                      required
                    />
                  </span>
                </label>

                <label>
                  Password
                  <span className="auth-input">
                    <Lock size={18} />
                    <input
                      type="password"
                      name="password"
                      value={loginForm.password}
                      onChange={updateLoginForm}
                      placeholder="Enter your password"
                      required
                    />
                  </span>
                </label>

                <button
                  className="auth-primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                  {!loading && <ArrowRight size={17} />}
                </button>
              </form>
              <p className="auth-switch auth-forgot-password">
                <button
                  type="button"
                  onClick={() => {
                    setStep("forgotPassword");
                    setMessage("");
                    setOtp("");
                  }}
                >
                  Forgot password?
                </button>
              </p>
              </>
            ) : (
              <form className="auth-form" onSubmit={requestLoginOTP}>
                <label>
                  Registered Gmail address
                  <span className="auth-input">
                    <Mail size={18} />
                    <input
                      type="email"
                      name="email"
                      value={loginForm.email}
                      onChange={updateLoginForm}
                      placeholder="example@gmail.com"
                      required
                    />
                  </span>
                </label>

                <button
                  className="auth-primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Sending OTP..." : "Send Gmail OTP"}
                  {!loading && <ArrowRight size={17} />}
                </button>
              </form>
            )}

            <p className="auth-switch">
              Don't have an account?{" "}
              <button onClick={switchToRegister}>Register</button>
            </p>
          </>
        )}

        {/* FORGOT PASSWORD: REQUEST OTP */}
        {step === "forgotPassword" && (
          <>
            <button
              className="auth-back"
              type="button"
              onClick={() => {
                setStep("role");
                setMessage("");
              }}
            >
              <ArrowLeft size={16} /> Back to login
            </button>

            <div className="auth-heading">
              <h2>Forgot password?</h2>
              <p>Enter your registered Gmail address. We'll send you a reset OTP.</p>
            </div>

            <form className="auth-form" onSubmit={requestPasswordReset}>
              <label>
                Registered Gmail address
                <span className="auth-input">
                  <Mail size={18} />
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, email: e.target.value })
                    }
                    placeholder="example@gmail.com"
                    required
                  />
                </span>
              </label>

              <button className="auth-primary-button" type="submit" disabled={loading}>
                {loading ? "Sending OTP..." : "Send reset OTP"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </>
        )}

        {/* VERIFY PASSWORD-RESET OTP */}
        {step === "resetOtp" && (
          <>
            <button
              className="auth-back"
              type="button"
              onClick={() => {
                setStep("forgotPassword");
                setOtp("");
                setMessage("");
              }}
            >
              <ArrowLeft size={16} /> Change email
            </button>

            <div className="auth-otp-icon">
              <ShieldCheck size={30} />
            </div>

            <div className="auth-heading">
              <h2>Verify reset OTP</h2>
              <p>Enter the six-digit code sent to <strong>{loginForm.email}</strong>.</p>
            </div>

            <form className="auth-form" onSubmit={verifyPasswordResetOTP}>
              <label>
                Six-digit OTP
                <span className="auth-input">
                  <ShieldCheck size={18} />
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\\D/g, "").slice(0, 6))}
                    placeholder="Enter OTP"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </span>
              </label>

              <button
                className="auth-primary-button"
                type="submit"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify OTP"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
            <p className="auth-note">The reset OTP expires after 5 minutes.</p>
          </>
        )}

        {/* SET NEW PASSWORD */}
        {step === "resetPassword" && (
          <>
            <div className="auth-heading">
              <h2>Create a new password</h2>
              <p>Choose a strong password for your SARATHI account.</p>
            </div>

            <form className="auth-form" onSubmit={submitNewPassword}>
              <label>
                New password
                <span className="auth-input">
                  <Lock size={18} />
                  <input
                    type="password"
                    value={resetForm.password}
                    onChange={(e) =>
                      setResetForm({ ...resetForm, password: e.target.value })
                    }
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </span>
              </label>

              <label>
                Confirm new password
                <span className="auth-input">
                  <Lock size={18} />
                  <input
                    type="password"
                    value={resetForm.confirmPassword}
                    onChange={(e) =>
                      setResetForm({ ...resetForm, confirmPassword: e.target.value })
                    }
                    placeholder="Re-enter new password"
                    minLength={8}
                    required
                  />
                </span>
              </label>

              <button className="auth-primary-button" type="submit" disabled={loading}>
                {loading ? "Updating password..." : "Reset password"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </>
        )}

        {/* REGISTRATION FORM */}
        {step === "register" && (
          <>
            <button
              className="auth-back"
              onClick={() => {
                setStep("role");
                setMessage("");
              }}
            >
              <ArrowLeft size={16} /> Change account type
            </button>

            <div className="auth-heading">
              <h2>Create your account</h2>
              <p>
                Register as a {roles.find((r) => r.value === role)?.label}.
              </p>
            </div>

            <form className="auth-form" onSubmit={register}>
              <label>
                Full name
                <span className="auth-input">
                  <User size={18} />
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateForm}
                    placeholder="Enter your full name"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </span>
              </label>

              <label>
                Gmail address
                <span className="auth-input">
                  <Mail size={18} />
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateForm}
                    placeholder="example@gmail.com"
                    required
                  />
                </span>
              </label>

              <label>
                Phone number
                <span className="auth-input">
                  <Phone size={18} />
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={updateForm}
                    placeholder="10-digit phone number"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    required
                  />
                </span>
              </label>

              <label>
                Password
                <span className="auth-input">
                  <Lock size={18} />
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={updateForm}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </span>
              </label>

              <button
                className="auth-primary-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending OTP..." : "Create account and send OTP"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </>
        )}

        {/* REGISTRATION OTP */}
        {step === "otp" && (
          <>
            <div className="auth-otp-icon">
              <Mail size={30} />
            </div>

            <div className="auth-heading">
              <h2>Verify your email</h2>
              <p>
                Enter the six-digit OTP sent to <strong>{form.email}</strong>.
              </p>
            </div>

            <form className="auth-form" onSubmit={verifyOTP}>
              <label>
                Six-digit OTP
                <span className="auth-input">
                  <ShieldCheck size={18} />
                  <input
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="Enter OTP"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </span>
              </label>

              <button
                className="auth-primary-button"
                type="submit"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify email"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="auth-note">
              Check your Gmail inbox and spam folder.
            </p>
          </>
        )}

        {/* LOGIN OTP */}
        {step === "loginOtp" && (
          <>
            <button
              className="auth-back"
              onClick={() => {
                setStep("role");
                setLoginMethod("otp");
                setOtp("");
                setMessage("");
              }}
            >
              <ArrowLeft size={16} /> Back to login
            </button>

            <div className="auth-otp-icon">
              <ShieldCheck size={30} />
            </div>

            <div className="auth-heading">
              <h2>Gmail OTP Login</h2>
              <p>
                Enter the six-digit OTP sent to{" "}
                <strong>{loginForm.email}</strong>.
              </p>
            </div>

            <form className="auth-form" onSubmit={verifyLoginOTP}>
              <label>
                Six-digit OTP
                <span className="auth-input">
                  <ShieldCheck size={18} />
                  <input
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="Enter OTP"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </span>
              </label>

              <button
                className="auth-primary-button"
                type="submit"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify and Login"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>

            <button
              type="button"
              className="auth-resend-button"
              onClick={resendLoginOTP}
              disabled={loading}
            >
              Resend OTP
            </button>

            <p className="auth-note">
              OTP expires after 5 minutes. Resending is subject to a 60-second cooldown.
            </p>
          </>
        )}

        {/* SUCCESS */}
        {step === "success" && (
          <div className="auth-success">
            <div className="auth-success-icon">
              <ShieldCheck size={38} />
            </div>

            <h2>
              {mode === "login" ? "Login successful!" : "Registration successful!"}
            </h2>

            <p>
              {mode === "login"
                ? "You are now logged in to SARATHI."
                : role === "customer"
                  ? "Your customer account is now verified."
                  : "Your email is verified. Your account is pending approval before partner features become available."}
            </p>

            <button
              className="auth-primary-button"
              onClick={onClose}
            >
              Continue to SARATHI
            </button>
          </div>
        )}

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}

      </div>
    </div>
  );
}
