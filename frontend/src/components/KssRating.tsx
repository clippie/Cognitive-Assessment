interface KssRatingProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

// Karolinska Sleepiness Scale: a validated 1 (extremely alert) - 9 (extremely
// sleepy, fighting sleep) scale. Reused for both kss_pre and kss_post.
export function KssRating({ label, value, onChange }: KssRatingProps) {
  return (
    <fieldset className="kss-rating">
      <legend>{label}</legend>
      <div className="kss-rating-options">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={value === n ? "kss-option selected" : "kss-option"}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
