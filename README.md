# DataSense AI

DataSense AI is a full-stack AI data analyst web app that turns raw CSV or Excel files into a cleaned dataset, statistical analysis, charts, and a business-style AI report.

The goal of the project is to make exploratory data analysis easier for non-technical users. Instead of opening a spreadsheet, cleaning columns manually, calculating statistics, and writing conclusions from scratch, the user uploads a file and moves through a guided analysis workflow.

## What The App Does

DataSense AI follows a four-step workflow:

1. **Upload**
   The user uploads a `.csv` or `.xlsx` dataset.

2. **Clean**
   The backend cleans the dataset automatically and shows what changed.

3. **Analyze**
   The app calculates statistical summaries, correlations, outliers, distributions, categorical breakdowns, and time-series trends.

4. **AI Report**
   An AI analyst reads the computed statistics and generates a structured business report with insights, risks, recommendations, and suggested next analyses.

## Why This Project Matters

Raw datasets are often messy and hard to understand quickly. DataSense AI shows how automation and AI can work together in a practical analytics workflow:

- Traditional data processing handles the factual work: cleaning, profiling, statistics, outliers, correlations, and charts.
- AI handles the interpretation layer: explaining patterns, highlighting risks, and turning numbers into stakeholder-friendly insights.

This separation is important. The AI report is not guessing from the file directly; it is guided by structured analysis results produced by the backend.

## Core Features

- Upload CSV and Excel datasets
- Automatic data cleaning
- Cleaning report with row counts, null handling, type conversions, and column changes
- Numeric descriptive statistics
- Categorical value breakdowns
- Correlation analysis
- Distribution and skewness detection
- IQR-based outlier detection
- Time-series trend detection when date columns exist
- Base64 chart generation
- AI-generated executive report using Groq
- PDF export of the AI report
- Saved report history
- Dark, professional dashboard-style interface

## Analysis Meaning

The app uses deterministic statistical methods before calling the AI model:

- **Descriptive statistics** summarize numeric columns with mean, median, standard deviation, percentiles, skewness, kurtosis, and min/max values.
- **Categorical analysis** shows the most common values and flags high-cardinality columns.
- **Correlation analysis** finds the strongest positive and negative relationships between numeric columns.
- **Distribution analysis** classifies numeric columns as normal, skewed, or potentially bimodal.
- **Outlier analysis** uses the IQR method to identify unusually high or low values.
- **Time-series detection** looks for date columns and estimates trend direction over monthly aggregates.

The AI report is generated from these computed results. It should be treated as an analyst-style interpretation: useful for summarizing patterns and suggesting next steps, but still worth reviewing against the source data for important decisions.

## Tech Stack

**Frontend**
- React
- Vite
- Tailwind CSS
- Axios
- React Router
- jsPDF and html2canvas

**Backend**
- FastAPI
- pandas
- NumPy
- matplotlib
- seaborn
- openpyxl

**Storage and AI**
- Supabase Storage for cleaned datasets
- Supabase Database for saved AI reports
- Groq API for AI-generated analysis

**Deployment Targets**
- Vercel for the frontend
- Render for the backend

## Project Structure

```text
frontend/   React application and UI components
backend/    FastAPI API, cleaning engine, analysis engine, chart generation, AI analyst logic
```

## Main Screens

- **Workspace:** file upload, progress stepper, cleaning report, statistical analysis, charts, and AI report.
- **History:** previously generated AI reports with quality score, date, filename, and row count.
- **AI Report:** executive summary, quality score, key insights, column narratives, correlation insights, risks, recommendations, next analyses, and PDF export.

## Current Status

DataSense AI is feature-complete for the full upload-to-report workflow. It supports the complete path from raw file upload to cleaned data, statistical analysis, AI interpretation, saved history, and PDF export.
