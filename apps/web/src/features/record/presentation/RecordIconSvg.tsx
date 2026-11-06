import type { RecordIcon } from "../domain/record-kinds";

const PATHS: Record<RecordIcon, string> = {
  number: "M5 9h14M5 15h14M10 4 8 20M16 4l-2 16",
  done: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-4 9 3 3 5-6",
  photo: "M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  money: "M3 6h18v13H3zM3 10h18M16 15h2",
  form: "M7 4h10v17H7zM9 4h6v3H9zM9 12h6M9 16h4",
};

/** The one drawing of each kind's icon, so the chooser and the Today buttons never differ. Decorative: the words beside it carry the meaning. */
export function RecordIconSvg({ icon, size = 24 }: { icon: RecordIcon; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[icon]} />
    </svg>
  );
}
