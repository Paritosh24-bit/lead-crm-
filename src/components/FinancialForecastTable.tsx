import React, { useState, useEffect } from "react";
import { TrendingUp, Eye, EyeOff, Save, CheckCircle2, AlertTriangle, Sparkles, Landmark, Coins, Download } from "lucide-react";
import { api } from "../lib/api";
import { PoAssuredBusiness } from "../types";

interface FinancialForecastTableProps {
  isMasterAdmin: boolean;
  revenueMetrics: any[];
  showRevenueToUsers: boolean;
  onRefresh: () => void;
  poList: PoAssuredBusiness[];
}

export default function FinancialForecastTable({
  isMasterAdmin,
  revenueMetrics,
  showRevenueToUsers,
  onRefresh,
  poList = [],
}: FinancialForecastTableProps) {
  const [localMetrics, setLocalMetrics] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("category");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const categoriesOrder = ["Digital Marketing", "AI", "Workshops", "Websites", "Books"];

  useEffect(() => {
    if (revenueMetrics && revenueMetrics.length > 0) {
      // Normalize to make sure we always have the 5 requested categories
      const normalized = categoriesOrder.map((cat) => {
        const existing = revenueMetrics.find(
          (m) => m.category.toLowerCase().trim() === cat.toLowerCase().trim()
        );
        return {
          category: cat,
          projectedRevenue: existing ? Number(existing.projectedRevenue) || 0 : 0,
          tillDateRevenue: existing ? Number(existing.tillDateRevenue) || 0 : 0,
          finalRevenue: existing ? Number(existing.finalRevenue) || 0 : 0,
        };
      });
      setLocalMetrics(normalized);
    } else {
      // Setup default fallback local state
      const defaults = categoriesOrder.map((cat) => ({
        category: cat,
        projectedRevenue: cat === "Digital Marketing" ? 1500000 : cat === "AI" ? 2000000 : cat === "Workshops" ? 500000 : cat === "Websites" ? 800000 : 200000,
        tillDateRevenue: cat === "Digital Marketing" ? 1000000 : cat === "AI" ? 1200000 : cat === "Workshops" ? 250000 : cat === "Websites" ? 400000 : 100000,
        finalRevenue: 0,
      }));
      setLocalMetrics(defaults);
    }
  }, [revenueMetrics]);

  const handleCellChange = (index: number, cellKey: string, val: number) => {
    setLocalMetrics((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [cellKey]: Math.max(0, val) };
      return next;
    });
  };

  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateRevenueMetrics(localMetrics, showRevenueToUsers);
      onRefresh();
      alert("Revenue targets and actuals saved successfully to Supabase!");
    } catch (err: any) {
      alert(err.message || "Failed to persist revenue metrics.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    try {
      const nextToggle = !showRevenueToUsers;
      await api.updateRevenueMetrics(localMetrics, nextToggle);
      onRefresh();
      alert(
        `Success! Revenue dashboard is now ${
          nextToggle ? "VISIBLE" : "HIDDEN"
        } for standard users.`
      );
    } catch (err: any) {
      alert(err.message || "Failed to toggle revenue dashboard visibility.");
    }
  };

  const handleDownloadExcel = () => {
    const headers = ["Category", "Target Amount (INR)", "Achieved Till Date (INR)", "Pending (INR)", "Approved PO Amount (INR)", "Balance Shortfall (INR)"];
    
    const rows = sortedRows.map(row => [
      row.category,
      row.targetAmount,
      row.achievedTillDate,
      row.pending,
      row.poAmount,
      row.balance
    ]);

    // Append total row
    rows.push([
      "Grand Totals",
      totalTarget,
      totalAchieved,
      totalPending,
      totalPoAmount,
      totalBalance
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `revenue_target_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to calculate total approved PO amount for a category
  const getApprovedPoAmount = (category: string) => {
    return poList
      .filter(
        (po) =>
          po.category.toLowerCase().trim() === category.toLowerCase().trim() &&
          po.status?.toUpperCase() === "APPROVED"
      )
      .reduce((sum, po) => sum + (Number(po.totalPoValue) || 0), 0);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Calculate row metrics
  const calculatedRows = localMetrics.map((row, index) => {
    const targetAmount = Number(row.projectedRevenue) || 0;
    const achievedTillDate = Number(row.tillDateRevenue) || 0;
    const pending = Math.max(0, targetAmount - achievedTillDate);
    const poAmount = getApprovedPoAmount(row.category);
    const balance = pending - poAmount;

    return {
      ...row,
      index,
      targetAmount,
      achievedTillDate,
      pending,
      poAmount,
      balance,
    };
  });

  // Apply filters
  const filteredRows = calculatedRows.filter((row) =>
    row.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply sorting
  const sortedRows = [...filteredRows].sort((a, b) => {
    let aVal: any = a[sortBy as keyof typeof a];
    let bVal: any = b[sortBy as keyof typeof b];

    if (sortBy === "category") {
      aVal = a.category;
      bVal = b.category;
    }

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

  // Calculate Grand Totals
  const totalTarget = calculatedRows.reduce((sum, r) => sum + r.targetAmount, 0);
  const totalAchieved = calculatedRows.reduce((sum, r) => sum + r.achievedTillDate, 0);
  const totalPending = calculatedRows.reduce((sum, r) => sum + r.pending, 0);
  const totalPoAmount = calculatedRows.reduce((sum, r) => sum + r.poAmount, 0);
  const totalBalance = calculatedRows.reduce((sum, r) => sum + r.balance, 0);

  // Formatting helper in Indian Rupee
  const formatINR = (val: number) => {
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  return (
    <div id="revenue-target-dashboard" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Landmark className="h-5 w-5 shrink-0" />
            </span>
            Revenue Target Dashboard
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Category goals, actuals achieved, approved PO commitments, and pending balances tracked in Indian Rupee (INR).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isMasterAdmin ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Admin Editor Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-600/10">
              Standard View Mode
            </span>
          )}

          <button
            id="btn-download-revenue-excel"
            type="button"
            onClick={handleDownloadExcel}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition"
          >
            <Download className="h-4 w-4" />
            <span>Download Excel Report</span>
          </button>

          {isMasterAdmin && (
            <button
              id="btn-toggle-revenue-visibility"
              type="button"
              onClick={handleToggleVisibility}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs border ${
                showRevenueToUsers
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {showRevenueToUsers ? (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Show to Users: Enabled</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span>Show to Users: Disabled</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Target</p>
          <p className="text-lg font-black text-slate-800 mt-1 font-mono">{formatINR(totalTarget)}</p>
        </div>
        <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/50">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600/80">Total Achieved</p>
          <p className="text-lg font-black text-emerald-700 mt-1 font-mono">{formatINR(totalAchieved)}</p>
        </div>
        <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100/50">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600/80">Total Approved POs</p>
          <p className="text-lg font-black text-sky-700 mt-1 font-mono">{formatINR(totalPoAmount)}</p>
        </div>
        <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100/50">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700/80">Net Balance</p>
          <p className="text-lg font-black text-amber-700 mt-1 font-mono">{formatINR(totalBalance)}</p>
        </div>
      </div>

      {/* Control panel for filters & search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <input
            id="revenue-search-input"
            type="text"
            placeholder="Filter categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 bg-slate-50/30 px-3 py-2 text-xs placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none min-h-[38px]"
          />
        </div>
        <p className="text-xs text-slate-400">
          Showing {sortedRows.length} of {categoriesOrder.length} product categories
        </p>
      </div>

      <form onSubmit={handleSaveMetrics} className="space-y-4">
        {/* Table representation */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500 select-none">
                <th className="px-5 py-3.5 cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("category")}>
                  Category {sortBy === "category" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-5 py-3.5 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("targetAmount")}>
                  Target Amount {sortBy === "targetAmount" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-5 py-3.5 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("achievedTillDate")}>
                  Achieved Till Date {sortBy === "achievedTillDate" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-5 py-3.5 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("pending")}>
                  Pending {sortBy === "pending" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-5 py-3.5 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("poAmount")}>
                  PO Amount {sortBy === "poAmount" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="px-5 py-3.5 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => handleSort("balance")}>
                  Balance {sortBy === "balance" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedRows.map((row) => {
                // Highlight statuses based on balance size or goals
                const isCompleted = row.balance <= 0;
                const progressPercent = row.targetAmount > 0 ? (row.achievedTillDate / row.targetAmount) * 100 : 0;

                return (
                  <tr key={row.category} className="hover:bg-slate-50/30 transition-colors group">
                    {/* Category Label */}
                    <td className="px-5 py-4 font-bold text-slate-800">
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-bold text-sm">{row.category}</span>
                        {/* Progress bar visual aid */}
                        <div className="w-24 bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, progressPercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Target Amount */}
                    <td className="px-5 py-4 text-right">
                      {isMasterAdmin ? (
                        <div className="inline-flex items-center gap-1 justify-end">
                          <span className="text-slate-400 font-mono text-sm">₹</span>
                          <input
                            type="number"
                            value={row.projectedRevenue}
                            onChange={(e) =>
                              handleCellChange(row.index, "projectedRevenue", Number(e.target.value))
                            }
                            className="w-32 text-right rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-sm text-slate-900 font-bold focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[34px]"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-slate-700 font-bold text-sm">
                          {formatINR(row.targetAmount)}
                        </span>
                      )}
                    </td>

                    {/* Achieved Till Date */}
                    <td className="px-5 py-4 text-right">
                      {isMasterAdmin ? (
                        <div className="inline-flex items-center gap-1 justify-end">
                          <span className="text-slate-400 font-mono text-sm">₹</span>
                          <input
                            type="number"
                            value={row.tillDateRevenue}
                            onChange={(e) =>
                              handleCellChange(row.index, "tillDateRevenue", Number(e.target.value))
                            }
                            className="w-32 text-right rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-sm text-slate-900 font-bold focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[34px]"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-slate-700 font-bold text-sm">
                          {formatINR(row.achievedTillDate)}
                        </span>
                      )}
                    </td>

                    {/* Pending Amount */}
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-600 text-sm">
                      {formatINR(row.pending)}
                    </td>

                    {/* Dynamic PO Amount */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sky-700 font-bold text-sm">
                          {formatINR(row.poAmount)}
                        </span>
                        {row.poAmount > 0 && (
                          <span className="text-[9px] text-sky-500 mt-0.5">
                            Approved Contracts
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Balance */}
                    <td className="px-5 py-4 text-right">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          Target Assured
                        </span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-black text-sm ${row.balance > 100000 ? "text-amber-600 animate-pulse" : "text-rose-600"}`}>
                            {formatINR(row.balance)}
                          </span>
                          {row.balance > 200000 && (
                            <span className="text-[9px] text-amber-500 flex items-center gap-0.5 mt-0.5 font-semibold">
                              <AlertTriangle className="h-2.5 w-2.5" /> High Shortfall
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Grand Totals Footer */}
              <tr className="bg-slate-100/80 font-black border-t border-slate-300 text-slate-900 select-none">
                <td className="px-5 py-4 text-sm uppercase tracking-wider font-extrabold">
                  Grand Totals
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm">
                  {formatINR(totalTarget)}
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm">
                  {formatINR(totalAchieved)}
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm">
                  {formatINR(totalPending)}
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm text-sky-800">
                  {formatINR(totalPoAmount)}
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm text-slate-900">
                  {formatINR(totalBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Admin Action Button */}
        {isMasterAdmin && (
          <div className="flex justify-end">
            <button
              id="btn-save-revenue-summary"
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 disabled:bg-slate-400 transition-all cursor-pointer border border-transparent"
            >
              <Save className="h-4 w-4 shrink-0" />
              {saving ? "Saving Targets..." : "Save Target Summary"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
