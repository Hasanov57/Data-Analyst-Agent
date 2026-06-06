import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/api/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export async function analyzeDataset(supabasePath) {
  const response = await api.post("/api/analyze", {
    supabase_path: supabasePath,
  });

  return response.data;
}

export async function generateAIAnalysis({ supabasePath, analysisResults, cleaningReport, columnInfo }) {
  const response = await api.post("/api/ai-analyze", {
    supabase_path: supabasePath,
    analysis_results: analysisResults,
    cleaning_report: cleaningReport,
    column_info: columnInfo,
  });

  return response.data;
}

export async function healthCheck() {
  const response = await api.get("/health");
  return response.data;
}

export async function getReports() {
  const response = await api.get("/api/reports");
  return response.data;
}

export async function getReport(reportId) {
  const response = await api.get(`/api/reports/${reportId}`);
  return response.data;
}

export default api;
