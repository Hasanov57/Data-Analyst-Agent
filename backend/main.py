import os
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai_analyst import apply_objective_quality_score, build_analyst_prompt, call_groq_api
from analyzer import analyze_dataframe
from cleaner import clean_file, dataframe_preview
from supabase_client import (
    download_cleaned_file,
    fetch_analysis_report,
    list_analysis_reports,
    save_analysis_report,
    upload_cleaned_file,
)
from visualizer import generate_charts


app = FastAPI(title="DataWhiz AI API")

allowed_origin = os.getenv("ALLOWED_ORIGIN")
allowed_origins = (
    [origin.strip() for origin in allowed_origin.split(",") if origin.strip()]
    if allowed_origin
    else ["http://localhost:5173", "http://127.0.0.1:5173"]
)
allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX", r"https://.*\.vercel\.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMP_DIR = Path("/tmp")
TMP_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
MAX_ROWS = 500_000


class AnalyzeRequest(BaseModel):
    supabase_path: str


class AIAnalyzeRequest(BaseModel):
    supabase_path: str
    analysis_results: dict
    cleaning_report: dict
    column_info: list[dict] | None = None
    client_id: str


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="A file name is required.")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported.")

    temp_path = TMP_DIR / f"upload_{Path(file.filename).stem}{extension}"

    try:
        with temp_path.open("wb") as buffer:
            uploaded_size = 0
            while chunk := file.file.read(1024 * 1024):
                uploaded_size += len(chunk)
                if uploaded_size > MAX_FILE_SIZE_BYTES:
                    raise HTTPException(status_code=413, detail="File size exceeds the 50MB limit.")
                buffer.write(chunk)

        cleaned_result = clean_file(temp_path, file.filename)
        if cleaned_result["cleaning_report"]["rows_before"] > MAX_ROWS:
            raise HTTPException(status_code=413, detail="Datasets over 500,000 rows are not supported yet.")

        cleaned_df = cleaned_result["cleaned_df"]
        supabase_path = upload_cleaned_file(cleaned_df, file.filename)

        return {
            "cleaning_report": cleaned_result["cleaning_report"],
            "cleaned_data_preview": dataframe_preview(cleaned_df),
            "column_info": cleaned_result["column_info"],
            "supabase_path": supabase_path,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to process file: {exc}") from exc
    finally:
        await file.close()
        if temp_path.exists():
            temp_path.unlink()


@app.post("/api/analyze")
async def analyze_dataset(request: AnalyzeRequest):
    try:
        dataframe = download_cleaned_file(request.supabase_path)
        analysis_results = analyze_dataframe(dataframe)
        charts = generate_charts(dataframe, analysis_results)

        return {
            "analysis": analysis_results,
            "charts": charts,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to analyze dataset: {exc}") from exc


@app.post("/api/ai-analyze")
async def ai_analyze_dataset(request: AIAnalyzeRequest):
    try:
        prompt = build_analyst_prompt(
            request.analysis_results,
            request.cleaning_report,
            request.column_info or [],
        )
        ai_report = await call_groq_api(prompt)
        ai_report = apply_objective_quality_score(
            ai_report,
            request.analysis_results,
            request.cleaning_report,
        )
        report_id = save_analysis_report(
            request.supabase_path,
            ai_report,
            request.analysis_results,
            request.client_id,
        )

        return {
            "ai_report": ai_report,
            "report_id": report_id,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to generate AI analysis: {exc}") from exc


@app.get("/api/reports")
async def get_reports(x_client_id: str | None = Header(default=None)):
    try:
        if not x_client_id:
            return {"reports": []}
        return {"reports": list_analysis_reports(x_client_id)}
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to fetch reports: {exc}") from exc


@app.get("/api/reports/{report_id}")
async def get_report(report_id: str, x_client_id: str | None = Header(default=None)):
    try:
        if not x_client_id:
            raise HTTPException(status_code=400, detail="Client id is required.")
        report = fetch_analysis_report(report_id, x_client_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found.")
        return report
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to fetch report: {exc}") from exc
