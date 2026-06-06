import { ArrowRight, CheckCircle2, Loader2, Table2 } from "lucide-react";

const summaryLabels = [
  ["Rows Before", "rows_before"],
  ["Rows After", "rows_after"],
  ["Duplicates Removed", "duplicates_removed"],
  ["Nulls Filled", "nulls_filled"],
];

export default function CleaningReport({ result, onProceed, isAnalyzing = false }) {
  const report = result.cleaning_report || {};
  const columnInfo = result.column_info || [];
  const previewRows = result.cleaned_data_preview || [];
  const previewColumns = previewRows[0] ? Object.keys(previewRows[0]) : [];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Cleaning Report</h2>
            <p className="mt-1 text-sm text-zinc-400">Cleaned file saved to Supabase storage.</p>
          </div>
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" aria-hidden="true" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryLabels.map(([label, key]) => (
            <div key={key} className="rounded-lg border border-zinc-800 bg-[#111214] p-4">
              <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(report[key])}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <div className="mb-4 flex items-center gap-2">
          <Table2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h3 className="text-base font-semibold text-white">Column Changes</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Column</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Original Dtype</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Converted Dtype</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Nulls Filled</th>
                <th className="min-w-[260px] px-3 py-3 font-medium">Transformations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {columnInfo.map((column) => (
                <tr key={`${column.original_name}-${column.column_name}`} className="text-zinc-300">
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-white">{column.column_name}</td>
                  <td className="whitespace-nowrap px-3 py-3">{column.original_dtype}</td>
                  <td className="whitespace-nowrap px-3 py-3">{column.converted_dtype}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatNumber(column.nulls_filled)}</td>
                  <td className="px-3 py-3">
                    {column.transformations?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {column.transformations.map((transformation) => (
                          <span
                            key={transformation}
                            className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100"
                          >
                            {transformation}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-500">No changes</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-white">Cleaned Data Preview</h3>
          <span className="text-xs text-zinc-500">First 10 rows</span>
        </div>

        <div className="max-h-[420px] overflow-auto rounded-lg border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#111214] text-xs uppercase text-zinc-500">
              <tr>
                {previewColumns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-3 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="text-zinc-300">
                  {previewColumns.map((column) => (
                    <td key={column} className="whitespace-nowrap px-3 py-3">
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        onClick={onProceed}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Running analysis...
          </>
        ) : (
          <>
            Proceed to Analysis <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  return String(value);
}
