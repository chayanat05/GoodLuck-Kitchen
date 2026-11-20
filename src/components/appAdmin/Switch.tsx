"use client";

/** สวิตช์เปิด/ปิด ขนาดใหญ่ กดง่ายบนแท็บเล็ตในครัว */
export default function Switch({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 rounded-full transition-colors disabled:opacity-50 ${lg ? "h-9 w-16" : "h-7 w-12"} ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 left-1 rounded-full bg-white shadow transition-transform ${lg ? "h-7 w-7" : "h-5 w-5"} ${
          checked ? (lg ? "translate-x-7" : "translate-x-5") : ""
        }`}
      />
    </button>
  );
}
