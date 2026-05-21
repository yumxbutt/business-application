import React from 'react';

export default React.forwardRef(function Input({ value, onChange, placeholder, type='text', className='', ...rest }, ref){
  return (
    <input
      ref={ref}
      className={[ 'form-input-sm', className].filter(Boolean).join(' ')}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      {...rest}
    />
  );
});
