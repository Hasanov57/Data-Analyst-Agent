import base64
from io import BytesIO
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd

from analyzer import prepare_dataframe_for_analysis


BACKGROUND = "#0f1117"
TEXT_COLOR = "#ffffff"
ACCENT = "#4f8ef7"
GRID_COLOR = "#2b3240"
PLOT_SAMPLE_LIMIT = 1800
MAX_DISTRIBUTION_CHARTS = 4
MAX_CATEGORICAL_CHARTS = 6
MAX_OUTLIER_CHARTS = 3


def generate_charts(df: pd.DataFrame, analysis_results: dict[str, Any]) -> dict[str, str]:
    analysis_df, numeric_columns, categorical_columns, datetime_columns = prepare_dataframe_for_analysis(df)
    charts: dict[str, str] = {}

    charts.update(_distribution_plots(analysis_df, numeric_columns))
    charts.update(_correlation_heatmap(analysis_df, numeric_columns))
    charts.update(_categorical_bar_charts(analysis_df, categorical_columns))
    charts.update(_outlier_box_plots(analysis_df, numeric_columns, analysis_results))
    charts.update(_time_series_chart(analysis_df, analysis_results, datetime_columns))

    return charts


def _distribution_plots(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, str]:
    charts = {}
    selected_columns = (
        df[numeric_columns]
        .var(numeric_only=True)
        .sort_values(ascending=False)
        .head(MAX_DISTRIBUTION_CHARTS)
        .index.tolist()
        if numeric_columns
        else []
    )

    for column in selected_columns:
        try:
            series = pd.to_numeric(df[column], errors="coerce").dropna()
            if series.empty:
                continue
            if len(series) > PLOT_SAMPLE_LIMIT:
                series = series.sample(PLOT_SAMPLE_LIMIT, random_state=42)

            fig, ax = _new_figure()
            ax.hist(series, bins="auto", color=ACCENT, edgecolor=BACKGROUND, alpha=0.88)
            _style_axis(ax, f"Distribution: {column}", column, "Count")
            charts[f"distribution_{column}"] = _figure_to_base64(fig)
        except Exception:
            plt.close("all")
            continue

    return charts


def _correlation_heatmap(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, str]:
    if len(numeric_columns) < 3:
        return {}

    try:
        selected_columns = (
            df[numeric_columns]
            .var(numeric_only=True)
            .sort_values(ascending=False)
            .head(8)
            .index.tolist()
        )
        corr = df[selected_columns].corr(method="pearson")
        fig, ax = _new_figure()
        image = ax.imshow(corr.values, cmap="coolwarm", vmin=-1, vmax=1)
        fig.colorbar(image, ax=ax, shrink=0.8)
        ax.set_xticks(range(len(corr.columns)), labels=[str(column) for column in corr.columns])
        ax.set_yticks(range(len(corr.index)), labels=[str(column) for column in corr.index])
        for row_index, row in enumerate(corr.values):
            for col_index, value in enumerate(row):
                ax.text(col_index, row_index, f"{value:.2f}", ha="center", va="center", color=TEXT_COLOR, fontsize=8)
        _style_axis(ax, "Correlation Heatmap", "", "")
        ax.tick_params(axis="x", rotation=35)
        ax.tick_params(axis="y", rotation=0)
        charts = {"correlation_heatmap": _figure_to_base64(fig)}
        return charts
    except Exception:
        plt.close("all")
        return {}


def _categorical_bar_charts(df: pd.DataFrame, categorical_columns: list[str]) -> dict[str, str]:
    charts = {}
    eligible_columns = []

    for column in categorical_columns:
        try:
            unique_count = df[column].nunique(dropna=False)
        except Exception:
            continue
        if unique_count < 20:
            eligible_columns.append((column, unique_count))

    eligible_columns = [
        column
        for column, _ in sorted(eligible_columns, key=lambda item: (item[1], str(item[0])))[:MAX_CATEGORICAL_CHARTS]
    ]

    for column in eligible_columns:
        try:
            counts = df[column].fillna("Unknown").astype(str).value_counts().head(10).sort_values()
            if counts.empty:
                continue

            fig, ax = _new_figure()
            ax.barh(counts.index, counts.values, color=ACCENT)
            _style_axis(ax, f"Top Categories: {column}", "Count", column)
            charts[f"categorical_{column}"] = _figure_to_base64(fig)
        except Exception:
            plt.close("all")
            continue

    return charts


def _outlier_box_plots(df: pd.DataFrame, numeric_columns: list[str], analysis_results: dict[str, Any]) -> dict[str, str]:
    charts = {}
    descriptive_stats = analysis_results.get("descriptive_stats", {})
    outlier_columns = [
        column for column in numeric_columns if descriptive_stats.get(str(column), {}).get("outlier_count", 0) > 0
    ]

    for column in outlier_columns[:MAX_OUTLIER_CHARTS]:
        try:
            series = pd.to_numeric(df[column], errors="coerce").dropna()
            if series.empty:
                continue
            if len(series) > PLOT_SAMPLE_LIMIT:
                series = series.sample(PLOT_SAMPLE_LIMIT, random_state=42)

            fig, ax = _new_figure()
            ax.boxplot(series, vert=False, patch_artist=True, boxprops={"facecolor": ACCENT, "color": ACCENT})
            _style_axis(ax, f"Outliers: {column}", column, "")
            charts[f"outliers_{column}"] = _figure_to_base64(fig)
        except Exception:
            plt.close("all")
            continue

    return charts


def _time_series_chart(
    df: pd.DataFrame, analysis_results: dict[str, Any], datetime_columns: list[str]
) -> dict[str, str]:
    time_series = analysis_results.get("time_series_detection", {})
    if not time_series.get("detected") or not datetime_columns:
        return {}

    try:
        monthly_records = time_series.get("monthly_aggregation", [])
        if not monthly_records:
            return {}

        plot_df = pd.DataFrame(monthly_records)
        plot_df["period"] = pd.to_datetime(plot_df["period"])
        plot_df["value"] = pd.to_numeric(plot_df["value"], errors="coerce")
        plot_df = plot_df.dropna()

        fig, ax = _new_figure()
        ax.plot(plot_df["period"], plot_df["value"], color=ACCENT, linewidth=2.2, marker="o", markersize=4)
        _style_axis(
            ax,
            f"Monthly Trend: {time_series.get('value_column')} by {time_series.get('date_column')}",
            "Month",
            str(time_series.get("value_column") or "Value"),
        )
        fig.autofmt_xdate()
        return {"time_series_trend": _figure_to_base64(fig)}
    except Exception:
        plt.close("all")
        return {}


def _new_figure():
    fig, ax = plt.subplots(figsize=(7.2, 3.6), facecolor=BACKGROUND)
    ax.set_facecolor(BACKGROUND)
    return fig, ax


def _style_axis(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title, color=TEXT_COLOR, fontsize=12, pad=12)
    ax.set_xlabel(xlabel, color=TEXT_COLOR)
    ax.set_ylabel(ylabel, color=TEXT_COLOR)
    ax.tick_params(colors=TEXT_COLOR)
    ax.grid(True, color=GRID_COLOR, alpha=0.35, linewidth=0.7)

    for spine in ax.spines.values():
        spine.set_color(GRID_COLOR)


def _figure_to_base64(fig) -> str:
    buffer = BytesIO()
    fig.tight_layout()
    fig.savefig(buffer, format="png", dpi=95, facecolor=BACKGROUND, bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")
