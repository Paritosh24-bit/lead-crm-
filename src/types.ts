export type UserRole = "ADMIN" | "USER";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export interface LoggedInUser {
  email: string;
  name: string;
  role: UserRole;
  addedBy?: string;
}

export interface UserOption {
  email: string;
  name: string;
  role: UserRole;
  addedBy?: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  location: string;
  industry: string;
  status: LeadStatus;
  notes: string;
  owner: string; // User email, or "unassigned"
  createdAt: string;
  businessUnit?: string;
  temperature?: "HOT" | "WARM" | "COLD";
  createdBy?: string;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  success: boolean;
  senderEmail?: string;
  senderName?: string;
  payload: any;
  leadId?: string;
  message?: string;
}

export interface VoiceNote {
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

export interface Task {
  id: string;
  leadId: string;
  title: string;
  status: "Pending" | "Completed";
  dueDate: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  leadId: string;
  title: string;
  reminderDate: string; // e.g., "Monday" or concrete date string
  timing: "1 day before" | "On due date";
  status: "Pending" | "Sent";
  createdAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  activityType: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface LeadDocument {
  id: string;
  leadId: string;
  name: string;
  category: "Quotation" | "Purchase Order" | "Contract" | "Product Catalogue" | "Invoice" | "Other Attachment";
  fileUrl: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface CommunicationLog {
  id: string;
  leadId: string;
  type: "Call" | "Meeting" | "Note" | "Email" | "WhatsApp";
  details: string;
  outcome?: string;
  loggedAt: string;
  loggedBy: string;
}

export interface ChatMessage {
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

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  activeLeadId?: string;
}

export interface PoAssuredBusiness {
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

export interface WorkshopRecord {
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



