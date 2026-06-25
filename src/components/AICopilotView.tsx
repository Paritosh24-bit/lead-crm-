import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Lead, Task } from "../types";
import { 
  Send, 
  Sparkles, 
  Bot, 
  User as UserIcon, 
  Copy, 
  Check, 
  Trash2, 
  Plus, 
  MessageSquare, 
  ChevronRight, 
  Building, 
  MapPin, 
  CircleAlert, 
  CheckCircle2, 
  Calendar,
  AlertCircle,
  FileText,
  Smartphone
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  suggestedPrompts?: string[];
  matchingLeads?: Lead[];
  matchingTasks?: Task[];
  actionDraft?: {
    type: "Email" | "WhatsApp" | "MeetingPrep" | "ProposalSummary";
    subject?: string;
    body: string;
  };
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  activeLeadId?: string;
}

interface AICopilotViewProps {
  leads: Lead[];
  allTasks: Task[];
  onSelectLead: (leadId: string) => void;
  onUpdateTaskStatus?: (taskId: string, currentStatus: "Pending" | "Completed") => Promise<void>;
}

const DEFAULT_SUGGESTED_QUESTIONS = [
  "Which leads need follow-up today?",
  "Show hot leads.",
  "Show customers with budget above ₹10 lakh.",
  "Show overdue tasks.",
  "Which leads have not been contacted recently?",
  "Which meetings happened this week?"
];

export default function AICopilotView({ 
  leads, 
  allTasks, 
  onSelectLead,
  onUpdateTaskStatus 
}: AICopilotViewProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [activeLeadId, setActiveLeadId] = useState<string>("");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat sessions from localStorage on init
  useEffect(() => {
    const stored = localStorage.getItem("crm_copilot_sessions");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatSession[];
        if (parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          if (parsed[0].activeLeadId) {
            setActiveLeadId(parsed[0].activeLeadId);
          }
          return;
        }
      } catch (err) {
        console.error("Failed to parse chat sessions", err);
      }
    }
    
    // Create an initial default empty session if none exist
    const initialSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: "New Sales Consulting Session",
      createdAt: new Date().toISOString(),
      messages: [],
      activeLeadId: ""
    };
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
  }, []);

  // Save chat sessions helper
  const saveSessions = (updated: ChatSession[]) => {
    setSessions(updated);
    localStorage.setItem("crm_copilot_sessions", JSON.stringify(updated));
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, loading]);

  const startNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: `Session ${sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      messages: [],
      activeLeadId: activeLeadId
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setActiveSessionId(newSession.id);
    setErrorMessage(null);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter(s => s.id !== id);
    if (remaining.length === 0) {
      const fallback: ChatSession = {
        id: `session-${Date.now()}`,
        title: "New Sales Consulting Session",
        createdAt: new Date().toISOString(),
        messages: [],
        activeLeadId: ""
      };
      saveSessions([fallback]);
      setActiveSessionId(fallback.id);
    } else {
      saveSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  const handleSendMessage = async (rawText: string) => {
    if (!rawText.trim() || !activeSession || loading) return;

    const userMessageText = rawText.trim();
    setInputValue("");
    setErrorMessage(null);

    // 1. Append user message locally
    const newUserMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      text: userMessageText
    };

    const sessionMessages = [...activeSession.messages, newUserMsg];
    let updatedTitle = activeSession.title;
    if (activeSession.messages.length === 0) {
      // Auto name based on first query
      updatedTitle = userMessageText.substring(0, 32) + (userMessageText.length > 32 ? "..." : "");
    }

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          title: updatedTitle,
          messages: sessionMessages,
          activeLeadId: activeLeadId
        };
      }
      return s;
    });
    saveSessions(updatedSessions);
    setLoading(true);

    try {
      // 2. Call backend Copilot service
      // Map previous messages to system history format { role: "user" | "model", text: string }
      const backendHistory = sessionMessages.slice(0, -1).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await api.copilotChat(userMessageText, backendHistory, activeLeadId || undefined);

      // 3. Match lead/task objects from returned IDs
      let matchedLeads: Lead[] = [];
      if (res.matchingLeadIds && res.matchingLeadIds.length > 0) {
        matchedLeads = leads.filter(l => res.matchingLeadIds?.includes(l.id));
      }

      let matchedTasks: Task[] = [];
      if (res.matchingTaskIds && res.matchingTaskIds.length > 0) {
        matchedTasks = allTasks.filter(t => res.matchingTaskIds?.includes(t.id));
      }

      // 4. Create AI result message
      const newBotMsg: ChatMessage = {
        id: `msg-bot-${Date.now()}`,
        role: "model",
        text: res.answer,
        suggestedPrompts: res.suggestedPrompts || [],
        matchingLeads: matchedLeads,
        matchingTasks: matchedTasks,
        actionDraft: res.actionDraft
      };

      const finalSessions = sessions.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            messages: [...sessionMessages, newBotMsg]
          };
        }
        return s;
      });
      saveSessions(finalSessions);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred while calling the copilot agent.");
      
      // Append fallback failure message
      const errorBotMsg: ChatMessage = {
        id: `msg-bot-err-${Date.now()}`,
        role: "model",
        text: `⚠️ **API Key is not configured or rate limited**.\n\nPlease define a valid **GEMINI_API_KEY** in **Settings > Secrets** to enable the AI sales copilot. For test simulation without key, here is how I will process the query:\n\n*Parsed query:* "${userMessageText}"\n*Targeted leads:* Matching on locations, budgets, requirements.`
      };
      const finalSessions = sessions.map(s => {
        if (s.id === activeSession.id) {
          return {
            ...s,
            messages: [...sessionMessages, errorBotMsg]
          };
        }
        return s;
      });
      saveSessions(finalSessions);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDraft = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2000);
  };

  const handleCopyAnswer = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  return (
    <div id="ai-copilot-panel" className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden min-h-[680px] grid grid-cols-1 md:grid-cols-4">
      {/* Sidebar - Sessions and Instructions */}
      <div className="bg-slate-50 border-r border-slate-200 p-4 flex flex-col justify-between h-full min-h-[640px] md:col-span-1">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              Copilot Sessions
            </h3>
            <button 
              onClick={startNewSession}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-indigo-600 transition cursor-pointer"
              title="New Session"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
            {sessions.map(s => {
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    if (s.activeLeadId) setActiveLeadId(s.activeLeadId);
                  }}
                  className={`group flex items-center justify-between p-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isActive 
                      ? "bg-slate-900 text-white" 
                      : "text-slate-600 hover:bg-slate-200/60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Sparkles className={`h-3 w-3 shrink-0 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500 hover:text-white transition cursor-pointer text-slate-450`}
                    title="Delete Session"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-250 mt-4">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
            <div className="flex gap-2 items-start text-[11px] text-indigo-950 font-medium">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold uppercase text-[9px] tracking-wider text-indigo-700 block mb-1">AI Sales Copilot</span>
                Let the assistant scan your leads database, followups, notes, and records to summarize client state or search immediately.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-col h-full md:col-span-3 min-h-[640px]">
        {/* Chat Header controls */}
        <div className="border-b border-slate-200 px-4 py-3 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                Sales Companion Assistant 
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Ready"></span>
              </h2>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                CRM Natural Language Intel Engine
              </p>
            </div>
          </div>

          {/* Active Lead Filter Context Selector Option */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-[10px] font-black text-slate-450 uppercase whitespace-nowrap">
              Focus Context:
            </label>
            <select
              value={activeLeadId}
              onChange={(e) => {
                const val = e.target.value;
                setActiveLeadId(val);
                // Update active session metadata
                if (activeSession) {
                  const updated = sessions.map(s => {
                    if (s.id === activeSession.id) {
                      return { ...s, activeLeadId: val };
                    }
                    return s;
                  });
                  saveSessions(updated);
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs font-semibold focus:outline-none focus:bg-white text-slate-850 w-full sm:max-w-[200px]"
            >
              <option value="">-- All Leads Database --</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>
                  🎯 {l.name} ({l.company})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 max-h-[480px] min-h-[380px]">
          {activeSession?.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 space-y-3">
              <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 animate-bounce">
                <Sparkles className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-black text-slate-800">
                Welcome to your sales companion, copilot assistant!
              </h4>
              <p className="text-xs text-slate-400 max-w-md">
                Ask simple natural language questions about your pipeline data. Try clicking any of the suggestions below to quickly see results!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full pt-4">
                {DEFAULT_SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="p-3 text-left bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold text-slate-700 transition shadow-2xs hover:shadow-xs text-slate-800 hover:text-indigo-950 cursor-pointer flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 duration-200" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeSession?.messages.map((m) => {
                const isBot = m.role === "model";
                return (
                  <div key={m.id} className={`flex gap-3 sm:gap-4 ${isBot ? "justify-start" : "justify-end"}`}>
                    {isBot && (
                      <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                        <Bot className="h-4.5 w-4.5" />
                      </div>
                    )}

                    <div className="max-w-[85%] min-w-0">
                      <div className={`p-4 rounded-2xl ${
                        isBot 
                          ? "bg-white border border-slate-200 shadow-3xs text-slate-900" 
                          : "bg-indigo-600 text-white shadow-3xs"
                      }`}>
                        {/* Conversation Header Action */}
                        {isBot && (
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                            <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1">
                              <Sparkles className="h-2.5 w-2.5" /> Copilot Solution
                            </span>
                            <button
                              onClick={() => handleCopyAnswer(m.id, m.text)}
                              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
                              title="Copy Answer to clipboard"
                            >
                              {copiedTextId === m.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}

                        <div className="text-xs md:text-[13px] leading-relaxed break-words font-medium prose prose-slate">
                          <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>

                        {/* RENDER INLINE ACTION COPY COPYWRITING DRAFT */}
                        {m.actionDraft && (
                          <div className="mt-4 border-t border-indigo-100 pt-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-pink-600 tracking-wider flex items-center gap-1">
                                {m.actionDraft.type === "WhatsApp" ? (
                                  <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5 text-indigo-500" />
                                )}
                                Action Draft: {m.actionDraft.type}
                              </span>
                              <button
                                onClick={() => handleCopyDraft(m.id, m.actionDraft?.body || "")}
                                className="flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:text-slate-900 duration-150 cursor-pointer"
                              >
                                {copiedDraftId === m.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-500" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" /> Copy Draft
                                  </>
                                )}
                              </button>
                            </div>
                            
                            {m.actionDraft.subject && (
                              <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-lg text-xs text-slate-950 font-black flex items-start gap-1">
                                <span className="text-slate-400 shrink-0 select-none uppercase font-extrabold text-[9px] mt-0.5">Subject:</span>
                                <span>{m.actionDraft.subject}</span>
                              </div>
                            )}

                            <div className="bg-slate-900 text-slate-100 font-mono text-[11px] p-3 rounded-lg leading-relaxed whitespace-pre-wrap select-all">
                              {m.actionDraft.body}
                            </div>
                          </div>
                        )}

                        {/* RENDER INLINE MATCHED LEADS LIST */}
                        {m.matchingLeads && m.matchingLeads.length > 0 && (
                          <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                              Matched CRM Leads ({m.matchingLeads.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {m.matchingLeads.map(lead => (
                                <div key={lead.id} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-col justify-between duration-150 group/card shadow-2xs">
                                  <div className="min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 truncate">
                                        {lead.industry || "General"}
                                      </span>
                                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                        lead.status === "WON" 
                                          ? "bg-emerald-100 text-emerald-800" 
                                          : lead.status === "LOST"
                                          ? "bg-rose-100 text-rose-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}>
                                        {lead.status}
                                      </span>
                                    </div>

                                    <h5 className="text-[13px] font-black text-slate-950 mt-1 truncate">
                                      {lead.name}
                                    </h5>
                                    
                                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-medium truncate">
                                      <Building className="h-3 w-3 shrink-0" />
                                      <span>{lead.company}</span>
                                    </div>

                                    {lead.location && (
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 truncate font-medium">
                                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                                        <span>{lead.location}</span>
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => onSelectLead(lead.id)}
                                    className="mt-3 w-full bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600 rounded-lg py-1 px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-center gap-1 duration-150 cursor-pointer"
                                  >
                                    View Lead Details <ChevronRight className="h-3 w-3 group-hover/card:translate-x-0.5 duration-150 shrink-0" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* RENDER INLINE MATCHED TASKS CHECKLISTS */}
                        {m.matchingTasks && m.matchingTasks.length > 0 && (
                          <div className="mt-4 border-t border-slate-100 pt-3.5 space-y-2">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                              CRM Actionable Tasks ({m.matchingTasks.length})
                            </h4>
                            <div className="space-y-1.5">
                              {m.matchingTasks.map(task => {
                                const isCompleted = task.status === "Completed";
                                return (
                                  <div key={task.id} className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between gap-3 shadow-3xs duration-150">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <button
                                        onClick={async () => {
                                          if (onUpdateTaskStatus) {
                                            await onUpdateTaskStatus(task.id, task.status);
                                            // trigger update inside local message state
                                            const updatedM = activeSession.messages.map(msg => {
                                              if (msg.id === m.id) {
                                                const uTasks = msg.matchingTasks?.map(t => {
                                                  if (t.id === task.id) {
                                                    return { ...t, status: isCompleted ? "Pending" as const : "Completed" as const };
                                                  }
                                                  return t;
                                                });
                                                return { ...msg, matchingTasks: uTasks };
                                              }
                                              return msg;
                                            });
                                            saveSessions(sessions.map(s => s.id === activeSessionId ? { ...s, messages: updatedM } : s));
                                          }
                                        }}
                                        className="h-4 w-4 rounded border border-slate-350 bg-white flex items-center justify-center hover:bg-slate-105 duration-100 text-indigo-600 cursor-pointer shrink-0"
                                      >
                                        {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                      </button>
                                      
                                      <div className="min-w-0">
                                        <p className={`text-[11.5px] font-black truncate leading-tight ${isCompleted ? "line-through text-slate-400" : "text-slate-900"}`}>
                                          {task.title}
                                        </p>
                                        <span className="text-[9px] font-medium text-slate-400 block flex items-center gap-0.5 truncate mt-0.5">
                                          <Calendar className="h-2.5 w-2.5 text-slate-350 shrink-0" /> Due: {task.dueDate}
                                        </span>
                                      </div>
                                    </div>

                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                      isCompleted 
                                        ? "bg-slate-200 text-slate-600" 
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}>
                                      {task.status}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Interactive suggested prompts row right below bot message */}
                      {isBot && m.suggestedPrompts && m.suggestedPrompts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 justify-start max-w-full">
                          {m.suggestedPrompts.map((pText, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => handleSendMessage(pText)}
                              className="bg-white hover:bg-indigo-50 hover:text-indigo-900 border border-slate-200 hover:border-indigo-250 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full transition cursor-pointer text-slate-600 shadow-3xs"
                            >
                              💡 {pText}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!isBot && (
                      <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs">
                        <UserIcon className="h-4.5 w-4.5" />
                      </div>
                    )}
                  </div>
                );
              })}
              
              {loading && (
                <div className="flex gap-3 justify-start items-center">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                    <Sparkles className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-100"></span>
                    <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-200"></span>
                    <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-300"></span>
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Copilot scanning records...</span>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2 max-w-xl">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-black uppercase tracking-wider text-[10px] text-red-700">Copilot Execution Error</strong>
                    <p className="mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Action input panel */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }} 
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(inputValue);
                  }
                }}
                disabled={loading}
                placeholder={
                  activeLeadId 
                    ? `Ask anything about Lead context (e.g. "Summarize this customer", "Draft email follow up")` 
                    : "Ask AI Copilot: (e.g. 'Show hot leads with ₹10L budget', 'manufacturing leads' ...)"
                }
                className="w-full bg-slate-50 border border-slate-205 rounded-xl py-2 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium placeholder-slate-400 max-h-[120px] resize-none"
                style={{ height: "42px" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white p-3 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 min-h-[42px] min-w-[42px] shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold mt-2.5">
            <span>💡 Press Enter to send, Shift + Enter for new line.</span>
            <span>Gemini LLM Supercharged</span>
          </div>
        </div>
      </div>
    </div>
  );
}
