import React, { FC, ReactNode } from 'react';

interface PasswordStrengthIndicatorItemProps {
  isValid: boolean;
  message: ReactNode;
  title?: boolean;
  noColor?: boolean;
}

const PasswordStrengthIndicatorItem: FC<PasswordStrengthIndicatorItemProps> = ({
  isValid,
  message,
  title = false,
  noColor = false
}) => {
  const style = isValid ? { color: '#00B71D' } : noColor ? {} : { color: '#FF3E3E' };

  return title ? <p style={style}>{message}</p> : <li style={style}>{message}</li>;
};

export default PasswordStrengthIndicatorItem;
