import React, { useState } from "react";
import { api } from "../lib/api";
import { LoggedInUser } from "../types";
import { Shield, UserPlus, LogIn, Mail, Lock, User, Briefcase } from "lucide-react";
import SyncAILogo from "./SyncAILogo";

interface LoginViewProps {
  onLoginSuccess: (user: LoggedInUser) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [requestingCode, setRequestingCode] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError("Please input your registered administrative or expert partner email address.");
      return;
    }
    setError(null);
    setInfo(null);
    setRequestingCode(true);
    try {
      const res = await api.forgotPassword(resetEmail.trim());
      if (res.debugCode) {
        setInfo(res.message);
        setResetCode(res.debugCode);
        alert(`Security Verification Code Generated:\n${res.debugCode}\n\nThis copyable code is pre-filled in your security input field. Make sure to define the RESEND_API_KEY inside your .env configuration later for mail delivery!`);
      } else {
        setInfo(res.message || "A secure security code has been dispatched to your email address.");
      }
    } catch (err: any) {
      setError(err.message || "Could not generate or send security code.");
    } finally {
      setRequestingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!email.trim() || !password.trim() || !name.trim()) {
          throw new Error("All registration fields are required.");
        }
        await api.register(email, password, name, "ADMIN");
        setInfo("Admin account registered successfully! You can now sign in.");
        setIsRegister(false);
        setPassword("");
      } else {
        if (!email.trim() || !password.trim()) {
          throw new Error("Please enter both email and password.");
        }
        const response = await api.login(email, password);
        onLoginSuccess(response.user);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (!resetEmail.trim() || !resetNewPassword.trim() || !resetCode.trim()) {
        throw new Error("Please fill in all reset credentials.");
      }
      const data = await api.resetPassword(resetEmail.trim(), resetNewPassword.trim(), resetCode.trim());
      setInfo(data.message || "Password has been successfully updated!");
      setShowReset(false);
      setEmail(resetEmail); // autofill login email
      setPassword(resetNewPassword); // autofill new password
      setResetEmail("");
      setResetNewPassword("");
      setResetCode("");
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please verify your fields.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="flex min-h-[75vh] items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-all">
        {/* Banner with branded custom logo */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <SyncAILogo variant="original" height="58px" className="transition duration-300 hover:scale-102" />
          </div>
          <p className="text-[10px] tracking-widest text-[#0d9488] font-black uppercase mt-2">
            Sales Lead Management & Administration
          </p>
        </div>

        {/* Tab Selector */}
        {!showReset && (
          <div className="flex border-b border-slate-100 bg-slate-50">
            <button
              id="tab-login"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 min-h-[44px] py-3 text-center text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                !isRegister
                  ? "bg-white text-indigo-600 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <LogIn className="h-4 w-4" />
              Sign In As Admin
            </button>
            <button
              id="tab-register"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 min-h-[44px] py-3 text-center text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isRegister
                  ? "bg-white text-indigo-600 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Register New Admin
            </button>
          </div>
        )}

        {showReset && (
          <div className="bg-slate-50 p-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">
              🔒 Admin Password Reset Mechanism
            </span>
            <button
              onClick={() => {
                setShowReset(false);
                setError(null);
                setInfo(null);
              }}
              className="text-[10px] bg-slate-200 text-slate-700 font-extrabold px-2 py-1 rounded hover:bg-slate-300"
            >
              Back To Login
            </button>
          </div>
        )}

        {/* Form Container */}
        <div className="p-5 sm:p-8">
          {error && (
            <div
              id="error-banner"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-semibold"
            >
              <strong>Access Error:</strong> {error}
            </div>
          )}

          {info && (
            <div
              id="info-banner"
              className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3.5 text-xs text-green-700 font-semibold"
            >
              {info}
            </div>
          )}

          {/* PASSWORD RESET FORM */}
          {showReset ? (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                  Administrator Email Address
                </label>
                <div id="email-request-wrapper" className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="admin@company.com"
                      className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestCode}
                    disabled={requestingCode}
                    className="min-h-[44px] px-3.5 rounded-lg bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 hover:bg-[#0d9488]/20 font-extrabold text-xs transition cursor-pointer shrink-0"
                  >
                    {requestingCode ? "Dispatching..." : "Send Code"}
                  </button>
                </div>
              </div>
 
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                  New Desired Password
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Enter new 6+ digit password..."
                    className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
 
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 flex justify-between">
                  <span>Security Auth Code</span>
                  <span className="text-[9px] text-[#0d9488] font-bold">Format: SECURE-XXXXXX</span>
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Shield className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter SECURE-XXXXXX verification code..."
                    className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full min-h-[44px] rounded-lg bg-indigo-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow hover:bg-indigo-700 transition focus:outline-none cursor-pointer"
              >
                {loading ? "Confirming Override..." : "Authorize Password Override"}
              </button>
            </form>
          ) : (
            /* STANDARD LOGIN / REGISTER FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                    Admin Name
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="input-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. System Admin"
                      className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="input-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                    Password
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowReset(true);
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-[10px] font-black text-indigo-650 hover:underline cursor-pointer"
                    >
                      Forgot/Reset Password?
                    </button>
                  )}
                </div>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="input-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password..."
                    className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                id="btn-auth-submit"
                type="submit"
                disabled={loading}
                className="mt-2 w-full min-h-[44px] rounded-lg bg-indigo-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow hover:bg-indigo-700 transition focus:outline-none disabled:bg-indigo-400 cursor-pointer"
              >
                {loading ? "Accessing Secure Database..." : isRegister ? "Create Admin Roster Account" : "Access CRM System"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
