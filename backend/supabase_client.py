import os
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import uuid4

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

BUCKET_NAME = "datasets"


def upload_cleaned_file(df, original_filename: str) -> str:
    client = _get_client()
    safe_stem = _safe_filename(Path(original_filename).stem or "dataset")
    storage_path = f"cleaned/{safe_stem}_{uuid4().hex}.csv"
    csv_bytes = df.to_csv(index=False).encode("utf-8")

    client.storage.from_(BUCKET_NAME).upload(
        storage_path,
        csv_bytes,
        file_options={
            "content-type": "text/csv",
            "upsert": "false",
        },
    )

    return client.storage.from_(BUCKET_NAME).get_public_url(storage_path)


def download_cleaned_file(supabase_path: str) -> pd.DataFrame:
    if not supabase_path:
        raise ValueError("supabase_path is required.")

    client = _get_client()
    storage_path = _extract_storage_path(supabase_path)
    response = client.storage.from_(BUCKET_NAME).download(storage_path)

    if isinstance(response, str):
        response = response.encode("utf-8")

    return pd.read_csv(BytesIO(response))


def save_analysis_report(supabase_path: str, ai_report: dict, analysis_results: dict, client_id: str) -> str:
    client = _get_client()
    response = (
        client.table("analysis_reports")
        .insert(
            {
                "supabase_path": supabase_path,
                "ai_report": ai_report,
                "analysis_results": analysis_results,
                "client_id": client_id,
            }
        )
        .execute()
    )

    if not response.data:
        raise RuntimeError("Supabase did not return an analysis report id.")

    return response.data[0]["id"]


def list_analysis_reports(client_id: str) -> list[dict]:
    client = _get_client()
    response = (
        client.table("analysis_reports")
        .select("id, created_at, supabase_path, ai_report, analysis_results")
        .eq("client_id", client_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    reports = []
    for record in response.data or []:
        ai_report = record.get("ai_report") or {}
        analysis_results = record.get("analysis_results") or {}
        overview = analysis_results.get("dataset_overview", {})
        reports.append(
            {
                "id": record.get("id"),
                "created_at": record.get("created_at"),
                "supabase_path": record.get("supabase_path"),
                "filename": _filename_from_supabase_path(record.get("supabase_path") or ""),
                "executive_summary": ai_report.get("executive_summary"),
                "data_quality_score": (ai_report.get("data_quality_assessment") or {}).get("score"),
                "row_count": overview.get("total_rows"),
            }
        )

    return reports


def fetch_analysis_report(report_id: str, client_id: str) -> dict | None:
    client = _get_client()
    response = (
        client.table("analysis_reports")
        .select("id, created_at, supabase_path, ai_report, analysis_results")
        .eq("id", report_id)
        .eq("client_id", client_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        return None

    record = response.data[0]
    return {
        "report_id": record.get("id"),
        "created_at": record.get("created_at"),
        "supabase_path": record.get("supabase_path"),
        "ai_report": record.get("ai_report") or {},
        "analysis_results": record.get("analysis_results") or {},
    }


def _get_client():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError("Supabase credentials are not configured.")

    return create_client(supabase_url, supabase_key)


def _extract_storage_path(supabase_path: str) -> str:
    if not supabase_path.startswith("http://") and not supabase_path.startswith("https://"):
        return supabase_path.lstrip("/")

    parsed = urlparse(supabase_path)
    marker = f"/storage/v1/object/public/{BUCKET_NAME}/"
    if marker not in parsed.path:
        raise ValueError("supabase_path must be a datasets bucket public URL or storage path.")

    return unquote(parsed.path.split(marker, 1)[1])


def _safe_filename(filename: str) -> str:
    filename = filename.strip().lower()
    filename = re.sub(r"\s+", "_", filename)
    filename = re.sub(r"[^a-z0-9_-]", "", filename)
    return filename or "dataset"


def _filename_from_supabase_path(supabase_path: str) -> str:
    try:
        storage_path = _extract_storage_path(supabase_path)
    except ValueError:
        storage_path = supabase_path

    return Path(storage_path).name or "dataset.csv"
