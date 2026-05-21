import React from 'react';

export default React.forwardRef(function Select({ value, onChange, options = [], className = '', ...rest }, ref){
  return (
    <select ref={ref} className={[ 'ui-select', className].filter(Boolean).join(' ')} value={value} onChange={onChange} {...rest}>
      {options.map((opt, i) => {
        const base = opt && (opt.key ?? opt.value);
        const key = base != null ? `${String(base)}-${i}` : String(i);
        return (
          <option key={key} value={opt.value}>{opt.label}</option>
        );
      })}
    </select>
  );
});
