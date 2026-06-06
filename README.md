# DataSense AI

Full-stack AI Data Analyst web app. It supports dataset upload, automated cleaning, statistical analysis, chart generation, Groq-powered AI interpretation, PDF export, and saved report history.

## Project Structure

```text
frontend/   React, Vite, Tailwind CSS, Axios
backend/    FastAPI, pandas, Supabase upload
```

## Backend Setup

1. Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Create your environment file:

```bash
copy .env.example .env
```

3. Add your Supabase values to `backend/.env`:

```text
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
ALLOWED_ORIGIN=http://localhost:5173
```

4. Start the API:

```bash
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`.

## Supabase Storage Setup

1. Open your Supabase project.
2. Go to Storage.
3. Create a bucket named `datasets`.
4. Make the bucket public if you want the app to return public URLs for cleaned CSV files.
5. Use your project URL and anon key in `backend/.env`.

The backend uploads cleaned CSV files under `cleaned/` inside the `datasets` bucket.

## Supabase Database Setup

Create the table used to store AI-generated analyst reports:

```sql
create table analysis_reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp default now(),
  supabase_path text,
  ai_report jsonb,
  analysis_results jsonb
);
```

## Frontend Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Create your environment file:

```bash
copy .env.example .env
```

3. Confirm the API URL in `frontend/.env`:

```text
VITE_API_URL=http://localhost:8000
```

4. Start the frontend:

```bash
npm run dev
```

The frontend runs at the local Vite URL shown in the terminal, usually `http://localhost:5173`.

## API

`POST /api/upload`

Accepts multipart uploads with a `file` field. Supported formats are `.csv` and `.xlsx`.

Returns:

- `cleaning_report`
- `cleaned_data_preview`
- `column_info`
- `supabase_path`

## Cleaning Pipeline

The backend:

- Profiles raw data before cleaning.
- Removes fully duplicate rows.
- Strips whitespace from text columns.
- Detects and converts date-like columns.
- Detects and converts numeric values stored as text, including values with `$`, commas, and `%`.
- Fills numeric nulls with median values.
- Fills text nulls with `Unknown`.
- Normalizes column names.
- Profiles cleaned data after cleaning.

## Analysis Pipeline

`POST /api/analyze`

Accepts:

```json
{
  "supabase_path": "https://your-project.supabase.co/storage/v1/object/public/datasets/cleaned/file.csv"
}
```

The endpoint also accepts a raw storage path such as `cleaned/file.csv`.

Returns:

- `analysis`: structured statistics, categorical summaries, correlations, distributions, outlier summary, and time series detection.
- `charts`: base64-encoded PNG charts for distributions, correlations, categorical counts, outliers, and time series trends where applicable.

The analysis engine includes:

- Descriptive statistics for numeric columns.
- Top value counts and cardinality flags for categorical columns.
- Pearson correlation matrix plus strongest positive and negative pairs.
- Distribution classification and high-skew flags.
- IQR-based outlier counts and overall outlier percentage.
- Datetime detection with monthly aggregation and trend direction.

## AI Analyst Pipeline

`POST /api/ai-analyze`

Accepts:

```json
{
  "supabase_path": "cleaned/file.csv",
  "analysis_results": {},
  "cleaning_report": {},
  "column_info": []
}
```

Returns:

- `ai_report`: structured JSON from Groq with executive summary, quality score, insights, column narratives, correlation insights, risks, recommendations, and suggested follow-up analyses.
- `report_id`: the saved row id from the Supabase `analysis_reports` table.

The backend uses `GROQ_API_KEY` and model `llama-3.3-70b-versatile`.

## Report History

`GET /api/reports`

Returns the last 20 saved AI reports from Supabase, ordered by newest first.

`GET /api/reports/{report_id}`

Returns a full saved report with its AI report JSON and analysis results.

## Limits

- Uploads must be `.csv` or `.xlsx`.
- Maximum file size: 50MB.
- Maximum dataset size after reading: 500,000 rows.

## Deployment Guide

1. Create a Supabase project.
2. In Supabase Storage, create a public bucket named `datasets`.
3. In Supabase SQL Editor, run:

```sql
create table analysis_reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp default now(),
  supabase_path text,
  ai_report jsonb,
  analysis_results jsonb
);
```

4. Push the project to GitHub.
5. Connect the backend to Render using `backend/render.yaml`.
6. In Render, set:

```text
SUPABASE_URL
SUPABASE_KEY
GROQ_API_KEY
ALLOWED_ORIGIN
```

7. Connect the frontend to Vercel from the `frontend` directory.
8. In Vercel, set:

```text
VITE_API_URL=https://your-render-service-url
```

9. Set `ALLOWED_ORIGIN` in Render to your production Vercel URL, for example:

```text
https://your-app.vercel.app
```

10. Redeploy both services, then test the full flow with a CSV file.

## Final Deployment Checklist

- [ ] Supabase project created
- [ ] `datasets` storage bucket created and set to public
- [ ] `analysis_reports` table created with the provided SQL
- [ ] All env vars set in Render
- [ ] All env vars set in Vercel
- [ ] CORS origin updated to production Vercel URL
- [ ] Test with a CSV file end-to-end
