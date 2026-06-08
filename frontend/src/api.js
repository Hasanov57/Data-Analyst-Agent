import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

const CLIENT_ID_KEY = "datawhiz_client_id";

export function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/api/upload", formData);

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
    client_id: getClientId(),
  });

  return response.data;
}

export async function healthCheck() {
  const response = await api.get("/health");
  return response.data;
}

export async function getReports() {
  const response = await api.get("/api/reports", {
    headers: {
      "X-Client-Id": getClientId(),
    },
  });
  return response.data;
}

export async function getReport(reportId) {
  const response = await api.get(`/api/reports/${reportId}`, {
    headers: {
      "X-Client-Id": getClientId(),
    },
  });
  return response.data;
}

export default api;
