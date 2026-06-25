import { LoggedInUser, Lead, UserOption, LeadStatus, WebhookLog, VoiceNote, Task, Reminder, LeadActivity, LeadDocument, CommunicationLog, ChatSession, PoAssuredBusiness, WorkshopRecord } from "../types";

const TOKEN_KEY = "sales_companion_crm_token";
const USER_KEY = "sales_companion_crm_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): LoggedInUser | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  async login(emailStr: string, passwordStr: string): Promise<{ token: string; user: LoggedInUser }> {
    const data = await request<{ token: string; user: LoggedInUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: emailStr, password: passwordStr }),
    });

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },

  async register(
    emailStr: string,
    passwordStr: string,
    nameStr: string,
    roleStr?: "ADMIN" | "USER"
  ): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: emailStr, password: passwordStr, name: nameStr, role: roleStr || "USER" }),
    });
  },

  async getConfig(): Promise<{ useSupabase: boolean; supabaseUrl: string | null; sqlSchema: string }> {
    return request<{ useSupabase: boolean; supabaseUrl: string | null; sqlSchema: string }>("/api/config");
  },

  async me(): Promise<{ user: LoggedInUser }> {
    return request<{ user: LoggedInUser }>("/api/auth/me", {
      method: "GET",
    });
  },

  async logout(): Promise<void> {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Server-side logout failed, clearing local session", e);
    } finally {
      clearSession();
    }
  },

  async getUsers(): Promise<UserOption[]> {
    const data = await request<{ users: UserOption[] }>("/api/auth/users");
    return data.users;
  },

  async getLeads(): Promise<Lead[]> {
    const data = await request<{ leads: Lead[] }>("/api/leads");
    return data.leads;
  },

  async getLead(id: string): Promise<Lead> {
    const data = await request<{ lead: Lead }>(`/api/leads/${id}`);
    return data.lead;
  },

  async createLead(leadData: Partial<Lead>): Promise<Lead> {
    const data = await request<{ success: boolean; lead: Lead }>("/api/leads", {
      method: "POST",
      body: JSON.stringify(leadData),
    });
    return data.lead;
  },

  async updateLead(id: string, leadData: Partial<Lead>): Promise<Lead> {
    const data = await request<{ success: boolean; lead: Lead }>(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(leadData),
    });
    return data.lead;
  },

  async deleteLead(id: string): Promise<void> {
    await request(`/api/leads/${id}`, {
      method: "DELETE",
    });
  },

  async deleteUser(email: string): Promise<void> {
    await request(`/api/auth/users/${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
  },

  async getRevenueMetrics(): Promise<{ metrics: any[]; showToUsers: boolean }> {
    return request<{ metrics: any[]; showToUsers: boolean }>("/api/revenue-metrics");
  },

  async updateRevenueMetrics(metrics: any[], showToUsers: boolean): Promise<any> {
    return request<any>("/api/revenue-metrics", {
      method: "POST",
      body: JSON.stringify({ metrics, showToUsers }),
    });
  },

  async getPoAssured(): Promise<PoAssuredBusiness[]> {
    const data = await request<{ success: boolean; poAssured: PoAssuredBusiness[] }>("/api/po-assured");
    return data.poAssured;
  },

  async savePoAssured(item: Partial<PoAssuredBusiness>): Promise<PoAssuredBusiness> {
    const data = await request<{ success: boolean; poAssured: PoAssuredBusiness }>("/api/po-assured", {
      method: "POST",
      body: JSON.stringify(item)
    });
    return data.poAssured;
  },

  async deletePoAssured(id: string): Promise<void> {
    await request(`/api/po-assured/${id}`, {
      method: "DELETE"
    });
  },

  async uploadPoInvoice(fileName: string, fileData: string): Promise<{ success: boolean; fileUrl: string }> {
    return request<{ success: boolean; fileUrl: string }>("/api/po-assured/upload-invoice", {
      method: "POST",
      body: JSON.stringify({ fileName, fileData })
    });
  },

  async getWorkshops(): Promise<WorkshopRecord[]> {
    const data = await request<{ success: boolean; workshops: WorkshopRecord[] }>("/api/workshops");
    return data.workshops;
  },

  async saveWorkshop(item: Partial<WorkshopRecord>): Promise<WorkshopRecord> {
    const data = await request<{ success: boolean; workshop: WorkshopRecord }>("/api/workshops", {
      method: "POST",
      body: JSON.stringify(item)
    });
    return data.workshop;
  },

  async deleteWorkshop(id: string): Promise<void> {
    await request(`/api/workshops/${id}`, {
      method: "DELETE"
    });
  },

  async getWebhookLogs(): Promise<WebhookLog[]> {
    const data = await request<{ logs: WebhookLog[] }>("/api/webhook-logs");
    return data.logs;
  },

  async getVoiceNotes(leadId: string): Promise<VoiceNote[]> {
    const data = await request<{ voiceNotes: VoiceNote[] }>(`/api/leads/${leadId}/voice-notes`);
    return data.voiceNotes;
  },

  async createVoiceNote(leadId: string, audioUrl: string): Promise<VoiceNote> {
    const data = await request<{ success: boolean; voiceNote: VoiceNote }>(`/api/leads/${leadId}/voice-notes`, {
      method: "POST",
      body: JSON.stringify({ audioUrl }),
    });
    return data.voiceNote;
  },

  async deleteVoiceNote(id: string): Promise<void> {
    await request(`/api/voice-notes/${id}`, {
      method: "DELETE",
    });
  },

  async getTasks(leadId: string): Promise<Task[]> {
    const data = await request<{ tasks: Task[] }>(`/api/leads/${leadId}/tasks`);
    return data.tasks;
  },

  async getAllTasks(): Promise<Task[]> {
    const data = await request<{ tasks: Task[] }>("/api/tasks");
    return data.tasks;
  },

  async createTask(leadId: string, title: string, dueDate?: string): Promise<Task> {
    const data = await request<{ success: boolean; task: Task }>(`/api/leads/${leadId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, dueDate }),
    });
    return data.task;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const data = await request<{ success: boolean; task: Task }>(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return data.task;
  },

  async deleteTask(id: string): Promise<void> {
    await request(`/api/tasks/${id}`, {
      method: "DELETE",
    });
  },

  async getReminders(leadId: string): Promise<Reminder[]> {
    const data = await request<{ reminders: Reminder[] }>(`/api/leads/${leadId}/reminders`);
    return data.reminders;
  },

  async getAllReminders(): Promise<Reminder[]> {
    const data = await request<{ reminders: Reminder[] }>("/api/reminders");
    return data.reminders;
  },

  async createReminder(leadId: string, title: string, reminderDate: string, timing?: "1 day before" | "On due date"): Promise<Reminder> {
    const data = await request<{ success: boolean; reminder: Reminder }>(`/api/leads/${leadId}/reminders`, {
      method: "POST",
      body: JSON.stringify({ title, reminderDate, timing }),
    });
    return data.reminder;
  },

  async updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder> {
    const data = await request<{ success: boolean; reminder: Reminder }>(`/api/reminders/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return data.reminder;
  },

  async deleteReminder(id: string): Promise<void> {
    await request(`/api/reminders/${id}`, {
      method: "DELETE",
    });
  },

  async getActivities(leadId: string): Promise<LeadActivity[]> {
    const data = await request<{ activities: LeadActivity[] }>(`/api/leads/${leadId}/activities`);
    return data.activities;
  },

  // Document Management APIs
  async getDocuments(leadId: string): Promise<LeadDocument[]> {
    const data = await request<{ documents: LeadDocument[] }>(`/api/leads/${leadId}/documents`);
    return data.documents;
  },

  async uploadDocument(leadId: string, name: string, category: string, fileData: string, fileSize: string): Promise<LeadDocument> {
    const data = await request<{ success: boolean; document: LeadDocument }>(`/api/leads/${leadId}/documents`, {
      method: "POST",
      body: JSON.stringify({ name, category, fileData, fileSize }),
    });
    return data.document;
  },

  async deleteDocument(id: string): Promise<void> {
    await request(`/api/documents/${id}`, {
      method: "DELETE",
    });
  },

  // Communication History APIs
  async getCommunications(leadId: string): Promise<CommunicationLog[]> {
    const data = await request<{ communications: CommunicationLog[] }>(`/api/leads/${leadId}/communications`);
    return data.communications;
  },

  async createCommunication(leadId: string, type: string, details: string, outcome?: string): Promise<CommunicationLog> {
    const data = await request<{ success: boolean; communication: CommunicationLog }>(`/api/leads/${leadId}/communications`, {
      method: "POST",
      body: JSON.stringify({ type, details, outcome }),
    });
    return data.communication;
  },

  async copilotChat(message: string, history: Array<{ role: "user" | "model"; text: string }>, activeLeadId?: string): Promise<{
    answer: string;
    suggestedPrompts: string[];
    matchingLeadIds?: string[];
    matchingTaskIds?: string[];
    actionDraft?: {
      type: "Email" | "WhatsApp" | "MeetingPrep" | "ProposalSummary";
      subject?: string;
      body: string;
    };
  }> {
    return request("/api/copilot/chat", {
      method: "POST",
      body: JSON.stringify({ message, history, activeLeadId })
    });
  },

  async getCopilotSessions(): Promise<ChatSession[]> {
    const data = await request<{ sessions: ChatSession[] }>("/api/copilot/sessions");
    return data.sessions;
  },

  async saveCopilotSessions(sessions: ChatSession[]): Promise<ChatSession[]> {
    const data = await request<{ sessions: ChatSession[] }>("/api/copilot/sessions", {
      method: "POST",
      body: JSON.stringify({ sessions })
    });
    return data.sessions;
  },

  async deleteCopilotSession(id: string): Promise<void> {
    await request(`/api/copilot/sessions/${id}`, {
      method: "DELETE"
    });
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; debugCode?: string }> {
    return request<{ success: boolean; message: string; debugCode?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  async resetPassword(email: string, newPassword: string, code: string): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, newPassword, code })
    });
  },
};
