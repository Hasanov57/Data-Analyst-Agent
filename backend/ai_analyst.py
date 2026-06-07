import json
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv


load_dotenv()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
SYSTEM_PROMPT = (
    "You are a senior data analyst with 15 years of experience. You have just received a dataset "
    "and its full statistical analysis. Your job is to provide a deep, structured analytical report "
    "as if you were presenting to a business stakeholder. Be specific - reference actual column names, "
    "actual numbers, actual patterns. Do not be generic. Structure your response in clearly labeled sections."
)

JSON_SCHEMA_INSTRUCTIONS = """
Return only a valid JSON object. Do not include markdown, code fences, comments, or explanatory text outside the JSON.

Use this exact structure:
{
  "executive_summary": "3-4 sentence high-level summary of what this dataset is about and its overall quality",
  "data_quality_assessment": {
    "score": "integer from 0 to 100 based on the objective data quality evidence",
    "findings": ["finding 1", "finding 2"],
    "recommendations": ["rec 1", "rec 2"]
  },
  "key_insights": [
    {
      "title": "Insight title",
      "detail": "Full explanation referencing real numbers",
      "importance": "high"
    }
  ],
  "column_narratives": {
    "column_name": "2-3 sentence narrative about this column's behavior, distribution, notable patterns"
  },
  "correlation_insights": ["Insight about correlation pair 1"],
  "anomalies_and_risks": ["Anomaly description 1"],
  "business_recommendations": ["Actionable recommendation 1"],
  "suggested_next_analyses": ["What to investigate next 1"]
}
"""


def build_analyst_prompt(
    analysis_results: dict[str, Any],
    cleaning_report: dict[str, Any] | None,
    column_info: list[dict[str, Any]] | None,
) -> dict[str, str]:
    cleaning_report = cleaning_report or {}
    column_info = column_info or []
    overview = analysis_results.get("dataset_overview", {})
    descriptive_stats = analysis_results.get("descriptive_stats", {})
    correlations = analysis_results.get("correlation_analysis", {})
    categorical_analysis = analysis_results.get("categorical_analysis", {})
    time_series = analysis_results.get("time_series_detection", {})
    outliers = analysis_results.get("outlier_summary", {})
    distributions = analysis_results.get("distribution_analysis", {})

    user_prompt = f"""
You are analyzing a cleaned dataset. Use the statistical results below to produce a business-ready analytical report.

Dataset overview:
- Total rows: {overview.get("total_rows")}
- Total columns: {overview.get("total_columns")}
- Numeric columns: {overview.get("numeric_columns_count")} ({", ".join(overview.get("numeric_columns", []))})
- Categorical columns: {overview.get("categorical_columns_count")} ({", ".join(overview.get("categorical_columns", []))})
- Datetime columns detected: {overview.get("datetime_columns_detected")} ({", ".join(overview.get("datetime_columns", []))})

Cleaning summary:
- Rows before cleaning: {cleaning_report.get("rows_before")}
- Rows after cleaning: {cleaning_report.get("rows_after")}
- Full-row duplicates removed: {cleaning_report.get("duplicates_removed")}
- Duplicate detection method: {cleaning_report.get("duplicate_detection", {}).get("method")}
- Nulls filled: {cleaning_report.get("nulls_filled")}
- Type conversions: {_compact_json(cleaning_report.get("type_conversions", []))}
- Columns cleaned: {_compact_json(cleaning_report.get("columns_cleaned", []))}
- Column info: {_compact_json(column_info)}

Numeric column statistics:
{_numeric_stats_block(descriptive_stats, distributions)}

Top positive correlations:
{_correlation_block(correlations.get("strongest_positive", []))}

Top negative correlations:
{_correlation_block(correlations.get("strongest_negative", []))}

Categorical breakdowns:
{_categorical_block(categorical_analysis)}

Time series:
{_time_series_block(time_series)}

Anomaly and outlier summary:
- Total outliers detected: {outliers.get("total_outliers_detected")}
- Overall outlier percentage: {_format_number(outliers.get("overall_outlier_percentage"))}%
- Columns with most outliers: {_compact_json(outliers.get("columns_with_most_outliers", []))}

Data quality scoring guidance:
- Use 90-100 for very clean data with minimal missing values, duplicates, and outliers.
- Use 70-89 for generally usable data with some cleanup or moderate issues.
- Use 40-69 for data that is usable but needs meaningful review.
- Use below 40 only for severe quality problems such as very high missingness, duplicate rates, or outlier contamination.

Write conclusions that directly reference the actual columns and numbers above. Avoid generic commentary.
{JSON_SCHEMA_INSTRUCTIONS}
"""

    return {
        "system_prompt": SYSTEM_PROMPT,
        "user_prompt": user_prompt.strip(),
    }


async def call_groq_api(prompt_dict: dict[str, str]) -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("Groq API key is not configured.")

    async with httpx.AsyncClient(timeout=60) as client:
        first_response = await _send_groq_request(client, api_key, prompt_dict["system_prompt"], prompt_dict["user_prompt"])
        try:
            return _parse_model_json(first_response)
        except ValueError:
            retry_prompt = (
                f"{prompt_dict['user_prompt']}\n\nYour previous response was not valid JSON. "
                "Return only valid JSON that exactly matches the requested structure."
            )
            second_response = await _send_groq_request(client, api_key, prompt_dict["system_prompt"], retry_prompt)
            return _parse_model_json(second_response)


def apply_objective_quality_score(
    ai_report: dict[str, Any],
    analysis_results: dict[str, Any],
    cleaning_report: dict[str, Any] | None,
) -> dict[str, Any]:
    """Use deterministic data-quality scoring instead of trusting an LLM-created number."""
    cleaning_report = cleaning_report or {}
    score, score_factors = calculate_data_quality_score(analysis_results, cleaning_report)
    assessment = ai_report.setdefault("data_quality_assessment", {})
    assessment["score"] = score

    existing_findings = assessment.get("findings")
    if not isinstance(existing_findings, list):
        existing_findings = []

    factor_summary = (
        "Objective quality score factors: "
        f"missing cells {score_factors['missing_cell_percentage']}%, "
        f"duplicate rows {score_factors['duplicate_row_percentage']}%, "
        f"outlier cells {score_factors['outlier_percentage']}%, "
        f"high-cardinality categorical columns {score_factors['high_cardinality_columns']}."
    )
    if factor_summary not in existing_findings:
        existing_findings.insert(0, factor_summary)
    assessment["findings"] = existing_findings
    assessment["score_factors"] = score_factors
    return ai_report


def calculate_data_quality_score(
    analysis_results: dict[str, Any],
    cleaning_report: dict[str, Any],
) -> tuple[int, dict[str, Any]]:
    pre_profile = cleaning_report.get("pre_clean_profile", {})
    overview = analysis_results.get("dataset_overview", {})
    categorical_analysis = analysis_results.get("categorical_analysis", {})
    outlier_summary = analysis_results.get("outlier_summary", {})

    rows_before = _safe_number(cleaning_report.get("rows_before"), pre_profile.get("total_rows"), overview.get("total_rows"))
    rows_before = max(rows_before, 0)
    total_columns = int(_safe_number(pre_profile.get("total_columns"), overview.get("total_columns")))
    duplicate_rows = _safe_number(cleaning_report.get("duplicates_removed"), pre_profile.get("duplicate_rows"))

    total_cells = rows_before * total_columns
    missing_cells = 0
    for column_profile in pre_profile.get("columns", {}).values():
        missing_cells += int(_safe_number(column_profile.get("null_count")))

    missing_percentage = (missing_cells / total_cells * 100) if total_cells else 0
    duplicate_percentage = (duplicate_rows / rows_before * 100) if rows_before else 0
    outlier_percentage = _safe_number(outlier_summary.get("overall_outlier_percentage"))
    high_cardinality_columns = sum(
        1 for details in categorical_analysis.values() if details.get("high_cardinality")
    )
    categorical_count = max(len(categorical_analysis), 1)
    high_cardinality_ratio = high_cardinality_columns / categorical_count

    type_conversion_count = len(cleaning_report.get("type_conversions", []) or [])
    type_conversion_ratio = type_conversion_count / total_columns if total_columns else 0

    penalty = 0
    penalty += min(35, missing_percentage * 0.7)
    penalty += min(25, duplicate_percentage * 1.2)
    penalty += min(20, outlier_percentage * 1.5)
    penalty += min(10, high_cardinality_ratio * 10)
    penalty += min(5, type_conversion_ratio * 5)

    score = int(round(max(0, min(100, 100 - penalty))))
    score_factors = {
        "missing_cell_percentage": round(missing_percentage, 2),
        "duplicate_row_percentage": round(duplicate_percentage, 2),
        "outlier_percentage": round(outlier_percentage, 2),
        "high_cardinality_columns": high_cardinality_columns,
        "type_conversions": type_conversion_count,
    }
    return score, score_factors


async def _send_groq_request(
    client: httpx.AsyncClient, api_key: str, system_prompt: str, user_prompt: str
) -> str:
    response = await client.post(
        GROQ_URL,
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_completion_tokens": 4000,
            "response_format": {"type": "json_object"},
        },
    )

    if response.status_code >= 400:
        detail = _extract_api_error(response)
        raise RuntimeError(f"Groq API request failed: {detail}")

    payload = response.json()
    choices = payload.get("choices") or []
    text = choices[0].get("message", {}).get("content", "").strip() if choices else ""
    if not text:
        raise RuntimeError("Groq returned an empty response.")

    return text


def _parse_model_json(text: str) -> dict[str, Any]:
    cleaned_text = text.strip()
    cleaned_text = re.sub(r"^```(?:json)?", "", cleaned_text, flags=re.IGNORECASE).strip()
    cleaned_text = re.sub(r"```$", "", cleaned_text).strip()

    try:
        parsed = json.loads(cleaned_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned_text, flags=re.DOTALL)
        if not match:
            raise ValueError("Model response did not contain valid JSON.")
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("Model response JSON must be an object.")

    return parsed


def _numeric_stats_block(descriptive_stats: dict[str, dict[str, Any]], distributions: dict[str, dict[str, Any]]) -> str:
    if not descriptive_stats:
        return "- No numeric columns detected."

    lines = []
    for column, stats in descriptive_stats.items():
        distribution = distributions.get(column, {})
        lines.append(
            "- "
            f"{column}: count={stats.get('count')}, mean={_format_number(stats.get('mean'))}, "
            f"median={_format_number(stats.get('median'))}, std={_format_number(stats.get('std'))}, "
            f"skewness={_format_number(stats.get('skewness'))}, outliers={stats.get('outlier_count')}, "
            f"distribution={distribution.get('classification')}"
        )
    return "\n".join(lines)


def _correlation_block(pairs: list[dict[str, Any]]) -> str:
    if not pairs:
        return "- No qualifying correlation pairs detected."

    return "\n".join(
        f"- {pair.get('column_a')} and {pair.get('column_b')}: r={_format_number(pair.get('r'))}" for pair in pairs
    )


def _categorical_block(categorical_analysis: dict[str, dict[str, Any]]) -> str:
    if not categorical_analysis:
        return "- No categorical columns detected."

    lines = []
    for column, details in categorical_analysis.items():
        top_values = ", ".join(
            f"{item.get('value')} ({item.get('count')} rows, {_format_number(item.get('percentage'))}%)"
            for item in details.get("value_counts", [])[:5]
        )
        cardinality = details.get("cardinality", {})
        lines.append(
            f"- {column}: unique={cardinality.get('unique_count')} of {cardinality.get('total_rows')} rows, "
            f"high_cardinality={details.get('high_cardinality')}, top values: {top_values}"
        )

    return "\n".join(lines)


def _time_series_block(time_series: dict[str, Any]) -> str:
    if not time_series.get("detected"):
        return "- No time series pattern detected."

    monthly = time_series.get("monthly_aggregation", [])
    first_months = monthly[:3]
    last_months = monthly[-3:] if len(monthly) > 3 else []
    return (
        f"- Date column: {time_series.get('date_column')}\n"
        f"- Value column: {time_series.get('value_column')}\n"
        f"- Trend direction: {time_series.get('trend_direction')}\n"
        f"- Slope: {_format_number(time_series.get('slope'))}\n"
        f"- Monthly aggregation sample start: {_compact_json(first_months)}\n"
        f"- Monthly aggregation sample end: {_compact_json(last_months)}"
    )


def _extract_api_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
        return payload.get("error", {}).get("message") or response.text
    except ValueError:
        return response.text


def _compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))[:6000]


def _format_number(value: Any) -> str:
    if isinstance(value, (int, float)):
        return f"{value:.3f}" if isinstance(value, float) else str(value)
    return "N/A" if value is None else str(value)


def _safe_number(*values: Any) -> float:
    for value in values:
        if value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if not isinstance(number, float) or not (number != number):
            return number
    return 0
