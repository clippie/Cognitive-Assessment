interface HoursSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

// 0-16hr range slider in 0.5hr steps, used for both sleep_hours and
// hours_since_waking. A native range input always carries a value (there's no
// "empty" state the way a text input has ""), so these fields default to 0
// rather than requiring the user to first interact with the control.
export function HoursSlider({ label, value, onChange }: HoursSliderProps) {
  return (
    <label className="hours-slider">
      <span className="hours-slider-label">
        {label}: <span className="hours-slider-value">{value}</span> hr{value === 1 ? "" : "s"}
      </span>
      <input
        type="range"
        min={0}
        max={16}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
