import re
from typing import Any

import numpy as np
import pandas as pd
from pandas.api.types import is_datetime64_any_dtype, is_numeric_dtype, is_object_dtype, is_string_dtype


DATE_HINT_PATTERN = re.compile(
    r"(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|"
    r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s/-]+\d{1,2}(?:,?[\s/-]+\d{2,4})?|\d{1,2}[\s/-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?:[\s/-]+\d{2,4})?)",
    re.IGNORECASE,
)


def analyze_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    analysis_df, datetime_columns = _prepare_analysis_dataframe(df)
    numeric_columns = [column for column in analysis_df.columns if is_numeric_dtype(analysis_df[column])]
    categorical_columns = [
        column
        for column in analysis_df.columns
        if column not in datetime_columns and (is_object_dtype(analysis_df[column]) or is_string_dtype(analysis_df[column]))
    ]

    descriptive_stats = _descriptive_stats(analysis_df, numeric_columns)
    categorical_analysis = _categorical_analysis(analysis_df, categorical_columns)
    correlation_analysis = _correlation_analysis(analysis_df, numeric_columns)
    distribution_analysis = _distribution_analysis(analysis_df, numeric_columns)
    outlier_summary = _outlier_summary(descriptive_stats, len(analysis_df))
    time_series = _time_series_detection(analysis_df, datetime_columns, numeric_columns)

    return _json_safe(
        {
            "dataset_overview": {
                "total_rows": int(len(analysis_df)),
                "total_columns": int(len(analysis_df.columns)),
                "numeric_columns_count": len(numeric_columns),
                "categorical_columns_count": len(categorical_columns),
                "datetime_columns_detected": len(datetime_columns),
                "numeric_columns": [str(column) for column in numeric_columns],
                "categorical_columns": [str(column) for column in categorical_columns],
                "datetime_columns": [str(column) for column in datetime_columns],
                "total_outliers_detected": outlier_summary["total_outliers_detected"],
                "overall_outlier_percentage": outlier_summary["overall_outlier_percentage"],
            },
            "descriptive_stats": descriptive_stats,
            "categorical_analysis": categorical_analysis,
            "correlation_analysis": correlation_analysis,
            "distribution_analysis": distribution_analysis,
            "outlier_summary": outlier_summary,
            "time_series_detection": time_series,
        }
    )


def prepare_dataframe_for_analysis(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str], list[str], list[str]]:
    analysis_df, datetime_columns = _prepare_analysis_dataframe(df)
    numeric_columns = [column for column in analysis_df.columns if is_numeric_dtype(analysis_df[column])]
    categorical_columns = [
        column
        for column in analysis_df.columns
        if column not in datetime_columns and (is_object_dtype(analysis_df[column]) or is_string_dtype(analysis_df[column]))
    ]
    return analysis_df, numeric_columns, categorical_columns, datetime_columns


def _prepare_analysis_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    analysis_df = df.copy()
    datetime_columns: list[str] = []

    for column in analysis_df.columns:
        if is_datetime64_any_dtype(analysis_df[column]):
            datetime_columns.append(column)
            continue

        if not (is_object_dtype(analysis_df[column]) or is_string_dtype(analysis_df[column])):
            continue

        series = analysis_df[column]
        non_null = series.dropna()
        if non_null.empty:
            continue

        text_values = non_null.astype(str).str.strip()
        date_hint_ratio = text_values.str.contains(DATE_HINT_PATTERN, na=False).mean()
        if date_hint_ratio < 0.6:
            continue

        parsed = pd.to_datetime(series, errors="coerce")
        success_ratio = parsed[series.notna()].notna().mean()
        if success_ratio >= 0.6:
            analysis_df[column] = parsed
            datetime_columns.append(column)

    return analysis_df, datetime_columns


def _descriptive_stats(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}

    for column in numeric_columns:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        q1 = series.quantile(0.25) if not series.empty else np.nan
        q3 = series.quantile(0.75) if not series.empty else np.nan
        outlier_count = _count_outliers(series)

        stats[str(column)] = {
            "count": int(series.count()),
            "mean": series.mean() if not series.empty else None,
            "median": series.median() if not series.empty else None,
            "std": series.std() if len(series) > 1 else 0,
            "min": series.min() if not series.empty else None,
            "max": series.max() if not series.empty else None,
            "percentile_25": q1,
            "percentile_75": q3,
            "skewness": series.skew() if len(series) > 2 else 0,
            "kurtosis": series.kurtosis() if len(series) > 3 else 0,
            "outlier_count": outlier_count,
            "outlier_percentage": (outlier_count / len(df) * 100) if len(df) else 0,
        }

    return _json_safe(stats)


def _categorical_analysis(df: pd.DataFrame, categorical_columns: list[str]) -> dict[str, dict[str, Any]]:
    analysis: dict[str, dict[str, Any]] = {}
    total_rows = len(df)

    for column in categorical_columns:
        series = df[column].fillna("Unknown").astype(str)
        value_counts = series.value_counts(dropna=False).head(10)
        unique_count = int(series.nunique(dropna=False))

        analysis[str(column)] = {
            "value_counts": [
                {
                    "value": str(value),
                    "count": int(count),
                    "percentage": (int(count) / total_rows * 100) if total_rows else 0,
                }
                for value, count in value_counts.items()
            ],
            "cardinality": {
                "unique_count": unique_count,
                "total_rows": total_rows,
                "unique_ratio": (unique_count / total_rows) if total_rows else 0,
            },
            "high_cardinality": bool(total_rows and unique_count > total_rows * 0.5),
        }

    return _json_safe(analysis)


def _correlation_analysis(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, Any]:
    if len(numeric_columns) < 2:
        return {"matrix": {}, "strongest_positive": [], "strongest_negative": []}

    corr = df[numeric_columns].corr(method="pearson")
    pairs = []

    for index, column_a in enumerate(numeric_columns):
        for column_b in numeric_columns[index + 1 :]:
            value = corr.loc[column_a, column_b]
            if pd.isna(value):
                continue
            pairs.append({"column_a": str(column_a), "column_b": str(column_b), "r": float(value)})

    positive = sorted([pair for pair in pairs if pair["r"] > 0], key=lambda item: item["r"], reverse=True)[:5]
    negative = sorted([pair for pair in pairs if pair["r"] < 0], key=lambda item: item["r"])[:5]

    return _json_safe(
        {
            "matrix": corr.to_dict(),
            "strongest_positive": positive,
            "strongest_negative": negative,
        }
    )


def _distribution_analysis(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, dict[str, Any]]:
    analysis: dict[str, dict[str, Any]] = {}

    for column in numeric_columns:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        skewness = series.skew() if len(series) > 2 else 0

        if _looks_bimodal(series):
            classification = "bimodal"
        elif skewness > 0.5:
            classification = "right-skewed"
        elif skewness < -0.5:
            classification = "left-skewed"
        else:
            classification = "normal"

        analysis[str(column)] = {
            "classification": classification,
            "skewness": skewness,
            "high_skew": bool(skewness > 1 or skewness < -1),
        }

    return _json_safe(analysis)


def _outlier_summary(descriptive_stats: dict[str, dict[str, Any]], total_rows: int) -> dict[str, Any]:
    ranked = sorted(
        [
            {
                "column": column,
                "outlier_count": int(stats["outlier_count"]),
                "outlier_percentage": stats["outlier_percentage"],
            }
            for column, stats in descriptive_stats.items()
        ],
        key=lambda item: item["outlier_count"],
        reverse=True,
    )
    total_outliers = int(sum(item["outlier_count"] for item in ranked))
    denominator = total_rows * len(descriptive_stats)

    return _json_safe(
        {
            "columns_ranked": ranked,
            "columns_with_most_outliers": ranked[:5],
            "total_outliers_detected": total_outliers,
            "overall_outlier_percentage": (total_outliers / denominator * 100) if denominator else 0,
        }
    )


def _time_series_detection(
    df: pd.DataFrame, datetime_columns: list[str], numeric_columns: list[str]
) -> dict[str, Any]:
    if not datetime_columns or not numeric_columns:
        return {"detected": False, "date_column": None, "value_column": None, "monthly_aggregation": []}

    date_column = max(datetime_columns, key=lambda column: df[column].notna().sum())
    value_column = max(numeric_columns, key=lambda column: pd.to_numeric(df[column], errors="coerce").var(skipna=True))

    time_df = df[[date_column, value_column]].dropna().copy()
    if time_df.empty:
        return {"detected": False, "date_column": str(date_column), "value_column": str(value_column), "monthly_aggregation": []}

    time_df[date_column] = pd.to_datetime(time_df[date_column], errors="coerce")
    time_df[value_column] = pd.to_numeric(time_df[value_column], errors="coerce")
    time_df = time_df.dropna().sort_values(date_column)

    if time_df.empty:
        return {"detected": False, "date_column": str(date_column), "value_column": str(value_column), "monthly_aggregation": []}

    monthly = time_df.set_index(date_column)[value_column].resample("MS").mean().dropna()
    monthly_records = [
        {"period": period.strftime("%Y-%m"), "value": value}
        for period, value in monthly.items()
    ]

    slope = 0
    trend_direction = "flat"
    if len(monthly) >= 2:
        x_values = np.arange(len(monthly))
        slope = float(np.polyfit(x_values, monthly.values, 1)[0])
        baseline = max(abs(float(monthly.mean())), 1)
        if slope > baseline * 0.01:
            trend_direction = "increasing"
        elif slope < baseline * -0.01:
            trend_direction = "decreasing"

    return _json_safe(
        {
            "detected": True,
            "date_column": str(date_column),
            "value_column": str(value_column),
            "monthly_aggregation": monthly_records,
            "trend_direction": trend_direction,
            "slope": slope,
        }
    )


def _count_outliers(series: pd.Series) -> int:
    if series.empty:
        return 0

    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    if pd.isna(iqr) or iqr == 0:
        return 0

    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    return int(((series < lower_bound) | (series > upper_bound)).sum())


def _looks_bimodal(series: pd.Series) -> bool:
    if len(series) < 30 or series.nunique() < 5:
        return False

    counts, _ = np.histogram(series, bins="auto")
    if len(counts) < 5:
        return False

    peak_count = 0
    threshold = counts.max() * 0.2
    for index in range(1, len(counts) - 1):
        if counts[index] > counts[index - 1] and counts[index] > counts[index + 1] and counts[index] >= threshold:
            peak_count += 1

    return peak_count >= 2


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}

    if isinstance(value, list):
        return [_json_safe(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_json_safe(item) for item in value)

    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()

    if isinstance(value, np.datetime64):
        if np.isnat(value):
            return None
        return pd.Timestamp(value).isoformat()

    if isinstance(value, np.generic):
        value = value.item()

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return None

    return value
