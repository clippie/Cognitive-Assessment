export interface CheckboxOption<T extends string> {
  value: T;
  label: string;
}

interface CheckboxGroupProps<T extends string> {
  legend: string;
  options: CheckboxOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

// Single-select rendered as a row of checkboxes rather than a <select> or radio
// group, per project decision: checking one option unchecks the others, but the
// visual affordance stays "checkbox" throughout the form.
export function CheckboxGroup<T extends string>({ legend, options, value, onChange }: CheckboxGroupProps<T>) {
  return (
    <fieldset className="checkbox-group">
      <legend>{legend}</legend>
      <div className="checkbox-row">
        {options.map((option) => (
          <label key={option.value} className="checkbox-option">
            <input type="checkbox" checked={value === option.value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
