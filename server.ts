import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";

interface User {
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  passwordHash: string;
  addedBy?: string;
}

interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  location: string;
  industry: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";
  notes: string;
  owner: string; // Email of owner, or "unassigned"
  createdAt: string;
  businessUnit?: string;
  temperature?: "HOT" | "WARM" | "COLD";
  createdBy?: string;
}

interface VoiceNote {
  id: string;
  leadId: string;
  audioUrl: string;
  transcript?: string;
  summary?: string;
  requirements?: string;
  budget?: string;
  productsDiscussed?: string;
  followUpDate?: string;
  actionItems?: string;
  priority?: string;
  keyTakeaways?: string;
  createdAt: string;
  createdBy: string;
}

interface Task {
  id: string;
  leadId: string;
  title: string;
  status: "Pending" | "Completed";
  dueDate: string;
  createdAt: string;
}

interface Reminder {
  id: string;
  leadId: string;
  title: string;
  reminderDate: string;
  timing: "1 day before" | "On due date";
  status: "Pending" | "Sent";
  createdAt: string;
}

interface LeadActivity {
  id: string;
  leadId: string;
  activityType: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

interface LeadDocument {
  id: string;
  leadId: string;
  name: string;
  category: "Quotation" | "Purchase Order" | "Contract" | "Product Catalogue" | "Invoice" | "Other Attachment";
  fileUrl: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface CommunicationLog {
  id: string;
  leadId: string;
  type: "Call" | "Meeting" | "Note" | "Email" | "WhatsApp";
  details: string;
  outcome?: string;
  loggedAt: string;
  loggedBy: string;
}

interface PoAssuredBusiness {
  id: string;
  category: string;
  monthlyAmount: number;
  durationMonths: number;
  totalPoValue: number;
  clientName: string;
  status: string; // e.g. 'Approved', 'Pending', 'Rejected'
  invoiceUrl?: string;
  createdAt: string;
}

interface WorkshopRecord {
  id: string;
  type: "OPEN" | "CORPORATE";
  title?: string;
  ownerName?: string;
  price?: number;
  clientName?: string;
  location?: string;
  eventDate?: string;
  invoiceUrl?: string;
  additionalDetails?: string;
  createdAt: string;
}


const DB_FILE = path.join(process.cwd(), "db.json");

// Active secure reset codes store
const RESET_CODES: { [email: string]: { code: string; expiresAt: number } } = {};


// Default local initial state
const DEFAULT_USERS: User[] = [
  {
    email: "admin@company.com",
    name: "System Admin",
    role: "ADMIN",
    passwordHash: "123456"
  }
];

const DEFAULT_REVENUE_METRICS = [
  { category: "Digital Marketing", projectedRevenue: 1500000, tillDateRevenue: 1000000, finalRevenue: 0 },
  { category: "AI", projectedRevenue: 2000000, tillDateRevenue: 1200000, finalRevenue: 0 },
  { category: "Workshops", projectedRevenue: 500000, tillDateRevenue: 250000, finalRevenue: 0 },
  { category: "Websites", projectedRevenue: 800000, tillDateRevenue: 400000, finalRevenue: 0 },
  { category: "Books", projectedRevenue: 200000, tillDateRevenue: 100000, finalRevenue: 0 }
];

const DEFAULT_LEADS: Lead[] = [];

// --- FALLBACK LOCAL JSON DATABASE HELPERS ---
function readDatabase(): { 
  users: User[]; 
  leads: Lead[]; 
  voiceNotes: VoiceNote[]; 
  tasks: Task[];
  reminders: Reminder[];
  activities: LeadActivity[];
  documents?: LeadDocument[];
  communications?: CommunicationLog[];
  revenueMetrics?: any[];
  showRevenueToUsers?: boolean;
  poAssuredBusinesses?: PoAssuredBusiness[];
  workshops?: WorkshopRecord[];
} {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const data = { 
        users: DEFAULT_USERS, 
        leads: DEFAULT_LEADS, 
        voiceNotes: [], 
        tasks: [],
        reminders: [],
        activities: [],
        documents: [],
        communications: [],
        revenueMetrics: DEFAULT_REVENUE_METRICS,
        showRevenueToUsers: false,
        poAssuredBusinesses: [],
        workshops: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      return data;
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    
    if (!parsed.revenueMetrics) {
      parsed.revenueMetrics = DEFAULT_REVENUE_METRICS;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    }
    if (parsed.showRevenueToUsers === undefined) {
      parsed.showRevenueToUsers = false;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    }
    if (!parsed.poAssuredBusinesses) {
      parsed.poAssuredBusinesses = [];
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    }
    if (!parsed.workshops) {
      parsed.workshops = [];
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    }

    if (!parsed.users || !parsed.users.some((u: any) => u.email.toLowerCase() === "admin@company.com")) {
      if (!parsed.users) {
        parsed.users = DEFAULT_USERS;
      } else {
        parsed.users.push({
          email: "admin@company.com",
          name: "System Admin",
          role: "ADMIN",
          passwordHash: "123456"
        });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    } else {
      const adminUser = parsed.users.find((u: any) => u.email.toLowerCase() === "admin@company.com");
      if (adminUser && adminUser.passwordHash === "admin") {
        adminUser.passwordHash = "123456";
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
      }
    }
    if (!parsed.voiceNotes) {
      parsed.voiceNotes = [];
    }
    if (!parsed.tasks) {
      parsed.tasks = [];
    }
    if (!parsed.reminders) {
      parsed.reminders = [];
    }
    if (!parsed.activities) {
      parsed.activities = [];
    }
    if (!parsed.documents) {
      parsed.documents = [];
    }
    if (!parsed.communications) {
      parsed.communications = [];
    }
    return parsed;
  } catch (err) {
    console.error("Local database read error. Reverting to default values.", err);
    return { 
      users: DEFAULT_USERS, 
      leads: DEFAULT_LEADS, 
      voiceNotes: [], 
      tasks: [],
      reminders: [],
      activities: []
    };
  }
}

function writeDatabase(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Local database write error", err);
  }
}

// --- GEMINI COGNITIVE TRANSCRIPTION ENGINE ---
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not defined in Settings > Secrets.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  if (!dataUrl || typeof dataUrl !== "string") {
    return { mimeType: "audio/webm", base64Data: "" };
  }
  if (!dataUrl.startsWith("data:")) {
    return { mimeType: "audio/webm", base64Data: dataUrl };
  }
  const parts = dataUrl.split(";base64,");
  if (parts.length < 2) {
    return { mimeType: "audio/webm", base64Data: dataUrl };
  }
  let mimeType = parts[0].substring(5); // skip "data:"
  if (mimeType.includes(";")) {
    mimeType = mimeType.split(";")[0].trim();
  }
  const base64Data = parts[1];
  return { mimeType, base64Data };
}

async function transcribeAudio(audioDataUrl: string): Promise<string> {
  const models = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
  const maxRetries = 3;
  let delay = 500;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const modelName = models[(attempt - 1) % models.length];
    try {
      const gemini = getGeminiClient();
      const { mimeType, base64Data } = parseDataUrl(audioDataUrl);
      if (!base64Data) {
        return "[Empty or malformed audio data]";
      }
      
      console.log(`Attempting audio transcription (attempt ${attempt}/${maxRetries}) using model: ${modelName}`);
      const response = await gemini.models.generateContent({
        model: modelName,
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            }
          },
          "Please listen to this audio recording and transcribe it into accurate English text. Provide ONLY the transcription text itself with no extra commentary, notes, prefixes, or conversational filler in your response. If the audio is silent or unreadable, write a description of it in brackets like '[silent]' or '[audio unreadable]'."
        ]
      });
      
      return response.text ? response.text.trim() : "[Empty transcript]";
    } catch (err: any) {
      console.warn(`Transcription attempt ${attempt} using ${modelName} failed:`, err.message || err);
      
      const isApiKeyError = err.message && err.message.includes("GEMINI_API_KEY");
      if (attempt === maxRetries || isApiKeyError) {
        console.error("Transcription service exception error:", err);
        return `[Transcription unavailable. Debug: ${err.message || err}]`;
      }
      
      // Exponential backoff wait with randomized jitter of up to 500ms
      const jitter = Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      delay *= 2;
    }
  }
  return "[Transcription failed]";
}

async function generateMeetingInsights(transcript: string): Promise<{
  summary: string;
  requirements: string;
  budget: string;
  productsDiscussed: string;
  followUpDate: string;
  actionItems: string;
  priority: string;
  keyTakeaways: string;
}> {
  const defaultInsights = {
    summary: "",
    requirements: "",
    budget: "",
    productsDiscussed: "",
    followUpDate: "",
    actionItems: "",
    priority: "Medium",
    keyTakeaways: ""
  };

  if (!transcript || transcript.startsWith("[silent]") || transcript.startsWith("[audio unreadable]") || transcript.startsWith("[Transcription unavailable")) {
    return defaultInsights;
  }

  const nowObj = new Date();
  const todayStrVal = nowObj.toISOString().substring(0, 10);
  const weekdayVal = nowObj.toLocaleDateString("en-US", { weekday: "long" });
  const longDateVal = nowObj.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dateDescriptorVal = `${weekdayVal}, ${longDateVal}`;

  const models = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
  const maxRetries = 3;
  let delay = 500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const modelName = models[(attempt - 1) % models.length];
    try {
      const gemini = getGeminiClient();
      console.log(`Attempting meeting insights generation (attempt ${attempt}/${maxRetries}) using model: ${modelName}`);
      const response = await gemini.models.generateContent({
        model: modelName,
        contents: [
          `You are an expert CRM assistant. Analyze the following call/meeting transcript and extract structured insights.

CRITICAL DATE CALCULATION INSTRUCTIONS:
Today's current date is ${dateDescriptorVal} (${todayStrVal}).
If you extract a follow-up date, callback date, promised timeline, or appointment, relative-calculate the exact calendar date based on today's date of ${dateDescriptorVal} (${todayStrVal}).
Output the calculated follow-up date strictly as a YYYY-MM-DD formatted string (e.g., today is "${todayStrVal}", relative terms like "tomorrow", "next Tuesday", "next Thursday", or "next week" must be correctly relative-calculated from today's date ${dateDescriptorVal}).
If no specific follow-up timeline is mentioned, return an empty string "".

If the transcript contains extra valuable business intelligence, instructions, or points of interest that do not match the predefined heads (budget, customer requirements, products discussed, follow-up timeline, or action items), extract those points cleanly and place them in 'keyTakeaways'.
Transcript to analyze:
"${transcript}"`
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "A highly concise summary of the conversation." },
              requirements: { type: Type.STRING, description: "Customer requirements or features requested." },
              budget: { type: Type.STRING, description: "Budget mentioned or indicated." },
              productsDiscussed: { type: Type.STRING, description: "Underlying products or components discussed." },
              followUpDate: { type: Type.STRING, description: `The calculated follow-up date strictly in YYYY-MM-DD format (based on today being ${todayStrVal}) or empty string if unspecified.` },
              actionItems: { type: Type.STRING, description: "Clear list of tasks or action items derived from the call." },
              priority: { type: Type.STRING, description: "Urgency/Priority rating (e.g. Low, Medium, High)." },
              keyTakeaways: { type: Type.STRING, description: "Extra interesting details, observations, or feedback extracted that does not fit into other headings, e.g. details about competitors, emotional state, or unrelated preferences." }
            },
            required: ["summary", "requirements", "budget", "productsDiscussed", "followUpDate", "actionItems", "priority", "keyTakeaways"]
          }
        }
      });

  const text = response.text ? response.text.trim() : "";
      if (text) {
        const parsed = JSON.parse(text);
        return {
          summary: parsed.summary || "",
          requirements: parsed.requirements || "",
          budget: parsed.budget || "",
          productsDiscussed: parsed.productsDiscussed || "",
          followUpDate: parsed.followUpDate || "",
          actionItems: parsed.actionItems || "",
          priority: parsed.priority || "Medium",
          keyTakeaways: parsed.keyTakeaways || ""
        };
      }
    } catch (err: any) {
      console.warn(`Meeting insights generation attempt ${attempt} using ${modelName} failed:`, err.message || err);
      
      const isApiKeyError = err.message && err.message.includes("GEMINI_API_KEY");
      if (attempt === maxRetries || isApiKeyError) {
        console.error("Meeting insights failed:", err);
        return defaultInsights;
      } else {
        // Exponential backoff wait with randomized jitter of up to 500ms
        const jitter = Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        delay *= 2;
      }
    }
  }

  return defaultInsights;
}

// Token simulation store (in-memory is sufficient for active sessions)
const SESSIONS: Record<string, { email: string; name: string; role: "ADMIN" | "USER" }> = {};

// --- SUPABASE CLIENT INITIALIZATION ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

let supabase: any = null;
let useSupabase = false;

const activeKey = serviceRoleKey.trim() !== "" ? serviceRoleKey : supabaseAnonKey;

if (supabaseUrl && activeKey && supabaseUrl.trim() !== "" && activeKey.trim() !== "") {
  try {
    supabase = createClient(supabaseUrl, activeKey);
    useSupabase = true;
    console.log("---------------------------------------------------------------");
    if (serviceRoleKey.trim() !== "") {
      console.log(`Supabase integrated live with CRM using Service Role Key (RLS Bypassed)!`);
    } else {
      console.log(`Supabase integrated live with CRM using Anonymous/Public Key!`);
    }
    console.log(`Connection URL: ${supabaseUrl}`);
    console.log("---------------------------------------------------------------");
  } catch (err) {
    console.error("Failed to construct Supabase client:", err);
  }
} else {
  console.log("---------------------------------------------------------------");
  console.log("No Supabase URL/Key detected. Operating with simulated JSON fallback.");
  console.log("To connect, define SUPABASE_URL and SUPABASE_ANON_KEY variables.");
  console.log("---------------------------------------------------------------");
}

// --- DB-AGNOSTIC CRUD INTERFACE LAYER ---

async function getRevenueMetricsFromDb(): Promise<{ metrics: any[]; showToUsers: boolean }> {
  let metrics = DEFAULT_REVENUE_METRICS;
  let showToUsers = false;

  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_revenue_metrics").select("*");
      if (error) {
        if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.code === "42P01")) {
          console.log("Infra notification (Silent Fallback): 'crm_revenue_metrics' table not ready in Supabase. Engaging local db.json fallback.");
        } else {
          console.log("Infra notification (Silent Fallback): Could not read 'crm_revenue_metrics' table.", error.message);
        }
      } else {
        if (data && data.length > 0) {
          metrics = data.map((r: any) => ({
            category: r.category,
            projectedRevenue: Number(r.projected_revenue) || 0,
            tillDateRevenue: Number(r.till_date_revenue) || 0,
            finalRevenue: Number(r.final_revenue) || 0
          }));
        } else {
          console.log("Seeding crm_revenue_metrics table with default values in Supabase.");
          try {
            for (const m of DEFAULT_REVENUE_METRICS) {
              await supabase.from("crm_revenue_metrics").insert({
                category: m.category,
                projected_revenue: Number(m.projectedRevenue) || 0,
                till_date_revenue: Number(m.tillDateRevenue) || 0,
                final_revenue: Number(m.finalRevenue) || 0
              });
            }
          } catch (seedErr: any) {
            console.log("Failed to seed default metrics in Supabase:", seedErr.message);
          }
          metrics = DEFAULT_REVENUE_METRICS;
        }

        const { data: settingsData, error: settingsError } = await supabase
          .from("crm_revenue_settings")
          .select("value")
          .eq("key", "show_revenue_to_users")
          .maybeSingle();
        
        if (!settingsError && settingsData) {
          showToUsers = !!settingsData.value;
        } else if (!settingsError && !settingsData) {
          try {
            await supabase.from("crm_revenue_settings").insert({
              key: "show_revenue_to_users",
              value: false
            });
          } catch (_) {}
        }
        return { metrics, showToUsers };
      }
    } catch (err: any) {
      console.log("Infra notification (Silent Fallback): Supabase load revenue metrics exception. engaging local db.json fallback.");
    }
  }

  const db = readDatabase();
  return {
    metrics: db.revenueMetrics || DEFAULT_REVENUE_METRICS,
    showToUsers: db.showRevenueToUsers !== undefined ? db.showRevenueToUsers : false
  };
}

async function saveRevenueMetricsToDb(metrics: any[], showToUsers: boolean): Promise<boolean> {
  let fallbackNeeded = false;

  if (useSupabase && supabase) {
    try {
      // Upsert each item in crm_revenue_metrics
      for (const m of metrics) {
        const { error } = await supabase
          .from("crm_revenue_metrics")
          .upsert({
            category: m.category,
            projected_revenue: Number(m.projectedRevenue) || 0,
            till_date_revenue: Number(m.tillDateRevenue) || 0,
            final_revenue: Number(m.finalRevenue) || 0
          }, { onConflict: "category" });
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.code === "42P01")) {
            console.log("Infra notification (Silent Fallback): 'crm_revenue_metrics' table not ready on Supabase. Saving to local db.json instead.");
            fallbackNeeded = true;
            break;
          } else {
            console.log(`Infra notification (Silent Fallback): Failed to save category ${m.category} to 'crm_revenue_metrics'.`, error.message);
            throw new Error(`Supabase DB Schema Mismatch: Column category or projected_revenue is missing in 'crm_revenue_metrics' table. Message: ${error.message}`);
          }
        }
      }

      if (!fallbackNeeded) {
        // Save showToUsers settings toggle inside crm_revenue_settings
        const { error: settingsError } = await supabase
          .from("crm_revenue_settings")
          .upsert({
            key: "show_revenue_to_users",
            value: showToUsers
          }, { onConflict: "key" });
        if (settingsError) {
          if (settingsError.message && (settingsError.message.includes("Could not find the table") || settingsError.message.includes("does not exist") || settingsError.code === "42P01")) {
            console.log("Infra notification (Silent Fallback): 'crm_revenue_settings' table not ready on Supabase. Saving toggle locally.");
            fallbackNeeded = true;
          } else {
            console.log("Infra notification (Silent Fallback): Failed to save show_revenue_to_users toggle in Supabase", settingsError.message);
            throw new Error(`Supabase DB Schema Mismatch: Table 'crm_revenue_settings' is missing key or value columns. Message: ${settingsError.message}`);
          }
        }
      }

      if (!fallbackNeeded) {
        try {
          const db = readDatabase();
          db.revenueMetrics = metrics;
          db.showRevenueToUsers = showToUsers;
          writeDatabase(db);
        } catch (_) {}
        return true;
      }
    } catch (err: any) {
      console.log("Infra notification (Silent Fallback): Supabase upsert revenue metrics exception, falling back to local db.json");
      if (err.message && err.message.includes("Supabase DB Schema")) {
        throw err;
      }
      fallbackNeeded = true;
    }
  }

  const db = readDatabase();
  db.revenueMetrics = metrics;
  db.showRevenueToUsers = showToUsers;
  writeDatabase(db);
  return true;
}

async function getAdmins(): Promise<User[]> {
  const localUsers = readDatabase().users || [];
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_admins").select("*");
      if (error) {
        console.warn("Could not read 'crm_admins' table (it may not exist). Falling back to local store.", error.message);
      } else if (data) {
        const dbUsers: User[] = data.map((u: any) => ({
          email: u.email,
          name: u.name,
          role: (u.role || "ADMIN") as "ADMIN" | "USER",
          passwordHash: u.password_hash,
          addedBy: u.added_by || u.addedBy || "system"
        }));

        // Return union of local and database users, prioritizing database records
        const merged = [...dbUsers];
        for (const lu of localUsers) {
          if (!merged.some(u => u.email.toLowerCase() === lu.email.toLowerCase())) {
            merged.push(lu);
          }
        }
        return merged;
      }
    } catch (err: any) {
      console.error("Supabase load admins exception:", err.message);
    }
  }
  return localUsers;
}

async function registerAdmin(user: User): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("crm_admins").insert([{
        email: user.email.toLowerCase(),
        name: user.name,
        password_hash: user.passwordHash,
        role: user.role,
        added_by: user.addedBy || "system"
      }]);
      if (error) {
        console.warn("Could not write to Supabase 'crm_admins'. Falling back to local.", error.message);
      }
    } catch (err: any) {
      console.error("Supabase insert admin exception:", err.message);
    }
  }

  // Always keep local storage synchronized as well
  const db = readDatabase();
  if (!db.users) db.users = [];
  const idx = db.users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (idx !== -1) {
    db.users[idx] = user;
  } else {
    db.users.push(user);
  }
  writeDatabase(db);
  return true;
}

async function deleteAdmin(email: string): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("crm_admins").delete().eq("email", email.toLowerCase());
      if (error) {
        console.warn("Could not delete from Supabase 'crm_admins', attempting local cleanup:", error.message);
      }
    } catch (err: any) {
      console.error("Supabase delete admin error during execution:", err.message);
    }
  }
  const db = readDatabase() as any;
  const index = db.users.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (index !== -1) {
    db.users.splice(index, 1);
    writeDatabase(db);
  }
  return true;
}

async function getLeads(): Promise<Lead[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_leads").select("*");
      if (error) {
        console.warn("Could not read Supabase 'crm_leads' table. Falling back to local store.", error.message);
      } else if (data) {
        return data.map((l: any) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          phone: l.phone || "",
          email: l.email || "",
          location: l.location || "",
          industry: l.industry || "",
          status: l.status || "NEW",
          notes: l.notes || "",
          owner: l.owner || "unassigned",
          createdAt: l.created_at || new Date().toISOString(),
          businessUnit: l.business_unit || "A consultancy",
          temperature: l.temperature || "WARM",
          createdBy: l.created_by || l.owner || "system"
        }));
      }
    } catch (err: any) {
      console.error("Supabase fetch leads exception:", err.message);
    }
  }
  return readDatabase().leads;
}

async function getLeadById(idStr: string): Promise<Lead | null> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_leads").select("*").eq("id", idStr).maybeSingle();
      if (error) {
        console.warn("Supabase fetch single lead failed, falling back", error.message);
      } else if (data) {
        return {
          id: data.id,
          name: data.name,
          company: data.company,
          phone: data.phone || "",
          email: data.email || "",
          location: data.location || "",
          industry: data.industry || "",
          status: data.status || "NEW",
          notes: data.notes || "",
          owner: data.owner || "unassigned",
          createdAt: data.created_at || new Date().toISOString(),
          businessUnit: data.business_unit || "A consultancy",
          temperature: data.temperature || "WARM",
          createdBy: data.created_by || data.owner || "system"
        };
      }
    } catch (err: any) {
      console.error("Supabase retrieve lead exception:", err.message);
    }
  }
  const db = readDatabase();
  return db.leads.find(l => l.id === idStr) || null;
}

async function createLead(lead: Lead): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      let row: any = {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        email: lead.email,
        location: lead.location,
        industry: lead.industry,
        status: lead.status,
        notes: lead.notes,
        owner: lead.owner,
        created_at: lead.createdAt,
        business_unit: lead.businessUnit || "A consultancy",
        temperature: lead.temperature || "WARM",
        created_by: lead.createdBy || "system"
      };

      let success = false;
      let lastErrorMsg = "";
      
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await supabase.from("crm_leads").insert([row]);
        if (!error) {
          success = true;
          break;
        }

        lastErrorMsg = error.message;
        console.warn(`Supabase insert attempt ${attempt + 1} failed: ${error.message}`);

        const errorMsg = error.message || "";
        const isMissingColumn = 
          errorMsg.includes("Could not find the") && errorMsg.includes("column of") ||
          errorMsg.includes("has no column named") ||
          error.code === "42703" ||
          errorMsg.includes("column") && errorMsg.includes("does not exist");

        if (isMissingColumn) {
          let match = errorMsg.match(/find the '([^']+)' column/);
          if (!match) match = errorMsg.match(/column "([^"]+)" of/);
          if (!match) match = errorMsg.match(/column "([^"]+)" does not exist/);
          if (!match) match = errorMsg.match(/column '([^']+)' does not exist/);
          if (!match) match = errorMsg.match(/has no column named "([^"]+)"/);
          if (!match) match = errorMsg.match(/column ([a-zA-Z0-9_]+) does not exist/);

          if (match && match[1]) {
            const missingCol = match[1];
            if (missingCol in row) {
              console.log(`Dynamic DB Alignment: Column '${missingCol}' does not exist on crm_leads. Pruning and retrying...`);
              delete row[missingCol];
              continue;
            }
          }

          const candidates = ["business_unit", "temperature", "created_by"];
          let prunedAny = false;
          for (const col of candidates) {
            if (col in row) {
              console.log(`Fallback Dynamic Pruning: Column '${col}' is pruned on crm_leads. Retrying...`);
              delete row[col];
              prunedAny = true;
              break;
            }
          }
          if (prunedAny) continue;
        }

        break;
      }

      if (success) {
        return true;
      } else {
        console.warn("Supabase insert lead failed after dynamic pruning, writing local fallback. Error:", lastErrorMsg);
      }
    } catch (err: any) {
      console.error("Supabase insert exception:", err.message);
    }
  }
  const db = readDatabase();
  db.leads.push(lead);
  writeDatabase(db);
  return true;
}

async function updateLead(idStr: string, lead: Partial<Lead>): Promise<Lead | null> {
  if (useSupabase && supabase) {
    try {
      const updateData: any = {};
      if (lead.name !== undefined) updateData.name = lead.name;
      if (lead.company !== undefined) updateData.company = lead.company;
      if (lead.phone !== undefined) updateData.phone = lead.phone;
      if (lead.email !== undefined) updateData.email = lead.email;
      if (lead.location !== undefined) updateData.location = lead.location;
      if (lead.industry !== undefined) updateData.industry = lead.industry;
      if (lead.status !== undefined) updateData.status = lead.status;
      if (lead.notes !== undefined) updateData.notes = lead.notes;
      if (lead.owner !== undefined) updateData.owner = lead.owner;
      if (lead.businessUnit !== undefined) updateData.business_unit = lead.businessUnit;
      if (lead.temperature !== undefined) updateData.temperature = lead.temperature;
      if (lead.createdBy !== undefined) updateData.created_by = lead.createdBy;

      let success = false;
      let returnedData: any = null;
      let lastErrorMsg = "";

      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase.from("crm_leads").update(updateData).eq("id", idStr).select().maybeSingle();
        if (!error) {
          success = true;
          returnedData = data;
          break;
        }

        lastErrorMsg = error.message;
        console.warn(`Supabase update attempt ${attempt + 1} failed: ${error.message}`);

        const errorMsg = error.message || "";
        const isMissingColumn = 
          errorMsg.includes("Could not find the") && errorMsg.includes("column of") ||
          errorMsg.includes("has no column named") ||
          error.code === "42703" ||
          errorMsg.includes("column") && errorMsg.includes("does not exist");

        if (isMissingColumn) {
          let match = errorMsg.match(/find the '([^']+)' column/);
          if (!match) match = errorMsg.match(/column "([^"]+)" of/);
          if (!match) match = errorMsg.match(/column "([^"]+)" does not exist/);
          if (!match) match = errorMsg.match(/column '([^']+)' does not exist/);
          if (!match) match = errorMsg.match(/has no column named "([^"]+)"/);
          if (!match) match = errorMsg.match(/column ([a-zA-Z0-9_]+) does not exist/);

          if (match && match[1]) {
            const missingCol = match[1];
            if (missingCol in updateData) {
              console.log(`Dynamic DB Alignment (Update): Column '${missingCol}' does not exist on crm_leads. Pruning and retrying...`);
              delete updateData[missingCol];
              continue;
            }
          }

          const candidates = ["business_unit", "temperature", "created_by"];
          let prunedAny = false;
          for (const col of candidates) {
            if (col in updateData) {
              console.log(`Fallback Dynamic Pruning (Update): Column '${col}' is pruned on crm_leads. Retrying...`);
              delete updateData[col];
              prunedAny = true;
              break;
            }
          }
          if (prunedAny) continue;
        }

        break;
      }

      if (success && returnedData) {
        return {
          id: returnedData.id,
          name: returnedData.name,
          company: returnedData.company,
          phone: returnedData.phone || "",
          email: returnedData.email || "",
          location: returnedData.location || "",
          industry: returnedData.industry || "",
          status: returnedData.status || "NEW",
          notes: returnedData.notes || "",
          owner: returnedData.owner || "unassigned",
          createdAt: returnedData.created_at || new Date().toISOString(),
          businessUnit: returnedData.business_unit || "A consultancy",
          temperature: returnedData.temperature || "WARM",
          createdBy: returnedData.created_by || returnedData.owner || "system"
        };
      } else {
        console.warn("Supabase update lead failed after dynamic pruning, fallback to local file. Error:", lastErrorMsg);
      }
    } catch (err: any) {
      console.error("Supabase write-update exception:", err.message);
    }
  }

  // Local fallback
  const db = readDatabase();
  const index = db.leads.findIndex(l => l.id === idStr);
  if (index === -1) return null;
  const updated = { ...db.leads[index], ...lead };
  db.leads[index] = updated;
  writeDatabase(db);
  return updated;
}

async function deleteLead(idStr: string): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      // Manually cascade delete associated records to prevent foreign key or reference constraint violations
      await supabase.from("crm_voice_notes").delete().eq("lead_id", idStr);
      await supabase.from("crm_tasks").delete().eq("lead_id", idStr);
      await supabase.from("crm_reminders").delete().eq("lead_id", idStr);
      await supabase.from("crm_documents").delete().eq("lead_id", idStr);
      await supabase.from("crm_communications").delete().eq("lead_id", idStr);
      await supabase.from("crm_activities").delete().eq("lead_id", idStr);

      const { error } = await supabase.from("crm_leads").delete().eq("id", idStr);
      if (error) {
        console.warn("Supabase delete lead query failed, using local option fallback to resolve.", error.message);
      }
    } catch (err: any) {
      console.error("Supabase remove action exception:", err.message);
    }
  }

  // Always proceed with local storage synchronization so databases stay matching
  const db = readDatabase() as any;
  if (db.leads) {
    const index = db.leads.findIndex((l: any) => l.id === idStr);
    if (index !== -1) {
      db.leads.splice(index, 1);
    }
  }

  if (db.voiceNotes) db.voiceNotes = db.voiceNotes.filter((vn: any) => vn.leadId !== idStr);
  if (db.voice_notes) db.voice_notes = db.voice_notes.filter((vn: any) => vn.leadId !== idStr || vn.lead_id !== idStr);
  if (db.tasks) db.tasks = db.tasks.filter((t: any) => t.leadId !== idStr);
  if (db.reminders) db.reminders = db.reminders.filter((r: any) => r.leadId !== idStr);
  if (db.activities) db.activities = db.activities.filter((a: any) => a.leadId !== idStr);
  if (db.documents) db.documents = db.documents.filter((d: any) => d.leadId !== idStr);
  if (db.communications) db.communications = db.communications.filter((c: any) => c.leadId !== idStr);

  writeDatabase(db);
  return true;
}

async function getVoiceNotesByLead(leadId: string): Promise<VoiceNote[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_voice_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      if (error) {
        console.warn("Could not read 'crm_voice_notes' table from Supabase. Falling back to local store.", error.message);
      } else if (data) {
        const list = data.map((vn: any) => {
          let transcript = vn.transcript || "";
          let summary = vn.summary || "";
          let requirements = vn.requirements || "";
          let budget = vn.budget || "";
          let productsDiscussed = vn.products_discussed || "";
          let followUpDate = vn.follow_up_date || "";
          let actionItems = vn.action_items || "";
          let priority = vn.priority || "";
          let keyTakeaways = vn.key_takeaways || "";

          let displayTranscript = transcript;

          if (transcript.includes("--- Extracted Insights Falling Back ---")) {
            const parts = transcript.split("--- Extracted Insights Falling Back ---");
            displayTranscript = parts[0].trim();
            const fallbackSection = parts[1] || "";

            const lines = fallbackSection.split("\n");
            for (const line of lines) {
              const colonIndex = line.indexOf(":");
              if (colonIndex !== -1) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                
                if (key === "summary" && !summary) summary = value;
                else if (key === "requirements" && !requirements) requirements = value;
                else if (key === "budget" && !budget) budget = value;
                else if ((key === "products discussed" || key === "products_discussed") && !productsDiscussed) productsDiscussed = value;
                else if ((key === "follow up date" || key === "follow_up_date" || key === "follow-up date") && !followUpDate) followUpDate = value;
                else if ((key === "action items" || key === "action_items") && !actionItems) actionItems = value;
                else if (key === "priority" && !priority) priority = value;
                else if ((key === "key takeaways" || key === "key_takeaways") && !keyTakeaways) keyTakeaways = value;
              }
            }
          }

          return {
            id: vn.id,
            leadId: vn.lead_id,
            audioUrl: vn.audio_url,
            transcript: displayTranscript,
            summary: summary,
            requirements: requirements,
            budget: budget,
            productsDiscussed: productsDiscussed,
            followUpDate: followUpDate,
            actionItems: actionItems,
            priority: priority,
            keyTakeaways: keyTakeaways,
            createdAt: vn.created_at || new Date().toISOString(),
            createdBy: vn.created_by
          };
        });
        return list;
      }
    } catch (err: any) {
      console.error("Supabase load voice notes exception:", err.message);
    }
  }
  const db = readDatabase();
  const list = db.voiceNotes ? db.voiceNotes.filter(vn => vn.leadId === leadId) : [];
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

async function createVoiceNote(voiceNote: VoiceNote): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const payload: Record<string, any> = {
        id: voiceNote.id,
        lead_id: voiceNote.leadId,
        audio_url: voiceNote.audioUrl,
        transcript: voiceNote.transcript || "",
        summary: voiceNote.summary || "",
        requirements: voiceNote.requirements || "",
        budget: voiceNote.budget || "",
        products_discussed: voiceNote.productsDiscussed || "",
        follow_up_date: voiceNote.followUpDate || "",
        action_items: voiceNote.actionItems || "",
        key_takeaways: voiceNote.keyTakeaways || "",
        priority: voiceNote.priority || "",
        created_at: voiceNote.createdAt,
        created_by: voiceNote.createdBy
      };

      let success = false;
      let attempt = 0;
      const maxAttempts = 12;

      while (!success && attempt < maxAttempts) {
        attempt++;
        const { error } = await supabase.from("crm_voice_notes").insert([payload]);

        if (error) {
          let pruned = false;
          const msg = error.message;

          // Pattern 1: Could not find the 'column_name' column of 'table_name' in the schema cache
          let match = msg.match(/Could not find the\s+'([^']+)'\s+column/i);
          if (!match) {
            match = msg.match(/column\s+"([^"]+)"\s+does not exist/i);
          }
          if (match && match[1]) {
            const col = match[1];
            console.log(`Pruning column [${col}] because it is not present in Supabase crm_voice_notes schema cache.`);
            
            // Backup the value into the transcript so we don't lose the precious analyzed insights!
            const originalVal = payload[col];
            if (originalVal !== undefined && originalVal !== null && originalVal !== "") {
              const friendlyColName = col
                .split('_')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
              
              if (!payload.transcript.includes("--- Extracted Insights Falling Back ---")) {
                payload.transcript += "\n\n--- Extracted Insights Falling Back ---";
              }
              payload.transcript += `\n${friendlyColName}: ${originalVal}`;
            }

            delete payload[col];
            pruned = true;
          }

          if (!pruned) {
            // Non-schema error or unknown format, bubble option forward
            console.error("Non-recoverable database write: " + error.message);
            throw new Error(`Supabase write failed: ${error.message}`);
          }
        } else {
          success = true;
        }
      }

      if (success) {
        return true;
      }
    } catch (err: any) {
      console.error("Supabase insert voice note exception:", err.message);
      throw err;
    }
  }
  const db = readDatabase();
  if (!db.voiceNotes) {
    db.voiceNotes = [];
  }
  db.voiceNotes.push(voiceNote);
  writeDatabase(db);
  return true;
}

async function deleteVoiceNote(id: string): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("crm_voice_notes").delete().eq("id", id);
      if (error) {
        console.error("Supabase delete voice note failed:", error.message);
        throw new Error(`Supabase deletion failed: ${error.message}. Please verify if your user role has sufficient Row Level Security (RLS) policies for delete on 'crm_voice_notes'.`);
      } else {
        return true;
      }
    } catch (err: any) {
      console.error("Supabase delete voice note exception:", err.message);
      throw err;
    }
  }
  const db = readDatabase();
  if (!db.voiceNotes) {
    db.voiceNotes = [];
  }
  const index = db.voiceNotes.findIndex(vn => vn.id === id);
  if (index === -1) return false;
  db.voiceNotes.splice(index, 1);
  writeDatabase(db);
  return true;
}

// --- TASK DATABASE HELPER LAYER ---
async function extractTasksFromActionItems(actionItems: string, transcript: string): Promise<Array<{ title: string; dueDate: string }>> {
  const defaultTasks: Array<{ title: string; dueDate: string }> = [];
  if (!actionItems && !transcript) return defaultTasks;

  const nowObj = new Date();
  const todayStrVal = nowObj.toISOString().substring(0, 10);
  const weekdayVal = nowObj.toLocaleDateString("en-US", { weekday: "long" });
  const longDateVal = nowObj.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dateDescriptorVal = `${weekdayVal}, ${longDateVal}`;

  const models = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const modelName = models[(attempt - 1) % models.length];
    try {
      const gemini = getGeminiClient();
      console.log(`Attempting task extraction (attempt ${attempt}/${maxRetries}) using model: ${modelName}`);
      const response = await gemini.models.generateContent({
        model: modelName,
        contents: [
          `You are an expert CRM assistant. Analyze the action items or meeting transcript provided, and extract individual, discrete actionable tasks.
          
          CRITICAL DATE CALCULATION INSTRUCTIONS:
          Today's current date is ${dateDescriptorVal} (${todayStrVal}).
          For each extracted task, relative-calculate the exact calendar dueDate based on today's date of ${dateDescriptorVal} (${todayStrVal}).
          Output the dueDate strictly in YYYY-MM-DD format (e.g. today is "${todayStrVal}", relative days such as tomorrow, next Wednesday, next week must be mapped correctly from today's date).
          If no specific timeline, callback date, or due date is mentioned, use "Pending".

          For each task, separate:
          1. The action title (e.g., "Send quotation", "Call customer") - keep it concise and active. Do not include numbers, bullets, or dates in the title.
          2. The exact calculated YYYY-MM-DD due date or "Pending".

          Input Action Items:
          "${actionItems}"

          Input Transcript:
          "${transcript}"`
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "A concise actionable task title. e.g. 'Send quotation', 'Call customer'." },
                    dueDate: { type: Type.STRING, description: `Calculated task due date strictly in YYYY-MM-DD format based on today being ${todayStrVal}, or 'Pending' if unspecified.` }
                  },
                  required: ["title", "dueDate"]
                }
              }
            },
            required: ["tasks"]
          }
        }
      });

      const text = response.text ? response.text.trim() : "";
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.tasks)) {
          return parsed.tasks.map((t: any) => ({
            title: t.title || "",
            dueDate: t.dueDate || "Pending"
          })).filter((t: any) => t.title.trim().length > 0);
        }
      }
    } catch (err: any) {
      console.warn(`Task extraction attempt ${attempt} using ${modelName} failed:`, err.message || err);
      if (attempt === maxRetries) {
        return defaultTasks;
      }
    }
  }
  return defaultTasks;
}

async function getTasksByLead(leadId: string): Promise<Task[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_tasks").select("*").eq("lead_id", leadId).order("created_at", { ascending: true });
      if (error) {
        console.warn("Could not read 'crm_tasks' table from Supabase. Falling back to local store.", error.message);
      } else if (data) {
        return data.map((t: any) => ({
          id: t.id,
          leadId: t.lead_id,
          title: t.title,
          status: t.status as "Pending" | "Completed",
          dueDate: t.due_date || "",
          createdAt: t.created_at || new Date().toISOString()
        }));
      }
    } catch (err: any) {
      console.error("Supabase load tasks exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.tasks) db.tasks = [];
  return db.tasks.filter(t => t.leadId === leadId);
}

async function getAllTasks(): Promise<Task[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_tasks").select("*").order("created_at", { ascending: true });
      if (error) {
        console.warn("Could not read all 'crm_tasks' table from Supabase. Falling back to local store.", error.message);
      } else if (data) {
        return data.map((t: any) => ({
          id: t.id,
          leadId: t.lead_id,
          title: t.title,
          status: t.status as "Pending" | "Completed",
          dueDate: t.due_date || "",
          createdAt: t.created_at || new Date().toISOString()
        }));
      }
    } catch (err: any) {
      console.error("Supabase load all tasks exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.tasks) db.tasks = [];
  return db.tasks;
}

async function createTask(task: Task): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const payload = {
        id: task.id,
        lead_id: task.leadId,
        title: task.title,
        status: task.status,
        due_date: task.dueDate,
        created_at: task.createdAt
      };
      
      const { error } = await supabase.from("crm_tasks").insert([payload]);
      if (error) {
        console.warn("Could not write to Supabase 'crm_tasks'. Falling back to local.", error.message);
      } else {
        return true;
      }
    } catch (err: any) {
      console.error("Supabase insert task exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.tasks) db.tasks = [];
  db.tasks.push(task);
  writeDatabase(db);
  return true;
}

async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  if (useSupabase && supabase) {
    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
      
      const { data, error } = await supabase.from("crm_tasks").update(payload).eq("id", id).select().maybeSingle();
      if (error) {
        console.warn("Could not update Supabase 'crm_tasks'. Falling back to local.", error.message);
      } else if (data) {
        return {
          id: data.id,
          leadId: data.lead_id,
          title: data.title,
          status: data.status,
          dueDate: data.due_date || "",
          createdAt: data.created_at || new Date().toISOString()
        };
      }
    } catch (err: any) {
      console.error("Supabase update task exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.tasks) db.tasks = [];
  const index = db.tasks.findIndex(t => t.id === id);
  if (index === -1) return null;
  db.tasks[index] = { ...db.tasks[index], ...updates };
  writeDatabase(db);
  return db.tasks[index];
}

async function deleteTask(id: string): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("crm_tasks").delete().eq("id", id);
      if (error) {
        console.warn("Could not delete from Supabase 'crm_tasks'. Falling back to local.", error.message);
      } else {
        return true;
      }
    } catch (err: any) {
      console.error("Supabase delete task exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.tasks) db.tasks = [];
  const index = db.tasks.findIndex(t => t.id === id);
  if (index === -1) return false;
  db.tasks.splice(index, 1);
  writeDatabase(db);
  return true;
}

// --- REMINDERS HELPERS ---
async function getRemindersByLead(leadId: string): Promise<Reminder[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_reminders").select("*").eq("lead_id", leadId).order("created_at", { ascending: true });
      if (error) {
        console.warn("Could not read 'crm_reminders' from Supabase. Falling back to local.", error.message);
      } else if (data) {
        return data.map((r: any) => ({
          id: r.id,
          leadId: r.lead_id,
          title: r.title,
          reminderDate: r.reminder_date,
          timing: r.timing,
          status: r.status,
          createdAt: r.created_at || new Date().toISOString()
        }));
      }
    } catch (err: any) {
      console.error("Supabase load reminders exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.reminders) db.reminders = [];
  return db.reminders.filter(r => r.leadId === leadId);
}

async function getAllReminders(): Promise<Reminder[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_reminders").select("*").order("created_at", { ascending: true });
      if (error) {
        console.warn("Could not read all 'crm_reminders' from Supabase. Falling back to local.", error.message);
      } else if (data) {
        return data.map((r: any) => ({
          id: r.id,
          leadId: r.lead_id,
          title: r.title,
          reminderDate: r.reminder_date,
          timing: r.timing,
          status: r.status,
          createdAt: r.created_at || new Date().toISOString()
        }));
      }
    } catch (err: any) {
      console.error("Supabase load all reminders exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.reminders) db.reminders = [];
  return db.reminders;
}

async function createReminder(reminder: Reminder): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const payload = {
        id: reminder.id,
        lead_id: reminder.leadId,
        title: reminder.title,
        reminder_date: reminder.reminderDate,
        timing: reminder.timing,
        status: reminder.status,
        created_at: reminder.createdAt
      };
      const { error } = await supabase.from("crm_reminders").insert([payload]);
      if (error) {
        console.warn("Could not write to Supabase 'crm_reminders'. Falling back to local.", error.message);
      } else {
        return true;
      }
    } catch (err: any) {
      console.error("Supabase write reminder exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.reminders) db.reminders = [];
  db.reminders.push(reminder);
  writeDatabase(db);
  return true;
}

async function updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | null> {
  if (useSupabase && supabase) {
    try {
      const payload: any = {};
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.reminderDate !== undefined) payload.reminder_date = updates.reminderDate;
      const { data, error } = await supabase.from("crm_reminders").update(payload).eq("id", id).select().maybeSingle();
      if (error) {
        console.warn("Could not update Supabase 'crm_reminders'. Falling back to local.", error.message);
      } else if (data) {
        return {
          id: data.id,
          leadId: data.lead_id,
          title: data.title,
          reminderDate: data.reminder_date,
          timing: data.timing,
          status: data.status,
          createdAt: data.created_at || new Date().toISOString()
        };
      }
    } catch (err: any) {
      console.error("Supabase update reminder exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.reminders) db.reminders = [];
  const idx = db.reminders.findIndex(r => r.id === id);
  if (idx === -1) return null;
  db.reminders[idx] = { ...db.reminders[idx], ...updates };
  writeDatabase(db);
  return db.reminders[idx];
}

async function deleteReminder(id: string): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("crm_reminders").delete().eq("id", id);
      if (error) {
        console.warn("Could not delete from Supabase 'crm_reminders'. Falling back to local.", error.message);
      } else {
        return true;
      }
    } catch (err: any) {
      console.error("Supabase delete reminder exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.reminders) db.reminders = [];
  const idx = db.reminders.findIndex(r => r.id === id);
  if (idx === -1) return false;
  db.reminders.splice(idx, 1);
  writeDatabase(db);
  return true;
}

// --- DOCUMENT HELPERS ---
async function getDocsByLead(leadId: string): Promise<LeadDocument[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_documents").select("*").eq("lead_id", leadId).order("uploaded_at", { ascending: false });
      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          leadId: d.lead_id,
          name: d.name,
          category: d.category,
          fileUrl: d.file_url,
          fileSize: d.file_size,
          uploadedAt: d.uploaded_at,
          uploadedBy: d.uploaded_by
        }));
      }
    } catch (_) {}
  }
  const db = readDatabase();
  if (!db.documents) db.documents = [];
  return db.documents.filter(d => d.leadId === leadId).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

async function createDoc(doc: LeadDocument): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const payload = {
        id: doc.id,
        lead_id: doc.leadId,
        name: doc.name,
        category: doc.category,
        file_url: doc.fileUrl,
        file_size: doc.fileSize,
        uploaded_at: doc.uploadedAt,
        uploaded_by: doc.uploadedBy
      };
      const { error } = await supabase.from("crm_documents").insert([payload]);
      if (!error) return true;
    } catch (_) {}
  }
  const db = readDatabase();
  if (!db.documents) db.documents = [];
  db.documents.push(doc);
  writeDatabase(db);
  return true;
}

async function deleteDoc(id: string): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("crm_documents").delete().eq("id", id);
      if (!error) return true;
    } catch (_) {}
  }
  const db = readDatabase();
  if (!db.documents) db.documents = [];
  const idx = db.documents.findIndex(d => d.id === id);
  if (idx === -1) return false;
  db.documents.splice(idx, 1);
  writeDatabase(db);
  return true;
}

// --- COMMUNICATION HELPERS ---
async function getCommsByLead(leadId: string): Promise<CommunicationLog[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_communications").select("*").eq("lead_id", leadId).order("logged_at", { ascending: false });
      if (!error && data) {
        return data.map((c: any) => ({
          id: c.id,
          leadId: c.lead_id,
          type: c.type,
          details: c.details,
          outcome: c.outcome,
          loggedAt: c.logged_at,
          loggedBy: c.logged_by
        }));
      }
    } catch (_) {}
  }
  const db = readDatabase();
  if (!db.communications) db.communications = [];
  return db.communications.filter(c => c.leadId === leadId).sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
}

async function createComm(comm: CommunicationLog): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const payload = {
        id: comm.id,
        lead_id: comm.leadId,
        type: comm.type,
        details: comm.details,
        outcome: comm.outcome,
        logged_at: comm.loggedAt,
        logged_by: comm.loggedBy
      };
      const { error } = await supabase.from("crm_communications").insert([payload]);
      if (!error) return true;
    } catch (_) {}
  }
  const db = readDatabase();
  if (!db.communications) db.communications = [];
  db.communications.push(comm);
  writeDatabase(db);
  return true;
}

// --- ACTIVITIES HELPERS ---
async function getActivitiesByLead(leadId: string): Promise<LeadActivity[]> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("crm_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      if (error) {
        console.warn("Could not read 'crm_activities' from Supabase. Falling back to local.", error.message);
      } else if (data) {
        return data.map((a: any) => ({
          id: a.id,
          leadId: a.lead_id,
          activityType: a.activity_type,
          description: a.description,
          createdAt: a.created_at || new Date().toISOString(),
          createdBy: a.created_by
        }));
      }
    } catch (err: any) {
      console.error("Supabase load activities exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.activities) db.activities = [];
  return db.activities.filter(a => a.leadId === leadId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function createActivity(activity: LeadActivity): Promise<boolean> {
  if (useSupabase && supabase) {
    try {
      const payload = {
        id: activity.id,
        lead_id: activity.leadId,
        activity_type: activity.activityType,
        description: activity.description,
        created_at: activity.createdAt,
        created_by: activity.createdBy
      };
      const { error } = await supabase.from("crm_activities").insert([payload]);
      if (error) {
        console.warn("Could not write to Supabase 'crm_activities'. Falling back to local.", error.message);
      } else {
        return true;
      }
    } catch (err: any) {
      console.error("Supabase insert activity exception:", err.message);
    }
  }
  const db = readDatabase();
  if (!db.activities) db.activities = [];
  db.activities.push(activity);
  writeDatabase(db);
  return true;
}

async function logActivity(leadId: string, type: string, description: string, email: string) {
  const activityObj: LeadActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    leadId,
    activityType: type as any,
    description,
    createdAt: new Date().toISOString(),
    createdBy: email || "system"
  };
  await createActivity(activityObj);
}

// --- AUTOMATIC SEED ROUTINE (CREATES SAMPLES ON SUPABASE ON LOAD IF EMPTY) ---
async function seedSupabaseDatabaseIfEmpty() {
  if (!useSupabase || !supabase) return;
  try {
    const { data: admins, error: errAdmins } = await supabase.from("crm_admins").select("email", { limit: 1 });
    if (!errAdmins && (!admins || admins.length === 0)) {
      console.log("Seeding default demo logins to 'crm_admins' table on Supabase...");
      await supabase.from("crm_admins").insert(
        DEFAULT_USERS.map(u => ({ email: u.email, name: u.name, password_hash: u.passwordHash, role: u.role, added_by: "system" }))
      );
    }

    const { data: leads, error: errLeads } = await supabase.from("crm_leads").select("id", { limit: 1 });
    if (!errLeads && (!leads || leads.length === 0) && DEFAULT_LEADS.length > 0) {
      console.log("Seeding default demo lead information to 'crm_leads' table on Supabase...");
      await supabase.from("crm_leads").insert(
        DEFAULT_LEADS.map(l => ({
          id: l.id,
          name: l.name,
          company: l.company,
          phone: l.phone,
          email: l.email,
          location: l.location,
          industry: l.industry,
          status: l.status,
          notes: l.notes,
          owner: l.owner,
          created_at: l.createdAt
        }))
      );
    }

    const { data: revMetrics, error: errMetrics } = await supabase.from("crm_revenue_metrics").select("category", { limit: 1 });
    if (!errMetrics && (!revMetrics || revMetrics.length === 0)) {
      console.log("Seeding default revenue metrics to 'crm_revenue_metrics' table on Supabase...");
      await supabase.from("crm_revenue_metrics").insert(
        DEFAULT_REVENUE_METRICS.map(m => ({
          category: m.category,
          projected_revenue: m.projectedRevenue,
          till_date_revenue: m.tillDateRevenue,
          final_revenue: m.finalRevenue
        }))
      );
    }

    const { data: revSet, error: errSet } = await supabase.from("crm_revenue_settings").select("key", { limit: 1 });
    if (!errSet && (!revSet || revSet.length === 0)) {
      console.log("Seeding default revenue settings visibility to 'crm_revenue_settings' table...");
      await supabase.from("crm_revenue_settings").insert([
        { key: "show_revenue_to_users", value: false }
      ]);
    }
  } catch (err) {
    console.warn("Could not check/seed Supabase automatically. Disregard if tables not created yet.", err);
  }
}

// Trigger seed and cleanup checks for clean database state
setTimeout(async () => {
  try {
    const residualIds = ["lead-1", "lead-2", "lead-3", "lead-4", "lead-5"];
    for (const rid of residualIds) {
      await deleteLead(rid);
    }
  } catch (err) {
    console.error("Error purging residual sample database entries:", err);
  }
  await seedSupabaseDatabaseIfEmpty();
}, 3000);

// --- EXPRESS APPLICATION SETTINGS ---
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Authentication and Session Middleware
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const session = SESSIONS[token];
      if (session) {
        (req as any).user = session;
      }
    }
    next();
  });

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Unauthorized access detected. Please log in again." });
    }
    next();
  };

  // --- CONFIG / STATUS ENDPOINT ---
  app.get("/api/config", (req, res) => {
    const sqlSchema = `
-- COPY & RUN THIS IN YOUR SUPABASE SQL EDITOR TO SETUP TABLES PERMANENTLY:

CREATE TABLE IF NOT EXISTS crm_admins (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'USER',
  added_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  location TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  status TEXT DEFAULT 'NEW',
  notes TEXT DEFAULT '',
  owner TEXT DEFAULT 'unassigned',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  business_unit TEXT DEFAULT 'A consultancy',
  temperature TEXT DEFAULT 'WARM',
  created_by TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS crm_voice_notes (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  transcript TEXT,
  summary TEXT,
  requirements TEXT,
  budget TEXT,
  products_discussed TEXT,
  follow_up_date TEXT,
  action_items TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  due_date TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_reminders (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reminder_date TEXT NOT NULL,
  timing TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_documents (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size TEXT DEFAULT '',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_communications (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  outcome TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_revenue_metrics (
  category TEXT PRIMARY KEY,
  projected_revenue NUMERIC DEFAULT 0,
  till_date_revenue NUMERIC DEFAULT 0,
  final_revenue NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_revenue_settings (
  key TEXT PRIMARY KEY,
  value BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crm_po_management (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  monthly_amount NUMERIC DEFAULT 0,
  duration_months INTEGER DEFAULT 1,
  total_po_value NUMERIC DEFAULT 0,
  client_name TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  invoice_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_workshops (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  price NUMERIC DEFAULT 0,
  client_name TEXT DEFAULT '',
  location TEXT DEFAULT '',
  event_date TEXT DEFAULT '',
  invoice_url TEXT DEFAULT '',
  additional_details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- STORAGE BUCKET CONFIGURATION & RLS POLICIES (RUN TO ENABLE PUBLIC STORAGE UPLOADS) ---
-- NOTE: If you receive error "42501: must be owner of table objects", simply skip the ALTER TABLE or POLICY lines.
-- You can instead easily mark your bucket "lead-documents" as Public in the Supabase Storage dashboard, which accomplishes the same.

-- Create storage bucket named "lead-documents" if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-documents', 'lead-documents', true)
ON CONFLICT (id) DO NOTHING;

-- If your current Supabase role permits, you can apply policies below.
-- If you get a privilege error, you can safely skip these lines and set up a public bucket through the Supabase Storage panel.

-- DROP policies if they exist to avoid conflicts on recreation
-- DROP POLICY IF EXISTS "Public Access" ON storage.objects;
-- DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
-- DROP POLICY IF EXISTS "Public Update" ON storage.objects;
-- DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- Create policies to allow public/anon access to the "lead-documents" bucket
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'lead-documents');
-- CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lead-documents');
-- CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'lead-documents');
-- CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'lead-documents');

-- --- EXPLICITLY DISABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES TO ALLOW ALL SYSTEM USERS FULL ACCESS TO EACH OTHER'S DATA ---
ALTER TABLE crm_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_voice_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_po_management DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_workshops DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_admins DISABLE ROW LEVEL SECURITY;
    `.trim();

    res.json({
      useSupabase,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...supabase.co` : null,
      sqlSchema
    });
  });

  // --- AUTH ENDPOINTS (ALL REGISTERED USERS ARE ADMINS IN THIS VERSION) ---

  // Register admin or standard crm user
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Name, email, and password properties are required." });
    }

    const adminsList = await getAdmins();
    if (adminsList.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: "An administrator or user with this email is already registered." });
    }

    const newAdmin: User = {
      email: email.toLowerCase(),
      name,
      role: role === "ADMIN" ? "ADMIN" : "USER",
      passwordHash: password,
      addedBy: (req as any).user?.email || "system"
    };

    await registerAdmin(newAdmin);
    res.json({ success: true, message: `Account for ${name} (${role || "USER"}) provisioned successfully.` });
  });

  // Send forgot password verification OTP via Resend
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Please specify a valid email address to request a security validation code." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let userExists = false;
    let userName = "Consultant Partner";
    let userRole = "USER";

    // Check custom database registry
    const db = readDatabase();
    const localUser = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (localUser) {
      userExists = true;
      userName = localUser.name || userName;
      userRole = localUser.role || userRole;
    }

    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from("crm_admins").select("*").eq("email", normalizedEmail).maybeSingle();
        if (!error && data) {
          userExists = true;
          userName = data.name || userName;
          userRole = data.role || userRole;
        }
      } catch (_) {}
    }

    if (!userExists) {
      return res.status(404).json({ error: `No active consultant or admin profile was found matching "${email}".` });
    }

    // Generate secure 6-digit OTP code
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const code = `SECURE-${rawCode}`;
    RESET_CODES[normalizedEmail] = {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000 // Valid for 15 minutes
    };

    let emailSentStatus = false;
    let emailSentError = "";

    if (process.env.RESEND_API_KEY) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: "SyncAI Security <onboarding@resend.dev>",
            to: [normalizedEmail],
            subject: "SyncAI Security Password Reset Code",
            html: `
              <div style="font-family: sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: auto; background-color: #ffffff;">
                <h2 style="color: #0d2c54; margin-bottom: 5px;">SyncAI CRM Registry</h2>
                <p style="font-size: 14px; color: #475569; margin-top: 15px;">Hello <strong>${userName}</strong>,</p>
                <p style="font-size: 14px; color: #475569; line-height: 1.5;">A request to override your custom login credentials has been security-authenticated.</p>
                <p style="font-size: 14px; color: #475569;">Specify the following validation code inside your security panel to complete your password update:</p>
                <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 26px; font-weight: bold; text-align: center; letter-spacing: 2px; color: #0d9488; margin: 24px 0; border: 1px solid #e2e8f0;">
                  ${code}
                </div>
                <p style="font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 15px;">This secure token was dispatched specifically to ${normalizedEmail} and is active for 15 minutes. Note: if you didn't trigger this action, you can safely ignore this email.</p>
              </div>
            `
          })
        });

        if (response.ok) {
          emailSentStatus = true;
        } else {
          const errBody = await response.json().catch(() => ({}));
          emailSentError = JSON.stringify(errBody);
          console.error("Resend API returned error:", errBody);
        }
      } catch (err: any) {
        console.error("Failed to connect with Resend API:", err?.message);
        emailSentError = err?.message || "Connection exception";
      }
    }

    if (emailSentStatus) {
      return res.json({
        success: true,
        message: `Security validation code dispatched successfully to your registered layout inbox of ${email}.`
      });
    } else {
      // Dev friendly graceful fallback when RESEND_API_KEY is missing or fails
      const fallbackMsg = process.env.RESEND_API_KEY 
        ? `Failed to send email via Resend (${emailSentError}).` 
        : "RESEND_API_KEY environment variable is not defined yet.";
      
      return res.json({
        success: true,
        message: `Security verification code generated! (${fallbackMsg})`,
        debugCode: code // Shown directly on front-end as fallback alert to unblock immediate usage
      });
    }
  });

  // Reset password mechanism using dynamic OTP
  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;
    const authCode = req.body.code || req.body.verificationCode;

    if (!email || !newPassword || !authCode) {
      return res.status(400).json({ error: "Email, new password, and verification code are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = RESET_CODES[normalizedEmail];

    if (!record || record.code !== authCode || record.expiresAt < Date.now()) {
      return res.status(400).json({ error: "Invalid, expired, or incorrect security verification code. Please request a fresh code." });
    }

    try {
      // 1. Update in local db.json
      const db = readDatabase();
      let matchedName = "Consultant Partner";
      let matchedRole: "ADMIN" | "USER" = "USER";

      const userIdx = db.users.findIndex(u => u.email.toLowerCase() === normalizedEmail);
      if (userIdx !== -1) {
        db.users[userIdx].passwordHash = newPassword;
        matchedName = db.users[userIdx].name || matchedName;
        matchedRole = db.users[userIdx].role || matchedRole;
        writeDatabase(db);
      } else {
        // Create matching local fallback account
        db.users.push({
          email: normalizedEmail,
          name: matchedName,
          role: matchedRole,
          passwordHash: newPassword
        });
        writeDatabase(db);
      }

      // 2. Update in Supabase if active
      if (useSupabase && supabase) {
        try {
          const { data: existingUser } = await supabase.from("crm_admins").select("*").eq("email", normalizedEmail).maybeSingle();
          if (existingUser) {
            matchedName = existingUser.name || matchedName;
            matchedRole = existingUser.role || matchedRole;
          }
          await supabase.from("crm_admins").upsert([{
            email: normalizedEmail,
            name: matchedName,
            role: matchedRole,
            password_hash: newPassword
          }], { onConflict: "email" });
        } catch (syncErr: any) {
          console.warn("Could not sync updated reset password to Supabase crm_admins:", syncErr.message);
        }
      }

      // Clear code from memory upon usage
      delete RESET_CODES[normalizedEmail];

      res.json({ success: true, message: `Administrator / Advisor password for ${normalizedEmail} has been reset successfully.` });
    } catch (err: any) {
      console.error("Password reset error:", err);
      res.status(500).json({ error: "Failed to reset password due to database issue." });
    }
  });

  // Login admin
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Credentials credentials required." });
    }

    const adminsList = await getAdmins();
    const user = adminsList.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "Invalid credentials. Please verify your email & password." });
    }

    // Generate simulated session token
    const token = `token_${user.email}_${Math.random().toString(36).substring(2, 12)}`;
    SESSIONS[token] = {
      email: user.email,
      name: user.name,
      role: user.role
    };

    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  });

  // Get active self session profile
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // List of admins for lead assignees
  app.get("/api/auth/users", requireAuth, async (req, res) => {
    const list = await getAdmins();
    const clean = list.map(u => ({
      email: u.email,
      name: u.name,
      role: u.role,
      addedBy: u.addedBy || "system"
    }));
    res.json({ users: clean });
  });

  // Permanently delete a team admin/user (with authorization rules)
  app.delete("/api/auth/users/:email", requireAuth, async (req, res) => {
    const { email } = req.params;
    const actorEmail = (req as any).user?.email;

    if (!actorEmail) {
      return res.status(401).json({ error: "Unauthorized access." });
    }

    const userList = await getAdmins();
    const actor = userList.find(u => u.email.toLowerCase() === actorEmail.toLowerCase());
    const target = userList.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!target) {
      return res.status(404).json({ error: "Target administrator or standard user email not found." });
    }

    if (!actor) {
      return res.status(403).json({ error: "Access denied. Your profile was not found in our registry." });
    }

    // Prevents self deletion on this general endpoint
    if (actor.email.toLowerCase() === target.email.toLowerCase()) {
      return res.status(400).json({ error: "You cannot delete your own logged-in account directly. Please ask another administrator." });
    }

    // All authenticated users and admins have clearance to permanently delete other employee/consultant records
    let isAuthorized = true;

    const deleted = await deleteAdmin(email);
    if (deleted) {
      res.json({ success: true, message: `Account for ${target.name} (${email}) deleted permanently.` });
    } else {
      res.status(500).json({ error: "Failed to delete account from system store." });
    }
  });

  // --- PO ASSURED BUSINESS DATABASE HELPER LAYER ---
  async function getPoAssuredFromDb(): Promise<PoAssuredBusiness[]> {
    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from("crm_po_management").select("*");
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.code === "42P01")) {
            console.log("Infra notification (Silent Fallback): 'crm_po_management' table not ready in Supabase. Engaging local db.json fallback.");
          } else {
            console.log("Infra notification (Silent Fallback): Could not read 'crm_po_management' table.", error.message);
          }
        } else if (data) {
          return data.map((r: any) => ({
            id: r.id,
            category: r.category,
            monthlyAmount: Number(r.monthly_amount) || 0,
            durationMonths: Number(r.duration_months) || 0,
            totalPoValue: Number(r.total_po_value) || 0,
            clientName: r.client_name,
            status: r.status || "Pending",
            invoiceUrl: r.invoice_url || "",
            createdAt: r.created_at || new Date().toISOString()
          }));
        }
      } catch (err: any) {
        console.log("Infra notification (Silent Fallback): Supabase load po-assured exception. engaging local db.json fallback.");
      }
    }

    const db = readDatabase();
    return (db.poAssuredBusinesses as any) || [];
  }

  async function savePoAssuredToDb(item: PoAssuredBusiness): Promise<boolean> {
    if (useSupabase && supabase) {
      try {
        const { error } = await supabase.from("crm_po_management").upsert({
          id: item.id,
          category: item.category,
          monthly_amount: Number(item.monthlyAmount) || 0,
          duration_months: Number(item.durationMonths) || 0,
          total_po_value: Number(item.totalPoValue) || 0,
          client_name: item.clientName,
          status: item.status || "Pending",
          invoice_url: item.invoiceUrl || "",
          created_at: item.createdAt || new Date().toISOString()
        }, { onConflict: "id" });
        if (!error) {
          try {
            const db = readDatabase();
            if (!db.poAssuredBusinesses) {
              db.poAssuredBusinesses = [] as any;
            }
            const idx = (db.poAssuredBusinesses as any[]).findIndex((p: any) => p.id === item.id);
            if (idx !== -1) {
              (db.poAssuredBusinesses as any[])[idx] = item;
            } else {
              (db.poAssuredBusinesses as any[]).push(item);
            }
            writeDatabase(db);
          } catch (_) {}
          return true;
        }
        if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.code === "42P01")) {
          console.log("Infra notification (Silent Fallback): 'crm_po_management' table not ready in Supabase. Saving in local fallback instead.");
        } else {
          console.log("Infra notification (Silent Fallback): Failed to upsert key to crm_po_management", error.message);
          throw new Error(`Supabase DB Schema Mismatch: Column category or monthly_amount is missing in 'crm_po_management' table. Message: ${error.message}`);
        }
      } catch (err: any) {
        console.log("Infra notification (Silent Fallback): Supabase upsert exception on crm_po_management.");
        if (err.message && err.message.includes("Supabase DB Schema")) {
          throw err;
        }
      }
    }

    const db = readDatabase();
    if (!db.poAssuredBusinesses) {
      db.poAssuredBusinesses = [] as any;
    }
    const idx = (db.poAssuredBusinesses as any[]).findIndex((p: any) => p.id === item.id);
    if (idx !== -1) {
      (db.poAssuredBusinesses as any[])[idx] = item;
    } else {
      (db.poAssuredBusinesses as any[]).push(item);
    }
    writeDatabase(db);
    return true;
  }

  async function deletePoAssuredFromDb(id: string): Promise<boolean> {
    let supabaseSuccess = false;
    if (useSupabase && supabase) {
      try {
        const { error } = await supabase.from("crm_po_management").delete().eq("id", id);
        if (!error) {
          supabaseSuccess = true;
        } else {
          console.warn("Could not delete from Supabase 'crm_po_management':", error.message);
        }
      } catch (err: any) {
        console.error("Supabase delete po-assured error:", err.message);
      }
    }

    // Always perform local database cleanup so states remain synchronized
    let localDeleted = false;
    try {
      const db = readDatabase();
      if (!db.poAssuredBusinesses) {
        db.poAssuredBusinesses = [] as any;
      }
      const idx = (db.poAssuredBusinesses as any[]).findIndex((p: any) => p.id === id);
      if (idx !== -1) {
        (db.poAssuredBusinesses as any[]).splice(idx, 1);
        writeDatabase(db);
        localDeleted = true;
      }
    } catch (dbErr) {
      console.error("Local DB PO delete error:", dbErr);
    }

    return supabaseSuccess || localDeleted;
  }

  // --- BOOKS & WORKSHOPS DATABASE HELPER LAYER ---
  async function getWorkshopsFromDb(): Promise<WorkshopRecord[]> {
    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from("crm_workshops").select("*");
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.code === "42P01")) {
            console.log("Infra notification (Silent Fallback): 'crm_workshops' table not ready in Supabase. Engaging local db.json fallback.");
          } else {
            console.log("Infra notification (Silent Fallback): Could not read 'crm_workshops' table.", error.message);
          }
        } else if (data) {
          return data.map((r: any) => ({
            id: r.id,
            type: r.type,
            title: r.title || "",
            ownerName: r.owner_name || "",
            price: Number(r.price) || 0,
            clientName: r.client_name || "",
            location: r.location || "",
            eventDate: r.event_date || "",
            invoiceUrl: r.invoice_url || "",
            additionalDetails: r.additional_details || "",
            createdAt: r.created_at || new Date().toISOString()
          }));
        }
      } catch (err: any) {
        console.log("Infra notification (Silent Fallback): Supabase load workshops exception. engaging local db.json fallback.");
      }
    }

    const db = readDatabase();
    return db.workshops || [];
  }

  async function saveWorkshopToDb(item: WorkshopRecord): Promise<boolean> {
    if (useSupabase && supabase) {
      try {
        const { error } = await supabase.from("crm_workshops").upsert({
          id: item.id,
          type: item.type,
          title: item.title || "",
          owner_name: item.ownerName || "",
          price: Number(item.price) || 0,
          client_name: item.clientName || "",
          location: item.location || "",
          event_date: item.eventDate || "",
          invoice_url: item.invoiceUrl || "",
          additional_details: item.additionalDetails || "",
          created_at: item.createdAt || new Date().toISOString()
        }, { onConflict: "id" });
        if (!error) {
          return true;
        }
        if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.code === "42P01")) {
          console.log("Infra notification (Silent Fallback): 'crm_workshops' table not ready in Supabase. Saving in local fallback instead.");
        } else {
          console.log("Infra notification (Silent Fallback): Failed to upsert key to crm_workshops", error.message);
        }
      } catch (err: any) {
        console.log("Infra notification (Silent Fallback): Supabase upsert exception on crm_workshops.");
      }
    }

    const db = readDatabase();
    if (!db.workshops) {
      db.workshops = [];
    }
    const idx = db.workshops.findIndex((p: any) => p.id === item.id);
    if (idx !== -1) {
      db.workshops[idx] = item;
    } else {
      db.workshops.push(item);
    }
    writeDatabase(db);
    return true;
  }

  async function deleteWorkshopFromDb(id: string): Promise<boolean> {
    if (useSupabase && supabase) {
      try {
        const { error } = await supabase.from("crm_workshops").delete().eq("id", id);
        if (!error) {
          return true;
        }
      } catch (err: any) {
        console.log("Infra notification (Silent Fallback): Supabase delete workshops exception.");
      }
    }

    const db = readDatabase();
    if (!db.workshops) {
      db.workshops = [];
    }
    const idx = db.workshops.findIndex((p: any) => p.id === id);
    if (idx !== -1) {
      db.workshops.splice(idx, 1);
      writeDatabase(db);
      return true;
    }
    return false;
  }

  // POST /api/po-assured/upload-invoice
  app.post("/api/po-assured/upload-invoice", requireAuth, async (req, res) => {
    try {
      const { fileName, fileData } = req.body;
      if (!fileName || !fileData) {
        return res.status(400).json({ error: "Missing required parameters fileName or fileData." });
      }

      const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      let fileUrl = `/uploads/${safeName}`;

      // Create uploads directory if not exists
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        try {
          fs.mkdirSync(uploadsDir, { recursive: true });
        } catch (_) {}
      }

      // Write local fallback file
      try {
        let localBuffer: Buffer;
        if (fileData.startsWith("data:")) {
          localBuffer = Buffer.from(fileData.split(",")[1], "base64");
        } else {
          localBuffer = Buffer.from(fileData, "utf-8");
        }
        fs.writeFileSync(path.join(uploadsDir, safeName), localBuffer);
      } catch (writeErr: any) {
        console.warn("Could not write local invoice copy:", writeErr.message);
      }

      // Upload to Supabase 'lead-documents' bucket
      if (useSupabase && supabase) {
        try {
          // ensure bucket
          try {
            await supabase.storage.createBucket("lead-documents", { public: true });
          } catch (_) {}

          let mime = "application/octet-stream";
          let uploadBuffer: Buffer;

          if (fileData.startsWith("data:")) {
            const matchMime = fileData.match(/data:(.*?);/);
            if (matchMime) mime = matchMime[1];
            uploadBuffer = Buffer.from(fileData.split(",")[1], "base64");
          } else {
            uploadBuffer = Buffer.from(fileData, "utf-8");
          }

          const storagePath = `po-assured/${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("lead-documents")
            .upload(storagePath, uploadBuffer, {
              contentType: mime,
              upsert: true
            });

          if (!uploadError) {
            const publicUrl = supabase.storage.from("lead-documents").getPublicUrl(storagePath).data?.publicUrl;
            if (publicUrl) {
              fileUrl = publicUrl;
            }
          } else {
            console.warn("Supabase Storage upload invoice warning:", uploadError.message);
          }
        } catch (supabaseErr: any) {
          console.error("Supabase Storage flow for invoices failed:", supabaseErr.message);
        }
      }

      res.status(200).json({ success: true, fileUrl });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to upload invoice.", details: err.message });
    }
  });

  // GET all PO Assured Business
  app.get("/api/po-assured", requireAuth, async (req, res) => {
    try {
      const items = await getPoAssuredFromDb();
      res.json({ success: true, poAssured: items });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve PO Assured records." });
    }
  });

  // POST create/update PO Assured Business
  app.post("/api/po-assured", requireAuth, async (req, res) => {
    try {
      const { id, category, monthlyAmount, durationMonths, clientName, status, invoiceUrl } = req.body;
      if (!clientName || !category) {
        return res.status(400).json({ error: "Missing required PO fields (clientName and category are required)." });
      }

      const calculatedTotal = (Number(monthlyAmount) || 0) * (Number(durationMonths) || 0);

      const record: PoAssuredBusiness = {
        id: id || `po-${Date.now()}`,
        category,
        monthlyAmount: Number(monthlyAmount) || 0,
        durationMonths: Number(durationMonths) || 0,
        totalPoValue: calculatedTotal,
        clientName,
        status: status || "Pending",
        invoiceUrl: invoiceUrl || "",
        createdAt: new Date().toISOString()
      };

      await savePoAssuredToDb(record);
      res.json({ success: true, poAssured: record });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to save PO Assured record.", details: err.message });
    }
  });

  // DELETE a PO Assured Business
  app.delete("/api/po-assured/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deletePoAssuredFromDb(id);
      if (success) {
        res.json({ success: true, message: "PO Assured record deleted." });
      } else {
        res.status(404).json({ error: "PO Assured record not found." });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete PO Assured record." });
    }
  });

  // GET all Books & Workshops
  app.get("/api/workshops", requireAuth, async (req, res) => {
    try {
      const items = await getWorkshopsFromDb();
      res.json({ success: true, workshops: items });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve Books and Workshops records." });
    }
  });

  // POST create/update a Books & Workshop record
  app.post("/api/workshops", requireAuth, async (req, res) => {
    try {
      const { id, type, title, ownerName, price, clientName, location, eventDate, invoiceUrl, additionalDetails } = req.body;
      if (!type) {
        return res.status(400).json({ error: "Missing required type (OPEN or CORPORATE)." });
      }

      const record: WorkshopRecord = {
        id: id || `bw-${Date.now()}`,
        type,
        title: title || "",
        ownerName: ownerName || "",
        price: Number(price) || 0,
        clientName: clientName || "",
        location: location || "",
        eventDate: eventDate || "",
        invoiceUrl: invoiceUrl || "",
        additionalDetails: additionalDetails || "",
        createdAt: new Date().toISOString()
      };

      await saveWorkshopToDb(record);
      res.json({ success: true, workshop: record });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to save Books and Workshops record.", details: err.message });
    }
  });

  // DELETE a Books & Workshop record
  app.delete("/api/workshops/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deleteWorkshopFromDb(id);
      if (success) {
        res.json({ success: true, message: "Books/Workshop record deleted." });
      } else {
        res.status(404).json({ error: "Record not found." });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete Books and Workshops record." });
    }
  });

  // GET revenue metrics and visibility
  app.get("/api/revenue-metrics", requireAuth, async (req, res) => {
    try {
      const { metrics, showToUsers } = await getRevenueMetricsFromDb();
      res.json({ metrics, showToUsers });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve revenue metrics from datastore." });
    }
  });

  // UPDATE revenue metrics and visibility (Restricted to Administrators only)
  app.post("/api/revenue-metrics", requireAuth, async (req, res) => {
    const userObj = (req as any).user;
    const isMaster = userObj && (
      userObj.role === "ADMIN" ||
      userObj.email.toLowerCase() === "paritoshbadave@gmail.com" || 
      userObj.email.toLowerCase() === "admin@company.com"
    );
    if (!isMaster) {
      return res.status(403).json({ error: "Only administrators are authorized to update financial forecast projections or toggle visibility." });
    }

    try {
      const { metrics: existingMetrics, showToUsers: existingToggle } = await getRevenueMetricsFromDb();
      const { metrics, showToUsers } = req.body;
      
      const nextMetrics = metrics !== undefined ? metrics : existingMetrics;
      const nextToggle = showToUsers !== undefined ? showToUsers : existingToggle;

      await saveRevenueMetricsToDb(nextMetrics, nextToggle);
      res.json({ success: true, metrics: nextMetrics, showToUsers: nextToggle });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to save project metrics to datastore." });
    }
  });

  // Terminate session
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      delete SESSIONS[token];
    }
    res.json({ success: true });
  });

  // --- LEADS MANAGEMENT ENDPOINTS ---

  const canAccessLead = (lead: Lead, userObj: any): boolean => {
    return !!userObj; // Allow all authenticated system users to view, edit, and delete
  };

  // Get all leads
  app.get("/api/leads", requireAuth, async (req, res) => {
    const dataLeads = await getLeads();
    res.json({ leads: dataLeads });
  });

  // Read lead profile
  app.get("/api/leads/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const lead = await getLeadById(id);
    if (!lead) {
      return res.status(404).json({ error: "Lead profile not found." });
    }

    const userObj = (req as any).user;
    if (!canAccessLead(lead, userObj)) {
      return res.status(403).json({ error: "Access denied. You can only view your own assigned or created leads." });
    }

    res.json({ lead });
  });

  // Create new lead
  app.post("/api/leads", requireAuth, async (req, res) => {
    const { name, company, phone, email, location, industry, status, notes, owner, businessUnit, temperature } = req.body;
    const authorEmail = (req as any).user?.email || "system";

    if (!name || !company) {
      return res.status(400).json({ error: "Lead Name and Corporate Company are strictly required." });
    }

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name,
      company,
      phone: phone || "",
      email: email || "",
      location: location || "",
      industry: industry || "",
      status: status || "NEW",
      notes: notes || "",
      owner: owner || authorEmail, // Default to creator if unassigned
      createdAt: new Date().toISOString(),
      businessUnit: businessUnit || "A consultancy",
      temperature: temperature || "WARM",
      createdBy: authorEmail
    };

    await createLead(newLead);
    await logActivity(newLead.id, "LEAD_CREATED", `Lead created: "${newLead.name}" at ${newLead.company}`, authorEmail);
    res.status(201).json({ success: true, lead: newLead });
  });

  // Update lead specs
  app.put("/api/leads/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userObj = (req as any).user;

    const existingLead = await getLeadById(id);
    if (!existingLead) {
      return res.status(404).json({ error: "Lead option not found." });
    }

    if (!canAccessLead(existingLead, userObj)) {
      return res.status(403).json({ error: "Access denied. You are not authorized to update this lead." });
    }

    const { name, company, phone, email, location, industry, status, notes, owner, businessUnit, temperature } = req.body;

    const updated = await updateLead(id, {
      name, company, phone, email, location, industry, status, notes, owner, businessUnit, temperature
    });

    const emailStr = userObj?.email || "system";
    await logActivity(id, "LEAD_UPDATED", `Lead information updated for "${updated?.name}"`, emailStr);

    res.json({ success: true, lead: updated });
  });

  // Remove lead profile
  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userObj = (req as any).user;

    const existingLead = await getLeadById(id);
    if (!existingLead) {
      return res.status(404).json({ error: "Lead profile not found." });
    }

    if (!canAccessLead(existingLead, userObj)) {
      return res.status(403).json({ error: "Access denied. You are not authorized to delete this lead." });
    }

    await deleteLead(id);
    res.json({ success: true, message: "Lead removed successfully." });
  });

  // --- VOICE NOTES ENDPOINTS ---

  // Get voice notes linked to a specific lead
  app.get("/api/leads/:leadId/voice-notes", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    try {
      const lead = await getLeadById(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead profile not found." });
      }
      const notes = await getVoiceNotesByLead(leadId);
      res.json({ voiceNotes: notes });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load voice notes.", details: err.message });
    }
  });

  // Post a new voice note linked to a specific lead
  app.post("/api/leads/:leadId/voice-notes", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    const { audioUrl } = req.body;
    const creatorEmail = (req as any).user?.email || "unknown";

    if (!audioUrl) {
      return res.status(400).json({ error: "Audio data or URL is required." });
    }

    try {
      const lead = await getLeadById(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead profile not found." });
      }

      // Generate accurate speech-to-text transcript using Gemini API with safety fallback wrapping
      let transcript = "";
      try {
        transcript = await transcribeAudio(audioUrl);
      } catch (transcribeErr: any) {
        console.error("Critical error while transcribing audio:", transcribeErr);
        transcript = `[Transcription unavailable. Error: ${transcribeErr.message || transcribeErr}]`;
      }

      // Generate structured meeting insights from the transcript with safety fallback wrapping
      let insights = {
        summary: "",
        requirements: "",
        budget: "",
        productsDiscussed: "",
        followUpDate: "",
        actionItems: "",
        priority: "Medium"
      };

      try {
        insights = await generateMeetingInsights(transcript);
      } catch (insightsErr: any) {
        console.error("Critical error while generating meeting insights:", insightsErr);
      }

      const id = `vn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const voiceNote: VoiceNote = {
        id,
        leadId,
        audioUrl,
        transcript,
        summary: insights.summary,
        requirements: insights.requirements,
        budget: insights.budget,
        productsDiscussed: insights.productsDiscussed,
        followUpDate: insights.followUpDate,
        actionItems: insights.actionItems,
        priority: insights.priority,
        createdAt: new Date().toISOString(),
        createdBy: creatorEmail,
      };

      await createVoiceNote(voiceNote);

      // Core Activity Log entries
      await logActivity(leadId, "VOICE_NOTE_ADDED", "Voice note recording uploaded and saved successfully.", creatorEmail);
      if (transcript && !transcript.startsWith("[Transcription unavailable")) {
        await logActivity(leadId, "TRANSCRIPT_GENERATED", `Voice note transcription completed (${transcript.length} characters).`, creatorEmail);
      }
      if (insights.summary) {
        await logActivity(leadId, "AI_SUMMARY_GENERATED", `AI analyzed conversation summary. Product: "${insights.productsDiscussed || "Unspecified"}". Budget: "${insights.budget || "Unspecified"}". Priority: ${insights.priority}.`, creatorEmail);
      }

      // AUTOMATIC REMINDER GENERATION FROM AI INSIGHTS FOLLOW UP DATE
      if (insights.followUpDate && insights.followUpDate.trim() !== "" && insights.followUpDate.toLowerCase() !== "pending") {
        try {
          const reminderId = `rem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          const reminderObj: Reminder = {
            id: reminderId,
            leadId,
            title: `Follow-up contact regarding ${insights.productsDiscussed || "recent conversation"}`,
            reminderDate: insights.followUpDate,
            timing: "On due date",
            status: "Pending",
            createdAt: new Date().toISOString()
          };
          await createReminder(reminderObj);
          await logActivity(leadId, "FOLLOW_UP_SCHEDULED", `Scheduled follow-up reminder auto-calculated for ${insights.followUpDate}.`, creatorEmail);
          console.log(`Automatically scheduled smart reminder on ${insights.followUpDate} for lead ${leadId}`);
        } catch (remErr: any) {
          console.error("Failed to automatically schedule smart reminder:", remErr);
        }
      }

      // AUTOMATIC TASK GENERATION FROM INSIGHTS / TRANSCRIPT
      let generatedTasksCount = 0;
      try {
        if (voiceNote.actionItems && voiceNote.actionItems.trim() !== "") {
          console.log("Analyzing voice note action items for automatic CRM tasks generation...");
          const extractedTasks = await extractTasksFromActionItems(voiceNote.actionItems, voiceNote.transcript || "");
          
          if (extractedTasks && extractedTasks.length > 0) {
            // Get existing tasks to prevent duplicates
            const existingTasks = await getTasksByLead(leadId);
            const existingTitles = new Set(existingTasks.map(t => t.title.toLowerCase().trim()));

            for (const et of extractedTasks) {
              const cleanTitle = et.title.trim();
              if (cleanTitle === "") continue;

              // Prevent duplicates (case insensitive match)
              if (existingTitles.has(cleanTitle.toLowerCase())) {
                console.log(`Skipping duplicate task: "${cleanTitle}"`);
                continue;
              }

              const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
              const taskObj: Task = {
                id: taskId,
                leadId,
                title: cleanTitle,
                status: "Pending",
                dueDate: et.dueDate || "Pending",
                createdAt: new Date().toISOString()
              };

              await createTask(taskObj);
              await logActivity(leadId, "TASK_CREATED", `Automatically created task: "${cleanTitle}" (Due: ${taskObj.dueDate})`, creatorEmail);
              generatedTasksCount++;
              existingTitles.add(cleanTitle.toLowerCase()); // prevent duplicate in the same batch
            }
          }
        }
      } catch (taskErr: any) {
        console.error("Failed to automatically generate tasks:", taskErr);
      }

      res.status(201).json({ success: true, voiceNote, generatedTasksCount });
    } catch (err: any) {
      console.error("Failed to save audio voice note:", err);
      res.status(500).json({ error: "Failed to save voice note.", details: err.message });
    }
  });

  // Delete a voice note
  app.delete("/api/voice-notes/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const user = (req as any).user;
    
    // Explicit Admin-only authorization check
    if (user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied. Only registered Administrators can delete recordings." });
    }
    
    try {
      const success = await deleteVoiceNote(id);
      if (!success) {
        return res.status(404).json({ error: "Voice note not found or already deleted." });
      }
      res.json({ success: true, message: "Voice note deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete voice note.", details: err.message });
    }
  });

  // --- TASK REST ENDPOINTS ---

  // Get all tasks across all leads
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await getAllTasks();
      res.json({ tasks });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load all tasks.", details: err.message });
    }
  });

  // Get tasks for a lead
  app.get("/api/leads/:leadId/tasks", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    try {
      const lead = await getLeadById(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead profile not found." });
      }
      const tasks = await getTasksByLead(leadId);
      res.json({ tasks });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load tasks.", details: err.message });
    }
  });

  // Create a task manually
  app.post("/api/leads/:leadId/tasks", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    const { title, dueDate, status } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "Task title is required." });
    }

    try {
      const lead = await getLeadById(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead profile not found." });
      }

      // Prevent duplicate task creation
      const existingTasks = await getTasksByLead(leadId);
      const isDuplicate = existingTasks.some(t => t.title.toLowerCase().trim() === title.toLowerCase().trim());
      if (isDuplicate) {
        return res.status(400).json({ error: "A task with this title already exists for this lead." });
      }

      const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const task: Task = {
        id,
        leadId,
        title: title.trim(),
        status: status || "Pending",
        dueDate: dueDate || "Pending",
        createdAt: new Date().toISOString()
      };

      await createTask(task);
      const email = (req as any).user?.email || "system";
      await logActivity(leadId, "TASK_CREATED", `Task created: "${task.title}" (Due: ${task.dueDate})`, email);
      res.status(201).json({ success: true, task });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create task.", details: err.message });
    }
  });

  // Edit/update a task
  app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, status, dueDate } = req.body;

    try {
      let originalStatus = "Pending";
      if (useSupabase && supabase) {
        try {
          const { data } = await supabase.from("crm_tasks").select("status").eq("id", id).maybeSingle();
          if (data) originalStatus = data.status || "Pending";
        } catch (_) {}
      } else {
        const db = readDatabase();
        const existingTask = db.tasks ? db.tasks.find(t => t.id === id) : null;
        if (existingTask) originalStatus = existingTask.status || "Pending";
      }
      
      const updated = await updateTask(id, { title, status, dueDate });
      if (!updated) {
        return res.status(404).json({ error: "Task not found." });
      }

      const email = (req as any).user?.email || "system";
      if (status === "Completed" && originalStatus !== "Completed") {
        await logActivity(updated.leadId, "TASK_COMPLETED", `Completed task: "${updated.title}"`, email);
      } else {
        await logActivity(updated.leadId, "LEAD_UPDATED", `Updated task: "${updated.title}"`, email);
      }

      res.json({ success: true, task: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update task.", details: err.message });
    }
  });

  // Delete a task
  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const db = readDatabase();
      const existingTask = db.tasks ? db.tasks.find(t => t.id === id) : null;
      const leadId = existingTask ? existingTask.leadId : null;

      const success = await deleteTask(id);
      if (!success) {
        return res.status(404).json({ error: "Task not found." });
      }

      if (leadId) {
        const email = (req as any).user?.email || "system";
        await logActivity(leadId, "LEAD_UPDATED", `Deleted task: "${existingTask?.title || id}"`, email);
      }

      res.json({ success: true, message: "Task deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete task.", details: err.message });
    }
  });

  // --- REMINDERS ENDPOINTS ---
  app.get("/api/reminders", requireAuth, async (req, res) => {
    try {
      const list = await getAllReminders();
      res.json({ reminders: list });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch all reminders.", details: err.message });
    }
  });

  app.get("/api/leads/:leadId/reminders", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    try {
      const list = await getRemindersByLead(leadId);
      res.json({ reminders: list });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch reminders.", details: err.message });
    }
  });

  app.post("/api/leads/:leadId/reminders", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    const { title, reminderDate, timing } = req.body;

    if (!title || !reminderDate) {
      return res.status(400).json({ error: "Reminder title and scheduled date are required." });
    }

    try {
      const reminder: Reminder = {
        id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        leadId,
        title,
        reminderDate,
        timing: timing || "On due date",
        status: "Pending",
        createdAt: new Date().toISOString()
      };
      await createReminder(reminder);

      const email = (req as any).user?.email || "system";
      await logActivity(leadId, "FOLLOW_UP_SCHEDULED", `Scheduler reminder programmed: "${title}" for ${reminderDate}`, email);

      res.status(201).json({ success: true, reminder });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate reminder.", details: err.message });
    }
  });

  app.put("/api/reminders/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status, title, reminderDate } = req.body;
    try {
      const updated = await updateReminder(id, { status, title, reminderDate });
      if (!updated) {
        return res.status(404).json({ error: "Reminder not found." });
      }
      res.json({ success: true, reminder: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update reminder.", details: err.message });
    }
  });

  app.delete("/api/reminders/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const success = await deleteReminder(id);
      if (!success) {
        return res.status(404).json({ error: "Reminder not found." });
      }
      res.json({ success: true, message: "Reminder deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete reminder.", details: err.message });
    }
  });

  // --- ACTIVITIES ENDPOINTS ---
  app.get("/api/leads/:leadId/activities", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    try {
      const list = await getActivitiesByLead(leadId);
      res.json({ activities: list });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load activities.", details: err.message });
    }
  });

  // --- DOCUMENTS ENDPOINTS ---
  app.get("/api/leads/:leadId/documents", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    try {
      const docs = await getDocsByLead(leadId);
      res.json({ documents: docs });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch documents.", details: err.message });
    }
  });

  app.post("/api/leads/:leadId/documents", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    const { name, category, fileData, fileSize } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: "Document name and category are required." });
    }

    try {
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      let fileUrl = "";
      const safeName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

      // 1. Write document content to disk as local fallback
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, safeName);

      if (fileData && fileData.startsWith("data:")) {
        try {
          const base64Data = fileData.split(",")[1];
          fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
          fileUrl = `/uploads/${safeName}`;
        } catch (err) {
          console.error("Local write failed for base64 file", err);
          fileUrl = `/uploads/${safeName}`;
        }
      } else {
        fileUrl = `/uploads/${safeName}`;
        fs.writeFileSync(filePath, Buffer.from(fileData || "Placeholder attachment content", "utf-8"));
      }

      // 2. If Supabase is configured, upload to 'lead-documents' bucket
      if (useSupabase && supabase) {
        try {
          // Auto-provision bucket to ensure it exists
          try {
            await supabase.storage.createBucket("lead-documents", {
              public: true,
              fileSizeLimit: 52428800 // 50MB
            });
          } catch (_) {
            // Bucket might already exist, safe to ignore
          }

          let uploadBuffer: Buffer;
          let mime = "application/octet-stream";

          if (fileData && fileData.startsWith("data:")) {
            const matchMime = fileData.match(/data:(.*?);/);
            if (matchMime) mime = matchMime[1];
            const base64Data = fileData.split(",")[1];
            uploadBuffer = Buffer.from(base64Data, "base64");
          } else {
            uploadBuffer = Buffer.from(fileData || "Placeholder attachment content", "utf-8");
          }

          const storagePath = `${leadId}/${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("lead-documents")
            .upload(storagePath, uploadBuffer, {
              contentType: mime,
              upsert: true
            });

          if (uploadError) {
            console.warn("Supabase Storage upload error:", uploadError.message);
          } else {
            const { dataUrl } = supabase.storage.from("lead-documents").getPublicUrl(storagePath);
            // Some older clients or versions of supabase-js return getPublicUrl as data.publicUrl
            const publicUrl = supabase.storage.from("lead-documents").getPublicUrl(storagePath).data?.publicUrl;
            if (publicUrl) {
              fileUrl = publicUrl;
            }
          }
        } catch (supabaseErr: any) {
          console.error("Supabase Storage workflow failed, falling back to local path.", supabaseErr.message);
        }
      }

      const email = (req as any).user?.email || "system";
      const doc: LeadDocument = {
        id: docId,
        leadId,
        name,
        category,
        fileUrl,
        fileSize: fileSize || "15 KB",
        uploadedAt: new Date().toISOString(),
        uploadedBy: email
      };

      await createDoc(doc);
      await logActivity(leadId, "DOCUMENT_UPLOADED", `Uploaded document: "${name}" (${category})`, email);

      res.status(201).json({ success: true, document: doc });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to upload document.", details: err.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const email = (req as any).user?.email || "system";
      
      // Locate the document first to get its leadId & details
      let docObj: LeadDocument | null = null;
      if (useSupabase && supabase) {
        try {
          const { data } = await supabase.from("crm_documents").select("*").eq("id", id).maybeSingle();
          if (data) {
            docObj = {
              id: data.id,
              leadId: data.lead_id,
              name: data.name,
              category: data.category,
              fileUrl: data.file_url,
              fileSize: data.file_size,
              uploadedAt: data.uploaded_at,
              uploadedBy: data.uploaded_by
            };
          }
        } catch (_) {}
      }

      if (!docObj) {
        const db = readDatabase();
        const found = db.documents?.find(d => d.id === id);
        if (found) docObj = found;
      }

      if (docObj) {
        // If it's a Supabase storage URL, attempt deletion of the bucket file as well
        if (useSupabase && supabase && docObj.fileUrl && docObj.fileUrl.includes("lead-documents")) {
          try {
            const urlParts = docObj.fileUrl.split("/lead-documents/");
            if (urlParts.length > 1) {
              const storagePath = decodeURIComponent(urlParts[1]);
              await supabase.storage.from("lead-documents").remove([storagePath]);
            }
          } catch (storageDelErr: any) {
            console.error("Failed to delete document from Supabase storage:", storageDelErr.message);
          }
        }

        // Also try to delete local file on disk if exists
        try {
          const fileName = docObj.fileUrl.split("/uploads/")[1];
          if (fileName) {
            const filePath = path.join(process.cwd(), "public", "uploads", fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        } catch (_) {}
      }

      const success = await deleteDoc(id);
      if (docObj) {
        await logActivity(docObj.leadId, "DOCUMENT_DELETED", `Deleted document: "${docObj.name}"`, email);
      }
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete document.", details: err.message });
    }
  });

  // --- COMMUNICATIONS ENDPOINTS ---
  app.get("/api/leads/:leadId/communications", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    try {
      const list = await getCommsByLead(leadId);
      res.json({ communications: list });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch communications.", details: err.message });
    }
  });

  app.post("/api/leads/:leadId/communications", requireAuth, async (req, res) => {
    const { leadId } = req.params;
    const { type, details, outcome } = req.body;

    if (!type || !details) {
      return res.status(400).json({ error: "Communication type and details are required." });
    }

    try {
      const email = (req as any).user?.email || "system";
      const comm: CommunicationLog = {
        id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        leadId,
        type,
        details,
        outcome: outcome || "",
        loggedAt: new Date().toISOString(),
        loggedBy: email
      };

      await createComm(comm);
      await logActivity(leadId, "COMM_LOGGED", `Logged ${type}: "${details.substring(0, 60)}${details.length > 60 ? "..." : ""}"`, email);

      res.status(201).json({ success: true, communication: comm });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to log communication.", details: err.message });
    }
  });


  // --- FORMSPREE WEBHOOK INTEGRATION ENDPOINTS ---

  interface WebhookLog {
    id: string;
    timestamp: string;
    success: boolean;
    senderEmail?: string;
    senderName?: string;
    payload: any;
    leadId?: string;
    message?: string;
  }

  const WEBHOOK_LOGS: WebhookLog[] = [];

  // Public Formspree Webhook Receiver Endpoint (Accepts POST requests from formspree.io server triggers)
  app.post("/api/webhooks/formspree", async (req, res) => {
    console.log("[Formspree Webhook] Inbound submission received:", JSON.stringify(req.body, null, 2));

    const rawData = req.body || {};
    // Check if formspree has structured the custom form fields inside a nested "data" node, or fallback to the root payload
    const source = (rawData.data && typeof rawData.data === "object") ? { ...rawData.data, ...rawData } : rawData;

    // Handle flexible, standard naming variations of typical customer form fields
    const name = String(
      source.name || 
      source.fullName || 
      source.fullname || 
      source.customerName ||
      source.customer_name || 
      (source.firstName ? `${source.firstName} ${source.lastName || ""}` : "") || 
      "Formspree Contact Source"
    ).trim();

    const company = String(
      source.company || 
      source.companyName || 
      source.company_name || 
      source.business || 
      source.firm || 
      source.organization || 
      "Independent Buyer"
    ).trim();

    const phone = String(
      source.phone || 
      source.phoneNumber || 
      source.phone_number || 
      source.telephone || 
      source.tel || 
      source.mobile || 
      ""
    ).trim();

    const email = String(
      source.email || 
      source.emailAddress || 
      source.email_address || 
      rawData.email || 
      ""
    ).trim();

    const location = String(
      source.location || 
      source.city || 
      source.address || 
      source.country || 
      source.region || 
      source.state || 
      ""
    ).trim();

    const industry = String(
      source.industry || 
      source.segment || 
      source.business_segment || 
      source.industry_segment || 
      source.category || 
      ""
    ).trim();

    // Map comments or user request text
    const messageOrNotes = source.message || source.notes || source.comment || source.comments || source.description || source.desc || "";

    // Aggregate any secondary submitted fields not directly mapped into leads so that no customer details are ever lost!
    const omittedKeys = ["name", "fullName", "fullname", "customerName", "customer_name", "firstName", "lastName", "company", "companyName", "company_name", "business", "firm", "organization", "phone", "phoneNumber", "phone_number", "telephone", "tel", "mobile", "email", "emailAddress", "email_address", "location", "city", "address", "country", "region", "state", "industry", "segment", "business_segment", "industry_segment", "category", "message", "notes", "comment", "comments", "description", "desc", "id", "form", "created_at", "data", "_to", "_subject", "_replyto"];

    let additionalMetadataStr = "";
    Object.keys(source).forEach((k) => {
      if (!omittedKeys.includes(k) && source[k] !== undefined && source[k] !== null && String(source[k]).trim() !== "") {
        additionalMetadataStr += `\n - ${k}: ${source[k]}`;
      }
    });

    const assembledNotes = `[Website Formspree Submission]
${messageOrNotes ? `Customer Message: "${messageOrNotes}"` : "No special message provided."}${additionalMetadataStr ? `\n\nAdditional Input Fields:${additionalMetadataStr}` : ""}`;

    const newLeadId = `lead-fs-${Date.now()}`;
    const newLead: Lead = {
      id: newLeadId,
      name: name || "Anonymous Lead",
      company: company || "Not Decided",
      phone,
      email,
      location,
      industry,
      status: "NEW", // Webhook registrations are placed in the fresh NEW stage of the CRM pipeline
      notes: assembledNotes.trim(),
      owner: "unassigned", // Placed in unassigned open pool for admins to pick up
      createdAt: new Date().toISOString()
    };

    let processedWithSuccess = false;
    let feedbackMsg = "";

    try {
      if (!newLead.name || newLead.name === "Formspree Contact Source") {
        if (email) {
          newLead.name = email.split("@")[0]; // extract name part from email as quick helper
        }
      }

      await createLead(newLead);
      processedWithSuccess = true;
      feedbackMsg = `Created lead successfully from website webhook: ${newLead.name} (${newLead.company})`;
      res.status(200).json({ success: true, lead_id: newLeadId, message: "Webhook processed and registered as NEW CRM lead." });
    } catch (err: any) {
      processedWithSuccess = false;
      feedbackMsg = `Failed to process webhook lead registration. SQL/Save Reason: ${err.message || err}`;
      res.status(500).json({ error: "Storage error occurred.", details: err.message });
    }

    // Keep memory cache of recent submissions logs so admins have real-time debug visibility in the CRM panel
    WEBHOOK_LOGS.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      success: processedWithSuccess,
      senderEmail: email,
      senderName: name,
      payload: rawData,
      leadId: processedWithSuccess ? newLeadId : undefined,
      message: feedbackMsg
    });

    if (WEBHOOK_LOGS.length > 30) {
      WEBHOOK_LOGS.pop();
    }
  });

  // Authenticated endpoint to view recent Webhook activity logs
  app.get("/api/webhook-logs", requireAuth, (req, res) => {
    res.json({ logs: WEBHOOK_LOGS });
  });

  // --- COPILOT AI ASSISTANT ASSIST HELPERS ---
  async function getAllDocuments(): Promise<LeadDocument[]> {
    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from("crm_documents").select("*");
        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            leadId: d.lead_id,
            name: d.name,
            category: d.category,
            fileUrl: d.file_url,
            fileSize: d.file_size,
            uploadedAt: d.uploaded_at,
            uploadedBy: d.uploaded_by
          }));
        }
      } catch (_) {}
    }
    const db = readDatabase();
    return db.documents || [];
  }

  async function getAllVoiceNotesData(): Promise<VoiceNote[]> {
    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from("crm_voice_notes").select("*");
        if (!error && data) {
          return data.map((v: any) => ({
            id: v.id,
            leadId: v.lead_id,
            audioUrl: v.audio_url,
            transcript: v.transcript,
            summary: v.summary,
            requirements: v.requirements,
            budget: v.budget,
            productsDiscussed: v.products_discussed,
            followUpDate: v.follow_up_date,
            actionItems: v.action_items,
            priority: v.priority,
            keyTakeaways: v.key_takeaways,
            createdAt: v.created_at,
            createdBy: v.created_by
          }));
        }
      } catch (_) {}
    }
    const db = readDatabase();
    return db.voiceNotes || [];
  }

  async function getAllCommunicationsData(): Promise<CommunicationLog[]> {
    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from("crm_communications").select("*");
        if (!error && data) {
          return data.map((c: any) => ({
            id: c.id,
            leadId: c.lead_id,
            type: c.type,
            details: c.details,
            outcome: c.outcome,
            loggedAt: c.logged_at,
            loggedBy: c.logged_by
          }));
        }
      } catch (_) {}
    }
    const db = readDatabase();
    return db.communications || [];
  }

  app.post("/api/copilot/chat", requireAuth, async (req, res) => {
    const { message, history, activeLeadId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    try {
      const leads = await getLeads();
      const tasks = await getAllTasks();
      const reminders = await getAllReminders();
      const voiceNotes = await getAllVoiceNotesData();
      const communications = await getAllCommunicationsData();
      const documents = await getAllDocuments();

      const serializedContext = {
        currentDate: new Date().toISOString().substring(0, 10),
        currentDayOfWeek: new Date().toLocaleDateString("en-US", { weekday: "long" }),
        leads: leads.map(l => ({
          id: l.id,
          name: l.name,
          company: l.company,
          phone: l.phone,
          email: l.email,
          location: l.location,
          industry: l.industry,
          status: l.status,
          notes: l.notes,
          createdAt: l.createdAt
        })),
        tasks: tasks.map(t => ({
          id: t.id,
          leadId: t.leadId,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
          createdAt: t.createdAt
        })),
        reminders: reminders.map(r => ({
          id: r.id,
          leadId: r.leadId,
          title: r.title,
          reminderDate: r.reminderDate,
          status: r.status,
          createdAt: r.createdAt
        })),
        communications: communications.map(c => ({
          id: c.id,
          leadId: c.leadId,
          type: c.type,
          details: c.details,
          outcome: c.outcome,
          loggedAt: c.loggedAt,
          loggedBy: c.loggedBy
        })),
        voiceNotes: voiceNotes.map(v => ({
          id: v.id,
          leadId: v.leadId,
          transcript: v.transcript || "",
          summary: v.summary || "",
          requirements: v.requirements || "",
          budget: v.budget || "",
          priority: v.priority || "",
          actionItems: v.actionItems || "",
          followUpDate: v.followUpDate || "",
          createdAt: v.createdAt
        })),
        documents: documents.map(d => ({
          id: d.id,
          leadId: d.leadId,
          name: d.name,
          category: d.category,
          uploadedAt: d.uploadedAt
        }))
      };

      const systemPrompt = `You are the flagship AI Sales Copilot & Assistant for the "Sales Companion CRM".
Your job is to answer business questions, parse customer database records, filter leads, perform customer intelligence summaries, find missed actions, and produce top-tier actionable sales material (WhatsApp drafts, emails, meeting briefs, etc.).

You have access to the complete, live CRM system state. You are looking at the data for all leads, tasks, reminders, documents, communications, and voice notes.
Today's date is: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} (${new Date().toISOString().substring(0, 10)}).

INSTRUCTIONS FOR RETURNING MATCHING IDs:
- Whenever the user asks a question that expects a specific set of matching leads (e.g. "which leads need follow-up today?", "show hot leads", "leads in Pune", "budget above ₹10 lakh"), you MUST inspect the CRM records, analyze them, and output their precise IDs in the "matchingLeadIds" field.
- Whenever the user asks to see tasks (e.g. "show overdue tasks", "list tasks due tomorrow"), output the matched task IDs in the "matchingTaskIds" field.
- If the user is asking a general question, the "matchingLeadIds" and "matchingTaskIds" arrays should be left empty.

INSTRUCTIONS FOR DRAFT GENERATION:
- If the user asks you to draft an email, WhatsApp message, meeting summary, or proposal, generate a professional sales copy in the "actionDraft" field, and provide a conversational overview in your main "answer".
- Match the customer details name, company, notes, industry, previous conversations, etc. to make it highly personalized!

CRM DOMAIN & FILTER CONTEXT HELPERS:
- "Hot leads" are defined as leads with status WON/QUALIFIED, or scores that look high priority, or voice notes that suggest high interest / priority.
- "Budget above ₹10 lakh" or "Budget above 15 lakh" - inspect lead notes, voice notes 'budget' field, requirements, or communication logs for any mentions of budgets like "10L", "₹10,00,000", "15 lakh", "12 lakh", etc.
- "Leads needing follow-up today" - active reminders scheduled for today, or pending tasks due today, or active follow-ups.
- "Not contacted recently" - leads without any logged communications or voice notes in the last 7 days, or status NEW with no logs.
- "Meetings happened this week" - communication logs where type is "Meeting" and loggedAt is within the last 7 days.

${activeLeadId ? `CRITICAL FOCUS: The user is currently viewing the lead with ID "${activeLeadId}". Answer queries with extra focus on this lead, but maintain general copilot capabilities if asked other queries.` : ""}

Be polite, helpful, extremely professional, and act as a peer sales strategist who helps close deals! Return the response strictly in JSON matching the requested schema.`;

      // Models retry list as pattern in other endpoints to guarantee stability
      const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
      let lastErr = null;
      
      for (const mName of models) {
        try {
          const gemini = getGeminiClient();
          console.log(`Copilot calling Gemini using model: ${mName}`);
          
          const contents: any[] = [];
          
          contents.push(`SYSTEM INSTRUCTION: ${systemPrompt}`);
          contents.push(`CRM LIVE STATE CONTEXT: ${JSON.stringify(serializedContext)}`);
          
          if (history && Array.isArray(history)) {
            for (const item of history) {
              contents.push(`${item.role === "user" ? "USER: " : "ASSISTANT: "}${item.text}`);
            }
          }
          
          contents.push(`CURRENT USER QUERY: ${message}`);
          
          const response = await gemini.models.generateContent({
            model: mName,
            contents,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  answer: { 
                    type: Type.STRING, 
                    description: "Conversational markdown text explaining results, answering details, or providing drafted materials. Use rich styles, bullet lists, checkpoints etc." 
                  },
                  suggestedPrompts: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }, 
                    description: "3 highly relevant contextual suggestion question prompts the user can click next." 
                  },
                  matchingLeadIds: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }, 
                    description: "Any Lead IDs that directly match the user search or filtering query. Empty if not a search or filter query." 
                  },
                  matchingTaskIds: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }, 
                    description: "Any Task IDs that are queried or filtered by the user. Empty if not a task query." 
                  },
                  actionDraft: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, description: "Type of the draft: 'Email' | 'WhatsApp' | 'MeetingPrep' | 'ProposalSummary'" },
                      subject: { type: Type.STRING, description: "Optional subject line if action is an Email" },
                      body: { type: Type.STRING, description: "The beautiful copy-pasteable draft body text based on CRM context." }
                    },
                    required: ["type", "body"]
                  }
                },
                required: ["answer", "suggestedPrompts"]
              }
            }
          });

          if (response && response.text) {
            const resultObj = JSON.parse(response.text);
            return res.json(resultObj);
          }
        } catch (err: any) {
          console.warn(`Model ${mName} failed in Copilot:`, err.message);
          lastErr = err;
        }
      }
      
      throw lastErr || new Error("All Gemini models failed to process query.");
    } catch (err: any) {
      console.error("Copilot backend exception:", err);
      res.status(500).json({ 
        error: "AI Copilot failed to generate a response. Please check your Gemini API key.",
        details: err?.message || ""
      });
    }
  });

  // Serve document uploads directory
  app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

  // --- VITE DEV / PRODUCTION MOUNTING ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OK] CRM active and running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
