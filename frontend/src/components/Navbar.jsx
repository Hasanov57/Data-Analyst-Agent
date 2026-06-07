import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BarChart3, Menu, X } from "lucide-react";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Features", to: "/#features" },
  { label: "How It Works", to: "/#how-it-works" },
  { label: "About", to: "/#about" },
  { label: "History", to: "/history" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-emerald-300 shadow-sm">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold text-slate-950">DataWhiz AI</span>
            <span className="hidden text-xs text-slate-500 sm:block">AI data analyst workflow</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <NavItem key={link.label} link={link} location={location} />
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/analyze"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-700 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <NavItem key={link.label} link={link} location={location} onClick={() => setIsOpen(false)} />
            ))}
            <Link
              to="/analyze"
              className="mt-2 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white"
              onClick={() => setIsOpen(false)}
            >
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function NavItem({ link, location, onClick }) {
  const isAnchor = link.to.includes("#");
  const className =
    "rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2";
  const activeClassName = "bg-slate-100 text-slate-950";

  if (isAnchor) {
    const hash = `#${link.to.split("#")[1]}`;
    const isActive = location.pathname === "/" && location.hash === hash;
    return (
      <Link to={link.to} className={`${className} ${isActive ? activeClassName : ""}`} onClick={onClick}>
        {link.label}
      </Link>
    );
  }

  return (
    <NavLink
      to={link.to}
      end={link.to === "/"}
      className={({ isActive }) =>
        `${className} ${isActive && !location.hash ? activeClassName : ""}`
      }
      onClick={onClick}
    >
      {link.label}
    </NavLink>
  );
}
