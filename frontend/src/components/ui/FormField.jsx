export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  className = '',
  inputClassName = '',
}) {
  return (
    <label className={`form-field ${className}`.trim()} htmlFor={name}>
      <span className="form-field__label">{label}</span>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`form-field__control ${inputClassName}`.trim()}
      />
    </label>
  );
}
