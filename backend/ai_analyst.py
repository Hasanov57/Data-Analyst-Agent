import json
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv


load_dotenv()

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
SYSTEM_PROMPT = (
    "You are a senior data analyst with 15 years of experience. You have just received a dataset "
    "and its full statistical analysis. Your job is to provide a deep, structured analytical report "
    "as if you were presenting to a business stakeholder. Be specific — reference actual column names, "
    "actual numbers, actual patterns. Do not be generic. Structure your response in clearly labeled sections."
)

JSON_SCHEMA_INSTRUCTIONS = """
Return only a valid JSON object. Do not include markdown, code fences, comments, or explanatory text outside the JSON.

Use this exact structure:
{
  "executive_summary": "3-4 sentence high-level summary of what this dataset is about and its overall quality",
  "data_quality_assessment": {
    "score": 0,
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
- Duplicates removed: {cleaning_report.get("duplicates_removed")}
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

Write conclusions that directly reference the actual columns and numbers above. Avoid generic commentary.
{JSON_SCHEMA_INSTRUCTIONS}
"""

    return {
        "system_prompt": SYSTEM_PROMPT,
        "user_prompt": user_prompt.strip(),
    }


async def call_claude_api(prompt_dict: dict[str, str]) -> dict[str, Any]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Anthropic API key is not configured.")

    async with httpx.AsyncClient(timeout=60) as client:
        first_response = await _send_claude_request(client, api_key, prompt_dict["system_prompt"], prompt_dict["user_prompt"])
        try:
            return _parse_claude_json(first_response)
        except ValueError:
            retry_prompt = (
                f"{prompt_dict['user_prompt']}\n\nYour previous response was not valid JSON. "
                "Return only valid JSON that exactly matches the requested structure."
            )
            second_response = await _send_claude_request(client, api_key, prompt_dict["system_prompt"], retry_prompt)
            return _parse_claude_json(second_response)


async def _send_claude_request(
    client: httpx.AsyncClient, api_key: str, system_prompt: str, user_prompt: str
) -> str:
    response = await client.post(
        ANTHROPIC_URL,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": ANTHROPIC_MODEL,
            "max_tokens": 4000,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        },
    )

    if response.status_code >= 400:
        detail = _extract_api_error(response)
        raise RuntimeError(f"Claude API request failed: {detail}")

    payload = response.json()
    content_blocks = payload.get("content", [])
    text_parts = [block.get("text", "") for block in content_blocks if block.get("type") == "text"]
    text = "\n".join(text_parts).strip()
    if not text:
        raise RuntimeError("Claude returned an empty response.")

    return text


def _parse_claude_json(text: str) -> dict[str, Any]:
    cleaned_text = text.strip()
    cleaned_text = re.sub(r"^```(?:json)?", "", cleaned_text, flags=re.IGNORECASE).strip()
    cleaned_text = re.sub(r"```$", "", cleaned_text).strip()

    try:
        parsed = json.loads(cleaned_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned_text, flags=re.DOTALL)
        if not match:
            raise ValueError("Claude response did not contain valid JSON.")
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("Claude response JSON must be an object.")

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
