import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Users, 
  Plus, 
  Trash2, 
  UserPlus, 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  AlertTriangle,
  RefreshCw,
  Search
} from "lucide-react";
import { LoggedInUser, UserOption } from "../types";
import { api } from "../lib/api";
import LeadFormView from "./LeadFormView";

interface AdminConsoleProps {
  user: LoggedInUser;
  onLeadAdded: () => void;
  onUsersUpdated?: () => void;
}

type TabType = "ADD_LEAD" | "MANAGE_USERS";

export default function AdminConsoleView({ user, onLeadAdded, onUsersUpdated }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ADD_LEAD");
  
  // Register User / Admin form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"ADMIN" | "USER">("USER");
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);

  // Users List view state
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersSuccess, setUsersSuccess] = useState<string | null>(null);
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    setUsersSuccess(null);
    setConfirmDeleteEmail(null);
    try {
      const data = await api.getUsers();
      setAllUsers(data);
    } catch (err: any) {
      setUsersError(err.message || "Failed to load registered users directory.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "MANAGE_USERS") {
      fetchUsers();
    }
  }, [activeTab]);

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    const emailTrimmed = newUserEmail.trim();
    const nameTrimmed = newUserName.trim();
    const passwordTrimmed = newUserPassword.trim();

    if (!nameTrimmed || !emailTrimmed || !passwordTrimmed) {
      setUserError("Please provide a name, email address, and secure password.");
      return;
    }

    setIsSubmittingUser(true);
    try {
      await api.register(emailTrimmed, passwordTrimmed, nameTrimmed, newUserRole);
      setUserSuccess(`Success! Account for ${nameTrimmed} (${newUserRole}) has been created.`);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("USER");
      // Refresh the directory list if currently loaded
      await fetchUsers();
      if (onUsersUpdated) {
        onUsersUpdated();
      }
    } catch (err: any) {
      setUserError(err.message || "Could not register user account. Duplicate emails are prohibited.");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (email: string, name: string) => {
    const isSelf = email.toLowerCase() === user.email.toLowerCase();
    if (isSelf) {
      setUsersError("Self-deletion protection: You cannot delete your own active logged-in account.");
      return;
    }

    try {
      await api.deleteUser(email);
      await fetchUsers();
      if (onUsersUpdated) {
        onUsersUpdated();
      }
      setUsersSuccess(`Success: User account ${name} (${email}) has been permanently deleted.`);
    } catch (err: any) {
      setUsersError(err.message || `Failed to delete user: ${name}. Please contact your administrator.`);
    }
  };

  const filteredUsersList = allUsers.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in" id="admin-options-container">
      {/* Admin header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="h-5.5 w-5.5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Controls & Admin Console</h2>
            <p className="text-xs text-slate-500 mt-1">
              Add corporate pipeline leads, create new system users/admins, or delete active team profiles from the Supabase environment.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-250 mt-5 pt-1 gap-4">
          <button
            onClick={() => setActiveTab("ADD_LEAD")}
            className={`pb-3 text-xs sm:text-xs font-black uppercase tracking-wider transition relative cursor-pointer ${
              activeTab === "ADD_LEAD" 
                ? "text-indigo-600 border-b-2 border-indigo-600" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              a. Add Lead
            </span>
          </button>

          <button
            onClick={() => setActiveTab("MANAGE_USERS")}
            className={`pb-3 text-xs sm:text-xs font-black uppercase tracking-wider transition relative cursor-pointer ${
              activeTab === "MANAGE_USERS" 
                ? "text-indigo-600 border-b-2 border-indigo-600" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-3.5 w-3.5" />
              b. Add & Manage Users
            </span>
          </button>
        </div>
      </div>

      {/* Render selected content tab */}
      <div>
        {activeTab === "ADD_LEAD" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6" id="admin-add-lead-tab">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600" /> Option A: Register New Pipeline Prospect
            </h3>
            <LeadFormView
              user={user}
              editingLead={null} // Adding a fresh Lead
              onSaved={() => {
                onLeadAdded();
                alert("New CRM lead profile saved and added to Supabase database successfully!");
              }}
              onCancel={() => {
                setActiveTab("MANAGE_USERS");
              }}
            />
          </div>
        )}

        {activeTab === "MANAGE_USERS" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="admin-manage-users-tab">
            {/* Create user Form card */}
            <div className="md:col-span-1 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 h-fit">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Provision New Account
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Define CRM system users or additional pipeline managers.</p>
              </div>

              {userError && (
                <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 p-2.5 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{userError}</span>
                </div>
              )}

              {userSuccess && (
                <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg flex items-start gap-2 animate-pulse">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{userSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRegisterUser} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Full English Name</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Jean Dupont"
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-indigo-600 focus:bg-white px-3 py-2 rounded-lg text-slate-900 transition font-semibold min-h-[38px] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Corporate Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="e.g. jean@company.com"
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-indigo-600 focus:bg-white px-3 py-2 rounded-lg text-slate-900 transition font-semibold min-h-[38px] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Security Password</label>
                  <input
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Minimum 6 characters recommended"
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-indigo-600 focus:bg-white px-3 py-2 rounded-lg text-slate-900 transition font-semibold min-h-[38px] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Strategic Security Role</label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setNewUserRole("USER")}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition text-center cursor-pointer min-h-[38px] ${
                        newUserRole === "USER"
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      👤 Standard User
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUserRole("ADMIN")}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition text-center cursor-pointer min-h-[38px] ${
                        newUserRole === "ADMIN"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      👑 Admin Clearance
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="w-full bg-slate-900 text-white font-extrabold uppercase tracking-wider py-2.5 rounded-lg hover:bg-black transition cursor-pointer min-h-[42px] disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingUser ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Create Account</span>
                </button>
              </form>
            </div>

            {/* Existing Users Directory table cards */}
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <span>Registered User Database</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black">
                      {allUsers.length} total
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Manage administrative and client executive profiles.</p>
                </div>
                <button
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="inline-flex self-start sm:self-center items-center justify-center h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition cursor-pointer"
                  title="Reload Users"
                  type="button"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingUsers ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Simple Search filter */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search accounts by name, email or access role..."
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-indigo-600 focus:bg-white pl-9 pr-4 py-2 rounded-lg text-xs font-semibold text-slate-900 transition outline-none min-h-[36px]"
                />
              </div>

              {usersError && (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 p-3 rounded-lg leading-snug font-semibold text-center">
                  {usersError}
                </div>
              )}

              {usersSuccess && (
                <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-155 p-3 rounded-lg leading-snug font-semibold text-center animate-fade-in">
                  {usersSuccess}
                </div>
              )}

              {loadingUsers ? (
                <div className="py-14 text-center text-slate-400 font-bold text-xs space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-slate-350" />
                  <p className="font-mono text-[10px] uppercase tracking-wider">Syncing users directory...</p>
                </div>
              ) : filteredUsersList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  No accounts found matching your filters.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-150">
                  <table className="w-full text-left text-xs border-collapse divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Full Name</th>
                        <th className="px-4 py-3">Email Address</th>
                        <th className="px-4 py-3">Strategic Role</th>
                        <th className="px-4 py-3 text-right">Supabase Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsersList.map((adminItem) => {
                        const isSelf = adminItem.email.toLowerCase() === user.email.toLowerCase();
                        
                        return (
                          <tr key={adminItem.email} className="hover:bg-slate-50/40 text-xs font-semibold text-slate-700">
                            <td className="px-4 py-3 text-slate-900 font-black">
                              {adminItem.name}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                              {adminItem.email}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                                adminItem.role === "ADMIN" ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-800"
                              }`}>
                                {adminItem.role === "ADMIN" ? "👑 ADMIN" : "👤 USER"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isSelf ? (
                                <span className="text-[10px] text-slate-400 italic px-2 font-mono">You (Active)</span>
                              ) : confirmDeleteEmail === adminItem.email ? (
                                <div className="flex items-center justify-end gap-1.5 animate-in fade-in slide-in-from-right-1 duration-150">
                                  <span className="text-[10px] text-rose-700 font-extrabold select-none">Sure?</span>
                                  <button
                                    onClick={() => {
                                      handleDeleteUser(adminItem.email, adminItem.name);
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 text-white rounded px-2 py-1 text-[10px] font-black cursor-pointer shadow-xs min-h-[26px] flex items-center justify-center transition"
                                  >
                                    Confirm Delete
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteEmail(null)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2 py-1 text-[10px] font-bold cursor-pointer border border-slate-200 min-h-[26px] flex items-center justify-center transition"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setUsersError(null);
                                    setUsersSuccess(null);
                                    setConfirmDeleteEmail(adminItem.email);
                                  }}
                                  className="inline-flex items-center justify-center gap-1 min-h-[32px] text-[10px] font-black text-rose-600 hover:text-white hover:bg-rose-600 px-2.5 py-1 rounded bg-rose-50 border border-rose-100 hover:border-rose-600 transition cursor-pointer"
                                  title="Delete User completely from Supabase"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
