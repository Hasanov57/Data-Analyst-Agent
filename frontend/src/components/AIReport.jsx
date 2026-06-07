import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function AIReport({ result, generatedAt, onReset, onRegenerate, isRegenerating = false }) {
  const reportRef = useRef(null);
  const report = result?.ai_report || {};
  const quality = report.data_quality_assessment || {};
  const score = clampScore(quality.score);
  const [openColumns, setOpenColumns] = useState({});
  const [isExporting, setIsExporting] = useState(false);

  const columnNarratives = report.column_narratives || {};
  const generatedLabel = generatedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(generatedAt))
    : "Just now";

  const exportReport = async () => {
    if (!reportRef.current) {
      return;
    }

    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
        heightLeft -= pageHeight;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      pdf.save(`datawhiz-report-${timestamp}.pdf`);
    } catch (exportError) {
      console.error("PDF export failed:", exportError);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div ref={reportRef} className="space-y-6 bg-slate-50">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-emerald-300">
                <BrainCircuit className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">AI Analysis Report</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Business-ready interpretation</h2>
                <p className="mt-2 text-sm text-slate-500">Generated {generatedLabel}</p>
                {result?.report_id && <p className="mt-2 text-xs text-slate-400">Report ID: {result.report_id}</p>}
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <QualityScore score={score} />
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Data Quality Score</p>
                <p className={`mt-1 text-sm font-semibold ${scoreTone(score)}`}>{scoreLabel(score)}</p>
              </div>
            </div>
          </div>
        </div>

        <ReportCard icon={Sparkles} title="Executive Summary">
          <p className="max-w-4xl text-lg leading-8 text-slate-700">{report.executive_summary || "No summary returned."}</p>
        </ReportCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <ReportCard title="Key Insights">
            <div className="space-y-3">
              {(report.key_insights || []).map((insight, index) => (
                <article key={`${insight.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-base font-semibold text-slate-950">{insight.title}</h4>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${importanceTone(insight.importance)}`}>
                      {insight.importance || "low"}
                    </span>
                  </div>
                  <p className="leading-6 text-slate-600">{insight.detail}</p>
                </article>
              ))}
              {!report.key_insights?.length && <p className="text-sm text-slate-500">No key insights returned.</p>}
            </div>
          </ReportCard>

          <ReportCard title="Data Quality Assessment">
            <div className="space-y-5">
              <QualityList title="Findings" items={quality.findings || []} />
              <QualityList title="Recommendations" items={quality.recommendations || []} />
            </div>
          </ReportCard>
        </div>

        <ReportCard title="Column Narratives">
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {Object.entries(columnNarratives).map(([column, narrative]) => {
              const isOpen = Boolean(openColumns[column]);
              return (
                <div key={column}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
                    onClick={() => setOpenColumns((current) => ({ ...current, [column]: !isOpen }))}
                  >
                    <span className="font-medium text-slate-950">{column}</span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    )}
                  </button>
                  {isOpen && <p className="border-t border-slate-200 px-4 pb-4 pt-3 leading-6 text-slate-600">{narrative}</p>}
                </div>
              );
            })}
            {!Object.keys(columnNarratives).length && <p className="p-4 text-sm text-slate-500">No column narratives returned.</p>}
          </div>
        </ReportCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <ReportCard icon={GitCompareArrows} title="Correlation Insights">
            <div className="space-y-3">
              {(report.correlation_insights || []).map((insight, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  <ArrowRight className="mr-2 inline h-4 w-4 text-emerald-700" aria-hidden="true" />
                  {insight}
                </div>
              ))}
              {!report.correlation_insights?.length && <p className="text-sm text-slate-500">No correlation insights returned.</p>}
            </div>
          </ReportCard>

          <ReportCard icon={AlertTriangle} title="Anomalies & Risks">
            <div className="space-y-3">
              {(report.anomalies_and_risks || []).map((risk, index) => (
                <div key={index} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <AlertTriangle className="mr-2 inline h-4 w-4 text-amber-700" aria-hidden="true" />
                  {risk}
                </div>
              ))}
              {!report.anomalies_and_risks?.length && <p className="text-sm text-slate-500">No anomalies or risks returned.</p>}
            </div>
          </ReportCard>
        </div>

        <ReportCard title="Business Recommendations">
          <ol className="space-y-3">
            {(report.business_recommendations || []).map((recommendation, index) => (
              <li key={index} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>
                  <span className="mr-2 font-semibold text-slate-950">{index + 1}.</span>
                  {recommendation}
                </span>
              </li>
            ))}
          </ol>
        </ReportCard>

        <ReportCard title="Suggested Next Analyses">
          <div className="flex flex-wrap gap-2">
            {(report.suggested_next_analyses || []).map((analysis, index) => (
              <span key={index} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                {analysis}
              </span>
            ))}
          </div>
        </ReportCard>
      </div>

      <footer className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
        <button type="button" className="btn-secondary" onClick={exportReport} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Exporting report...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Report
            </>
          )}
        </button>
        {onRegenerate && (
          <button type="button" className="btn-secondary" onClick={onRegenerate} disabled={isRegenerating}>
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Regenerate
              </>
            )}
          </button>
        )}
        <button type="button" className="btn-primary" onClick={onReset}>
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          Analyze Another File
        </button>
      </footer>
    </section>
  );
}

function ReportCard({ icon: Icon, title, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />}
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function QualityScore({ score }) {
  return (
    <div
      className="grid h-20 w-20 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${scoreColor(score)} ${score * 3.6}deg, #e2e8f0 0deg)`,
      }}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-white">
        <span className="text-lg font-semibold text-slate-950">{score}</span>
      </div>
    </div>
  );
}

function QualityList({ title, items }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-slate-950">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
            {item}
          </li>
        ))}
        {!items.length && <li className="text-sm text-slate-500">None returned.</li>}
      </ul>
    </div>
  );
}

function clampScore(value) {
  const score = Number(value);
  if (Number.isNaN(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(score) {
  if (score >= 80) {
    return "#059669";
  }
  if (score >= 60) {
    return "#d97706";
  }
  return "#dc2626";
}

function scoreTone(score) {
  if (score >= 80) {
    return "text-emerald-700";
  }
  if (score >= 60) {
    return "text-amber-700";
  }
  return "text-red-700";
}

function scoreLabel(score) {
  if (score >= 80) {
    return "Strong";
  }
  if (score >= 60) {
    return "Needs review";
  }
  return "High risk";
}

function importanceTone(importance) {
  if (importance === "high") {
    return "border border-red-200 bg-red-50 text-red-700";
  }
  if (importance === "medium") {
    return "border border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border border-slate-200 bg-slate-100 text-slate-600";
}
