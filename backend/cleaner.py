import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from pandas.api.types import (
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_object_dtype,
    is_string_dtype,
)


DATE_HINT_PATTERN = re.compile(
    r"(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|"
    r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b)",
    re.IGNORECASE,
)


def load_file(file_path: str | Path, original_filename: str) -> pd.DataFrame:
    """Load a CSV or XLSX file into a DataFrame."""
    extension = Path(original_filename).suffix.lower() or Path(file_path).suffix.lower()

    if extension == ".csv":
        try:
            return pd.read_csv(file_path)
        except UnicodeDecodeError:
            return pd.read_csv(file_path, encoding="latin-1")

    if extension == ".xlsx":
        return pd.read_excel(file_path, engine="openpyxl")

    raise ValueError("Unsupported file type. Please upload a .csv or .xlsx file.")


def profile_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    columns: dict[str, dict[str, Any]] = {}

    for column in df.columns:
        series = df[column]
        null_count = int(series.isna().sum())

        try:
            unique_count = int(series.nunique(dropna=True))
        except TypeError:
            unique_count = int(series.astype(str).nunique(dropna=True))

        columns[str(column)] = {
            "dtype": str(series.dtype),
            "null_count": null_count,
            "null_percentage": round((null_count / len(df) * 100) if len(df) else 0, 2),
            "unique_count": unique_count,
            "sample_values": [_json_safe(value) for value in series.dropna().head(3).tolist()],
        }

    return {
        "total_rows": int(len(df)),
        "total_columns": int(len(df.columns)),
        "duplicate_rows": int(df.duplicated().sum()),
        "columns": columns,
    }


def clean_file(file_path: str | Path, original_filename: str) -> dict[str, Any]:
    raw_df = load_file(file_path, original_filename)
    raw_profile = profile_dataframe(raw_df)
    df = raw_df.copy()

    column_meta = {
        column: {
            "column_name": str(column),
            "original_name": str(column),
            "original_dtype": str(df[column].dtype),
            "converted_dtype": str(df[column].dtype),
            "nulls_filled": 0,
            "transformations": [],
        }
        for column in df.columns
    }

    rows_before = int(len(df))
    raw_duplicate_count = int(raw_df.duplicated().sum())

    for column in df.columns:
        if _is_text_column(df[column]):
            whitespace_changes = int(
                df[column].apply(lambda value: isinstance(value, str) and value != value.strip()).sum()
            )
            df[column] = df[column].map(lambda value: value.strip() if isinstance(value, str) else value)

            if whitespace_changes:
                column_meta[column]["transformations"].append(
                    f"stripped whitespace from {whitespace_changes} values"
                )

    duplicate_count = int(df.duplicated().sum())
    df = df.drop_duplicates().reset_index(drop=True)

    type_conversions: list[dict[str, str]] = []

    for column in df.columns:
        if _is_text_column(df[column]):
            converted_dates = _maybe_convert_to_datetime(df[column])
            if converted_dates is not None:
                previous_dtype = str(df[column].dtype)
                df[column] = converted_dates
                column_meta[column]["transformations"].append("converted to datetime")
                column_meta[column]["converted_dtype"] = str(df[column].dtype)
                type_conversions.append(
                    {
                        "column": str(column),
                        "original_dtype": previous_dtype,
                        "converted_dtype": str(df[column].dtype),
                        "conversion": "datetime",
                    }
                )

    for column in df.columns:
        if _is_text_column(df[column]):
            converted_numeric = _maybe_convert_to_numeric(df[column])
            if converted_numeric is not None:
                previous_dtype = str(df[column].dtype)
                df[column] = converted_numeric
                column_meta[column]["transformations"].append("converted numeric text to number")
                column_meta[column]["converted_dtype"] = str(df[column].dtype)
                type_conversions.append(
                    {
                        "column": str(column),
                        "original_dtype": previous_dtype,
                        "converted_dtype": str(df[column].dtype),
                        "conversion": "numeric",
                    }
                )

    total_nulls_filled = 0
    nulls_filled_by_column: dict[str, int] = {}

    for column in df.columns:
        null_count = int(df[column].isna().sum())
        if null_count == 0:
            nulls_filled_by_column[str(column)] = 0
            continue

        if is_numeric_dtype(df[column]) and not is_datetime64_any_dtype(df[column]):
            median_value = df[column].median(skipna=True)
            if pd.isna(median_value):
                median_value = 0
            df[column] = df[column].fillna(median_value)
            filled_count = null_count - int(df[column].isna().sum())
            if filled_count:
                column_meta[column]["transformations"].append("filled numeric nulls with median")
        elif _is_text_column(df[column]):
            df[column] = df[column].fillna("Unknown")
            filled_count = null_count - int(df[column].isna().sum())
            if filled_count:
                column_meta[column]["transformations"].append('filled text nulls with "Unknown"')
        else:
            filled_count = 0

        total_nulls_filled += filled_count
        nulls_filled_by_column[str(column)] = filled_count
        column_meta[column]["nulls_filled"] = filled_count

    original_columns = list(df.columns)
    normalized_columns = _normalize_column_names(original_columns)
    df.columns = normalized_columns

    for old_column, new_column in zip(original_columns, normalized_columns):
        meta = column_meta[old_column]
        if str(old_column) != new_column:
            meta["transformations"].append(f'renamed column to "{new_column}"')
        meta["column_name"] = new_column
        meta["converted_dtype"] = str(df[new_column].dtype)

    post_profile = profile_dataframe(df)

    column_info = list(column_meta.values())
    cleaned_columns = [
        {
            "column": info["column_name"],
            "original_column": info["original_name"],
            "original_dtype": info["original_dtype"],
            "converted_dtype": info["converted_dtype"],
            "nulls_filled": info["nulls_filled"],
            "transformations": info["transformations"],
        }
        for info in column_info
        if info["transformations"]
        or info["nulls_filled"]
        or info["original_dtype"] != info["converted_dtype"]
    ]

    renamed_type_conversions = []
    original_to_normalized = {str(old): new for old, new in zip(original_columns, normalized_columns)}
    for conversion in type_conversions:
        renamed_type_conversions.append(
            {
                **conversion,
                "column": original_to_normalized.get(conversion["column"], conversion["column"]),
            }
        )

    cleaning_report = {
        "rows_before": rows_before,
        "rows_after": int(len(df)),
        "duplicates_removed": duplicate_count,
        "duplicate_detection": {
            "method": "full-row duplicate detection after basic text trimming",
            "raw_exact_duplicate_rows": raw_duplicate_count,
            "duplicates_removed": duplicate_count,
        },
        "columns_cleaned": cleaned_columns,
        "nulls_filled": total_nulls_filled,
        "nulls_filled_by_column": {
            original_to_normalized.get(column, column): value for column, value in nulls_filled_by_column.items()
        },
        "type_conversions": renamed_type_conversions,
        "pre_clean_profile": raw_profile,
        "post_clean_profile": post_profile,
    }

    return {
        "cleaned_df": df,
        "cleaning_report": cleaning_report,
        "column_info": column_info,
    }


def dataframe_preview(df: pd.DataFrame, rows: int = 10) -> list[dict[str, Any]]:
    return [
        {str(column): _json_safe(value) for column, value in record.items()}
        for record in df.head(rows).to_dict(orient="records")
    ]


def _is_text_column(series: pd.Series) -> bool:
    return is_object_dtype(series) or is_string_dtype(series)


def _maybe_convert_to_datetime(series: pd.Series) -> pd.Series | None:
    non_null = series.dropna()
    if non_null.empty:
        return None

    text_values = non_null.astype(str).str.strip()
    date_hint_ratio = text_values.str.contains(DATE_HINT_PATTERN, na=False).mean()
    if date_hint_ratio < 0.6:
        return None

    parsed = series.map(lambda value: pd.NaT if pd.isna(value) else pd.to_datetime(value, errors="coerce"))
    success_ratio = parsed[series.notna()].notna().mean()

    if success_ratio >= 0.6:
        return parsed

    return None


def _maybe_convert_to_numeric(series: pd.Series) -> pd.Series | None:
    non_null = series.dropna()
    if non_null.empty:
        return None

    converted_non_null = _coerce_numeric_text(non_null)
    success_ratio = converted_non_null.notna().mean()

    if success_ratio >= 0.8 and converted_non_null.notna().sum() > 0:
        return _coerce_numeric_text(series)

    return None


def _coerce_numeric_text(series: pd.Series) -> pd.Series:
    text_values = series.astype("string").str.strip()
    text_values = text_values.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
    text_values = text_values.str.replace(r"[$€£¥,\s%]", "", regex=True)
    text_values = text_values.replace({"": pd.NA})
    return pd.to_numeric(text_values, errors="coerce")


def _normalize_column_names(columns: list[Any]) -> list[str]:
    normalized: list[str] = []
    used_names: dict[str, int] = {}

    for index, column in enumerate(columns, start=1):
        name = str(column).strip().lower()
        name = re.sub(r"\s+", "_", name)
        name = re.sub(r"[^a-z0-9_]", "", name)
        name = re.sub(r"_+", "_", name).strip("_")
        name = name or f"column_{index}"

        if name in used_names:
            used_names[name] += 1
            name = f"{name}_{used_names[name]}"
        else:
            used_names[name] = 1

        normalized.append(name)

    return normalized


def _json_safe(value: Any) -> Any:
    if value is None:
        return None

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
