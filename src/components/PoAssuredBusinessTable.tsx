import React, { useState, useEffect } from "react";
import { 
  Coins, FileText, UploadCloud, User, Trash2, Plus, 
  Download, ExternalLink, RefreshCw, X, ShieldCheck, 
  CheckCircle2, AlertCircle, FileSpreadsheet, Sparkles, 
  Calendar, Layers, Check, Hourglass, Ban
} from "lucide-react";
import { api } from "../lib/api";
import { PoAssuredBusiness } from "../types";

interface PoAssuredBusinessTableProps {
  appUsers: any[];
  currentUserEmail: string;
  poList: PoAssuredBusiness[];
  onRefreshPo: () => void;
}

export default function PoAssuredBusinessTable({
  appUsers,
  currentUserEmail,
  poList = [],
  onRefreshPo,
}: PoAssuredBusinessTableProps) {
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeletePoId, setConfirmDeletePoId] = useState<string | null>(null);

  // Form Fields
  const [clientName, setClientName] = useState("");
  const [category, setCategory] = useState("Digital Marketing");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [durationMonths, setDurationMonths] = useState("1");
  const [status, setStatus] = useState("Pending");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  
  // Drag & Drop / Upload State
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const categories = ["Digital Marketing", "AI", "Workshops", "Websites", "Books"];

  const handleFileUpload = async (file: File, rowId?: string) => {
    if (!file) return;

    setUploadingFile(true);
    setUploadProgress(rowId ? "Replacing invoice..." : `Reading "${file.name}"...`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileDataHex = event.target?.result as string;
        if (!fileDataHex) {
          alert("Error: Could not read file data.");
          setUploadingFile(false);
          return;
        }

        try {
          const uploadRes = await api.uploadPoInvoice(file.name, fileDataHex);
          if (uploadRes.success && uploadRes.fileUrl) {
            if (rowId) {
              const targetedRecord = poList.find(r => r.id === rowId);
              if (targetedRecord) {
                const updated = { ...targetedRecord, invoiceUrl: uploadRes.fileUrl };
                await api.savePoAssured(updated);
                onRefreshPo();
                alert(`Invoice for "${targetedRecord.clientName}" updated successfully!`);
              }
            } else {
              setInvoiceUrl(uploadRes.fileUrl);
              setUploadProgress(`✔ Uploaded: ${file.name}`);
              alert("Invoice file uploaded successfully! Submit the form to complete registration.");
            }
          } else {
            alert("Upload failed. Try again.");
          }
        } catch (uploadErr: any) {
          alert(`Upload failed: ${uploadErr.message || "Network issue."}`);
        } finally {
          setUploadingFile(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(`Reader exception: ${err.message}`);
      setUploadingFile(false);
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

  const handleDrop = (e: React.DragEvent, rowId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0], rowId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !monthlyAmount || !durationMonths) {
      alert("Please provide corporate client name, monthly rate amount, and duration.");
      return;
    }

    setSubmitting(true);
    try {
      const rate = Number(monthlyAmount) || 0;
      const duration = Math.max(1, Number(durationMonths) || 1);
      const totalVal = rate * duration;

      await api.savePoAssured({
        category,
        monthlyAmount: rate,
        durationMonths: duration,
        totalPoValue: totalVal,
        clientName,
        status,
        invoiceUrl,
      });

      // Reset form fields
      setClientName("");
      setMonthlyAmount("");
      setDurationMonths("1");
      setInvoiceUrl("");
      setCategory("Digital Marketing");
      setStatus("Pending");
      setShowAddForm(false);
      setUploadProgress("");
      
      // Refresh
      onRefreshPo();
      alert("Purchase order registered successfully!");
    } catch (err: any) {
      alert(`Error registering PO: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      await api.deletePoAssured(id);
      onRefreshPo();
      setConfirmDeletePoId(null);
    } catch (err: any) {
      alert(`Error deleting record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (record: PoAssuredBusiness, newStatus: string) => {
    try {
      const updated = { ...record, status: newStatus };
      await api.savePoAssured(updated);
      onRefreshPo();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Filter application list
  const filteredList = poList.filter(item => {
    const matchesSearch = 
      item.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      categoryFilter === "ALL" || 
      item.category?.toLowerCase() === categoryFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "ALL" ||
      item.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Apply sorting
  const sortedList = [...filteredList].sort((a, b) => {
    let aVal: any = a[sortBy as keyof typeof a] || "";
    let bVal: any = b[sortBy as keyof typeof b] || "";

    if (typeof aVal === "string") {
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    } else {
      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    }
  });

  // Formatting helper in Indian Rupee
  const formatINR = (val: number) => {
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  const handleDownloadPoExcel = () => {
    const headers = ["PO ID", "Client Name", "Category", "Monthly Amount (INR)", "Duration (Months)", "Total PO Value (INR)", "Status", "Invoice Link", "Created At"];
    
    const rows = sortedList.map(item => [
      item.id,
      item.clientName,
      item.category,
      item.monthlyAmount,
      item.durationMonths,
      item.totalPoValue,
      item.status,
      item.invoiceUrl || "None",
      item.createdAt
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `po_management_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="po-management-section" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <FileSpreadsheet className="h-5 w-5 shrink-0" />
            </span>
            Purchase Order (PO) Management
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Register, approve, and track client purchase order contracts, monthly billings, and associated invoice files.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="btn-download-po-excel"
            type="button"
            onClick={handleDownloadPoExcel}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition"
          >
            <Download className="h-4 w-4" />
            <span>Download Excel Report</span>
          </button>

          <button
            id="btn-register-new-po"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-900 text-white px-4 py-1.5 text-xs font-bold tracking-wide hover:bg-slate-850 transition cursor-pointer shadow-xs"
          >
            {showAddForm ? (
              <>
                <X className="h-4 w-4" />
                <span>Cancel Entry</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Register New PO</span>
              </>
            )}
          </button>
          <button
            id="btn-refresh-po-list"
            onClick={onRefreshPo}
            className="inline-flex min-h-[38px] h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition"
            title="Refresh PO List"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Form for recording a new PO */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200/60 p-5 rounded-xl space-y-4 animate-fade-in">
          <div className="text-xs font-black uppercase text-slate-700 border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> New Purchase Order Registration Details
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Client / Corporate Name *</label>
              <input
                id="po-client-name"
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Zenith Tech Corp"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Category *</label>
              <select
                id="po-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none min-h-[38px] cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Monthly Billing Amount (₹) *</label>
              <input
                id="po-monthly-amount"
                type="number"
                required
                min="0"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Duration (Months) *</label>
              <input
                id="po-duration-months"
                type="number"
                required
                min="1"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                placeholder="e.g. 12"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Status *</label>
              <select
                id="po-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none min-h-[38px] cursor-pointer"
              >
                <option value="Pending">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Calculated Preview */}
            <div className="flex flex-col justify-end">
              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs flex justify-between items-center h-[38px]">
                <span className="text-indigo-600 font-bold">Total Calculated Value:</span>
                <span className="font-mono font-black text-indigo-700">
                  {formatINR((Number(monthlyAmount) || 0) * (Number(durationMonths) || 1))}
                </span>
              </div>
            </div>
          </div>

          {/* Drag & Drop File Upload Area */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider">Contract or Invoice Document Attachment (Optional)</label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={(e) => handleDrop(e)}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActive ? "border-indigo-500 bg-indigo-50/30" : "border-slate-200 bg-white hover:bg-slate-50/40"
              }`}
            >
              <input
                id="po-invoice-file"
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <label htmlFor="po-invoice-file" className="cursor-pointer flex flex-col items-center gap-2">
                <UploadCloud className="h-8 w-8 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">
                  {uploadProgress || "Drag and drop contract file here, or click to browse"}
                </span>
                <span className="text-[10px] text-slate-400">PDF, Excel, Images up to 10MB</span>
              </label>
            </div>
            {invoiceUrl && (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg text-emerald-800 text-[11px] font-semibold border border-emerald-100">
                <Check className="h-3.5 w-3.5" />
                <span>Invoice file loaded successfully! URL: </span>
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-900 flex items-center gap-1">
                  View File <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              id="btn-po-submit"
              type="submit"
              disabled={submitting || uploadingFile}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-2 text-xs font-bold hover:bg-slate-800 disabled:bg-slate-400 transition"
            >
              {submitting ? "Registering Deal..." : "Complete Registration"}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filtering Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2">
          <input
            id="po-search-input"
            type="text"
            placeholder="Search client, category or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 bg-slate-50/30 px-3 py-2 text-xs placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none min-h-[38px]"
          />
        </div>

        {/* Category filter */}
        <div>
          <select
            id="po-filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none min-h-[38px] cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <select
            id="po-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none min-h-[38px] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* PO Table representation */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 select-none">
              <th className="px-5 py-3 cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("id")}>
                PO ID {sortBy === "id" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-5 py-3 cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("clientName")}>
                Client Name {sortBy === "clientName" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-5 py-3 cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("category")}>
                Category {sortBy === "category" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("monthlyAmount")}>
                Monthly Amount {sortBy === "monthlyAmount" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("durationMonths")}>
                Duration {sortBy === "durationMonths" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("totalPoValue")}>
                Total PO Value {sortBy === "totalPoValue" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-5 py-3 text-center cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("status")}>
                Status {sortBy === "status" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-5 py-3 text-center">Invoice File</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedList.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-slate-400 font-mono text-sm">
                  No registered purchase orders matching the selected filters.
                </td>
              </tr>
            ) : (
              sortedList.map(row => {
                const isApproved = row.status?.toUpperCase() === "APPROVED";
                const isRejected = row.status?.toUpperCase() === "REJECTED";

                return (
                  <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                    {/* PO ID */}
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400 font-semibold select-all">
                      {row.id}
                    </td>

                    {/* Client Name */}
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800">
                      {row.clientName}
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {row.category}
                      </span>
                    </td>

                    {/* Monthly Amount */}
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-sm text-slate-700">
                      {formatINR(row.monthlyAmount)}
                    </td>

                    {/* Duration */}
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-600">
                      {row.durationMonths} {row.durationMonths === 1 ? "month" : "months"}
                    </td>

                    {/* Total Value */}
                    <td className="px-5 py-3.5 text-right font-mono font-black text-sm text-indigo-700">
                      {formatINR(row.totalPoValue)}
                    </td>

                    {/* Status Badge & Selector */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center">
                        <select
                          value={row.status || "Pending"}
                          onChange={(e) => handleStatusChange(row, e.target.value)}
                          className={`rounded-lg px-2 py-1 text-xs font-extrabold cursor-pointer border focus:outline-none transition-colors ${
                            isApproved 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100" 
                              : isRejected 
                              ? "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100" 
                              : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </td>

                    {/* File Attachment Upload/View */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {row.invoiceUrl ? (
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={row.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition hover:scale-105"
                              title="Download/View Contract Invoice"
                            >
                              <FileText className="h-4 w-4" />
                            </a>
                            {/* Option to replace/re-upload */}
                            <label className="cursor-pointer p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleFileUpload(e.target.files[0], row.id);
                                  }
                                }}
                              />
                              <UploadCloud className="h-3 w-3" />
                            </label>
                          </div>
                        ) : (
                          <div className="relative group">
                            <label className="cursor-pointer inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleFileUpload(e.target.files[0], row.id);
                                  }
                                }}
                              />
                              <UploadCloud className="h-3 w-3" />
                              <span>Upload</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions (Delete with Confirmation) */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap min-w-[140px]">
                      {confirmDeletePoId === row.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-rose-600 font-extrabold uppercase tracking-tight animate-pulse">Delete permanently?</span>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="rounded bg-rose-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-rose-700 transition cursor-pointer min-h-[26px]"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeletePoId(null)}
                            className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer min-h-[26px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeletePoId(row.id)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete PO Assured Record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
