import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  DatabaseZap,
  FileSpreadsheet,
  FileText,
  LineChart,
  PieChart,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: DatabaseZap,
    title: "Automatic Data Cleaning",
    description: "Clean missing values, duplicates, messy headers, numeric text, and date-like columns before analysis.",
  },
  {
    icon: BarChart3,
    title: "Statistical Analysis",
    description: "Generate descriptive stats, correlations, skewness, outliers, and time-series trend detection.",
  },
  {
    icon: LineChart,
    title: "Data Visualization",
    description: "Create distribution charts, categorical charts, box plots, heatmaps, and trend visuals automatically.",
  },
  {
    icon: Bot,
    title: "AI-Generated Insights",
    description: "Turn computed statistics into executive summaries, risks, recommendations, and next analysis ideas.",
  },
  {
    icon: FileText,
    title: "PDF Report Export",
    description: "Export the final AI report for sharing with stakeholders or keeping as analysis documentation.",
  },
  {
    icon: FileSpreadsheet,
    title: "CSV and Excel Support",
    description: "Upload common spreadsheet formats and move through a guided analysis workflow.",
  },
];

const steps = [
  "Upload a CSV or Excel file",
  "Review the cleaned dataset",
  "Explore statistics and charts",
  "Generate and export the AI report",
];

export default function Landing() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ProductPreview />
      <AboutSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:56px_56px] opacity-40" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI-assisted analytics for messy datasets
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Turn Raw Data Into Clear Business Insights
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Upload CSV or Excel files and receive cleaned data, statistical analysis, charts, AI-generated insights, and downloadable reports in one guided workflow.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/analyze"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Get Started <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              See How It Works
            </a>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-4 shadow-2xl shadow-slate-200">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeader
        label="Features"
        title="Everything needed for a first-pass data analysis"
        description="DataWhiz AI combines deterministic data processing with AI interpretation, keeping the workflow transparent and useful."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <feature.icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-950">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          label="Workflow"
          title="From upload to report in four steps"
          description="The interface is designed as a guided workflow, not a blank dashboard."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <h3 className="text-sm font-semibold text-slate-950">{step}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeader
        label="Preview"
        title="A dashboard built for readable analysis"
        description="The workspace separates dataset quality, statistical results, charts, and AI interpretation into clear sections."
      />
      <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
        <DashboardMockup light />
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">About</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Built to make exploratory analysis more accessible</h2>
        <p className="mt-5 text-base leading-7 text-slate-600">
          DataWhiz AI does not replace careful data work. It accelerates the first pass by cleaning the file, computing transparent statistics, and using AI to explain the patterns in a business-friendly way.
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-slate-950 px-6 py-14 text-center text-white sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to analyze your data?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          Start with a CSV or Excel file and turn it into a clean report with charts and AI-generated analysis.
        </p>
        <Link
          to="/analyze"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Start Analyzing
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="font-semibold text-slate-900">DataWhiz AI</p>
          <p className="mt-1">AI-assisted data cleaning, analysis, and reporting.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="#" className="hover:text-slate-950">GitHub</a>
          <span>Copyright 2026 DataWhiz AI</span>
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({ label, title, description }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function DashboardMockup({ light = false }) {
  const base = light ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800";
  const card = light ? "bg-white border-slate-200 text-slate-950" : "bg-slate-900 border-slate-800 text-white";
  const muted = light ? "text-slate-500" : "text-slate-400";

  return (
    <div className={`rounded-2xl border ${base} p-4`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className={`rounded-2xl border ${card} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Dataset Overview</p>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {["12,480 Rows", "18 Columns", "6 Charts", "92 Score"].map((item) => (
              <div key={item} className={`rounded-xl border p-3 ${light ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-slate-950"}`}>
                <p className="text-sm font-semibold">{item}</p>
                <p className={`mt-1 text-xs ${muted}`}>Auto-generated</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`rounded-2xl border ${card} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Revenue Distribution</p>
            <PieChart className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          </div>
          <div className="mt-6 flex h-32 items-end gap-2">
            {[34, 52, 78, 45, 92, 64, 84, 58, 73, 48, 68].map((height, index) => (
              <div key={index} className="flex-1 rounded-t-lg bg-emerald-400/80" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </div>
      <div className={`mt-4 rounded-2xl border ${card} p-4`}>
        <p className="text-sm font-semibold">AI Insights Preview</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {["Strong positive revenue trend", "3 columns show outlier risk", "Enterprise segment leads volume"].map((item) => (
            <div key={item} className={`rounded-xl border p-3 text-sm ${light ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-slate-950"}`}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
