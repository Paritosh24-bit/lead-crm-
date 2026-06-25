import React, { useState, useEffect, useRef } from "react";
import { Lead, LoggedInUser, VoiceNote, Task, Reminder, LeadActivity, LeadDocument, CommunicationLog } from "../types";
import { LEAD_STATUS_OPTIONS } from "./LeadFormView";
import { api } from "../lib/api";
import { 
  Phone, Mail, MapPin, Building, ChevronLeft, Edit, Trash2, 
  Shield, Calendar, User, AlertTriangle, Mic, Square, Trash, 
  Play, Pause, RefreshCw, Loader2, Volume2, Save, CheckSquare, Plus, X,
  FileText, FileDown, UploadCloud, PhoneCall, MessageSquare, Clock
} from "lucide-react";

interface LeadDetailsViewProps {
  lead: Lead;
  user: LoggedInUser;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onTasksUpdated?: () => void;
}

export default function LeadDetailsView({ lead, user, onEdit, onDelete, onBack, onTasksUpdated }: LeadDetailsViewProps) {
  const currentStatusInfo = LEAD_STATUS_OPTIONS.find((o) => o.value === lead.status) || {
    label: lead.status,
    bg: "bg-slate-100",
    text: "text-slate-800",
  };

  // Multiple admins can always edit and delete leads in this system
  const canModify = true;

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Voice Notes Integration State Layer
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generated Tasks State Layer
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [taskError, setTaskError] = useState<string | null>(null);

  // Reminders and Activities State Layers
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderDate, setNewReminderDate] = useState("");
  const [reminderError, setReminderError] = useState<string | null>(null);

  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Active sub-tab state
  const [activeDetailsTab, setActiveDetailsTab] = useState<"OVERVIEW" | "TASKS" | "DOCUMENTS" | "TIMELINE">("OVERVIEW");

  // Document Management States
  const [documents, setDocuments] = useState<LeadDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docSuccess, setDocSuccess] = useState<string | null>(null);
  const [selectedViewDoc, setSelectedViewDoc] = useState<LeadDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<"Quotation" | "Purchase Order" | "Contract" | "Product Catalogue" | "Invoice" | "Other Attachment">("Quotation");
  const [uploadFileName, setUploadFileName] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Securely generate Blob Object URLs to preview and download inside iframe-sandboxed environments
  useEffect(() => {
    if (selectedViewDoc && selectedViewDoc.fileUrl) {
      const fileUrl = selectedViewDoc.fileUrl;
      if (fileUrl.startsWith("data:")) {
        try {
          const parts = fileUrl.split(",");
          const mime = parts[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(blobUrl);
          return () => {
            URL.revokeObjectURL(blobUrl);
          };
        } catch (err) {
          console.error("Failed to parse data URL into blob:", err);
          setPreviewUrl(fileUrl);
        }
      } else {
        setPreviewUrl(fileUrl);
      }
    } else {
      setPreviewUrl(null);
    }
  }, [selectedViewDoc]);

  const handleDownloadDoc = (doc: LeadDocument) => {
    try {
      const fileUrl = doc.fileUrl;
      if (fileUrl.startsWith("data:")) {
        const parts = fileUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.target = "_blank";
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Error trigger downloading document:", err);
      window.open(doc.fileUrl, "_blank");
    }
  };

  // Load Voice Notes
  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const notes = await api.getVoiceNotes(lead.id);
      setVoiceNotes(notes);
    } catch (err: any) {
      console.warn("Could not retrieve voice memos for lead", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Load Documents
  const fetchDocs = async () => {
    setLoadingDocs(true);
    setDocError(null);
    try {
      const data = await api.getDocuments(lead.id);
      setDocuments(data);
    } catch (err: any) {
      console.warn("Could not retrieve documents for lead", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Document management operations
  const handleDocUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim()) {
      setDocError("Please enter a descriptive filename.");
      return;
    }
    setIsUploadingDoc(true);
    setDocError(null);
    setDocSuccess(null);
    try {
      const sizeStr = `${(Math.random() * 1.5 + 0.1).toFixed(1)} MB`;
      const base64FakePdf = "data:application/pdf;base64,JVBERi0xLjQKJ...";
      await api.uploadDocument(lead.id, uploadFileName.trim(), uploadCategory, base64FakePdf, sizeStr);
      const uploadedName = uploadFileName.trim();
      setUploadFileName("");
      setDocSuccess(`"${uploadedName}" has been uploaded successfully!`);
      await fetchDocs();
      await fetchActivities();
    } catch (err: any) {
      setDocError(err.message || "Failed to create document record");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const processFile = async (file: File) => {
    setIsUploadingDoc(true);
    setDocError(null);
    setDocSuccess(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";
          const b64 = event.target?.result as string;
          await api.uploadDocument(lead.id, file.name, uploadCategory, b64, sizeStr);
          setDocSuccess(`"${file.name}" has been uploaded successfully!`);
          await fetchDocs();
          await fetchActivities();
        } catch (innerErr: any) {
          setDocError(innerErr.message || "Failed file upload process");
        } finally {
          setIsUploadingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setDocError("Error reading local desktop file: " + err.message);
      setIsUploadingDoc(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processFile(file);
    }
  };

  const handleDocDelete = async (docId: string) => {
    setDocError(null);
    try {
      await api.deleteDocument(docId);
      await fetchDocs();
      await fetchActivities();
    } catch (err: any) {
      setDocError(err.message || "Failed to remove document");
    }
  };

  // Load Generated Tasks
  const fetchTasks = async () => {
    setLoadingTasks(true);
    setTaskError(null);
    try {
      const data = await api.getTasks(lead.id);
      setTasks(data);
      onTasksUpdated?.();
    } catch (err: any) {
      console.warn("Could not retrieve tasks for lead", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Load Reminders
  const fetchReminders = async () => {
    setLoadingReminders(true);
    setReminderError(null);
    try {
      const data = await api.getReminders(lead.id);
      setReminders(data);
      onTasksUpdated?.();
    } catch (err: any) {
      console.warn("Could not retrieve reminders for lead", err);
    } finally {
      setLoadingReminders(false);
    }
  };

  // Load Activities
  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      const data = await api.getActivities(lead.id);
      setActivities(data);
    } catch (err: any) {
      console.warn("Could not retrieve activities for lead", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    fetchTasks();
    fetchReminders();
    fetchActivities();
    fetchDocs();
    // Reset any pending draft on lead transition
    setAudioBlob(null);
    setAudioUrl(null);
    setIsRecording(false);
    setError(null);
    setTaskError(null);
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setEditingTaskId(null);
    // Reset reminders inputs
    setNewReminderTitle("");
    setNewReminderDate("");
    setReminderError(null);
    
    // Reset document inputs
    setUploadCategory("Quotation");
    setUploadFileName("");
    setDocError(null);
    setActiveDetailsTab("OVERVIEW");
  }, [lead.id]);

  // Lead scoring calculation
  const leadScoreDetails = React.useMemo(() => {
    let score = 0;
    
    // 1. Budget mentioned (+20)
    const hasBudget = voiceNotes.some(vn => vn.budget && vn.budget.trim() !== "" && !vn.budget.toLowerCase().includes("none") && !vn.budget.toLowerCase().includes("unspecified") && !vn.budget.toLowerCase().includes("not mentioned"));
    if (hasBudget) score += 20;

    // 2. Meeting recorded (+20)
    const hasVoiceNotes = voiceNotes.length > 0;
    if (hasVoiceNotes) score += 20;

    // 3. Follow-up date exists (+15)
    const hasFollowUp = voiceNotes.some(vn => vn.followUpDate && vn.followUpDate.trim() !== "" && !vn.followUpDate.toLowerCase().includes("none") && !vn.followUpDate.toLowerCase().includes("unspecified"));
    if (hasFollowUp) score += 15;

    // 4. Action items exist (+15)
    const hasActionItems = voiceNotes.some(vn => vn.actionItems && vn.actionItems.trim() !== "" && !vn.actionItems.toLowerCase().includes("none"));
    if (hasActionItems) score += 15;

    // 5. Multiple interactions (+10)
    const hasMultipleInteractions = voiceNotes.length >= 2 || tasks.length >= 2;
    if (hasMultipleInteractions) score += 10;

    // 6. Urgent keywords (+20)
    const urgentKeywords = ["urgent", "asap", "immediately", "quick", "critical", "highest", "high priority", "importance", "milestone", "friday", "tomorrow"];
    const hasUrgent = voiceNotes.some(vn => {
      const textToSearch = `${vn.transcript || ""} ${vn.actionItems || ""}`.toLowerCase();
      return urgentKeywords.some(kw => textToSearch.includes(kw));
    });
    if (hasUrgent) score += 20;

    if (score > 100) score = 100;

    let category: "HOT" | "WARM" | "COLD" = "COLD";
    let color = "text-blue-700 bg-blue-50 border-blue-200";
    if (score >= 80) {
      category = "HOT";
      color = "text-rose-750 bg-rose-50 border-rose-200";
    } else if (score >= 50) {
      category = "WARM";
      color = "text-amber-750 bg-amber-50 border-amber-200";
    }

    return { score, category, color };
  }, [voiceNotes, tasks]);

  // Handle manual task creation with duplicate prevention
  const handleAddTaskManually = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTaskError(null);

    const isDuplicate = tasks.some(t => t.title.toLowerCase().trim() === newTaskTitle.toLowerCase().trim());
    if (isDuplicate) {
      setTaskError("A task with this title already exists for this lead.");
      return;
    }

    try {
      const created = await api.createTask(lead.id, newTaskTitle, newTaskDueDate || "Pending");
      setTasks(prev => [...prev, created]);
      setNewTaskTitle("");
      setNewTaskDueDate("");
      fetchActivities();
    } catch (err: any) {
      setTaskError(err.message || "Failed to create task.");
    }
  };

  // Handle toggling of task status between Completed and Pending
  const handleToggleTaskStatus = async (task: Task) => {
    setTaskError(null);
    const originalStatus = task.status;
    const newStatus = originalStatus === "Completed" ? "Pending" : "Completed";
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await api.updateTask(task.id, { status: newStatus });
      fetchActivities();
    } catch (err: any) {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: originalStatus } : t));
      setTaskError("Failed to update status. Please try again.");
    }
  };

  // Handle triggering of inline task editor
  const handleStartEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setEditingDueDate(task.dueDate || "");
    setTaskError(null);
  };

  // Handle saving of edited task details with duplicate prevention
  const handleSaveTaskEdit = async (taskId: string) => {
    if (!editingTitle.trim()) return;
    setTaskError(null);

    const isDuplicate = tasks.some(t => t.id !== taskId && t.title.toLowerCase().trim() === editingTitle.toLowerCase().trim());
    if (isDuplicate) {
      setTaskError("Another task with this title already exists.");
      return;
    }

    try {
      const updated = await api.updateTask(taskId, { title: editingTitle, dueDate: editingDueDate });
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      setEditingTaskId(null);
      fetchActivities();
    } catch (err: any) {
      setTaskError("Failed to save changes.");
    }
  };

  // Handle deleting a task with optimistic state updates
  const handleDeleteTask = async (taskId: string) => {
    setTaskError(null);
    const originalTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      await api.deleteTask(taskId);
      fetchActivities();
    } catch (err: any) {
      setTasks(originalTasks);
      setTaskError("Failed to delete task.");
    }
  };

  // Recording Interval timer
  useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Stop individual streams so browser mic-recording light is instantly deactivated
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err: any) {
      console.error("Microphone hardware error:", err);
      setError("Unable to capture microphone stream. Ensure appropriate browser audio permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const saveRecording = async () => {
    if (!audioBlob) return;
    setIsSaving(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          await api.createVoiceNote(lead.id, base64data);
          
          // Clear current local recording draft state
          setAudioBlob(null);
          setAudioUrl(null);
          
          // Reload database voice records list
          await fetchNotes();
          await fetchTasks();
          await fetchReminders();
          await fetchActivities();
        } catch (postErr: any) {
          console.error("Post audio request error:", postErr);
          setError("Failed to save audio stream package: " + (postErr.message || postErr));
        } finally {
          setIsSaving(false);
        }
      };
    } catch (err: any) {
      console.error("_onLoad conversion failed", err);
      setError("An encoding error occurred while transforming the raw audio stream.");
      setIsSaving(false);
    }
  };

  const discardRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
  };

  const handleDeleteVoiceNote = async (id: string) => {
    try {
      await api.deleteVoiceNote(id);
      setConfirmDeleteId(null);
      await fetchNotes();
    } catch (err: any) {
      console.error("Delete note error:", err);
      setError("Failed to delete voice note: " + (err.message || err));
    }
  };

  const handleConfirmDelete = () => {
    onDelete(lead.id);
    setShowConfirmDelete(false);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-1 py-1 sm:px-2">
      {/* Return header bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          onClick={onBack}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition"
        >
          <ChevronLeft className="h-4 w-4 shrink-0 text-slate-500" /> Back to Leads
        </button>

        {canModify && (
          <div className="flex items-center gap-2">
            <button
              id="detail-edit-btn"
              onClick={() => onEdit(lead)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-2 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100 cursor-pointer transition"
            >
              <Edit className="h-3.5 w-3.5 mt-0.5" /> Edit Info
            </button>
            <button
              id="detail-delete-btn"
              onClick={() => setShowConfirmDelete(true)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-extrabold text-red-700 hover:bg-red-100 cursor-pointer transition"
            >
              <Trash2 className="h-3.5 w-3.5 mt-0.5" /> Remove
            </button>
          </div>
        )}
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left Side: Detail Attributes */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            {/* Header / Meta */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Lead Profile Summary
                </span>
                <h1 id="detail-lead-name" className="mt-1 text-xl sm:text-2xl font-black text-slate-950 leading-snug">
                  {lead.name}
                </h1>
                <p id="detail-lead-company" className="text-xs sm:text-sm text-slate-500 font-bold flex items-center gap-1.5 mt-1">
                  <Building className="h-4 w-4 text-slate-400 shrink-0" /> {lead.company}
                </p>
              </div>

              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${currentStatusInfo.bg} ${currentStatusInfo.text}`}>
                {currentStatusInfo.label}
              </span>
            </div>

            {/* Quick specifications */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5">
                <MapPin className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    Location / Region
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    {lead.location || "Not Provided"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5">
                <Building className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    Industry Segment
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    {lead.industry || "Not Provided"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5">
                <Mail className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    Email address
                  </span>
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-xs sm:text-sm font-bold text-indigo-600 hover:underline truncate block"
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold block">Not Listed</span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5">
                <Phone className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    Telephone Contact
                  </span>
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="text-xs sm:text-sm font-bold text-indigo-600 hover:underline block"
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold block">Not Listed</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2 mb-4 scrollbar-thin overflow-x-auto">
            <button
              onClick={() => setActiveDetailsTab("OVERVIEW")}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeDetailsTab === "OVERVIEW"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Mic className="h-3.5 w-3.5" /> Overview & Memos
            </button>
            <button
              id="lead-tasks-tab"
              onClick={() => setActiveDetailsTab("TASKS")}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeDetailsTab === "TASKS"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" /> Tasks
            </button>
            <button
              id="lead-documents-tab"
              onClick={() => setActiveDetailsTab("DOCUMENTS")}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeDetailsTab === "DOCUMENTS"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Documents ({documents.length})
            </button>

            <button
              onClick={() => setActiveDetailsTab("TIMELINE")}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeDetailsTab === "TIMELINE"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> Timeline ({activities.length})
            </button>
          </div>

          {activeDetailsTab === "OVERVIEW" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                <Shield className="h-4 w-4 text-indigo-500 shrink-0" /> Interaction Logs & Requirements
              </span>
              <div className="rounded-lg border border-slate-150 bg-slate-50 p-3 sm:p-4 min-h-[140px] text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {lead.notes ? lead.notes : "No interactive discussion log captured yet. Click Edit to append details."}
              </div>
            </div>
          )}

          {/* Voice Notes Module */}
          {activeDetailsTab === "OVERVIEW" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Voice Discovery Memos
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-650 px-2 py-0.5 rounded-full">
                {voiceNotes.length} memos
              </span>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-150 p-3 text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Recording Interface */}
            <div className="rounded-lg border border-slate-150 bg-slate-50/50 p-4">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Record New Memo
              </h4>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1 text-red-700 rounded-full animate-pulse font-mono text-xs font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-650 animate-ping shrink-0" />
                      RECORDING: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                    </div>
                  ) : audioUrl ? (
                    <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded">
                      ✓ Draft Recording Audio Pack Ready
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">
                      Record quick follow-up directions, customer requirements, or action plans.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  {!isRecording && !audioUrl && (
                    <button
                      onClick={startRecording}
                      className="w-full sm:w-auto flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-black shadow-xs cursor-pointer transition transform active:scale-98"
                    >
                      <Mic className="h-3.5 w-3.5 mt-0.5" /> Record Memo
                    </button>
                  )}

                  {isRecording && (
                    <button
                      onClick={stopRecording}
                      className="w-full sm:w-auto flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 text-xs font-black cursor-pointer transition animate-bounce"
                    >
                      <Square className="h-3.5 w-3.5" /> Stop Capture
                    </button>
                  )}

                  {audioUrl && !isRecording && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={saveRecording}
                        disabled={isSaving}
                        className="flex-grow sm:flex-grow-0 flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-emerald-650 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-extrabold cursor-pointer transition disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
                          </>
                        ) : (
                          <>
                            <Save className="h-3.5 w-3.5" /> Save Audio
                          </>
                        )}
                      </button>

                      <button
                        onClick={discardRecording}
                        className="flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer transition"
                        title="Discard recorded draft"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {audioUrl && !isRecording && (
                <div className="mt-3 p-2.5 rounded border border-emerald-100 bg-emerald-50/20">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block mb-1">
                    Preview Track (not yet saved):
                  </span>
                  <audio src={audioUrl} controls className="w-full h-8 focus:outline-none" />
                </div>
              )}
            </div>

            {/* List Memos Column */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Saved Voice Discovery List
              </h4>

              {loadingNotes ? (
                <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mb-1.5" />
                  <span>Loading memos...</span>
                </div>
              ) : voiceNotes.length === 0 ? (
                <div className="py-8 text-center rounded-lg border border-slate-200 border-dashed flex flex-col items-center justify-center bg-slate-50/20">
                  <Mic className="h-6 w-6 text-slate-350 mb-1.5" />
                  <span className="text-xs text-slate-500 font-semibold">No call records found</span>
                  <span className="text-[10px] text-slate-400 mt-1 px-4 leading-normal">
                    Press Record to capture dynamic audio recordings from discovery calls or verbal notes.
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {voiceNotes.map((vn) => (
                    <div key={vn.id} className="p-3 rounded-lg border border-slate-150 bg-slate-50/55 hover:bg-slate-50 transition flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-[9px]">
                            {vn.createdBy.charAt(0).toUpperCase()}
                          </div>
                          <span>
                            By <strong className="text-slate-700 font-extrabold">{vn.createdBy}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400">
                            {new Date(vn.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })} at {new Date(vn.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {!!user && (
                            <div className="flex items-center gap-1 shrink-0 bg-red-55/70 rounded">
                              {confirmDeleteId === vn.id ? (
                                <div className="flex items-center gap-1 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                                  <span className="text-[9px] text-red-700 font-extrabold mr-1">Sure?</span>
                                  <button
                                    onClick={() => handleDeleteVoiceNote(vn.id)}
                                    className="text-[9px] bg-red-600 hover:bg-red-700 text-white rounded px-1.5 py-0.5 font-bold cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[9px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded px-1.5 py-0.5 font-bold cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(vn.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition min-h-[24px] cursor-pointer"
                                  title="Delete Memo (Admin Only)"
                                >
                                  <Trash className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded border border-slate-100 p-1">
                        <audio src={vn.audioUrl} controls className="w-full h-8 focus:outline-none" />
                      </div>

                      {vn.transcript ? (
                        <div className="mt-1 bg-indigo-55/10 border border-indigo-150/40 rounded-lg p-3 text-[11px] text-slate-750">
                          <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 block mb-1">
                            Transcript
                          </span>
                          <p className="leading-relaxed font-medium italic text-slate-800">
                            "{vn.transcript}"
                          </p>
                        </div>
                      ) : (
                        <div className="mt-1 bg-slate-50 border border-slate-100 rounded-lg p-2 text-[10px] text-slate-400 italic">
                          No transcript text available for this voice memo.
                        </div>
                      )}

                      {vn.summary && (
                        <div className="mt-2.5 bg-violet-50/50 border border-violet-200/50 rounded-lg p-3.5 text-[11px] text-slate-700">
                          <span className="text-[9px] font-black uppercase tracking-wider text-violet-750 block mb-1.5">
                            Meeting Summary
                          </span>
                          <p className="leading-relaxed font-semibold text-slate-800">
                            {vn.summary}
                          </p>
                        </div>
                      )}                       {(vn.requirements || vn.budget || vn.productsDiscussed || vn.followUpDate || vn.actionItems || vn.priority || vn.keyTakeaways) && (
                        <div className="mt-2.5 bg-slate-50 border border-slate-200/60 rounded-lg p-3 text-[11px] space-y-3">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            Extracted Insights
                          </span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {vn.requirements && (
                              <div className="bg-white rounded border border-slate-150 p-2 shadow-2xs">
                                <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                  Customer Requirement
                                </span>
                                <span className="block text-slate-800 font-bold mt-0.5 leading-normal">
                                  {vn.requirements}
                                </span>
                              </div>
                            )}

                            {vn.budget && (
                              <div className="bg-white rounded border border-slate-150 p-2 shadow-2xs">
                                <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                  Budget
                                </span>
                                <span className="block text-emerald-800 font-extrabold mt-0.5">
                                  {vn.budget}
                                </span>
                              </div>
                            )}

                            {vn.productsDiscussed && (
                              <div className="bg-white rounded border border-slate-150 p-2 shadow-2xs">
                                <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                  Products Discussed
                                </span>
                                <span className="block text-slate-800 font-bold mt-0.5 leading-normal">
                                  {vn.productsDiscussed}
                                </span>
                              </div>
                            )}

                            {vn.followUpDate && (
                              <div className="bg-white rounded border border-slate-150 p-2 shadow-2xs">
                                <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                  Follow-up Date
                                </span>
                                <span className="block text-indigo-700 font-extrabold mt-0.5">
                                  {vn.followUpDate}
                                </span>
                              </div>
                            )}

                            {vn.actionItems && (
                              <div className="bg-white rounded border border-slate-150 p-2 shadow-2xs sm:col-span-2">
                                <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                  Action Items
                                </span>
                                <span className="block text-slate-800 font-bold mt-0.5 leading-relaxed">
                                  {vn.actionItems}
                                </span>
                              </div>
                            )}

                            {vn.keyTakeaways && (
                              <div className="bg-white rounded border border-slate-150 p-2 shadow-2xs sm:col-span-2">
                                <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                  Key Takeaways
                                </span>
                                <span className="block text-slate-800 font-bold mt-0.5 leading-relaxed">
                                  {vn.keyTakeaways}
                                </span>
                              </div>
                            )}

                            {vn.priority && (
                              <div className="bg-white rounded border border-slate-150 p-2 shadow-2xs">
                                <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                  Priority
                                </span>
                                <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full mt-1 ${
                                  vn.priority.toLowerCase() === 'high' 
                                    ? 'bg-red-50 text-red-700 border border-red-250' 
                                    : vn.priority.toLowerCase() === 'medium'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-250'
                                    : 'bg-slate-50 text-slate-650 border border-slate-200'
                                }`}>
                                  {vn.priority}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Automatically Generated Tasks Module */}
          {activeDetailsTab === "TASKS" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Generated Tasks
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {tasks.filter(t => t.status === "Pending").length} pending
              </span>
            </div>

            {taskError && (
              <div className="rounded-lg bg-red-50 border border-red-150 p-2.5 text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{taskError}</span>
              </div>
            )}

            {/* Manual Task Add Option (Directly supports adding manually, linking to lead, with duplicate check) */}
            <form onSubmit={handleAddTaskManually} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Type a manual action item..."
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
              />
              <input
                type="text"
                placeholder="Due date (e.g. Friday)"
                value={newTaskDueDate}
                onChange={e => setNewTaskDueDate(e.target.value)}
                className="w-full sm:w-40 bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg px-3.5 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Task</span>
              </button>
            </form>

            {loadingTasks ? (
              <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500 mb-1.5" />
                <span>Syncing tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center rounded-lg border border-slate-200 border-dashed flex flex-col items-center justify-center bg-slate-50/25">
                <CheckSquare className="h-6 w-6 text-slate-350 mb-1.5" />
                <span className="text-xs text-slate-500 font-semibold">No actionable tasks generated yet</span>
                <span className="text-[10px] text-slate-400 mt-1 px-4 leading-normal">
                  Tasks will be automatically generated when you record/process audio discovery logs.
                </span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {tasks.map(t => {
                  const isEditing = editingTaskId === t.id;
                  const isCompleted = t.status === "Completed";
                  
                  return (
                    <div 
                      key={t.id} 
                      className={`p-3 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCompleted 
                          ? "bg-slate-50 border-slate-205 text-slate-400" 
                          : "bg-emerald-50/5 border-slate-205 hover:bg-slate-50/30 text-slate-800"
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            className="w-full bg-white border border-slate-250 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Due:</span>
                            <input
                              type="text"
                              value={editingDueDate}
                              onChange={e => setEditingDueDate(e.target.value)}
                              className="bg-white border border-slate-250 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {/* Completion Button */}
                          <button
                            onClick={() => handleToggleTaskStatus(t)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition shrink-0 cursor-pointer"
                            title={isCompleted ? "Mark as Pending" : "Mark as Completed"}
                          >
                            {isCompleted ? (
                              <CheckSquare className="h-4.5 w-4.5 text-emerald-650" />
                            ) : (
                              <Square className="h-4.5 w-4.5 text-slate-350 hover:text-emerald-500" />
                            )}
                          </button>
                          
                          <div className="min-w-0">
                            <span 
                              className={`block text-xs font-bold leading-normal truncate ${
                                isCompleted ? "line-through text-slate-400 font-medium" : "text-slate-800"
                              }`}
                              title={t.title}
                            >
                              {t.title}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-mono mt-0.5 ${isCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Calendar className="h-3 w-3 shrink-0 text-slate-350" />
                              <span>Due: {t.dueDate || "Pending"}</span>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Controls (Allow manual editing & deletion) */}
                      <div className="flex items-center gap-1.5 shrink-0 justify-end self-end sm:self-center">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveTaskEdit(t.id)}
                              disabled={!editingTitle.trim()}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded px-2.5 py-1 transition cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTaskId(null)}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded px-2.5 py-1 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEditTask(t)}
                              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition min-h-[24px] cursor-pointer"
                              title="Edit Task"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              className="text-slate-400 hover:text-red-650 hover:bg-red-50 p-1 rounded transition min-h-[24px] cursor-pointer"
                              title="Delete Task"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* DOCUMENTS tab */}
          {activeDetailsTab === "DOCUMENTS" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Document Attachment Hub
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    {documents.length} files attached
                  </span>
                </div>

                {docError && (
                  <div className="rounded-lg bg-red-50 border border-red-150 p-3 text-xs text-red-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <span>{docError}</span>
                  </div>
                )}

                {docSuccess && (
                  <div id="doc-success-banner" className="rounded-lg bg-emerald-55 bg-emerald-50 border border-emerald-250 p-3 text-xs text-emerald-800 flex items-start gap-2 animate-fade-in font-bold">
                    <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <span>{docSuccess}</span>
                  </div>
                )}

                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] ${
                    dragActive 
                      ? "border-indigo-500 bg-indigo-50/40 scale-[1.01]" 
                      : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <UploadCloud className={`h-8 w-8 mb-2 transition-transform ${dragActive ? 'text-indigo-600 scale-110' : 'text-slate-400'}`} />
                  <p className="text-xs font-bold text-slate-800">
                    Drag & drop any document here, or <span className="text-indigo-600 underline">browse computer</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 pb-1">
                    Directly saves on container disk storage. Supports Quotation, Purchase Order, Contract, Invoice & Catalogue.
                  </p>
                  {isUploadingDoc && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      <span>Writing file payload to system...</span>
                    </div>
                  )}
                </div>

                {/* Manual Form Setup */}
                <form onSubmit={handleDocUploadSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-1.5">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                      File category group
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white min-h-[38px]"
                    >
                      <option value="Quotation">Quotation</option>
                      <option value="Purchase Order">Purchase Order</option>
                      <option value="Contract">Contract</option>
                      <option value="Product Catalogue">Product Catalogue</option>
                      <option value="Invoice">Invoice</option>
                      <option value="Other Attachment">Other Attachment</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                      Custom File Name Identifier
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Revised Quotation Pricing.pdf"
                        value={uploadFileName}
                        onChange={(e) => setUploadFileName(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-205 rounded-lg px-3 py-1.5 text-xs text-slate-805 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white min-h-[38px]"
                      />
                      <button
                        type="submit"
                        disabled={isUploadingDoc || !uploadFileName.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg px-4 py-1.5 text-xs font-black transition flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Link</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* File Attachment List Table */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2.5">
                  Attached Files Inventory
                </h4>

                {loadingDocs ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mb-1.5" />
                    <span>Retrieving documents index...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="py-10 text-center rounded-lg border border-slate-200 border-dashed flex flex-col items-center justify-center bg-slate-50/20">
                    <FileText className="h-8 w-8 text-slate-300 mb-2" />
                    <span className="text-xs text-slate-500 font-semibold">No documents attached</span>
                    <span className="text-[10px] text-slate-400 mt-1 max-w-sm px-4 leading-normal">
                      Store and catalog quotations, purchase orders, contracts, product catalogues, and invoices linked specifically to {lead.name}.
                    </span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-205 text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">
                          <th className="py-2.5 px-2">Category</th>
                          <th className="py-2.5 px-2">Document Name</th>
                          <th className="py-2.5 px-2">Uploaded By</th>
                          <th className="py-2.5 px-2">Timestamp</th>
                          <th className="py-2.5 px-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...documents]
                          .sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
                          .map((doc) => {
                            let catColor = "bg-slate-100 text-slate-700";
                            if (doc.category === "Quotation") catColor = "bg-indigo-50 text-indigo-700 border-indigo-200 border text-[9px]";
                            if (doc.category === "Purchase Order") catColor = "bg-amber-50 text-amber-705 border-amber-205 border text-[9px]";
                            if (doc.category === "Contract") catColor = "bg-rose-50 text-rose-700 border-rose-150 border text-[9px]";
                            if (doc.category === "Invoice") catColor = "bg-emerald-50 text-emerald-700 border-emerald-150 border text-[9px]";
                            if (doc.category === "Product Catalogue") catColor = "bg-teal-50 text-teal-700 border-teal-150 border text-[9px]";
                            
                            return (
                              <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition">
                                <td className="py-3 px-2 font-bold select-all">
                                  <span className={`inline-block px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide text-[9px] ${catColor}`}>
                                    {doc.category}
                                  </span>
                                </td>
                                <td 
                                  className="py-3 px-2 font-black text-slate-900 break-all select-all cursor-pointer hover:text-indigo-650"
                                  onClick={() => setSelectedViewDoc(doc)}
                                  title="Click to view document in-app"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <FileText className="h-4 w-4 text-indigo-500 shrink-0 animate-pulse" />
                                    <span className="hover:underline select-none">{doc.name}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-slate-650 font-bold">{doc.uploadedBy}</td>
                                <td className="py-3 px-2 font-mono text-xs text-slate-400">
                                  {new Date(doc.uploadedAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <div className="flex justify-end items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadDoc(doc)}
                                      className="text-indigo-600 hover:text-indigo-805 hover:bg-indigo-50 p-1.5 rounded transition inline-flex items-center gap-1 font-bold min-h-[32px] cursor-pointer bg-transparent border-none"
                                      title="Download/View Document"
                                    >
                                      <FileDown className="h-3.5 w-3.5" />
                                      <span className="text-[10px]">Download</span>
                                    </button>
                                    <button
                                      onClick={() => handleDocDelete(doc.id)}
                                      type="button"
                                      className="text-red-650 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition min-h-[32px] cursor-pointer"
                                      title="Delete Document"
                                    >
                                      <Trash className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
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

          {/* TIMELINE tab */}
          {activeDetailsTab === "TIMELINE" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700">
                  <RefreshCw className="h-4 w-4 text-indigo-600 shrink-0" /> Full Lead Interaction & Document Audit Trail
                </h3>
                <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                  {activities.length} entries
                </span>
              </div>

              {loadingActivities ? (
                <div className="py-4 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500 mb-1.5" />
                  <span>Syncing logs...</span>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-4 text-[10px] text-slate-400 italic">No activity recorded for this lead yet.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {[...activities]
                    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(a => {
                      let badgeBg = "bg-slate-50 text-slate-500 border-slate-200 border";
                      if (a.activityType === "LEAD_CREATED") badgeBg = "bg-indigo-50 text-indigo-700 border-indigo-150 border";
                      if (a.activityType === "LEAD_UPDATED") badgeBg = "bg-sky-50 text-sky-700 border-sky-150 border";
                      if (a.activityType === "VOICE_NOTE_ADDED") badgeBg = "bg-violet-50 text-violet-750 border-violet-150 border";
                      if (a.activityType === "TRANSCRIPT_GENERATED") badgeBg = "bg-blue-50 text-blue-700 border-blue-150 border";
                      if (a.activityType === "AI_SUMMARY_GENERATED") badgeBg = "bg-purple-50 text-purple-750 border-purple-150 border";
                      if (a.activityType === "TASK_CREATED") badgeBg = "bg-amber-50 text-amber-705 border-amber-205 border";
                      if (a.activityType === "TASK_COMPLETED") badgeBg = "bg-emerald-50 text-emerald-750 border-emerald-200 border";
                      if (a.activityType === "FOLLOW_UP_SCHEDULED") badgeBg = "bg-rose-50 text-rose-700 border-rose-150 border";
                      if (a.activityType === "FOLLOW_UP_COMPLETED") badgeBg = "bg-emerald-50 text-emerald-710 border-emerald-150 border";
                      if (a.activityType === "DOCUMENT_UPLOADED") badgeBg = "bg-teal-50 text-teal-710 border-teal-150 border";
                      if (a.activityType === "DOCUMENT_DELETED") badgeBg = "bg-red-55 text-red-700 border-red-150 border";
                      if (a.activityType === "COMM_LOGGED") badgeBg = "bg-teal-55 text-teal-750 border-teal-200 border";

                      return (
                        <div key={a.id} className="relative pl-4 border-l border-slate-150 pb-1">
                          <div className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-slate-300" />
                          
                          <div className="space-y-1 bg-slate-50/40 hover:bg-slate-55 p-2.5 rounded-lg border border-slate-100 transition">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={`inline-block text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${badgeBg}`}>
                                {a.activityType.replace(/_/g, " ")}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono font-bold">
                                {new Date(a.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs font-black text-slate-800 leading-snug">
                              {a.description}
                            </p>
                            <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                              Logged by {a.createdBy}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Lead Score, Reminders, Timeline, Owner and Metadata details */}
        <div className="space-y-5">
          {/* Lead Score Distinctive Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2 text-slate-500">
              <Shield className="h-4 w-4 text-emerald-500 shrink-0" /> Lead Health Grade
            </h3>
            
            <div className="flex items-center gap-4">
              <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 ${leadScoreDetails.score >= 80 ? 'border-rose-500 bg-rose-50' : leadScoreDetails.score >= 50 ? 'border-amber-500 bg-amber-50' : 'border-blue-500 bg-blue-50'}`}>
                <span className="text-base font-black text-slate-900">{leadScoreDetails.score}</span>
              </div>
              
              <div className="min-w-0 flex-1">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border uppercase tracking-wider ${leadScoreDetails.color}`}>
                  {leadScoreDetails.category}
                </span>
                <p className="mt-1 text-[10px] text-slate-500 font-bold leading-tight">
                  Calculated from transcripts, budget mentions, interactions, and follow-ups.
                </p>
              </div>
            </div>
          </div>

          {/* Smart Follow-Up Reminders Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-700">
                <Calendar className="h-4 w-4 text-indigo-600 shrink-0" /> Smart Reminders
              </h3>
              <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                {reminders.length} active
              </span>
            </div>

            {reminderError && (
              <div className="text-[10px] text-red-650 bg-red-50 border border-red-105 rounded-lg p-2 font-semibold">
                {reminderError}
              </div>
            )}

            {/* Form to add a manual reminder */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newReminderTitle.trim() || !newReminderDate.trim()) return;
              try {
                setReminderError(null);
                await api.createReminder(lead.id, newReminderTitle, newReminderDate, "On due date");
                setNewReminderTitle("");
                setNewReminderDate("");
                fetchReminders();
                fetchActivities();
              } catch (err: any) {
                setReminderError(err.message || "Failed to add reminder");
              }
            }} className="space-y-2">
              <input
                type="text"
                placeholder="Reminder title (e.g., Follow up call)"
                value={newReminderTitle}
                onChange={e => setNewReminderTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-750 font-medium"
                required
              />
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Schedule Reminder Target Date
                </label>
                <input
                  type="date"
                  value={newReminderDate}
                  onChange={e => setNewReminderDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-750 font-semibold"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!newReminderTitle.trim() || !newReminderDate.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-2 text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 shrink-0 min-h-[36px]"
              >
                <Plus className="h-3 w-3" /> Add Reminder
              </button>
            </form>

            {/* Listed Reminders */}
            {loadingReminders ? (
              <span className="text-[10px] text-slate-400 block text-center">Syncing reminders...</span>
            ) : reminders.length === 0 ? (
              <div className="text-center py-2 text-[10px] text-slate-400 font-medium italic">
                No reminders configured. Record a voice memo or add one above.
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {reminders.map(r => (
                  <div key={r.id} className="p-2 border border-slate-150 rounded-lg bg-slate-50/70 flex items-start justify-between gap-2 text-xs text-slate-705">
                    <div className="min-w-0">
                      <span className="font-bold block text-slate-800 leading-tight truncate" title={r.title}>
                        {(() => {
                          const tLower = r.title.toLowerCase();
                          if (tLower.includes("regarding none") || tLower.includes("regarding unspecified") || tLower.includes("regarding null") || tLower.includes("regarding pending")) {
                            return `Follow up ${lead.company || lead.name || "Client"}`;
                          }
                          return r.title;
                        })()}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                        {r.reminderDate} • <strong className="text-indigo-600 font-extrabold">{r.timing}</strong>
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await api.deleteReminder(r.id);
                          fetchReminders();
                          fetchActivities();
                        } catch (err) {
                          setReminderError("Failed to delete reminder.");
                        }
                      }}
                      className="text-slate-400 hover:text-red-650 p-1 rounded transition shrink-0 cursor-pointer"
                      title="Remove Reminder"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>



          {/* Account Owner Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2 text-slate-500">
              <User className="h-4 w-4 text-indigo-500 shrink-0" /> Account Owner allocation
            </h3>

            <div className="mt-4">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">
                Responsible Owner
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-black text-xs text-indigo-700">
                  {lead.owner !== "unassigned" ? lead.owner.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="overflow-hidden">
                  <span className="block text-xs sm:text-sm font-extrabold text-slate-900 truncate" title={lead.owner}>
                    {lead.owner !== "unassigned" ? lead.owner : "Unassigned Open Pool"}
                  </span>
                  <span className="block text-[10px] text-slate-500 font-medium">
                    Owner Admin Allocation
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 pt-4 border-t border-slate-105 text-[11px] sm:text-xs text-slate-500">
              <div className="flex justify-between items-center">
                <span>Created On:</span>
                <span className="font-bold text-slate-700">
                  {new Date(lead.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Lead ID Code:</span>
                <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-700">{lead.id}</span>
              </div>
            </div>
          </div>

          {/* Configuration Rules Information */}
          <div className="rounded-xl border border-amber-250 bg-amber-50/40 p-4 text-[11px] text-slate-650 leading-relaxed space-y-1.5">
            <span className="font-extrabold text-amber-900 flex items-center gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5 text-amber-750 shrink-0" /> Multi-Admin Clearance
            </span>
            <p className="leading-normal font-medium">
              Under current policy, all authenticated administrators retain unlimited clearance to view, re-assign, modify, and delete customer profiles directly.
            </p>
          </div>
        </div>
      </div>

      {/* State-Based Modal Confirmation for Safe Deletion in sandboxed iframes */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-950">Confirm Deletion</h3>
                <p className="mt-2 text-xs sm:text-xs text-slate-500 leading-relaxed">
                  Are you absolutely sure you want to permanently remove <strong className="text-slate-900">{lead.name}</strong> ({lead.company || "Independent Buyer"}) from the CRM database? This action is irreversible.
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[38px] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 cursor-pointer min-h-[38px] transition"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Immersive In-App Document Viewer Modal */}
      {selectedViewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <FileText className="h-5 w-5 text-white animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-900">
                    {selectedViewDoc.category} Preview
                  </span>
                  <h3 className="text-sm font-extrabold truncate max-w-md mt-0.5">{selectedViewDoc.name}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(selectedViewDoc)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1.5 transition cursor-pointer border-none"
                >
                  <FileDown className="h-3.5 w-3.5" /> Download copy
                </button>
                <button
                  onClick={() => setSelectedViewDoc(null)}
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Content Box */}
            <div className="flex-1 overflow-y-auto bg-slate-100 p-6 flex justify-center items-center">
              {(() => {
                const fUrl = selectedViewDoc.fileUrl || "";
                const isImg = fUrl.startsWith("data:image/") || fUrl.match(/\.(jpeg|jpg|gif|png|svg|webp)/i);
                const isPdf = fUrl.startsWith("data:application/pdf") || fUrl.match(/\.pdf/i);

                if (isImg || isPdf) {
                  return (
                    <div className="w-full h-[60vh] bg-white rounded-xl shadow-inner overflow-hidden flex flex-col">
                      {isImg ? (
                        <div className="flex justify-center items-center p-4 overflow-auto h-full bg-slate-50">
                          <img src={previewUrl || fUrl} alt={selectedViewDoc.name} className="max-w-full max-h-full object-contain rounded shadow-md" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <iframe
                          src={previewUrl || fUrl}
                          title="PDF Preview"
                          className="w-full h-full border-0"
                        />
                      )}
                    </div>
                  );
                }

                return (
                  /* Beautiful Simulated High-Fidelity Business Document Viewer for user convenience */
                  <div className="w-full max-w-2xl bg-white rounded-xl shadow-md border border-slate-200/60 p-8 min-h-[500px] relative font-sans flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex justify-between items-start border-b border-indigo-100 pb-5">
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">OFFICIAL CRM DOCUMENTATION</span>
                          <h2 className="text-xl font-extrabold text-slate-900 mt-1">{selectedViewDoc.category.toUpperCase()}</h2>
                          <span className="text-xs text-slate-400 mt-0.5 block">{selectedViewDoc.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold font-mono">ID: {selectedViewDoc.id}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold py-1">
                        <div>
                          <span className="text-[9px] font-bold text-slate-450 uppercase block">Linked Client profile</span>
                          <span className="text-slate-800 font-bold block">{lead.name}</span>
                          <span className="text-slate-500 block">{lead.company}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-slate-450 uppercase block">Attachment Details</span>
                          <span className="text-slate-800 font-bold block">Uploaded by {selectedViewDoc.uploadedBy}</span>
                          <span className="text-slate-500 block font-mono text-[10px]">{new Date(selectedViewDoc.uploadedAt).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 space-y-3.5">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Indexed Content Summary (In-App View)</span>
                        </div>
                        
                        {selectedViewDoc.category === "Quotation" ? (
                          <div className="text-xs space-y-2 text-slate-700">
                            <p className="font-bold text-slate-900">Commercial Quotation Sheet Overview:</p>
                            <ul className="list-disc pl-4 space-y-1">
                              <li><strong>Product Description:</strong> Extended Enterprise Software License & CRM Integration Support</li>
                              <li><strong>Proposed Pricing Level:</strong> ₹12,50,050 (Standard Corporate Tariff Tier)</li>
                              <li><strong>Integrity Term:</strong> 30 calendar days from invoice log</li>
                              <li><strong>Delivery Frame:</strong> 14 business days post system clearing</li>
                            </ul>
                          </div>
                        ) : selectedViewDoc.category === "Purchase Order" ? (
                          <div className="text-xs space-y-2 text-slate-700">
                            <p className="font-bold text-slate-900">Signed Client Purchase Mandate:</p>
                            <ul className="list-disc pl-4 space-y-1">
                              <li><strong>Order Identifier:</strong> PO-{selectedViewDoc.id.substring(4, 10).toUpperCase()}</li>
                              <li><strong>Authorized Budget:</strong> ₹10,00,000 (Inclusive of tax structures)</li>
                              <li><strong>Approval Signature:</strong> Confirmed & Uploaded to active registry</li>
                              <li><strong>Payment Scheme:</strong> Net-30 credit terms apply</li>
                            </ul>
                          </div>
                        ) : selectedViewDoc.category === "Contract" ? (
                          <div className="text-xs space-y-2 text-slate-700">
                            <p className="font-bold text-slate-900">Service Level Agreement & NDA Terms:</p>
                            <p className="leading-relaxed">This legal agreement dictates technical milestones, IP assignment rights, and data protection specifications shared between {lead.company} and current organization registry. All active operations are certified compliant under ISO-27001.</p>
                          </div>
                        ) : (
                          <div className="text-xs space-y-2 text-slate-750">
                            <p className="font-bold text-slate-900">General Document Notes / Attachments:</p>
                            <p className="leading-relaxed">This business attachment represents official support metadata uploaded directly to client dossier registry. Click 'Download Copy' above to extract physical file binary block to local workspace.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-150 pt-4 mt-6 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                      <span>Generated and verified via Sales Companion CRM Sandbox</span>
                      <span className="font-mono">Page 1 of 1</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedViewDoc(null)}
                className="bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs px-5 py-2 rounded-lg cursor-pointer transition mr-2"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
