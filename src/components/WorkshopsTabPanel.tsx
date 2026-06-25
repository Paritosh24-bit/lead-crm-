import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Calendar, 
  MapPin, 
  Trash2, 
  Plus, 
  UploadCloud, 
  ExternalLink, 
  RefreshCw, 
  X, 
  FileText, 
  Building, 
  Layers, 
  CircleDollarSign, 
  UserCheck 
} from "lucide-react";
import { api } from "../lib/api";
import { WorkshopRecord, UserOption } from "../types";

interface WorkshopsTabPanelProps {
  appUsers: UserOption[];
  currentUserEmail: string;
}

export default function WorkshopsTabPanel({
  appUsers,
  currentUserEmail,
}: WorkshopsTabPanelProps) {
  const [activeSubtype, setActiveSubtype] = useState<"OPEN" | "CORPORATE">("OPEN");
  const [bweList, setBweList] = useState<WorkshopRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [price, setPrice] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filters / Search
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchWorkshopRecords();
    
    // Set default owner to logged in user name or email
    const currUser = appUsers.find(
      (u) => u.email.toLowerCase() === currentUserEmail.toLowerCase()
    );
    if (currUser) {
      setOwnerName(currUser.name || currUser.email);
    } else {
      setOwnerName(currentUserEmail);
    }
  }, [appUsers, currentUserEmail]);

  const fetchWorkshopRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getWorkshops();
      setBweList(data || []);
    } catch (err) {
      console.error("Failed to load workshops records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, rowId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    if (rowId) {
      setUploadProgress("Uploading invoice...");
    } else {
      setUploadProgress(`Reading "${file.name}"...`);
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileDataHex = event.target?.result as string;
        if (!fileDataHex) {
          alert("Error: Could not read file data.");
          setUploading(false);
          return;
        }

        try {
          const uploadRes = await api.uploadPoInvoice(file.name, fileDataHex);
          if (uploadRes.success && uploadRes.fileUrl) {
            if (rowId) {
              const targetedRecord = bweList.find((r) => r.id === rowId);
              if (targetedRecord) {
                const updated = { ...targetedRecord, invoiceUrl: uploadRes.fileUrl };
                await api.saveWorkshop(updated);
                await fetchWorkshopRecords();
                alert(`Invoice for "${targetedRecord.title}" updated successfully!`);
              }
            } else {
              setInvoiceUrl(uploadRes.fileUrl);
              setUploadProgress(`✔ Uploaded: ${file.name}`);
              alert("Invoice file attached! Complete the form and hit register.");
            }
          } else {
            alert("Upload failed. Try again.");
          }
        } catch (uploadErr: any) {
          alert(`Upload failed: ${uploadErr.message || "Network issue."}`);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(`Reader exception: ${err.message}`);
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.saveWorkshop({
        type: activeSubtype,
        title: title.trim() || undefined,
        ownerName: ownerName.trim() || undefined,
        price: price ? Number(price) : undefined,
        clientName: clientName.trim() || undefined,
        location: location.trim() || undefined,
        eventDate: eventDate || undefined,
        invoiceUrl: invoiceUrl || undefined,
        additionalDetails: additionalDetails.trim() || undefined,
      });

      // Reset
      setTitle("");
      setPrice("");
      setClientName("");
      setLocation("");
      setEventDate("");
      setInvoiceUrl("");
      setAdditionalDetails("");
      setUploadProgress("");
      setShowAddForm(false);

      await fetchWorkshopRecords();
      alert(`Successfully registered new record!`);
    } catch (err: any) {
      alert(`Failed to save record: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete "${name || 'this record'}"?`)) {
      return;
    }
    try {
      await api.deleteWorkshop(id);
      await fetchWorkshopRecords();
      alert("Record deleted successfully.");
    } catch (err: any) {
      alert(`Error deleting: ${err.message}`);
    }
  };

  // Filter items matching current sub-tab type and search terms
  const currentFilteredList = bweList.filter((item) => {
    if (item.type !== activeSubtype) return false;
    
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      (item.title || "").toLowerCase().includes(q) ||
      (item.ownerName || "").toLowerCase().includes(q) ||
      (item.clientName || "").toLowerCase().includes(q) ||
      (item.location || "").toLowerCase().includes(q)
    );
  });

  return (
    <div id="books-workshops-panel" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6">
      {/* Upper Brand Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-[#0d2c54] flex items-center gap-2 tracking-tight">
            <BookOpen className="h-5.5 w-5.5 text-[#0d9488]" />
            Books & Workshops Registry
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Log, track, and manage commercial Book Orders and Trainer Resource assignments across Open and Corporate workshops.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0d9488] hover:bg-[#0b7a70] text-white px-4 py-1.5 text-xs font-bold tracking-wide shadow-xs transition cursor-pointer"
          >
            {showAddForm ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Cancel Entry</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>Add Record</span>
              </>
            )}
          </button>
          
          <button
            onClick={fetchWorkshopRecords}
            className="inline-flex min-h-[38px] cursor-pointer items-center justify-center p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
            title="Refresh List"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Subparts Selector Tab Pane */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => {
            setActiveSubtype("OPEN");
          }}
          className={`pb-3.5 text-xs font-black uppercase tracking-wider transition relative cursor-pointer ${
            activeSubtype === "OPEN"
              ? "text-[#0d9488] border-b-3 border-[#0d9488]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            1. Open Workshops / Book Purchases
          </span>
        </button>

        <button
          onClick={() => {
            setActiveSubtype("CORPORATE");
          }}
          className={`pb-3.5 text-xs font-black uppercase tracking-wider transition relative cursor-pointer ${
            activeSubtype === "CORPORATE"
              ? "text-[#0d9488] border-b-3 border-[#0d9488]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Building className="h-4 w-4" />
            2. Corporate Workshops
          </span>
        </button>
      </div>

      {/* Form For New Entry */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50/50 border border-slate-200 p-5 rounded-xl space-y-4 animate-fade-in text-xs font-medium">
          <div className="text-xs font-black uppercase text-[#0d2c54] border-b border-slate-150 pb-2 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#0d9488]" />
            Register new {activeSubtype === "OPEN" ? "Open Workshop / Book Sale" : "Corporate Workshop"} Contract
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Workshop / Book Title Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SyncAI Advanced LLM Camp"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Resource Trainer / Instructor
              </label>
              <select
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px] cursor-pointer"
              >
                {appUsers.map((u) => (
                  <option key={u.email} value={u.name || u.email}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Total Price / Fee (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 15000"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Participant Client / Buyer Corp
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Global Academy"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Delivery Venue / Cyber Platform
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Zoom Video, Mumbai Head Office"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Scheduled Target Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px] cursor-pointer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Flexible Additional Details
              </label>
              <input
                type="text"
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                placeholder="e.g. Includes 35 books sent via BlueDart, 3-hour Q&A workshop panel"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Invoice File Upload
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex min-h-[38px] items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-350 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer text-xs font-semibold">
                  <UploadCloud className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{uploading ? "Uploading..." : invoiceUrl ? "Invoice Attached" : "Choose File"}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => handleFileUpload(e)}
                    disabled={uploading}
                  />
                </label>
                {invoiceUrl && (
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[38px] w-10 items-center justify-center rounded-lg bg-emerald-55/60 border border-emerald-200 text-emerald-850 hover:bg-emerald-100"
                    title="View Attached Invoice"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex min-h-[42px] cursor-pointer items-center justify-center bg-[#0d9488] hover:bg-[#0b7a70] text-white px-6 rounded-lg text-xs font-extrabold uppercase tracking-widest disabled:opacity-50 transition"
            >
              {submitting ? "Saving Info..." : `Record active ${activeSubtype === "OPEN" ? "Open Camp" : "Corporate Camp"}`}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${activeSubtype === "OPEN" ? "Open programs" : "Corporate events"} by title, instructor, buyer corporate...`}
          className="block w-full rounded-lg border border-slate-205 bg-slate-50/50 px-4 py-2 text-xs text-slate-900 focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488] min-h-[38px]"
        />
      </div>

      {loading && bweList.length === 0 ? (
        <div className="py-14 text-center text-xs font-mono text-slate-400 animate-pulse">
          Retrieving registry datastore...
        </div>
      ) : currentFilteredList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-12 text-center text-xs text-slate-400 font-semibold">
          No {activeSubtype === "OPEN" ? "open workshops / books" : "corporate workshops"} recorded matching your filter query.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-5 py-3.5">Topic / Title</th>
                <th className="px-5 py-3.5">Trainer Assignment</th>
                <th className="px-5 py-3.5">Target Client</th>
                <th className="px-5 py-3.5">Delivery Platform</th>
                <th className="px-5 py-3.5">Event Date</th>
                <th className="px-5 py-3.5">Price (INR)</th>
                <th className="px-5 py-3.5 text-center">Invoice Billing</th>
                <th className="px-5 py-3.5 text-right">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 bg-white font-medium text-slate-700">
              {currentFilteredList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/40">
                  <td className="px-5 py-4 font-bold text-slate-900">
                    {item.title || <span className="text-slate-350 italic">Untitled Event</span>}
                  </td>
                  <td className="px-5 py-4 text-xs">
                    <span className="inline-flex items-center gap-1 font-bold text-[#0d2c54]">
                      <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                      {item.ownerName || "system"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {item.clientName || <span className="text-slate-350">-</span>}
                  </td>
                  <td className="px-5 py-4">
                    {item.location ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {item.location}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-[11px]">
                    {item.eventDate ? (
                      <span className="inline-flex items-center gap-1 font-bold">
                        <Calendar className="h-3.5 w-3.5 text-[#0d9488]" />
                        {item.eventDate}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono font-black text-slate-900">
                    ₹{item.price ? Number(item.price).toLocaleString() : "0"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {item.invoiceUrl ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={item.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex hover:scale-[1.03] duration-100 min-h-[32px] px-3.5 py-1 items-center justify-center gap-1 text-[11px] font-bold rounded-lg border border-emerald-250 bg-emerald-55/40 text-emerald-950"
                        >
                          <FileText className="h-3.5 w-3.5 text-emerald-700" />
                          <span>View Invoice</span>
                        </a>
                        <label className="inline-flex min-h-[32px] p-2 items-center justify-center rounded-lg border border-slate-205 bg-white text-slate-500 hover:bg-slate-50 cursor-pointer text-xs font-semibold">
                          <UploadCloud className="h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            onChange={(e) => handleFileUpload(e, item.id)}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <label className="inline-flex min-h-[32px] px-3.5 py-1 items-center justify-center gap-1 bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-150/70 rounded-lg text-[11px] font-bold cursor-pointer transition">
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>Attach Invoice</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            onChange={(e) => handleFileUpload(e, item.id)}
                          />
                        </label>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleDelete(item.id, item.title || "")}
                      className="inline-flex p-2 rounded-lg cursor-pointer text-slate-400 hover:text-red-650 hover:bg-red-50 transition"
                      title="Remove record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Short details disclosure */}
      <div className="p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-xl space-y-1">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 font-sans">
          <CircleDollarSign className="h-4 w-4 text-[#0d9488]" /> Supporting books sales & multi-trainer resource allocation
        </h4>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          Open workshops and corporate accounts listed are synced automatically with the system's client datastore. Uploaded invoices are securely mounted onto our public cloud bucket.
        </p>
      </div>
    </div>
  );
}
