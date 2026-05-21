export default function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span className="toggle-switch__track">
        <span className="toggle-switch__thumb" />
      </span>
      <span className="toggle-switch__label">{checked ? 'Active' : 'Inactive'}</span>
    </button>
  );
}
