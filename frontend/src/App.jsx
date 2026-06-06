import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AlertCircle, BarChart3, Database, FileSpreadsheet, History as HistoryIcon, Loader2, UploadCloud } from "lucide-react";

import { analyzeDataset, generateAIAnalysis, healthCheck, uploadFile } from "./api";
import AIReport from "./components/AIReport";
import AnalysisReport from "./components/AnalysisReport";
import CleaningReport from "./components/CleaningReport";
import History from "./pages/History";

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
    <main className="min-h-screen bg-[#0a0b0d] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader />
        {serverWaking && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            <Loader2 className="h-4 w-4 animate-spin text-amber-300" aria-hidden="true" />
            Waking up server...
          </div>
        )}
        <Routes>
          <Route path="/" element={<HomeFlow />} />
          <Route path="/history" element={<HistoryRoute />} />
        </Routes>
      </div>
    </main>
  );
}

function HistoryRoute() {
  const navigate = useNavigate();
  return <History onReset={() => navigate("/")} />;
}

function AppHeader() {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <Link to="/" className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-white">DataSense AI</h1>
          <p className="text-sm text-zinc-400">AI data analyst workflow</p>
        </div>
      </Link>

      <nav className="flex items-center gap-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm transition ${
              isActive ? "bg-emerald-400 text-zinc-950" : "border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
            }`
          }
        >
          Workspace
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              isActive ? "bg-emerald-400 text-zinc-950" : "border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
            }`
          }
        >
          <HistoryIcon className="h-4 w-4" aria-hidden="true" />
          History
        </NavLink>
      </nav>
    </header>
  );
}

function HomeFlow() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState(null);

  const resetApp = useCallback(() => {
    setSelectedFile(null);
    setFileInfo(null);
    setResult(null);
    setAnalysisResult(null);
    setAiResult(null);
    setAiGeneratedAt(null);
    setError("");
    setIsDragging(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    navigate("/");
  }, [navigate]);

  const setFile = useCallback(async (file) => {
    setError("");
    setResult(null);
    setAnalysisResult(null);
    setAiResult(null);
    setAiGeneratedAt(null);
    setFileInfo(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setSelectedFile(null);
      setError("Please upload a CSV or XLSX file.");
      return;
    }

    setSelectedFile(file);
    const estimatedRows = extension === ".csv" ? await estimateCsvRows(file) : null;
    setFileInfo({
      name: file.name,
      size: file.size,
      estimatedRows,
      tooLarge: file.size > MAX_FILE_SIZE_BYTES,
    });
  }, []);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    setFile(event.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Choose a dataset before uploading.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError("File size exceeds the 50MB limit.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const response = await uploadFile(selectedFile);
      setResult(response);
      setAnalysisResult(null);
      setAiResult(null);
      setAiGeneratedAt(null);
    } catch (uploadError) {
      const message =
        uploadError.response?.data?.detail ||
        uploadError.message ||
        "Something went wrong while uploading the file.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!result?.supabase_path) {
      setError("The cleaned dataset path is missing. Please upload the file again.");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      const response = await analyzeDataset(result.supabase_path);
      setAnalysisResult({
        ...response,
        supabase_path: result.supabase_path,
        cleaning_report: result.cleaning_report,
        column_info: result.column_info,
      });
      setAiResult(null);
      setAiGeneratedAt(null);
    } catch (analysisError) {
      const message =
        analysisError.response?.data?.detail ||
        analysisError.message ||
        "Something went wrong while analyzing the dataset.";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!analysisResult?.analysis || !analysisResult?.supabase_path) {
      setError("Analysis results are missing. Please run analysis again.");
      return;
    }

    setIsGeneratingAI(true);
    setError("");

    try {
      const response = await generateAIAnalysis({
        supabasePath: analysisResult.supabase_path,
        analysisResults: analysisResult.analysis,
        cleaningReport: analysisResult.cleaning_report || {},
        columnInfo: analysisResult.column_info || [],
      });
      setAiResult(response);
      setAiGeneratedAt(new Date().toISOString());
    } catch (aiError) {
      const message =
        aiError.response?.data?.detail ||
        aiError.message ||
        "Something went wrong while generating the AI analysis.";
      setError(message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const currentStep = aiResult ? 4 : analysisResult ? 3 : result ? 2 : 1;

  return (
    <section className="relative grid flex-1 gap-6 py-8 lg:grid-cols-[420px_minmax(0,1fr)]">
      <div className="animated-grid-bg pointer-events-none absolute inset-0 -z-0" />
      <div className="relative z-10 space-y-4">
        <StepProgress currentStep={currentStep} />
        <UploadPanel
          inputRef={inputRef}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          handleDrop={handleDrop}
          setFile={setFile}
          selectedFile={selectedFile}
          fileInfo={fileInfo}
        />

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || fileInfo?.tooLarge}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cleaning your data...
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload and Clean
            </>
          )}
        </button>
      </div>

      <div className="relative z-10 min-w-0">
        {aiResult ? (
          <AIReport result={aiResult} generatedAt={aiGeneratedAt} onReset={resetApp} />
        ) : analysisResult ? (
          <AnalysisReport result={analysisResult} onGenerateAI={handleGenerateAI} isGeneratingAI={isGeneratingAI} />
        ) : result ? (
          <CleaningReport result={result} onProceed={handleAnalyze} isAnalyzing={isAnalyzing} />
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/95 p-8 text-center shadow-panel backdrop-blur">
            <div className="max-w-sm">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
                <Database className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-zinc-200">Cleaning report will appear here</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Upload a dataset to review row counts, type conversions, filled values, and the cleaned preview.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function UploadPanel({ inputRef, isDragging, setIsDragging, handleDrop, setFile, selectedFile, fileInfo }) {
  return (
    <div
      className={`flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition ${
        isDragging
          ? "border-emerald-300 bg-emerald-400/10"
          : "border-zinc-700 bg-zinc-950/95 hover:border-zinc-500 hover:bg-zinc-900/90"
      }`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".csv,.xlsx"
        onChange={(event) => setFile(event.target.files?.[0])}
      />
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-emerald-300">
        <UploadCloud className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="text-base font-medium text-white">Drop your dataset here</p>
      <p className="mt-2 text-sm text-zinc-400">CSV or XLSX, 50MB max</p>
      {selectedFile && fileInfo && (
        <div className="mt-6 w-full rounded-lg border border-zinc-800 bg-black/30 p-3 text-left text-sm text-zinc-300">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span className="truncate font-medium text-white">{fileInfo.name}</span>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
            <span>Size: {formatBytes(fileInfo.size)}</span>
            <span>Estimated rows: {fileInfo.estimatedRows ? fileInfo.estimatedRows.toLocaleString() : "N/A"}</span>
          </div>
          {fileInfo.tooLarge && <p className="mt-3 text-xs text-red-300">This file exceeds the 50MB limit.</p>}
        </div>
      )}
    </div>
  );
}

function StepProgress({ currentStep }) {
  const steps = ["Upload", "Cleaning Report", "Analysis", "AI Report"];
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
      <div className="grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;
          return (
            <div key={step} className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  isComplete || isActive ? "bg-emerald-400 text-zinc-950" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {stepNumber}
              </span>
              <span className={`text-xs font-medium ${isActive ? "text-white" : "text-zinc-500"}`}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
