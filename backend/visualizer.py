from typing import Any

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from analyzer import prepare_dataframe_for_analysis


dark_template = {
    "layout": {
        "paper_bgcolor": "#0f1117",
        "plot_bgcolor": "#0f1117",
        "font": {"color": "#e2e8f0", "family": "Inter, sans-serif"},
        "colorway": [
            "#4f8ef7",
            "#f7884f",
            "#4ff7a0",
            "#f74f7a",
            "#c44ff7",
            "#f7e04f",
        ],
        "xaxis": {"gridcolor": "#1e2433", "linecolor": "#2d3748"},
        "yaxis": {"gridcolor": "#1e2433", "linecolor": "#2d3748"},
    }
}


def generate_charts(df: pd.DataFrame, analysis_results: dict[str, Any]) -> dict[str, str | None]:
    analysis_df, numeric_columns, categorical_columns, datetime_columns = prepare_dataframe_for_analysis(df)
    charts: dict[str, str | None] = {}

    charts.update(_distribution_plots(analysis_df, numeric_columns))
    charts.update(_correlation_heatmap(analysis_df, numeric_columns))
    charts.update(_categorical_bar_charts(analysis_df, categorical_columns))
    charts.update(_outlier_box_plot(analysis_df, numeric_columns, analysis_results))
    charts.update(_time_series_chart(analysis_results, datetime_columns))
    charts.update(_missing_values_heatmap(analysis_df))

    return charts


def _distribution_plots(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, str | None]:
    charts: dict[str, str | None] = {}
    selected_columns = _highest_variance_columns(df, numeric_columns, limit=6)

    for column in selected_columns:
        chart_key = f"distribution_{_safe_key(column)}"
        try:
            series = pd.to_numeric(df[column], errors="coerce").dropna()
            if series.empty:
                continue
            plot_series = _sample_series(series)
            plot_df = pd.DataFrame({str(column): plot_series})

            fig = px.histogram(
                plot_df,
                x=str(column),
                marginal="box",
                opacity=0.78,
                color_discrete_sequence=["#4f8ef7"],
                title=f"Distribution - {column}",
            )
            kde_x, kde_y = _kde_overlay(plot_series)
            if len(kde_x):
                histogram_counts, _ = np.histogram(plot_series, bins="auto")
                if histogram_counts.size:
                    kde_y = kde_y * float(histogram_counts.max() / max(kde_y.max(), 1))
                fig.add_trace(
                    go.Scatter(
                        x=kde_x,
                        y=kde_y,
                        mode="lines",
                        name="KDE estimate",
                        line={"color": "#f7e04f", "width": 2},
                        hovertemplate=f"{column}: %{{x:.3f}}<br>Density: %{{y:.3f}}<extra></extra>",
                    )
                )
            _style_figure(fig)
            charts[chart_key] = fig.to_json()
        except Exception:
            charts[chart_key] = None

    return charts


def _correlation_heatmap(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, str | None]:
    if len(numeric_columns) < 3:
        return {}

    chart_key = "correlation_heatmap"
    try:
        selected_columns = _highest_variance_columns(df, numeric_columns, limit=12)
        corr = df[selected_columns].corr(method="pearson").round(2)
        fig = go.Figure(
            data=go.Heatmap(
                z=corr.values,
                x=[str(column) for column in corr.columns],
                y=[str(column) for column in corr.index],
                colorscale="RdBu_r",
                zmin=-1,
                zmax=1,
                text=corr.values,
                texttemplate="%{text:.2f}",
                textfont={"color": "#e2e8f0", "size": 11},
                hovertemplate="%{y} / %{x}<br>r=%{z:.2f}<extra></extra>",
                colorbar={"title": "r"},
            )
        )
        fig.update_layout(title="Correlation Matrix")
        _style_figure(fig)
        return {chart_key: fig.to_json()}
    except Exception:
        return {chart_key: None}


def _categorical_bar_charts(df: pd.DataFrame, categorical_columns: list[str]) -> dict[str, str | None]:
    charts: dict[str, str | None] = {}

    for column in categorical_columns:
        chart_key = f"categorical_{_safe_key(column)}"
        try:
            unique_count = df[column].nunique(dropna=False)
            if unique_count >= 20:
                continue

            counts = (
                df[column]
                .fillna("Unknown")
                .astype(str)
                .value_counts(dropna=False)
                .head(10)
                .reset_index()
            )
            counts.columns = [str(column), "count"]
            if counts.empty:
                continue

            counts = counts.sort_values("count", ascending=True)
            fig = px.bar(
                counts,
                x="count",
                y=str(column),
                orientation="h",
                title=f"Top Values - {column}",
                color_discrete_sequence=["#4f8ef7"],
            )
            fig.update_traces(hovertemplate=f"{column}: %{{y}}<br>Count: %{{x}}<extra></extra>")
            _style_figure(fig)
            charts[chart_key] = fig.to_json()
        except Exception:
            charts[chart_key] = None

    return charts


def _outlier_box_plot(
    df: pd.DataFrame, numeric_columns: list[str], analysis_results: dict[str, Any]
) -> dict[str, str | None]:
    descriptive_stats = analysis_results.get("descriptive_stats", {})
    outlier_columns = [
        column for column in numeric_columns if descriptive_stats.get(str(column), {}).get("outlier_count", 0) > 0
    ]
    if not outlier_columns:
        return {}

    chart_key = "outlier_boxplot"
    try:
        fig = go.Figure()
        for column in outlier_columns[:12]:
            series = pd.to_numeric(df[column], errors="coerce").dropna()
            if series.empty:
                continue
            fig.add_trace(
                go.Box(
                    y=_sample_series(series, limit=10000),
                    name=str(column),
                    boxpoints="outliers",
                    marker={"color": "#4f8ef7"},
                    line={"color": "#4f8ef7"},
                    hovertemplate=f"{column}: %{{y:.3f}}<extra></extra>",
                )
            )

        if not fig.data:
            return {}

        fig.update_layout(title="Outlier Overview", yaxis_title="Value")
        _style_figure(fig)
        return {chart_key: fig.to_json()}
    except Exception:
        return {chart_key: None}


def _time_series_chart(
    analysis_results: dict[str, Any], datetime_columns: list[str]
) -> dict[str, str | None]:
    time_series = analysis_results.get("time_series_detection", {})
    if not time_series.get("detected") or not datetime_columns:
        return {}

    chart_key = "timeseries"
    try:
        monthly_records = time_series.get("monthly_aggregation", [])
        if not monthly_records:
            return {}

        plot_df = pd.DataFrame(monthly_records)
        plot_df["period"] = pd.to_datetime(plot_df["period"], errors="coerce")
        plot_df["value"] = pd.to_numeric(plot_df["value"], errors="coerce")
        plot_df = plot_df.dropna().sort_values("period")
        if plot_df.empty:
            return {}

        value_column = str(time_series.get("value_column") or "Value")
        fig = px.line(
            plot_df,
            x="period",
            y="value",
            markers=True,
            title=f"Trend - {value_column} over time",
            color_discrete_sequence=["#4f8ef7"],
        )
        fig.update_traces(name=value_column, hovertemplate="Period: %{x|%Y-%m}<br>Value: %{y:.3f}<extra></extra>")

        if len(plot_df) >= 2:
            x_values = np.arange(len(plot_df))
            slope, intercept = np.polyfit(x_values, plot_df["value"].to_numpy(), 1)
            fig.add_trace(
                go.Scatter(
                    x=plot_df["period"],
                    y=slope * x_values + intercept,
                    mode="lines",
                    name="Linear trend",
                    line={"color": "#f7e04f", "width": 2, "dash": "dash"},
                    hovertemplate="Trend: %{y:.3f}<extra></extra>",
                )
            )

        fig.update_layout(xaxis_title="Period", yaxis_title=value_column)
        _style_figure(fig)
        return {chart_key: fig.to_json()}
    except Exception:
        return {chart_key: None}


def _missing_values_heatmap(df: pd.DataFrame) -> dict[str, str | None]:
    if not df.isna().any().any():
        return {}

    chart_key = "missing_values"
    try:
        sample_df = df.head(100)
        matrix = sample_df.isna().astype(int)
        fig = go.Figure(
            data=go.Heatmap(
                z=matrix.values,
                x=[str(column) for column in matrix.columns],
                y=list(range(1, len(matrix) + 1)),
                colorscale=[[0, "#111827"], [1, "#f74f7a"]],
                zmin=0,
                zmax=1,
                showscale=True,
                colorbar={"tickvals": [0, 1], "ticktext": ["Present", "Missing"]},
                hovertemplate="Row %{y}<br>Column %{x}<br>%{z}<extra></extra>",
            )
        )
        fig.update_layout(title="Missing Values Map", xaxis_title="Column", yaxis_title="Sampled row")
        _style_figure(fig)
        return {chart_key: fig.to_json()}
    except Exception:
        return {chart_key: None}


def _style_figure(fig: go.Figure) -> None:
    fig.update_layout(
        template=dark_template,
        margin=dict(l=40, r=40, t=50, b=40),
        hoverlabel=dict(
            bgcolor="#1e2433",
            font_size=13,
            font_color="#e2e8f0",
        ),
        paper_bgcolor="#0f1117",
        plot_bgcolor="#0f1117",
        font={"color": "#e2e8f0", "family": "Inter, sans-serif"},
    )
    fig.update_xaxes(gridcolor="#1e2433", linecolor="#2d3748", zerolinecolor="#2d3748")
    fig.update_yaxes(gridcolor="#1e2433", linecolor="#2d3748", zerolinecolor="#2d3748")


def _highest_variance_columns(df: pd.DataFrame, numeric_columns: list[str], limit: int) -> list[str]:
    if not numeric_columns:
        return []
    return (
        df[numeric_columns]
        .apply(pd.to_numeric, errors="coerce")
        .var(numeric_only=True)
        .sort_values(ascending=False)
        .head(limit)
        .index.tolist()
    )


def _sample_series(series: pd.Series, limit: int = 10000) -> pd.Series:
    return series.sample(limit, random_state=42) if len(series) > limit else series


def _kde_overlay(series: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    values = pd.to_numeric(series, errors="coerce").dropna().to_numpy(dtype=float)
    if values.size < 2 or np.nanstd(values) == 0:
        return np.array([]), np.array([])

    if values.size > 1200:
        rng = np.random.default_rng(42)
        values = rng.choice(values, size=1200, replace=False)

    x_values = np.linspace(values.min(), values.max(), 160)
    std = values.std(ddof=1)
    bandwidth = 1.06 * std * (values.size ** (-1 / 5))
    if not np.isfinite(bandwidth) or bandwidth <= 0:
        return np.array([]), np.array([])

    differences = (x_values[:, None] - values[None, :]) / bandwidth
    density = np.exp(-0.5 * differences**2).sum(axis=1) / (values.size * bandwidth * np.sqrt(2 * np.pi))
    return x_values, density


def _safe_key(value: Any) -> str:
    return str(value).lower().replace(" ", "_").replace("/", "_")
