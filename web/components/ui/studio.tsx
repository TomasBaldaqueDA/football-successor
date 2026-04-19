"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

// ─── Design tokens (match globals.css) ──────────────────────────────────────
export const C = {
  bg: "#0D1117",
  card: "#161B22",
  card2: "#1C2128",
  border: "rgba(255,255,255,0.08)",
  accent: "#00C9A7",
  muted: "#8B949E",
  text: "#E6EDF3",
  error: "#FF6B6B",
  warn: "#FFD54F",
} as const;

// ─── Page shell ─────────────────────────────────────────────────────────────
export function StudioPage({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: C.bg, color: C.text, fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}
    >
      {children}
    </div>
  );
}

export function StudioInner({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-10">
      {children}
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────
interface StudioHeaderProps {
  section: string;
  title: string;
  description?: ReactNode;
}
export function StudioHeader({ section, title, description }: StudioHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
          <Link href="/" className="hover:text-[#E6EDF3] transition">Home</Link>
          <span>/</span>
          <span>{section}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.text }}>{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed" style={{ color: C.muted }}>{description}</p>}
      </div>
    </header>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
interface CardProps { children: ReactNode; className?: string; noPad?: boolean }
export function Card({ children, className = "", noPad = false }: CardProps) {
  return (
    <div
      className={`rounded-xl border ${noPad ? "" : "p-5"} ${className}`}
      style={{ background: C.card, borderColor: C.border }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between border-b px-5 py-3"
      style={{ borderColor: C.border }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold" style={{ color: C.text }}>{children}</h2>;
}

// ─── Section label ───────────────────────────────────────────────────────────
export function SectionLabel({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {step != null && (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: C.accent + "20", color: C.accent }}
        >
          {step}
        </span>
      )}
      <h2 className="text-sm font-semibold" style={{ color: C.text }}>{children}</h2>
    </div>
  );
}

// ─── Error banner ────────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{ background: "#FF6B6B18", borderColor: "#FF6B6B40", color: C.error }}
    >
      ⚠ {message}
    </div>
  );
}

// ─── Warn banner ─────────────────────────────────────────────────────────────
export function WarnBanner({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{ background: "#FFD54F12", borderColor: "#FFD54F30", color: C.warn }}
    >
      {children}
    </div>
  );
}

// ─── Search input + dropdown ─────────────────────────────────────────────────
interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  loading?: boolean;
}
export function SearchInput({ value, onChange, placeholder, loading }: SearchInputProps) {
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search by name…"}
        autoComplete="off"
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#00C9A7]"
        style={{ background: C.bg, borderColor: C.border, color: C.text }}
      />
      {loading && (
        <span
          className="absolute right-3 top-2.5 text-xs"
          style={{ color: C.muted }}
        >
          Searching…
        </span>
      )}
    </div>
  );
}

interface HitItem { player_id: string; player_name: string; last_club: string | null }
export function SearchDropdown({ hits, onSelect }: { hits: HitItem[]; onSelect: (p: HitItem) => void }) {
  if (hits.length === 0) return null;
  return (
    <ul
      className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border py-1 text-sm shadow-2xl"
      style={{ background: C.card2, borderColor: C.border }}
    >
      {hits.map((p) => (
        <li key={p.player_id}>
          <button
            type="button"
            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-white/5"
            onClick={() => onSelect(p)}
          >
            <span className="font-medium" style={{ color: C.text }}>{p.player_name}</span>
            {p.last_club && <span className="text-xs" style={{ color: C.muted }}>{p.last_club}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Selected player badge ────────────────────────────────────────────────────
export function SelectedBadge({ name, id }: { name: string; id: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      style={{ background: "#00C9A710", borderColor: "#00C9A730" }}
    >
      <span className="text-[#00C9A7] text-xs font-medium">Selected</span>
      <span className="font-semibold" style={{ color: C.text }}>{name}</span>
      <span style={{ color: C.muted }}>·</span>
      <code className="text-[11px]" style={{ color: C.muted }}>{id}</code>
    </div>
  );
}

// ─── Form label wrapper ───────────────────────────────────────────────────────
export function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;
}
export function Select({ value, onChange, disabled, children }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#00C9A7] disabled:opacity-40"
      style={{ background: C.bg, borderColor: C.border, color: C.text }}
    >
      {children}
    </select>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps {
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}
export function Input({ type = "text", value, onChange, placeholder, min, max, step, disabled }: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#00C9A7] disabled:opacity-40"
      style={{ background: C.bg, borderColor: C.border, color: C.text }}
    />
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: "primary" | "ghost";
}
export function Button({ onClick, disabled, children, variant = "primary" }: ButtonProps) {
  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="h-[38px] rounded-lg border px-4 text-sm font-medium transition hover:bg-white/5 disabled:opacity-40"
        style={{ borderColor: C.border, color: C.muted }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[38px] rounded-lg px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: C.accent, color: C.bg }}
    >
      {children}
    </button>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ color: C.text }}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead style={{ background: "#0D1117", color: C.muted }}>
      <tr className="text-[11px] font-semibold uppercase tracking-wider">
        {children}
      </tr>
    </thead>
  );
}

export function TH({ children, className = "", style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <th className={`px-3 py-3 ${className}`} style={{ borderBottom: `1px solid ${C.border}`, ...style }}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

interface TRProps { children: ReactNode; rank?: number }
export function TR({ children }: TRProps) {
  return (
    <tr
      className="transition hover:bg-white/[0.03]"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className = "", style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return <td className={`px-3 py-2.5 ${className}`} style={style}>{children}</td>;
}

// ─── Score badge ──────────────────────────────────────────────────────────────
export function ScoreBadge({ value, color }: { value: string; color: string }) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{ background: color + "20", color }}
    >
      {value}
    </span>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: C.bg, borderColor: C.border }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: C.text }}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px]" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}

// ─── Score card (ControlScore style) ─────────────────────────────────────────
export function ScoreCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1"
      style={{ background: color + "0D", borderColor: color + "35" }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: color }}>
        {label}
      </span>
      <span className="text-3xl font-bold tabular-nums" style={{ color: C.text }}>{value}</span>
    </div>
  );
}

// ─── Player link ──────────────────────────────────────────────────────────────
export function PlayerLink({ href, name, onPointerDown }: { href: string; name: string; onPointerDown?: () => void }) {
  return (
    <Link
      href={href}
      onPointerDown={onPointerDown}
      className="font-medium transition hover:text-[#00C9A7]"
      style={{ color: C.text }}
    >
      {name}
    </Link>
  );
}

// ─── Inline stat row ─────────────────────────────────────────────────────────
export function StatRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {items.map((s) => (
        <span key={s.label}>
          <span style={{ color: C.muted }}>{s.label} </span>
          <span className="font-semibold" style={{ color: C.text }}>{s.value}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
      style={{ borderColor: C.accent, borderTopColor: "transparent" }}
    />
  );
}
