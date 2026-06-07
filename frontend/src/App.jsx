import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { analyzeDataset, generateAIAnalysis, healthCheck, uploadFile } from "./api";
import AIReport from "./components/AIReport";
import AnalysisReport from "./components/AnalysisReport";
import CleaningReport from "./components/CleaningReport";
import Navbar from "./components/Navbar";
import History from "./pages/History";
import Landing from "./pages/Landing";

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function App() {
  const [serverWaking, setServerWaking] = useState(false);

  useEffect(() => {
    let intervalId;
    let isMounted = true;

    async function pingBackend() {
      try {
        await healthCheck();
        if (isMounted) {
          setServerWaking(false);
        }
        if (intervalId) {
          clearInterval(intervalId);
        }
      } catch {
        if (isMounted) {
          setServerWaking(true);
        }
        if (!intervalId) {
          intervalId = setInterval(pingBackend, 5000);
        }
      }
    }

    pingBackend();
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      {serverWaking && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Waking up server...
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/analyze" element={<AnalyzeWorkspace />} />
        <Route path="/history" element={<HistoryRoute />} />
      </Routes>
    </main>
  );
}

function HistoryRoute() {
  const navigate = useNavigate();
  return (
    <PageShell>
      <History onReset={() => navigate("/analyze")} />
    </PageShell>
  );
}

function AnalyzeWorkspace() {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [flowState, setFlowState] = useState("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const resetResults = () => {
    setResult(null);
    setAnalysisResult(null);
    setAiResult(null);
    setAiGeneratedAt(null);
  };

  const resetApp = useCallback(() => {
    setSelectedFile(null);
    setFileInfo(null);
    setFlowState("idle");
    setStatusMessage("");
    setError("");
    resetResults();
    clearInput();
  }, []);

  const setFile = useCallback(async (file) => {
    setError("");
    setStatusMessage("");
    resetResults();

    if (!file) {
      setSelectedFile(null);
      setFileInfo(null);
      setFlowState("idle");
      return;
    }

    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      console.error("Unsupported file type:", file.name);
      setError("This file type is not supported. Please upload a CSV or XLSX file.");
      setSelectedFile(null);
      setFileInfo(null);
      setFlowState("idle");
      clearInput();
      return;
    }

    const estimatedRows = extension === ".csv" ? await estimateCsvRows(file) : null;
    setSelectedFile(file);
    setFileInfo({
      name: file.name,
      size: file.size,
      type: extension.replace(".", "").toUpperCase(),
      estimatedRows,
      tooLarge: file.size > MAX_FILE_SIZE_BYTES,
    });
    setFlowState("selected");
  }, []);

  const removeFile = () => {
    setSelectedFile(null);
    setFileInfo(null);
    setFlowState("idle");
    setStatusMessage("");
    setError("");
    resetResults();
    clearInput();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    setFile(event.dataTransfer.files?.[0]);
  };

  const handleContinue = async () => {
    if (!selectedFile) {
      setError("Choose a dataset before continuing.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError("This file is larger than the 50MB limit.");
      return;
    }

    setError("");
    resetResults();
    let uploadSucceeded = false;

    try {
      setFlowState("cleaning");
      setStatusMessage("Uploading dataset and cleaning data...");
      const uploadResponse = await uploadFile(selectedFile);
      uploadSucceeded = true;
      setResult(uploadResponse);

      setFlowState("analyzing");
      setStatusMessage("Running statistical analysis and preparing visualizations...");
      const analysisResponse = await analyzeDataset(uploadResponse.supabase_path);
      setAnalysisResult({
        ...analysisResponse,
        supabase_path: uploadResponse.supabase_path,
        cleaning_report: uploadResponse.cleaning_report,
        column_info: uploadResponse.column_info,
      });

      setFlowState("results");
      setStatusMessage("Analysis complete.");
    } catch (processError) {
      console.error(processError);
      setFlowState(uploadSucceeded ? "results" : "selected");
      setStatusMessage("");
      setError(getFriendlyError(processError));
    }
  };

  const handleGenerateAI = async () => {
    if (!analysisResult?.analysis || !analysisResult?.supabase_path) {
      setError("Analysis results are missing. Please run analysis again.");
      return;
    }

    setIsGeneratingAI(true);
    setError("");
    setStatusMessage("Generating AI insights...");

    try {
      const response = await generateAIAnalysis({
        supabasePath: analysisResult.supabase_path,
        analysisResults: analysisResult.analysis,
        cleaningReport: analysisResult.cleaning_report || {},
        columnInfo: analysisResult.column_info || [],
      });
      setAiResult(response);
      setAiGeneratedAt(new Date().toISOString());
      setFlowState("ai");
      setStatusMessage("AI report generated.");
    } catch (aiError) {
      console.error(aiError);
      setError(getFriendlyError(aiError, "AI request failed. Please check your API configuration and try again."));
      setStatusMessage("");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const hasStarted = ["cleaning", "analyzing", "results", "ai"].includes(flowState);
  const isProcessing = ["cleaning", "analyzing"].includes(flowState);
  const currentStep = aiResult ? 4 : analysisResult ? 3 : result ? 2 : selectedFile ? 1 : 0;
  const overview = analysisResult?.analysis?.dataset_overview || {};

  return (
    <PageShell>
      <input
        ref={inputRef}
        id="dataset-upload"
        className="sr-only"
        type="file"
        accept=".csv,.xlsx"
        aria-label="Upload CSV or Excel dataset"
        onChange={(event) => setFile(event.target.files?.[0])}
      />

      {!hasStarted ? (
        <UploadStart
          inputRef={inputRef}
          fileInfo={fileInfo}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          handleDrop={handleDrop}
          removeFile={removeFile}
          handleContinue={handleContinue}
          error={error}
        />
      ) : (
        <div className="space-y-8">
          <DatasetHeader
            fileInfo={fileInfo}
            overview={overview}
            statusMessage={statusMessage}
            isProcessing={isProcessing || isGeneratingAI}
            onChangeFile={() => inputRef.current?.click()}
          />
          <AnalysisProgress currentStep={currentStep} flowState={flowState} />
          {error && <ErrorMessage message={error} onRetry={flowState === "selected" ? handleContinue : undefined} />}
          {isProcessing && <ProcessingState flowState={flowState} />}
          {result && (
            <CleaningReport result={result} />
          )}
          {analysisResult && (
            <AnalysisReport
              result={analysisResult}
              onGenerateAI={handleGenerateAI}
              isGeneratingAI={isGeneratingAI}
            />
          )}
          {aiResult && (
            <AIReport
              result={aiResult}
              generatedAt={aiGeneratedAt}
              onReset={resetApp}
              onRegenerate={handleGenerateAI}
              isRegenerating={isGeneratingAI}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ children }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>;
}

function UploadStart({ inputRef, fileInfo, isDragging, setIsDragging, handleDrop, removeFile, handleContinue, error }) {
  return (
    <section className="mx-auto max-w-4xl py-10 sm:py-14">
      <div className="text-center">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Start a new data analysis</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Upload a CSV or Excel file. DataWhiz AI will clean it, compute statistics, prepare visualizations, and generate an AI report.
        </p>
      </div>

      <div className="mt-10">
        {!fileInfo ? (
          <UploadDropzone
            inputRef={inputRef}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            handleDrop={handleDrop}
          />
        ) : (
          <SelectedFileCard
            fileInfo={fileInfo}
            onChange={() => inputRef.current?.click()}
            onRemove={removeFile}
            onContinue={handleContinue}
          />
        )}
      </div>

      {error && <div className="mt-5"><ErrorMessage message={error} /></div>}
    </section>
  );
}

function UploadDropzone({ inputRef, isDragging, setIsDragging, handleDrop }) {
  return (
    <label
      htmlFor="dataset-upload"
      className={`flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-white p-8 text-center shadow-sm transition ${
        isDragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <UploadCloud className="h-8 w-8" aria-hidden="true" />
      </span>
      <span className="mt-6 text-xl font-semibold text-slate-950">Drag and drop your dataset here</span>
      <span className="mt-2 text-sm text-slate-500">or click to browse</span>
      <span className="mt-6 inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
        CSV and XLSX supported - 50MB max
      </span>
      <button
        type="button"
        className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        onClick={(event) => {
          event.preventDefault();
          inputRef.current?.click();
        }}
      >
        Choose File
      </button>
    </label>
  );
}

function SelectedFileCard({ fileInfo, onChange, onRemove, onContinue }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <FileCheck2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-slate-950">{fileInfo.name}</h2>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-3">
              <span>Type: {fileInfo.type}</span>
              <span>Size: {formatBytes(fileInfo.size)}</span>
              <span>Estimated rows: {fileInfo.estimatedRows ? fileInfo.estimatedRows.toLocaleString() : "N/A"}</span>
            </div>
            {fileInfo.tooLarge && <p className="mt-3 text-sm font-medium text-red-600">This file exceeds the 50MB limit.</p>}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-secondary" onClick={onChange}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Change File
          </button>
          <button type="button" className="btn-danger" onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove File
          </button>
          <button type="button" className="btn-primary" onClick={onContinue} disabled={fileInfo.tooLarge}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function DatasetHeader({ fileInfo, overview, statusMessage, isProcessing, onChangeFile }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-950">{fileInfo?.name || "Dataset"}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {fileInfo?.type || "File"} - {fileInfo ? formatBytes(fileInfo.size) : "N/A"}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[560px]">
          <HeaderMetric label="Rows" value={formatNumber(overview.total_rows)} />
          <HeaderMetric label="Columns" value={formatNumber(overview.total_columns)} />
          <HeaderMetric label="Status" value={isProcessing ? "Processing" : statusMessage || "Ready"} />
          <button type="button" className="btn-secondary justify-center" onClick={onChangeFile}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Change File
          </button>
        </div>
      </div>
    </section>
  );
}

function HeaderMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function AnalysisProgress({ currentStep }) {
  const steps = ["File Uploaded", "Data Cleaned", "Statistical Analysis", "AI Report Generated"];
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          return (
            <div key={step} className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                  isComplete
                    ? "bg-emerald-600 text-white"
                    : isCurrent
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {isComplete ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : stepNumber}
              </span>
              <span className={`text-sm font-medium ${isCurrent ? "text-slate-950" : "text-slate-500"}`}>{step}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProcessingState({ flowState }) {
  const message = flowState === "cleaning" ? "Cleaning data..." : "Preparing visualizations...";
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{message}</h2>
          <p className="mt-1 text-sm text-slate-500">This usually takes a few seconds for typical CSV or Excel files.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200" />
    </div>
  );
}

function ErrorMessage({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">Something needs attention</p>
          <p className="mt-1 text-sm leading-6">{message}</p>
          {onRetry && (
            <button type="button" className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getFriendlyError(error, fallback = "Something went wrong. Please try again.") {
  const rawMessage = error.response?.data?.detail || error.message || fallback;
  console.error("Technical error:", rawMessage);

  if (String(rawMessage).includes("50MB")) {
    return "This file is larger than the 50MB upload limit.";
  }
  if (String(rawMessage).includes("500,000 rows")) {
    return "This dataset is too large for the current version. Please use a file with 500,000 rows or fewer.";
  }
  if (String(rawMessage).toLowerCase().includes("unsupported") || String(rawMessage).includes(".csv")) {
    return "Please upload a valid CSV or XLSX file.";
  }
  if (String(rawMessage).toLowerCase().includes("supabase")) {
    return "The storage service could not be reached. Please try again shortly.";
  }
  if (String(rawMessage).toLowerCase().includes("groq")) {
    return "The AI analysis service could not complete the request. Please try again shortly.";
  }
  if (String(rawMessage).toLowerCase().includes("network")) {
    return "The backend server could not be reached. It may still be waking up.";
  }
  return fallback;
}

async function estimateCsvRows(file) {
  const sampleSize = Math.min(file.size, 256 * 1024);
  if (!sampleSize) {
    return 0;
  }

  try {
    const text = await file.slice(0, sampleSize).text();
    const lineCount = (text.match(/\n/g) || []).length;
    if (file.size <= sampleSize) {
      return Math.max(lineCount - 1, 0);
    }
    return Math.max(Math.round((lineCount * file.size) / sampleSize) - 1, 0);
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) {
    return "N/A";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString() : "N/A";
}
