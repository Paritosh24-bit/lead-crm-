import { useState, useEffect } from "react";
import { LoggedInUser, Lead, LeadStatus, WebhookLog, Task, Reminder } from "./types";
import { api, getStoredUser, clearSession } from "./lib/api";
import LoginView from "./components/LoginView";
import LeadFormView, { LEAD_STATUS_OPTIONS } from "./components/LeadFormView";
import LeadDetailsView from "./components/LeadDetailsView";
import {
  LogOut,
  Building,
  User,
  Plus,
  RefreshCw,
  Search,
  Users,
  Briefcase,
  Layers,
  ChevronRight,
  Shield,
  CircleAlert,
  SlidersHorizontal,
  FolderOpen,
  Database,
  MapPin,
  ClipboardList,
  Eye,
  Edit,
  Code,
  Activity,
  CheckCircle2,
  XCircle,
  ExternalLink,
  HelpCircle,
  Send,
  Copy,
  Check,
  Calendar,
  CheckSquare,
  Clock,
  AlertCircle,
  Sparkles,
  UserCheck,
  TrendingUp,
  Trash2,
  BookOpen,
  X
} from "lucide-react";
import AICopilotView from "./components/AICopilotView";
import FinancialForecastTable from "./components/FinancialForecastTable";
import PoAssuredBusinessTable from "./components/PoAssuredBusinessTable";
import AdminConsoleView from "./components/AdminConsoleView";
import WorkshopsTabPanel from "./components/WorkshopsTabPanel";
import SyncAILogo from "./components/SyncAILogo";

type NavRoute = "LOGIN" | "LIST" | "ADD" | "EDIT" | "DETAILS" | "DASHBOARD" | "FOLLOWUPS" | "AI_COPILOT" | "FINANCES" | "ADMIN_CONSOLE" | "WORKSHOPS";

interface SupabaseConfig {
  useSupabase: boolean;
  supabaseUrl: string | null;
  sqlSchema: string;
}

export default function App() {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [route, setRoute] = useState<NavRoute>("LOGIN");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [confirmDeleteLeadId, setConfirmDeleteLeadId] = useState<string | null>(null);
  const [defaultOwnerEmail, setDefaultOwnerEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  
  // Custom new states for CRM and administrative properties
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);
  const [showRevenueToUsers, setShowRevenueToUsers] = useState<boolean>(false);
  const [savingRevenue, setSavingRevenue] = useState<boolean>(false);

  const todayStr = new Date().toLocaleDateString("sv").substring(0, 10);

  // Connection State
  const [config, setConfig] = useState<SupabaseConfig>({
    useSupabase: false,
    supabaseUrl: null,
    sqlSchema: ""
  });
  const [showSqlSchema, setShowSqlSchema] = useState(false);

  // Formspree Integration States
  const [showWebhookSetup, setShowWebhookSetup] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [fetchingLogState, setFetchingLogState] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadWebhookLogs = async () => {
    if (!user) return;
    setFetchingLogState(true);
    try {
      const logs = await api.getWebhookLogs();
      setWebhookLogs(logs);
    } catch (err) {
      console.warn("Could not retrieve website integration logs", err);
    } finally {
      setFetchingLogState(false);
    }
  };

  // Real-time polling: when Formspree setup drawer is active, poll webhook logs every 5 seconds
  useEffect(() => {
    let interval: any = null;
    if (showWebhookSetup && user) {
      loadWebhookLogs();
      interval = setInterval(() => {
        loadWebhookLogs();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showWebhookSetup, user]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");

  // Check login session & check setup configurations on mount
  useEffect(() => {
    const activeUser = getStoredUser();
    if (activeUser) {
      setUser(activeUser);
      setRoute("LIST");
    } else {
      setRoute("LOGIN");
    }

    // Load connection parameters
    api.getConfig()
      .then((cfg) => setConfig(cfg))
      .catch((err) => console.warn("Failed to load connection configurations", err));
  }, []);

  // Fetch data when route changes to list or upon login
  useEffect(() => {
    if (user) {
      fetchLeads();
      fetchUsersList();
      fetchRevenueMetrics();
      fetchPoList();
    }
  }, [user, route]);

  const fetchPoList = async () => {
    try {
      const list = await api.getPoAssured();
      setPoList(list || []);
    } catch (err) {
      console.warn("Failed to load PO records", err);
    }
  };

  const fetchRevenueMetrics = async () => {
    try {
      const res = await api.getRevenueMetrics();
      setRevenueMetrics(res.metrics);
      setShowRevenueToUsers(res.showToUsers);
    } catch (err) {
      console.warn("Failed to load revenue metrics", err);
    }
  };

  const fetchAllTasks = async () => {
    try {
      const data = await api.getAllTasks();
      setAllTasks(data);
    } catch (err) {
      console.warn("Could not retrieve team active tasks list:", err);
    }
  };

  const fetchAllReminders = async () => {
    try {
      const data = await api.getAllReminders();
      setAllReminders(data);
    } catch (err) {
      console.warn("Could not retrieve all system reminders list:", err);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLeads();
      // Sort newly created leads to the top
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLeads(data);
      await fetchAllTasks();
      await fetchAllReminders();
    } catch (err: any) {
      setError(err.message || "Failed to load CRM leads.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersList = async () => {
    try {
      const usersList = await api.getUsers();
      setAvailableUsers(usersList.map((u) => u.email));
      setAppUsers(usersList);
    } catch {
      // Ignored gracefully
    }
  };

  const handleLoginSuccess = (loggedInUser: LoggedInUser) => {
    setUser(loggedInUser);
    setRoute("LIST");
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.logout();
    } catch {
      clearSession();
    } finally {
      setUser(null);
      setRoute("LOGIN");
      setSelectedLead(null);
      setLeads([]);
      setLoading(false);
    }
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setRoute("DETAILS");
  };

  const handleToggleTask = async (task: Task) => {
    const nextStatus = task.status === "Completed" ? "Pending" : "Completed";
    try {
      // Optimistic state change update
      setAllTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
      await api.updateTask(task.id, { status: nextStatus });
      await fetchAllTasks();
    } catch (err: any) {
      console.error("Failed to update task", err);
      await fetchAllTasks();
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      // Optimistic state change update
      setDismissedReminderIds((prev) => [...prev, id]);
      await api.deleteReminder(id);
      await fetchAllReminders();
    } catch (err: any) {
      console.error("Failed to delete reminder", err);
      await fetchAllReminders();
    }
  };

  const handleEditClick = (lead: Lead) => {
    setSelectedLead(lead);
    setRoute("EDIT");
  };

  const handleDeleteLead = async (id: string) => {
    try {
      setConfirmDeleteLeadId(null);
      await api.deleteLead(id);
      setSelectedLead(null);
      setRoute("LIST");
      fetchLeads();
    } catch (err: any) {
      setError(err.message || "Could not delete lead.");
    }
  };

  const handleSaved = () => {
    setSelectedLead(null);
    setDefaultOwnerEmail("");
    setRoute("LIST");
    fetchLeads();
  };

  // Master access checks (checks if user is a registered system administrator)
  const isMasterAdmin = !!user && (
    user.role === "ADMIN" ||
    user.email.toLowerCase() === "paritoshbadave@gmail.com" || 
    user.email.toLowerCase() === "admin@company.com"
  );

  // Filter computation
  const filteredLeads = leads.filter((lead) => {
    // Every user has full access to all other users' leads (view, edit, delete, enter new entries)
    const query = searchQuery.toLowerCase().trim();
    const matchQuery =
      query === "" ||
      lead.name.toLowerCase().includes(query) ||
      lead.company.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.location.toLowerCase().includes(query) ||
      lead.industry.toLowerCase().includes(query);

    const matchStatus = statusFilter === "ALL" || lead.status === statusFilter;
    const matchOwner =
      ownerFilter === "ALL" ||
      (ownerFilter.toUpperCase() === "UNASSIGNED" && (!lead.owner || lead.owner === "unassigned" || lead.owner === "")) ||
      (lead.owner && lead.owner.toLowerCase() === ownerFilter.toLowerCase());

    return matchQuery && matchStatus && matchOwner;
  });

  const myLeads = filteredLeads.filter(
    (lead) => lead.owner && lead.owner.toLowerCase() === user?.email?.toLowerCase()
  );
  const otherLeads = filteredLeads.filter(
    (lead) => !lead.owner || lead.owner.toLowerCase() !== user?.email?.toLowerCase()
  );

  const getOwnerName = (ownerEmail: string) => {
    if (!ownerEmail || ownerEmail === "unassigned") return "Unassigned Pool";
    const matchedUser = appUsers.find((u) => u.email.toLowerCase() === ownerEmail.toLowerCase());
    return matchedUser ? (matchedUser.name || ownerEmail) : ownerEmail;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col">
      {/* Header Layout */}
      <header className="sticky top-0 z-40 bg-[#0d2c54] text-white shadow-md border-b-4 border-[#0d9488]">
        <div id="crm-header-inner" className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 md:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3 py-1">
            <SyncAILogo variant="light" height="38px" className="hover:scale-101 transition duration-150" />
            <div className="hidden md:flex flex-col border-l border-slate-700/60 pl-3 ml-1">
              <span className="text-[9px] tracking-wider text-teal-300 font-bold uppercase block">
                Active Client Pipeline
              </span>
              <span className="text-[9px] tracking-wider text-slate-300 font-extrabold uppercase block mt-0.5">
                Enterprise CRM Portal
              </span>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden text-right xs:block md:block lg:block">
                <span className="block text-xs font-semibold text-white max-w-[120px] truncate">{user.name}</span>
                <span className="inline-flex items-center gap-1 mt-0.5 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-indigo-500 text-white">
                  <Shield className="h-2 w-2" /> Admin
                </span>
              </div>
              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:border-red-500 hover:bg-red-600 hover:text-white transition cursor-pointer min-h-[36px]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>



      {/* Tactile Sub-navigation control hub */}
      {user && route !== "LOGIN" && (
        <div id="crm-sub-navbar" className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 flex items-center gap-1 sm:gap-2.5 py-2.5 text-xs">
            <button
              id="nav-pipeline-btn"
              onClick={() => {
                setRoute("LIST");
                fetchAllTasks();
                fetchAllReminders();
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-black uppercase tracking-wider transition cursor-pointer min-h-[38px] ${
                route === "LIST"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/50"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Pipeline Leads</span>
            </button>

            <button
              id="nav-followup-btn"
              onClick={() => {
                setRoute("FOLLOWUPS");
                fetchAllTasks();
                fetchAllReminders();
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-black uppercase tracking-wider transition cursor-pointer min-h-[38px] ${
                route === "FOLLOWUPS"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/50"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Follow-Up Center</span>
            </button>

            <button
              onClick={() => {
                setRoute("DASHBOARD");
                fetchAllTasks();
                fetchAllReminders();
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-black uppercase tracking-wider transition cursor-pointer min-h-[38px] ${
                route === "DASHBOARD"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/50"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Sales Dashboard</span>
            </button>

            <button
              id="nav-copilot-btn"
              onClick={() => {
                setRoute("AI_COPILOT");
                fetchAllTasks();
                fetchAllReminders();
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-black uppercase tracking-wider transition cursor-pointer min-h-[38px] ${
                route === "AI_COPILOT"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100/80 hover:text-indigo-900 border border-indigo-200"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Copilot</span>
            </button>

            <button
              id="nav-workshops-btn"
              onClick={() => {
                setRoute("WORKSHOPS");
                fetchAllTasks();
                fetchAllReminders();
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-black uppercase tracking-wider transition cursor-pointer min-h-[38px] ${
                route === "WORKSHOPS"
                  ? "bg-[#0d2c54] text-white shadow"
                  : "text-[#0d9488] bg-teal-50 hover:bg-teal-100/85 hover:text-teal-900 border border-teal-200"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Books & Workshops</span>
            </button>

            <button
              id="nav-add-lead-navbar-btn"
              onClick={() => {
                setRoute("ADD");
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-black uppercase tracking-wider transition cursor-pointer min-h-[38px] ${
                route === "ADD"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100/95 border border-emerald-250/60"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add New Lead</span>
            </button>

            {!!user && (
              <button
                id="nav-admin-panel-btn"
                onClick={() => {
                  setRoute("ADMIN_CONSOLE");
                  fetchUsersList();
                }}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-black uppercase tracking-wider transition cursor-pointer min-h-[38px] ${
                  route === "ADMIN_CONSOLE"
                    ? "bg-indigo-600 text-white shadow border border-indigo-700"
                    : "text-slate-700 hover:bg-slate-100/90 border border-slate-200"
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Team Directory</span>
              </button>
            )}


          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <main className="flex-grow px-3 py-4 sm:py-6 md:px-6 max-w-7xl w-full mx-auto">
        {route === "LOGIN" && <LoginView onLoginSuccess={handleLoginSuccess} />}

        {user && route === "LIST" && (
          <div className="space-y-4 sm:space-y-6">
            {/* Interactive, dismissible Task and Smart System Reminders on Pipeline/Leads Main Page */}
            {(() => {
              const tomorrowObj = new Date();
              tomorrowObj.setDate(tomorrowObj.getDate() + 1);
              const tomorrowStr = tomorrowObj.toLocaleDateString("sv").substring(0, 10);
              
              const taskReminders = allTasks.filter(t => {
                return t.status === "Pending" && (t.dueDate === todayStr || t.dueDate === tomorrowStr) && !dismissedTaskIds.includes(t.id);
              });

              const activeSystemReminders = allReminders.filter(r => {
                return (r.reminderDate === todayStr || r.reminderDate === tomorrowStr) && r.status === "Pending" && !dismissedReminderIds.includes(r.id);
              });

              if (taskReminders.length === 0 && activeSystemReminders.length === 0) return null;

              return (
                <div id="pipeline-page-reminders" className="bg-gradient-to-r from-rose-50/70 via-indigo-50/50 to-amber-50/40 border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs relative">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                      </span>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        ⏰ Active System CRM & Sales Reminders ({taskReminders.length + activeSystemReminders.length})
                      </h3>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-3 py-1 rounded border border-slate-250">
                      Pipeline Dashboard Reminders
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3.5">
                    {/* Render Task Reminders */}
                    {taskReminders.map((task) => {
                      const associatedLead = leads.find((l) => l.id === task.leadId);
                      const isDueToday = task.dueDate === todayStr;
                      return (
                        <div key={task.id} className={`p-3.5 rounded-xl border flex items-start justify-between gap-3.5 shadow-3xs transition hover:scale-[1.002] duration-150 relative ${
                          isDueToday 
                            ? "bg-rose-50/30 border-rose-200 text-rose-950" 
                            : "bg-indigo-50/20 border-indigo-200 text-indigo-950"
                        }`}>
                          <div className="min-w-0 flex-grow">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                isDueToday
                                  ? "bg-rose-105 border-rose-200 text-rose-700"
                                  : "bg-indigo-105 border-indigo-200 text-indigo-700"
                              }`}>
                                {isDueToday ? "⚠️ Task Today" : "⏳ Task Tomorrow"}
                              </span>
                              {associatedLead && (
                                <span className="text-[10px] font-black text-slate-500 truncate max-w-[140px]">
                                  {associatedLead.company}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-black mt-2 leading-relaxed break-all text-slate-900">
                              {task.title}
                            </p>
                            {associatedLead && (
                              <button
                                onClick={() => handleLeadClick(associatedLead)}
                                className="text-[10px] font-black text-indigo-600 hover:underline mt-2 inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                              >
                                View client profile →
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0 self-start">
                            {/* Complete Task checkbox click */}
                            <button
                              onClick={() => handleToggleTask(task)}
                              className="bg-white hover:bg-emerald-600 hover:text-white text-slate-600 border border-slate-200 p-1.5 rounded-lg shadow-3xs cursor-pointer transition flex items-center justify-center shrink-0"
                              title="Mark task as completed"
                            >
                              <CheckSquare className="h-4 w-4" />
                            </button>

                            {/* Dismiss Reminder X click */}
                            <button
                              onClick={() => {
                                setDismissedTaskIds(prev => [...prev, task.id]);
                              }}
                              className="bg-white hover:bg-rose-100 text-slate-400 hover:text-rose-600 border border-slate-200 p-1.5 rounded-lg shadow-3xs cursor-pointer transition flex items-center justify-center shrink-0"
                              title="Dismiss Reminder"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render Smart/System Reminders */}
                    {activeSystemReminders.map((r) => {
                      const associatedLead = leads.find((l) => l.id === r.leadId);
                      const isToday = r.reminderDate === todayStr;
                      return (
                        <div key={r.id} className={`p-3.5 rounded-xl border flex items-start justify-between gap-3.5 shadow-3xs transition hover:scale-[1.002] duration-150 relative ${
                          isToday 
                            ? "bg-amber-50/50 border-amber-250 text-amber-950" 
                            : "bg-orange-50/20 border-orange-200 text-orange-950"
                        }`}>
                          <div className="min-w-0 flex-grow">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                isToday
                                  ? "bg-amber-100 border-amber-250 text-amber-700"
                                  : "bg-orange-100 border-orange-200 text-orange-700"
                              }`}>
                                {isToday ? "🚨 Smart Alert: Today" : "📅 Smart Alert: Tomorrow"}
                              </span>
                              {associatedLead && (
                                <span className="text-[10px] font-black text-slate-500 truncate max-w-[140px]">
                                  {associatedLead.company}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-black mt-2 leading-relaxed break-all text-slate-900">
                              {(() => {
                                const tLower = r.title.toLowerCase();
                                if (tLower.includes("regarding none") || tLower.includes("regarding unspecified") || tLower.includes("regarding null") || tLower.includes("regarding pending")) {
                                  const nameOrComp = (associatedLead?.company || associatedLead?.name || "Client");
                                  return `Follow up ${nameOrComp}`;
                                }
                                return r.title;
                              })()}
                            </p>
                            {associatedLead && (
                              <button
                                onClick={() => handleLeadClick(associatedLead)}
                                className="text-[10px] font-black text-indigo-600 hover:underline mt-2 inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                              >
                                View client profile →
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0 self-start">
                            {/* Dismiss Reminder X click */}
                            <button
                              onClick={() => handleDeleteReminder(r.id)}
                              className="bg-white hover:bg-rose-100 text-slate-400 hover:text-rose-600 border border-slate-200 p-1.5 rounded-lg shadow-3xs cursor-pointer transition flex items-center justify-center shrink-0"
                              title="Delete/Clear Reminder"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Admin Dynamic Actions & Scheduling Hub */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Monthly Interactive Calendar */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
                <div>
                  {(() => {
                    const MONTHS_LIST = [
                      { value: 1, label: "January" },
                      { value: 2, label: "February" },
                      { value: 3, label: "March" },
                      { value: 4, label: "April" },
                      { value: 5, label: "May" },
                      { value: 6, label: "June" },
                      { value: 7, label: "July" },
                      { value: 8, label: "August" },
                      { value: 9, label: "September" },
                      { value: 10, label: "October" },
                      { value: 11, label: "November" },
                      { value: 12, label: "December" },
                    ];

                    const currentYearValue = new Date().getFullYear();
                    const yearOptionsList: number[] = [];
                    for (let y = 2024; y <= currentYearValue + 15; y++) {
                      yearOptionsList.push(y);
                    }

                    const daysInActiveMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                    const monthPadded = selectedMonth < 10 ? "0" + selectedMonth : selectedMonth;

                    return (
                      <>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-indigo-600" />
                            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                              Scheduled CRM Actions Calendar
                            </h3>
                          </div>
                          
                          {/* Dropdown selectors for lifelong agnostics */}
                          <div className="flex items-center gap-1.5 pb-0.5">
                            <select
                              value={selectedMonth}
                              onChange={(e) => {
                                setSelectedMonth(parseInt(e.target.value, 10));
                                setSelectedDay(1); // Reset selected day to 1 on month shift
                              }}
                              className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-center font-mono"
                            >
                              {MONTHS_LIST.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={selectedYear}
                              onChange={(e) => {
                                setSelectedYear(parseInt(e.target.value, 10));
                                setSelectedDay(1); // Reset selected day to 1 on year shift
                              }}
                              className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-center font-mono"
                            >
                              {yearOptionsList.map((y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
                            <div
                              key={dayName}
                              className="py-1 text-[9px] font-black uppercase text-slate-400 tracking-wider"
                            >
                              {dayName}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 mt-1">
                          {(() => {
                            const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay();
                            const startOffset = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;
                            
                            const items: React.ReactNode[] = [];
                            
                            // Render empty placeholder blocks for calendar start alignment
                            for (let i = 0; i < startOffset; i++) {
                              items.push(
                                <div key={`empty-${i}`} className="min-h-[52px] bg-slate-50/30 border border-slate-100/40 rounded-lg opacity-25" />
                              );
                            }
                            
                            // Render active month days
                            for (let index = 0; index < daysInActiveMonth; index++) {
                              const dayVal = index + 1;
                              const dateStrVal = `${selectedYear}-${monthPadded}-${dayVal < 10 ? "0" + dayVal : dayVal}`;
                              const dayTasksVal = allTasks.filter((t) => t.dueDate === dateStrVal);
                              const todayObj = new Date();
                              const isTodayVal = selectedYear === todayObj.getFullYear() && selectedMonth === (todayObj.getMonth() + 1) && dayVal === todayObj.getDate();
                              const isSelectedVal = selectedDay === dayVal;
                              const pendingCount = dayTasksVal.filter((t) => t.status === "Pending").length;
                              
                              items.push(
                                <button
                                  key={`day-${dayVal}`}
                                  onClick={() => setSelectedDay(dayVal)}
                                  className={`min-h-[52px] p-1.5 border rounded-lg flex flex-col justify-between items-stretch transition cursor-pointer text-left ${
                                    isSelectedVal
                                      ? "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/10"
                                      : isTodayVal
                                      ? "border-sky-300 bg-sky-50 text-sky-900"
                                      : "border-slate-200 bg-white hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span
                                      className={`text-[10px] font-black ${
                                        isTodayVal
                                          ? "flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-white font-extrabold pb-0.5"
                                          : isSelectedVal
                                          ? "text-indigo-700 font-extrabold"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      {dayVal}
                                    </span>
                                    {dayTasksVal.length > 0 && (
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          pendingCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                                        }`}
                                      />
                                    )}
                                  </div>

                                  <div className="mt-1">
                                    {dayTasksVal.length > 0 ? (
                                      <div className="space-y-0.5 overflow-hidden">
                                        {dayTasksVal.slice(0, 2).map((t) => (
                                          <div
                                            key={t.id}
                                            title={t.title}
                                            className={`text-[7px] font-black px-1 py-0.5 rounded truncate leading-none ${
                                              t.status === "Completed"
                                                ? "bg-slate-100 text-slate-500 line-through opacity-70"
                                                : "bg-amber-55 bg-amber-100/60 text-amber-900"
                                            }`}
                                          >
                                            {t.title}
                                          </div>
                                        ))}
                                        {dayTasksVal.length > 2 && (
                                          <div className="text-[6px] text-slate-450 font-black uppercase pl-0.5 mt-0.5">
                                            +{dayTasksVal.length - 2} more
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="h-1" />
                                    )}
                                  </div>
                                </button>
                              );
                            }
                            
                            return items;
                          })()}
                        </div>

                        {/* Selected Day Schedule Details View */}
                        {(() => {
                          const activeDateTasks = allTasks.filter((t) => t.dueDate === `${selectedYear}-${monthPadded}-${selectedDay < 10 ? "0" + selectedDay : selectedDay}`);
                          if (activeDateTasks.length === 0) return null;
                          
                          return (
                            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-205">
                              <div className="flex justify-between items-center text-xs font-black text-slate-600 mb-2">
                                <span>Active Schedule: {MONTHS_LIST[selectedMonth - 1]?.label || "Month"} {selectedDay}, {selectedYear}</span>
                                <span className="bg-indigo-100 text-indigo-805 px-2 py-0.5 rounded-full text-[9px] font-black font-mono">
                                  {activeDateTasks.length} Actions
                                </span>
                              </div>
                              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                                {activeDateTasks.map((task) => {
                                  const lead = leads.find((l) => l.id === task.leadId);
                                  return (
                                    <div
                                      key={task.id}
                                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-150 text-xs shadow-xs"
                                    >
                                      <div className="flex-grow min-w-0 pr-2">
                                        <span
                                          className={`block font-bold truncate ${
                                            task.status === "Completed" ? "line-through text-slate-450 opacity-65" : "text-slate-800"
                                          }`}
                                        >
                                          {task.title}
                                        </span>
                                        {lead && (
                                          <button
                                            onClick={() => handleLeadClick(lead)}
                                            className="text-[10px] font-extrabold text-indigo-650 hover:underline inline-flex items-center gap-0.5 cursor-pointer mt-0.5"
                                          >
                                            <Building className="h-2.5 w-2.5" /> {lead.company}
                                          </button>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleToggleTask(task)}
                                        className={`p-1 rounded-md cursor-pointer transition shrink-0 ${
                                          task.status === "Completed"
                                            ? "bg-emerald-100/70 text-emerald-800 hover:bg-emerald-250"
                                            : "bg-slate-100 text-slate-650 hover:bg-slate-200"
                                        }`}
                                        title={task.status === "Completed" ? "Keep Active" : "Set Done"}
                                      >
                                        <CheckSquare className="h-4 w-4" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Right Side: Primary Active To-Do List */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                        Today's Actions To-Do List
                      </h3>
                    </div>
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>

                  <div className="space-y-3.5 max-h-[385px] overflow-y-auto pr-1">
                    {/* Overdue Warning Red Section */}
                    {allTasks.filter((t) => t.status === "Pending" && t.dueDate !== "Pending" && t.dueDate < todayStr).length > 0 && (
                      <div className="space-y-1.5 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                        <div className="text-[9px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-1.5 mb-1 animate-pulse">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Overdue Tasks Remaining
                        </div>
                        {allTasks
                          .filter((t) => t.status === "Pending" && t.dueDate !== "Pending" && t.dueDate < todayStr)
                          .map((t) => {
                            const lead = leads.find((l) => l.id === t.leadId);
                            return (
                              <div
                                key={t.id}
                                className="p-2.5 rounded-lg bg-white border-2 border-rose-200 shadow-sm flex items-center justify-between text-xs transition hover:bg-rose-50"
                              >
                                <div className="min-w-0 pr-3">
                                  <span className="block font-black text-rose-950 leading-tight">
                                    {t.title}
                                  </span>
                                  <span className="inline-block mt-0.5 font-mono text-[8px] text-rose-500 font-extrabold">
                                    Was due: {t.dueDate}
                                  </span>
                                  {lead && (
                                    <button
                                      onClick={() => handleLeadClick(lead)}
                                      className="block mt-1 text-[9px] font-black text-indigo-750 hover:underline cursor-pointer"
                                    >
                                      Lead: <span className="underline">{lead.company}</span>
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleToggleTask(t)}
                                  className="flex items-center justify-center h-7 w-7 rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer transition shrink-0 shadow-sm"
                                  title="Complete Overdue Action"
                                >
                                  <CheckSquare className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Today's due tasks & newly added EOD tasks */}
                    {allTasks.filter((t) => t.dueDate === todayStr || (t.dueDate === "Pending" && t.createdAt?.startsWith(todayStr))).length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                          <Clock className="h-3.5 w-3.5 text-indigo-500" /> Active actions for today
                        </div>
                        {allTasks
                          .filter((t) => t.dueDate === todayStr || (t.dueDate === "Pending" && t.createdAt?.startsWith(todayStr)))
                          .map((t) => {
                            const lead = leads.find((l) => l.id === t.leadId);
                            return (
                              <div
                                key={t.id}
                                className={`p-2.5 rounded-lg border shadow-sm flex items-center justify-between text-xs transition ${
                                  t.status === "Completed"
                                    ? "bg-slate-50 border-slate-100 text-slate-450 opacity-60"
                                    : "bg-white border-indigo-100 hover:bg-indigo-50/10"
                                }`}
                              >
                                <div className="min-w-0 pr-3">
                                  <span
                                    className={`block font-extrabold leading-tight ${
                                      t.status === "Completed" ? "line-through text-slate-450" : "text-slate-800"
                                    }`}
                                  >
                                    {t.title}
                                  </span>
                                  <span className="inline-block mt-0.5 font-mono text-[8px] text-indigo-500 font-extrabold">
                                    {t.dueDate === "Pending" ? "Today (EOD)" : "Due Today"}
                                  </span>
                                  {lead && (
                                    <button
                                      onClick={() => handleLeadClick(lead)}
                                      className="block mt-1 text-[9px] font-black text-indigo-650 hover:underline cursor-pointer"
                                    >
                                      Lead: <span className="underline">{lead.company}</span>
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleToggleTask(t)}
                                  className={`flex items-center justify-center h-7 w-7 rounded-lg cursor-pointer transition shrink-0 ${
                                    t.status === "Completed"
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                                  }`}
                                  title={t.status === "Completed" ? "Re-open" : "Set Done"}
                                >
                                  <CheckSquare className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        🎉 No active tasks scheduled for today. Keep up the great work!
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-[10px] text-slate-450 italic bg-indigo-50/40 p-2 rounded-lg border border-indigo-100/30">
                  💡 High priority action items detected inside Speech-to-Text transcribing automatically land here mapped and scheduled relative to today!
                </div>
              </div>
            </div>

            {/* Queries & Custom Filter Panel */}
            <div className="rounded-xl border border-slate-250 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-600" /> Pipeline Search & Filters
                </span>
              </div>

              <div className="p-4 flex flex-col gap-4">
                {/* Search query box */}
                <div className="relative w-full">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    id="search-box-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search client name, industry, location, or notes..."
                    className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Dropdowns Filters selection */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    {/* Filter Status Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Filter Stage:</span>
                      <select
                        id="filter-status-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="block w-full sm:w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:border-indigo-500 focus:outline-none min-h-[40px]"
                      >
                        <option value="ALL">All Statuses</option>
                        {LEAD_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filter Assignee Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Filter Owner:</span>
                      <select
                        id="filter-owner-select"
                        value={ownerFilter}
                        onChange={(e) => setOwnerFilter(e.target.value)}
                        className="block w-full sm:w-56 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-extrabold focus:border-indigo-500 focus:outline-none min-h-[40px] shadow-sm"
                      >
                        <option value="ALL">🌟 All Owners (Overall)</option>
                        <option value="UNASSIGNED">👤 Unassigned Leads</option>
                        {appUsers.map((u: any) => (
                          <option key={u.email} value={u.email}>
                            👤 {u.name || u.email} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center pt-2 sm:pt-0">
                    <button
                      onClick={fetchLeads}
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-650 hover:bg-slate-50 transition cursor-pointer"
                      title="Reload CRM Data"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>

                    {/* Dynamic View Mode selection toggle */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewMode("TABLE")}
                        className={`flex h-[32px] items-center gap-1 rounded-md px-3.5 text-xs font-bold transition cursor-pointer ${
                          viewMode === "TABLE"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-905"
                        }`}
                      >
                        Table View
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("CARDS")}
                        className={`flex h-[32px] items-center gap-1 rounded-md px-3.5 text-xs font-bold transition cursor-pointer ${
                          viewMode === "CARDS"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-905"
                        }`}
                      >
                        Cards View
                      </button>
                    </div>

                    <button
                      id="add-new-lead-btn"
                      onClick={() => setRoute("ADD")}
                      className="flex-grow sm:flex-grow-0 flex h-[44px] items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Add New Lead
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RENDER MODE A: DENSE RESPONSIVE VIEW (ALWAYS VISIBLE TABLE WITH SCROLL) */}
            {viewMode === "TABLE" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* COLUMN 1: MY LEADS */}
                <div className="flex flex-col space-y-3">
                  <div className="bg-[#0d2c54] text-white rounded-xl p-4 shadow-sm flex items-center justify-between border-b-2 border-indigo-500">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                        {myLeads.length}
                      </span>
                      <h3 className="font-extrabold text-xs sm:text-sm tracking-wide uppercase">My Leads</h3>
                    </div>
                    <button
                      onClick={() => {
                        setDefaultOwnerEmail(user?.email || "");
                        setRoute("ADD");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#0d9488] hover:bg-teal-650 text-white py-1 px-2.5 rounded-lg transition cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Add Lead For Me
                    </button>
                  </div>
                  
                  <div className="block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <th className="px-4 py-3">Lead / Company</th>
                          <th className="px-4 py-3">Industry</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                <tbody className="divide-y divide-slate-100">
                        {myLeads.length > 0 ? (
                          myLeads.map((lead) => {
                            const statusOpt = LEAD_STATUS_OPTIONS.find((o) => o.value === lead.status) || {
                              label: lead.status,
                              bg: "bg-slate-100",
                              text: "text-slate-800",
                            };
                            return (
                              <tr key={lead.id} className="hover:bg-indigo-50/10 transition group border-b border-slate-100 last:border-b-0">
                                <td className="px-4 py-3">
                                  <button onClick={() => handleLeadClick(lead)} className="block text-left focus:outline-none cursor-pointer">
                                    <span className="block font-bold text-slate-900 group-hover:text-indigo-600 transition text-sm">
                                      {lead.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                      <Building className="h-2.5 w-2.5 text-slate-400" /> {lead.company}
                                    </span>
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600 font-semibold">
                                  {lead.industry || "—"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block rounded px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusOpt.bg} ${statusOpt.text}`}>
                                    {statusOpt.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleLeadClick(lead)}
                                      className="rounded border border-slate-250 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer min-h-[26px]"
                                    >
                                      Details
                                    </button>
                                    <button
                                      id={`edit-lead-${lead.id}`}
                                      onClick={() => handleEditClick(lead)}
                                      className="rounded border border-indigo-200 bg-indigo-50/20 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 transition cursor-pointer min-h-[26px]"
                                    >
                                      Edit
                                    </button>
                                    {confirmDeleteLeadId === lead.id ? (
                                      <div className="inline-flex items-center gap-1 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-[9px] text-rose-700 font-bold">Sure?</span>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleDeleteLead(lead.id);
                                          }}
                                          className="rounded bg-rose-600 text-white px-1.5 py-0.5 text-[9px] font-black hover:bg-rose-700 transition"
                                        >
                                          Yes
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteLeadId(null);
                                          }}
                                          className="rounded border border-slate-200 bg-white text-slate-700 px-1.5 py-0.5 text-[9px] font-bold hover:bg-slate-50 transition"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        id={`delete-lead-${lead.id}`}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteLeadId(lead.id);
                                        }}
                                        className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700 hover:bg-rose-600 hover:text-white transition cursor-pointer min-h-[26px]"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-450 text-xs">
                              <FolderOpen className="h-8 w-8 mx-auto text-slate-300 mb-1" />
                              No active leads assigned to you.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* COLUMN 2: OTHER USERS' LEADS */}
                <div className="flex flex-col space-y-3">
                  <div className="bg-slate-800 text-white rounded-xl p-4 shadow-sm flex items-center justify-between border-b-2 border-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                        {otherLeads.length}
                      </span>
                      <h3 className="font-extrabold text-xs sm:text-sm tracking-wide uppercase">Other Users' Leads</h3>
                    </div>
                  </div>
                  
                  <div className="block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <th className="px-4 py-3">Lead / Company</th>
                          <th className="px-4 py-3">Owner username</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {otherLeads.length > 0 ? (
                          otherLeads.map((lead) => {
                            const statusOpt = LEAD_STATUS_OPTIONS.find((o) => o.value === lead.status) || {
                              label: lead.status,
                              bg: "bg-slate-100",
                              text: "text-slate-800",
                            };
                            const ownerName = getOwnerName(lead.owner);
                            return (
                              <tr key={lead.id} className="hover:bg-slate-50/50 transition group border-b border-slate-100 last:border-b-0">
                                <td className="px-4 py-3">
                                  <button onClick={() => handleLeadClick(lead)} className="block text-left focus:outline-none cursor-pointer">
                                    <span className="block font-bold text-slate-900 group-hover:text-indigo-600 transition text-sm">
                                      {lead.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                      <Building className="h-2.5 w-2.5 text-slate-400" /> {lead.company}
                                    </span>
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600 font-semibold">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate max-w-[120px] block" title={lead.owner}>
                                      👤 {ownerName}
                                    </span>
                                    {lead.owner && lead.owner !== "unassigned" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDefaultOwnerEmail(lead.owner);
                                          setRoute("ADD");
                                        }}
                                        className="inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-550 text-white hover:bg-indigo-600 transition cursor-pointer"
                                        title={`Add in ${ownerName}'s leads`}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block rounded px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusOpt.bg} ${statusOpt.text}`}>
                                    {statusOpt.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleLeadClick(lead)}
                                      className="rounded border border-slate-250 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer min-h-[26px]"
                                    >
                                      Details
                                    </button>
                                    <button
                                      id={`edit-lead-other-${lead.id}`}
                                      onClick={() => handleEditClick(lead)}
                                      className="rounded border border-indigo-200 bg-indigo-50/20 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 transition cursor-pointer min-h-[26px]"
                                    >
                                      Edit
                                    </button>
                                    {confirmDeleteLeadId === lead.id ? (
                                      <div className="inline-flex items-center gap-1 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-[9px] text-rose-700 font-bold">Sure?</span>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleDeleteLead(lead.id);
                                          }}
                                          className="rounded bg-rose-600 text-white px-1.5 py-0.5 text-[9px] font-black hover:bg-rose-700 transition"
                                        >
                                          Yes
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteLeadId(null);
                                          }}
                                          className="rounded border border-slate-200 bg-white text-slate-700 px-1.5 py-0.5 text-[9px] font-bold hover:bg-slate-50 transition"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        id={`delete-lead-other-${lead.id}`}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteLeadId(lead.id);
                                        }}
                                        className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700 hover:bg-rose-600 hover:text-white transition cursor-pointer min-h-[26px]"
                                      >
                                        Delete
                                      </button>
                                    )}
                                    {lead.owner && lead.owner !== "unassigned" && (
                                      <button
                                        onClick={() => {
                                          setDefaultOwnerEmail(lead.owner);
                                          setRoute("ADD");
                                        }}
                                        className="rounded border border-teal-200 bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 hover:border-teal-400 hover:bg-teal-100 transition cursor-pointer min-h-[26px] flex items-center gap-0.5"
                                        title={`Add new lead in ${ownerName}'s list`}
                                      >
                                        <Plus className="h-2.5 w-2.5" /> Add
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-450 text-xs">
                              <FolderOpen className="h-8 w-8 mx-auto text-slate-300 mb-1" />
                              No other leads matching filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* RENDER MODE B: FULL RESPONSIVE MOBILE CUSTOM GRID VIEW (block md:hidden) */}
            {viewMode === "CARDS" && (
              <div className="block md:hidden space-y-6">
                
                {/* SECTION 1: MY LEADS */}
                <div className="space-y-3">
                  <div className="bg-[#0d2c54] text-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                        {myLeads.length}
                      </span>
                      <h3 className="font-extrabold text-xs tracking-wide uppercase">My Leads</h3>
                    </div>
                    <button
                      onClick={() => {
                        setDefaultOwnerEmail(user?.email || "");
                        setRoute("ADD");
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#0d9488] hover:bg-teal-650 text-white py-1 px-2 rounded-md transition cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Add For Me
                    </button>
                  </div>

                  {myLeads.length > 0 ? (
                    myLeads.map((lead) => {
                      const statusOpt = LEAD_STATUS_OPTIONS.find((o) => o.value === lead.status) || {
                        label: lead.status,
                        bg: "bg-slate-100",
                        text: "text-slate-800",
                      };

                      return (
                        <div
                          key={lead.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 transition active:bg-slate-50"
                        >
                          {/* Name / Company Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <button
                                onClick={() => handleLeadClick(lead)}
                                className="text-left font-extrabold text-slate-900 text-sm hover:text-indigo-650 cursor-pointer block"
                              >
                                {lead.name}
                              </button>
                              <span className="text-[11px] text-slate-450 font-semibold flex items-center gap-1 mt-0.5">
                                <Building className="h-3 w-3 shrink-0 text-slate-400" /> {lead.company}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {lead.businessUnit && (
                                  <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 shrink-0">
                                    💼 {lead.businessUnit}
                                  </span>
                                )}
                                {lead.temperature && (
                                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset shrink-0 ${
                                    lead.temperature === "HOT" 
                                      ? "bg-rose-50 text-rose-700 ring-rose-650/10" 
                                      : lead.temperature === "WARM" 
                                      ? "bg-amber-50 text-amber-700 ring-amber-650/10" 
                                      : "bg-sky-50 text-sky-700 ring-sky-650/10"
                                  }`}>
                                    {lead.temperature === "HOT" ? "🔥 Hot" : lead.temperature === "WARM" ? "⚡ Warm" : "❄️ Cold"}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className={`inline-block rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusOpt.bg} ${statusOpt.text}`}>
                              {statusOpt.label}
                            </span>
                          </div>

                          {/* Small specifications */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-2.5">
                            {lead.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{lead.location}</span>
                              </div>
                            )}
                            {lead.industry && (
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-slate-550">🏭 {lead.industry}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleLeadClick(lead)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer min-w-[70px]"
                            >
                              <Eye className="h-3.5 w-3.5" /> Details
                            </button>
                            <button
                              id={`edit-lead-mob-${lead.id}`}
                              onClick={() => handleEditClick(lead)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/60 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer min-w-[70px]"
                            >
                              <Edit className="h-3.5 w-3.5" /> Edit
                            </button>
                            {confirmDeleteLeadId === lead.id ? (
                              <div className="flex-1 flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-right-1 duration-150 py-1" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[10px] text-rose-700 font-extrabold select-none text-nowrap">Sure?</span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleDeleteLead(lead.id);
                                  }}
                                  className="rounded bg-rose-600 text-white px-2.5 py-1 text-[10px] font-black hover:bg-rose-700 transition cursor-pointer min-h-[30px]"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteLeadId(null);
                                  }}
                                  className="rounded border border-slate-250 bg-white text-slate-700 px-2.5 py-1 text-[10px] font-bold hover:bg-slate-50 transition cursor-pointer min-h-[30px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                id={`delete-lead-mob-del-${lead.id}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteLeadId(lead.id);
                                }}
                                className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition cursor-pointer min-w-[70px]"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-xs">
                      <FolderOpen className="h-8 w-8 mx-auto text-slate-300 mb-1" />
                      No active leads assigned to you.
                    </div>
                  )}
                </div>

                {/* SECTION 2: OTHER USERS' LEADS */}
                <div className="space-y-3">
                  <div className="bg-slate-800 text-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white">
                        {otherLeads.length}
                      </span>
                      <h3 className="font-extrabold text-xs tracking-wide uppercase">Other Users' Leads</h3>
                    </div>
                  </div>

                  {otherLeads.length > 0 ? (
                    otherLeads.map((lead) => {
                      const statusOpt = LEAD_STATUS_OPTIONS.find((o) => o.value === lead.status) || {
                        label: lead.status,
                        bg: "bg-slate-100",
                        text: "text-slate-800",
                      };
                      const ownerName = getOwnerName(lead.owner);

                      return (
                        <div
                          key={lead.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 transition active:bg-slate-50"
                        >
                          {/* Name / Company Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <button
                                onClick={() => handleLeadClick(lead)}
                                className="text-left font-extrabold text-slate-900 text-sm hover:text-indigo-650 cursor-pointer block"
                              >
                                {lead.name}
                              </button>
                              <span className="text-[11px] text-slate-450 font-semibold flex items-center gap-1 mt-0.5">
                                <Building className="h-3 w-3 shrink-0 text-slate-400" /> {lead.company}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {lead.businessUnit && (
                                  <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 shrink-0">
                                    💼 {lead.businessUnit}
                                  </span>
                                )}
                                {lead.temperature && (
                                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset shrink-0 ${
                                    lead.temperature === "HOT" 
                                      ? "bg-rose-50 text-rose-700 ring-rose-650/10" 
                                      : lead.temperature === "WARM" 
                                      ? "bg-amber-50 text-amber-700 ring-amber-650/10" 
                                      : "bg-sky-50 text-sky-700 ring-sky-650/10"
                                  }`}>
                                    {lead.temperature === "HOT" ? "🔥 Hot" : lead.temperature === "WARM" ? "⚡ Warm" : "❄️ Cold"}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className={`inline-block rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusOpt.bg} ${statusOpt.text}`}>
                              {statusOpt.label}
                            </span>
                          </div>

                          {/* Small specifications */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-2.5">
                            <div className="flex items-center gap-1 col-span-2">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                👤 Owner username: <b className="text-slate-950">{ownerName}</b>
                              </span>
                              {lead.owner && lead.owner !== "unassigned" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDefaultOwnerEmail(lead.owner);
                                    setRoute("ADD");
                                  }}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition cursor-pointer"
                                  title={`Add in ${ownerName}'s leads`}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            {lead.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{lead.location}</span>
                              </div>
                            )}
                            {lead.industry && (
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-slate-550">🏭 {lead.industry}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleLeadClick(lead)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer min-w-[70px]"
                            >
                              <Eye className="h-3.5 w-3.5" /> Details
                            </button>
                            <button
                              id={`edit-lead-mob-other-${lead.id}`}
                              onClick={() => handleEditClick(lead)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/60 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer min-w-[70px]"
                            >
                              <Edit className="h-3.5 w-3.5" /> Edit
                            </button>
                            {confirmDeleteLeadId === lead.id ? (
                              <div className="flex-1 flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-right-1 duration-150 py-1" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[10px] text-rose-700 font-extrabold select-none text-nowrap">Sure?</span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleDeleteLead(lead.id);
                                  }}
                                  className="rounded bg-rose-600 text-white px-2.5 py-1 text-[10px] font-black hover:bg-rose-700 transition cursor-pointer min-h-[30px]"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteLeadId(null);
                                  }}
                                  className="rounded border border-slate-250 bg-white text-slate-700 px-2.5 py-1 text-[10px] font-bold hover:bg-slate-50 transition cursor-pointer min-h-[30px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                id={`delete-lead-mob-del-other-${lead.id}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteLeadId(lead.id);
                                }}
                                className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition cursor-pointer min-w-[70px]"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            )}
                            {lead.owner && lead.owner !== "unassigned" && (
                              <button
                                onClick={() => {
                                  setDefaultOwnerEmail(lead.owner);
                                  setRoute("ADD");
                                }}
                                className="flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-teal-200 bg-teal-50 text-xs font-bold text-teal-700 hover:bg-teal-100 transition cursor-pointer min-w-[70px]"
                                title={`Add new lead in ${ownerName}'s list`}
                              >
                                <Plus className="h-3.5 w-3.5" /> Add New
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-xs">
                      <FolderOpen className="h-8 w-8 mx-auto text-slate-300 mb-1" />
                      No other leads match filters.
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

          {/* SALES DASHBOARD SECTION */}
        {user && route === "DASHBOARD" && (() => {
          const dashboardLeads = leads;

          const totalLeads = dashboardLeads.length;
          const activeLeads = dashboardLeads.filter(l => l.status !== "LOST" && l.status !== "WON").length;
          const hotLeads = dashboardLeads.filter(l => l.temperature === "HOT" || l.status === "NEGOTIATION" || l.status === "PROPOSAL_SENT").length;
          const warmLeads = dashboardLeads.filter(l => l.temperature === "WARM" || (!l.temperature && (l.status === "CONTACTED" || l.status === "QUALIFIED" || l.status === "NEW"))).length;
          const coldLeads = dashboardLeads.filter(l => l.temperature === "COLD" || l.status === "LOST").length;

          const filteredDashboardTasks = allTasks.filter(t => {
            const matchedLead = leads.find(l => l.id === t.leadId);
            return !!matchedLead;
          });

          const pendingTasks = filteredDashboardTasks.filter(t => t.status === "Pending").length;
          const overdueTasks = filteredDashboardTasks.filter(t => t.status === "Pending" && t.dueDate !== "Pending" && t.dueDate < todayStr).length;
          const followupsToday = filteredDashboardTasks.filter(t => t.status === "Pending" && (t.dueDate === todayStr || (t.dueDate === "Pending" && t.createdAt?.startsWith(todayStr)))).length;

          return (
            <div className="space-y-6 animate-fade-in">
              {/* Stat Bento Grids */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
                {/* 1. Total Leads */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Total Pipeline Leads</span>
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">{totalLeads}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Inbound corporate accounts</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <Users className="h-5.5 w-5.5" />
                  </div>
                </div>

                {/* 2. Active Leads */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Active Leads</span>
                    <span className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1 block">{activeLeads}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Excludes lost/won stages</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <Briefcase className="h-5.5 w-5.5 text-emerald-600 shrink-0" />
                  </div>
                </div>

                {/* 3. Hot Leads */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Hot Prospects</span>
                    <span className="text-2xl sm:text-3xl font-black text-rose-650 mt-1 block">{hotLeads}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Negotiating & Proposals</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                    <Activity className="h-5.5 w-5.5 text-rose-500" />
                  </div>
                </div>

                {/* 4. Warm Leads */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Warm Proposals</span>
                    <span className="text-2xl sm:text-3xl font-black text-amber-550 mt-1 block">{warmLeads}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Discussions & Scheduled</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <SlidersHorizontal className="h-5.5 w-5.5 text-amber-500" />
                  </div>
                </div>

                {/* 5. Cold Leads */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Cold Candidates</span>
                    <span className="text-2xl sm:text-3xl font-black text-slate-500 mt-1 block">{coldLeads}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Lost or inactive leads</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <FolderOpen className="h-5.5 w-5.5 text-slate-500" />
                  </div>
                </div>

                {/* 6. Pending Tasks */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Pending Tasks</span>
                    <span className="text-2xl sm:text-3xl font-black text-indigo-650 mt-1 block">{pendingTasks}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Assigned active actions</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <CheckSquare className="h-5.5 w-5.5 text-indigo-500" />
                  </div>
                </div>

                {/* 7. Overdue Tasks */}
                <div className="bg-white p-5 rounded-xl border border-rose-250 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-rose-700 tracking-wider block font-black">Overdue Tasks</span>
                    <span className="text-2xl sm:text-3xl font-black text-rose-600 mt-1 block">{overdueTasks}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Delayed follow-ups remaining</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                    <AlertCircle className="h-5.5 w-5.5" />
                  </div>
                </div>

                {/* 8. Follow-Ups Due Today */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Follow-Ups Today</span>
                    <span className="text-2xl sm:text-3xl font-black text-sky-650 mt-1 block">{followupsToday}</span>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1.5 block">Must clear by end-of-day</span>
                  </div>
                  <div className="h-11 w-11 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                    <Clock className="h-5.5 w-4.5" />
                  </div>
                </div>
              </div>



              {/* Embed Financial Forecast Projections Table */}
              {(isMasterAdmin || showRevenueToUsers) && (
                <div className="space-y-6">
                  <FinancialForecastTable
                    isMasterAdmin={isMasterAdmin}
                    revenueMetrics={revenueMetrics}
                    showRevenueToUsers={showRevenueToUsers}
                    onRefresh={fetchRevenueMetrics}
                    poList={poList}
                  />

                  <PoAssuredBusinessTable
                    appUsers={appUsers}
                    currentUserEmail={user?.email || "system"}
                    poList={poList}
                    onRefreshPo={fetchPoList}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* FOLLOW-UP CENTER SECTION */}
        {user && route === "FOLLOWUPS" && (() => {
          const overdue = allTasks.filter(t => t.status === "Pending" && t.dueDate !== "Pending" && t.dueDate < todayStr);
          const dueToday = allTasks.filter(t => t.status === "Pending" && (t.dueDate === todayStr || (t.dueDate === "Pending" && t.createdAt?.startsWith(todayStr))));
          const upcoming = allTasks.filter(t => t.status === "Pending" && t.dueDate !== "Pending" && t.dueDate > todayStr);

          return (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-250 pb-4 gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">Dedicated Follow-Up Center</h2>
                  <p className="text-xs text-slate-500 mt-1">Manage scheduled touchpoints, calls, and customer pipeline follow-ups.</p>
                </div>
                <button
                  onClick={fetchAllTasks}
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-lg py-2 px-4 shadow-sm text-xs font-bold hover:bg-slate-50 cursor-pointer min-h-[38px] text-slate-700"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Reload Tasks</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Overdue Touchpoints */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-rose-50 text-rose-600 font-black text-xs font-mono">
                      {overdue.length}
                    </span>
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-rose-700">Follow-Ups Overdue</h3>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {overdue.length > 0 ? (
                      overdue.map(t => {
                        const lead = leads.find(l => l.id === t.leadId);
                        return (
                          <div key={t.id} className="bg-white p-4 rounded-xl border-2 border-rose-105 shadow-sm space-y-3 hover:border-rose-400 transition bg-rose-50/5">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest font-mono">Expired: {t.dueDate}</span>
                              <h4 className="font-extrabold text-sm text-slate-800 leading-snug">{t.title}</h4>
                              {lead && (
                                <button
                                  onClick={() => handleLeadClick(lead)}
                                  className="text-[11px] font-semibold text-indigo-650 inline-flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                  <Building className="h-3 w-3 text-slate-400" /> {lead.company} ({lead.name})
                                </button>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5">
                              {/* inline reschedule */}
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black uppercase text-slate-400">Reschedule:</span>
                                <input
                                  type="date"
                                  onChange={async (e) => {
                                    const nextD = e.target.value;
                                    if (!nextD) return;
                                    await api.updateTask(t.id, { dueDate: nextD });
                                    await fetchAllTasks();
                                  }}
                                  className="text-[10px] font-semibold border border-slate-200 bg-slate-50 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer min-h-[24px]"
                                />
                              </div>

                              <button
                                onClick={() => handleToggleTask(t)}
                                className="flex items-center justify-center p-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer transition shrink-0 h-[32px] w-[32px]"
                                title="Mark Completed"
                              >
                                <CheckSquare className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 py-8 text-center italic">Nice! No overdue follow-ups.</p>
                    )}
                  </div>
                </div>

                {/* Column 2: Due Today */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-indigo-100 pb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-50 text-indigo-600 font-black text-xs font-mono">
                      {dueToday.length}
                    </span>
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-indigo-700">Due Today</h3>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {dueToday.length > 0 ? (
                      dueToday.map(t => {
                        const lead = leads.find(l => l.id === t.leadId);
                        return (
                          <div key={t.id} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm space-y-3 hover:border-indigo-300 transition">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest font-mono">Action due today</span>
                              <h4 className="font-extrabold text-sm text-slate-800 leading-snug">{t.title}</h4>
                              {lead && (
                                <button
                                  onClick={() => handleLeadClick(lead)}
                                  className="text-[11px] font-semibold text-indigo-650 inline-flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                  <Building className="h-3 w-3 text-slate-400" /> {lead.company} ({lead.name})
                                </button>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5">
                              {/* inline reschedule */}
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black uppercase text-slate-400">Reschedule:</span>
                                <input
                                  type="date"
                                  onChange={async (e) => {
                                    const nextD = e.target.value;
                                    if (!nextD) return;
                                    await api.updateTask(t.id, { dueDate: nextD });
                                    await fetchAllTasks();
                                  }}
                                  className="text-[10px] font-semibold border border-slate-200 bg-slate-50 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer min-h-[24px]"
                                />
                              </div>

                              <button
                                onClick={() => handleToggleTask(t)}
                                className="flex items-center justify-center p-2 rounded-lg bg-indigo-605 bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer transition shrink-0 h-[32px] w-[32px]"
                                title="Mark Completed"
                              >
                                <CheckSquare className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 py-8 text-center italic">No tasks due today. Keep tracking!</p>
                    )}
                  </div>
                </div>

                {/* Column 3: Upcoming Touchpoints */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-600 font-black text-xs font-mono">
                      {upcoming.length}
                    </span>
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600">Upcoming Schedule</h3>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {upcoming.length > 0 ? (
                      upcoming.map(t => {
                        const lead = leads.find(l => l.id === t.leadId);
                        return (
                          <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-350 transition">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Future event: {t.dueDate}</span>
                              <h4 className="font-extrabold text-sm text-slate-800 leading-snug">{t.title}</h4>
                              {lead && (
                                <button
                                  onClick={() => handleLeadClick(lead)}
                                  className="text-[11px] font-semibold text-indigo-650 inline-flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                  <Building className="h-3 w-3 text-slate-400" /> {lead.company} ({lead.name})
                                </button>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5">
                              {/* inline reschedule */}
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black uppercase text-slate-400">Update Date:</span>
                                <input
                                  type="date"
                                  onChange={async (e) => {
                                    const nextD = e.target.value;
                                    if (!nextD) return;
                                    await api.updateTask(t.id, { dueDate: nextD });
                                    await fetchAllTasks();
                                  }}
                                  className="text-[10px] font-semibold border border-slate-200 bg-slate-50 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer min-h-[24px]"
                                />
                              </div>

                              <button
                                onClick={() => handleToggleTask(t)}
                                className="flex items-center justify-center p-2 rounded-lg bg-indigo-650 text-white hover:bg-indigo-700 cursor-pointer transition shrink-0 h-[32px] w-[32px]"
                                title="Mark Completed"
                              >
                                <CheckSquare className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 py-8 text-center italic">No upcoming follow-up tasks registered.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Create / Edit Form routing */}
        {user && (route === "ADD" || route === "EDIT") && (
          <LeadFormView
            user={user}
            editingLead={route === "EDIT" ? selectedLead : null}
            defaultOwnerEmail={defaultOwnerEmail}
            onSaved={handleSaved}
            onCancel={() => {
              setSelectedLead(null);
              setDefaultOwnerEmail("");
              setRoute("LIST");
            }}
          />
        )}

        {/* Admin Console Option A & Option B Routing */}
        {user && route === "ADMIN_CONSOLE" && (
          <AdminConsoleView
            user={user}
            onLeadAdded={async () => {
              await fetchLeads();
              setRoute("LIST");
            }}
            onUsersUpdated={fetchUsersList}
          />
        )}

        {/* Detail Visualizer routing */}
        {user && route === "DETAILS" && selectedLead && (
          <LeadDetailsView
            lead={selectedLead}
            user={user}
            onEdit={handleEditClick}
            onDelete={handleDeleteLead}
            onBack={async () => {
              setSelectedLead(null);
              setRoute("LIST");
              await fetchAllTasks();
              await fetchAllReminders();
            }}
            onTasksUpdated={async () => {
              await fetchAllTasks();
              await fetchAllReminders();
            }}
          />
        )}

        {/* AI Sales Copilot Assistant routing */}
        {user && route === "AI_COPILOT" && (
          <AICopilotView
            leads={leads}
            allTasks={allTasks}
            onSelectLead={(id) => {
              const matched = leads.find(l => l.id === id);
              if (matched) {
                setSelectedLead(matched);
                setRoute("DETAILS");
              }
            }}
            onUpdateTaskStatus={async (taskId, currentStatus) => {
              const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
              try {
                setAllTasks((prev) =>
                  prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
                );
                await api.updateTask(taskId, { status: nextStatus });
                fetchAllTasks();
              } catch (err) {
                console.error("Failed to update task inside copilot helper", err);
              }
            }}
          />
        )}

        {user && route === "WORKSHOPS" && (
          <WorkshopsTabPanel
            appUsers={appUsers}
            currentUserEmail={user.email}
          />
        )}


      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-[10px] sm:text-xs text-slate-400 font-semibold font-mono">
        Sales Companion CRM &bull; Multi-Admin Storage System &bull; Touch & Mobile Adaptive UI
      </footer>
    </div>
  );
}
