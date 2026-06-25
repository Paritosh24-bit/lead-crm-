import React, { useState, useEffect } from "react";
import { Lead, LeadStatus, LoggedInUser, UserOption } from "../types";
import { api } from "../lib/api";
import { Save, X, PlusCircle, PenTool, Clipboard, AlertTriangle } from "lucide-react";

interface LeadFormViewProps {
  user: LoggedInUser;
  editingLead?: Lead | null;
  onSaved: () => void;
  onCancel: () => void;
  defaultOwnerEmail?: string;
}

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string; bg: string; text: string }[] = [
  { value: "NEW", label: "New Lead", bg: "bg-blue-100/80", text: "text-blue-800" },
  { value: "CONTACTED", label: "Contacted", bg: "bg-cyan-100", text: "text-cyan-800" },
  { value: "QUALIFIED", label: "Qualified", bg: "bg-amber-100", text: "text-amber-800" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent", bg: "bg-indigo-100", text: "text-indigo-850" },
  { value: "NEGOTIATION", label: "Negotiation", bg: "bg-purple-100", text: "text-purple-800" },
  { value: "WON", label: "Closed / Won 🎉", bg: "bg-emerald-150 text-emerald-800", text: "text-emerald-900" },
  { value: "LOST", label: "Closed / Lost 😞", bg: "bg-rose-100", text: "text-rose-800" },
];

export default function LeadFormView({ user, editingLead, onSaved, onCancel, defaultOwnerEmail }: LeadFormViewProps) {
  const isEditMode = !!editingLead;

  // Form State
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState<LeadStatus>("NEW");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("unassigned");
  const [businessUnit, setBusinessUnit] = useState("A consultancy");
  const [temperature, setTemperature] = useState<"HOT" | "WARM" | "COLD">("WARM");

  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize form with existing values or defaults
  useEffect(() => {
    if (editingLead) {
      setName(editingLead.name || "");
      setCompany(editingLead.company || "");
      setPhone(editingLead.phone || "");
      setEmail(editingLead.email || "");
      setLocation(editingLead.location || "");
      setIndustry(editingLead.industry || "");
      setStatus(editingLead.status || "NEW");
      setNotes(editingLead.notes || "");
      setOwner(editingLead.owner || "unassigned");
      setBusinessUnit(editingLead.businessUnit || "A consultancy");
      setTemperature(editingLead.temperature || "WARM");
    } else {
      setName("");
      setCompany("");
      setPhone("");
      setEmail("");
      setLocation("");
      setIndustry("");
      setStatus("NEW");
      setNotes("");
      setOwner(defaultOwnerEmail || user.email); // Auto-assign to preselected or creator admin by default
      setBusinessUnit("A consultancy");
      setTemperature("WARM");
    }
  }, [editingLead, user, defaultOwnerEmail]);

  // Fetch registered administrators/users for assignee dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersList = await api.getUsers();
        setAvailableUsers(usersList);
      } catch (err: any) {
        console.error("Failed to load user assignments", err);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) {
      setError("Lead Name and Company Name are required fields.");
      return;
    }

    setError(null);
    setSaving(true);

    const dataPayload: Partial<Lead> = {
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      email: email.trim(),
      location: location.trim(),
      industry: industry.trim(),
      status,
      notes: notes.trim(),
      owner: owner, // All admins can configure ownership allocations
      businessUnit,
      temperature,
    };

    try {
      if (isEditMode && editingLead) {
        await api.updateLead(editingLead.id, dataPayload);
      } else {
        await api.createLead(dataPayload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to finalize lead details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-1 py-2 sm:px-2">
      {/* Header card with responsive actions */}
      <div className="mb-5 flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
            {isEditMode ? (
              <>
                <PenTool className="h-5 w-5 text-indigo-600 shrink-0" />
                Edit Lead Specifications
              </>
            ) : (
              <>
                <PlusCircle className="h-5 w-5 text-indigo-600 shrink-0" />
                Register Fresh Lead
              </>
            )}
          </h2>
          <p className="text-[11px] text-slate-500 mt-1">
            {isEditMode
              ? `Update details and assignment specifications for Lead ID: ${editingLead?.id}`
              : "Register business demographics, status signals, and account owners."}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            <strong>Validation Block:</strong> {error}
          </div>
        </div>
      )}

      {/* Form Details Grid */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section: Demographics */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-105 bg-slate-50/80 px-4 py-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Clipboard className="h-3.5 w-3.5 text-indigo-500" /> Executive Demographics
            </span>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Lead Name <span className="text-red-500">*</span>
              </label>
              <input
                id="form-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Robert Downey Jr."
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="form-company"
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stark Industries"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Phone Number
              </label>
              <input
                id="form-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 (555) 012-3456"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Email Address
              </label>
              <input
                id="form-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. partner@stark.com"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Corporate Location
              </label>
              <input
                id="form-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Los Angeles, CA"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Business Segment / Industry
              </label>
              <input
                id="form-industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Advanced Manufacturing, Defense"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section: Operational Assignment */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-105 bg-slate-50/80 px-4 py-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5 text-indigo-500" /> Pipeline Status & Assignment
            </span>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Pipeline Stage
              </label>
              <select
                id="form-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {LEAD_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Assigned Lead Owner (Administrator)
              </label>
              <select
                id="form-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="unassigned">Unassigned (Open Pool)</option>
                {availableUsers.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Business Unit Category <span className="text-red-500">*</span>
              </label>
              <select
                id="form-business-unit"
                value={businessUnit}
                onChange={(e) => setBusinessUnit(e.target.value)}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="A consultancy">a. A consultancy</option>
                <option value="Market Hammer">b. Market Hammer</option>
                <option value="SyncAI">c. SyncAI</option>
                <option value="Workshops">d. Workshops</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Response Interest / Temperature
              </label>
              <select
                id="form-temperature"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value as "HOT" | "WARM" | "COLD")}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="HOT">🔥 Hot Prospect</option>
                <option value="WARM">⚡ Warm Prospect</option>
                <option value="COLD">❄️ Cold Prospect</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Log Notes & Conversation History
              </label>
              <textarea
                id="form-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log business metrics, background requests, and call summary dates..."
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer min-h-[44px]"
          >
            Cancel
          </button>
          <button
            id="btn-lead-save"
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow hover:bg-indigo-700 transition focus:outline-none disabled:bg-indigo-400 cursor-pointer min-h-[44px]"
          >
            <Save className="h-4 w-4 shrink-0" />
            {saving ? "Saving Changes..." : isEditMode ? "Save Changes" : "Register Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}

export { LEAD_STATUS_OPTIONS };
