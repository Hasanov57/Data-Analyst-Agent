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
  Sparkles,
} from "lucide-react";


export default function AIReport({ result, generatedAt, onReset }) {
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
        backgroundColor: "#0a0b0d",
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
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div ref={reportRef} className="space-y-5">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <BrainCircuit className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">AI Analysis Report</h2>
              <p className="mt-1 text-sm text-zinc-400">Generated {generatedLabel}</p>
              {result?.report_id && <p className="mt-2 text-xs text-zinc-600">Report ID: {result.report_id}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-[#111214] px-4 py-3">
            <QualityScore score={score} />
            <div>
              <p className="text-xs font-medium uppercase text-zinc-500">Data Quality Score</p>
              <p className={`mt-1 text-sm font-semibold ${scoreTone(score)}`}>{scoreLabel(score)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-white">Executive Summary</h3>
        </div>
        <p className="max-w-4xl text-lg leading-8 text-zinc-200">{report.executive_summary || "No summary returned."}</p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
          <h3 className="mb-4 text-lg font-semibold text-white">Key Insights</h3>
          <div className="space-y-3">
            {(report.key_insights || []).map((insight, index) => (
              <article key={`${insight.title}-${index}`} className="rounded-lg border border-zinc-800 bg-[#111214] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-white">{insight.title}</h4>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${importanceTone(insight.importance)}`}>
                    {insight.importance || "low"}
                  </span>
                </div>
                <p className="leading-6 text-zinc-300">{insight.detail}</p>
              </article>
            ))}
            {!report.key_insights?.length && <p className="text-sm text-zinc-500">No key insights returned.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
          <h3 className="mb-4 text-lg font-semibold text-white">Data Quality Assessment</h3>
          <div className="space-y-5">
            <QualityList title="Findings" items={quality.findings || []} />
            <QualityList title="Recommendations" items={quality.recommendations || []} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
        <h3 className="mb-4 text-lg font-semibold text-white">Column Narratives</h3>
        <div className="divide-y divide-zinc-900 rounded-lg border border-zinc-800">
          {Object.entries(columnNarratives).map(([column, narrative]) => {
            const isOpen = Boolean(openColumns[column]);
            return (
              <div key={column}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-900"
                  onClick={() => setOpenColumns((current) => ({ ...current, [column]: !isOpen }))}
                >
                  <span className="font-medium text-white">{column}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                  )}
                </button>
                {isOpen && <p className="border-t border-zinc-900 px-4 pb-4 pt-3 leading-6 text-zinc-300">{narrative}</p>}
              </div>
            );
          })}
          {!Object.keys(columnNarratives).length && <p className="p-4 text-sm text-zinc-500">No column narratives returned.</p>}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
          <div className="mb-4 flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">Correlation Insights</h3>
          </div>
          <div className="space-y-3">
            {(report.correlation_insights || []).map((insight, index) => (
              <div key={index} className="rounded-lg border border-zinc-800 bg-[#111214] px-4 py-3 text-sm leading-6 text-zinc-300">
                <ArrowRight className="mr-2 inline h-4 w-4 text-emerald-300" aria-hidden="true" />
                {insight}
              </div>
            ))}
            {!report.correlation_insights?.length && <p className="text-sm text-zinc-500">No correlation insights returned.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">Anomalies & Risks</h3>
          </div>
          <div className="space-y-3">
            {(report.anomalies_and_risks || []).map((risk, index) => (
              <div key={index} className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
                <AlertTriangle className="mr-2 inline h-4 w-4 text-amber-300" aria-hidden="true" />
                {risk}
              </div>
            ))}
            {!report.anomalies_and_risks?.length && <p className="text-sm text-zinc-500">No anomalies or risks returned.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
        <h3 className="mb-4 text-lg font-semibold text-white">Business Recommendations</h3>
        <ol className="space-y-3">
          {(report.business_recommendations || []).map((recommendation, index) => (
            <li key={index} className="flex gap-3 rounded-lg border border-zinc-800 bg-[#111214] p-4 text-zinc-300">
              <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
              <span>
                <span className="mr-2 font-semibold text-white">{index + 1}.</span>
                {recommendation}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-panel">
        <h3 className="mb-4 text-lg font-semibold text-white">Suggested Next Analyses</h3>
        <div className="flex flex-wrap gap-2">
          {(report.suggested_next_analyses || []).map((analysis, index) => (
            <span key={index} className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              {analysis}
            </span>
          ))}
        </div>
      </section>
      </div>

      <footer className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel sm:flex-row">
        <button
          type="button"
          className="flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-500"
          onClick={exportReport}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Report
            </>
          )}
        </button>
        <button
          type="button"
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          onClick={onReset}
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          Analyze Another File
        </button>
      </footer>
    </div>
  );
}

function QualityScore({ score }) {
  return (
    <div
      className="grid h-20 w-20 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${scoreColor(score)} ${score * 3.6}deg, #27272a 0deg)`,
      }}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#111214]">
        <span className="text-lg font-semibold text-white">{score}</span>
      </div>
    </div>
  );
}

function QualityList({ title, items }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-white">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-lg border border-zinc-800 bg-[#111214] px-3 py-2 text-sm leading-6 text-zinc-300">
            {item}
          </li>
        ))}
        {!items.length && <li className="text-sm text-zinc-500">None returned.</li>}
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
    return "#34d399";
  }
  if (score >= 60) {
    return "#fbbf24";
  }
  return "#f87171";
}

function scoreTone(score) {
  if (score >= 80) {
    return "text-emerald-300";
  }
  if (score >= 60) {
    return "text-amber-300";
  }
  return "text-red-300";
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
    return "bg-red-400/10 text-red-200 border border-red-300/30";
  }
  if (importance === "medium") {
    return "bg-amber-300/10 text-amber-100 border border-amber-300/30";
  }
  return "bg-zinc-800 text-zinc-300 border border-zinc-700";
}
