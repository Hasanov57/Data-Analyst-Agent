import { useMemo, useRef } from "react";
import Plot from "react-plotly.js";
import Plotly from "plotly.js-dist-min";
import { Download } from "lucide-react";

export default function PlotlyChart({ chartJson, title }) {
  const plotRef = useRef(null);
  const figure = useMemo(() => {
    if (!chartJson) {
      return null;
    }

    try {
      return JSON.parse(chartJson);
    } catch {
      return null;
    }
  }, [chartJson]);

  if (!figure) {
    return null;
  }

  const chartTitle = title || figure.layout?.title?.text || "Chart";

  const downloadPng = () => {
    if (!plotRef.current) {
      return;
    }

    Plotly.downloadImage(plotRef.current, {
      format: "png",
      filename: slugify(chartTitle),
      scale: 2,
      width: 1200,
      height: 720,
    });
  };

  const downloadCsv = () => {
    const csv = figureToCsv(figure);
    if (!csv) {
      return;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(chartTitle)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chart-wrapper group relative min-h-[400px]">
      <div className="absolute right-4 top-4 z-10 flex gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" className="chart-download-button" onClick={downloadPng}>
          PNG
        </button>
        <button type="button" className="chart-download-button" onClick={downloadCsv}>
          CSV
        </button>
      </div>
      <Plot
        data={figure.data || []}
        layout={{
          ...(figure.layout || {}),
          autosize: true,
          title: {
            text: chartTitle,
            font: { color: "#e2e8f0", size: 14 },
          },
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          displaylogo: false,
          toImageButtonOptions: {
            format: "png",
            filename: slugify(chartTitle),
            scale: 2,
          },
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onInitialized={(_, graphDiv) => {
          plotRef.current = graphDiv;
        }}
        onUpdate={(_, graphDiv) => {
          plotRef.current = graphDiv;
        }}
      />
    </div>
  );
}

function figureToCsv(figure) {
  const rows = [];
  const traces = figure.data || [];

  traces.forEach((trace, traceIndex) => {
    const fields = Object.entries(trace).filter(([, value]) => Array.isArray(value));
    const maxLength = Math.max(0, ...fields.map(([, value]) => value.length));

    for (let index = 0; index < maxLength; index += 1) {
      const row = {
        trace: trace.name || `trace_${traceIndex + 1}`,
        point: index + 1,
      };
      fields.forEach(([field, values]) => {
        row[field] = values[index] ?? "";
      });
      rows.push(row);
    }
  });

  if (!rows.length) {
    return "";
  }

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const body = rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","));
  return `${headers.join(",")}\n${body.join("\n")}`;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function slugify(value) {
  return String(value || "datawhiz_chart")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "datawhiz_chart";
}
