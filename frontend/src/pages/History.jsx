import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, FileText, Loader2, Search } from "lucide-react";

import { getReport, getReports } from "../api";
import AIReport from "../components/AIReport";

export default function History({ onReset }) {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      setIsLoading(true);
      setError("");
      try {
        const response = await getReports();
        if (isMounted) {
          setReports(response.reports || []);
        }
      } catch (historyError) {
        if (isMounted) {
          setError(historyError.response?.data?.detail || historyError.message || "Unable to load report history.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadReports();
    return () => {
      isMounted = false;
    };
  }, []);

  const openReport = async (reportId) => {
    setIsOpening(true);
    setError("");
    try {
      const report = await getReport(reportId);
      setSelectedReport({
        ai_report: report.ai_report,
        report_id: report.report_id,
        analysis_results: report.analysis_results,
        created_at: report.created_at,
      });
    } catch (openError) {
      setError(openError.response?.data?.detail || openError.message || "Unable to open report.");
    } finally {
      setIsOpening(false);
    }
  };

  if (selectedReport) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 transition hover:bg-zinc-900"
          onClick={() => setSelectedReport(null)}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to History
        </button>
        <AIReport result={selectedReport} generatedAt={selectedReport.created_at} onReset={onReset} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Report History</h2>
            <p className="mt-1 text-sm text-zinc-400">Recent AI analysis reports saved in Supabase.</p>
          </div>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800 bg-[#111214] px-3 text-sm text-zinc-400">
            <CalendarDays className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Last 20 reports
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-300" aria-hidden="true" />
          Loading reports...
        </div>
      ) : reports.length ? (
        <div className="space-y-3">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              className="grid w-full gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-zinc-600 hover:bg-zinc-900 md:grid-cols-[minmax(0,1.2fr)_140px_120px_100px]"
              onClick={() => openReport(report.id)}
              disabled={isOpening}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  <p className="truncate font-medium text-white">{report.filename || "dataset.csv"}</p>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">
                  {report.executive_summary || "No summary saved."}
                </p>
              </div>
              <HistoryMetric label="Date Analyzed" value={formatDate(report.created_at)} />
              <HistoryMetric label="Quality Score" value={formatScore(report.data_quality_score)} />
              <HistoryMetric label="Rows" value={formatNumber(report.row_count)} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyHistory />
      )}
    </div>
  );
}

function HistoryMetric({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center shadow-panel">
      <div className="relative mb-6 h-28 w-28">
        <div className="absolute inset-0 rounded-full border border-emerald-400/20 bg-emerald-400/5" />
        <div className="absolute left-7 top-7 grid h-14 w-14 place-items-center rounded-lg border border-zinc-700 bg-[#111214]">
          <Search className="h-7 w-7 text-emerald-300" aria-hidden="true" />
        </div>
        <div className="absolute right-3 top-5 h-3 w-3 rounded-full bg-emerald-300/60" />
        <div className="absolute bottom-5 left-4 h-2 w-2 rounded-full bg-zinc-500" />
      </div>
      <h3 className="text-lg font-semibold text-white">No saved reports yet</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
        Finished AI reports will appear here after Supabase is configured and an analysis is generated.
      </p>
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatScore(value) {
  const score = Number(value);
  return Number.isNaN(score) ? "N/A" : `${Math.round(score)}/100`;
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString() : "N/A";
}
