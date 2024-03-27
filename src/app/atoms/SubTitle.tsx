import React, { FC, HTMLAttributes } from 'react';

import classNames from 'clsx';

type SubTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  uppercase?: boolean;
  small?: boolean;
};

const SubTitle: FC<SubTitleProps> = ({ className, children, uppercase = false, small = false, ...rest }) => {
  return (
    <h2
      className={classNames(
        'flex items-center justify-center text-center',
        'text-white',
        small ? 'text-base-plus' : 'text-xl leading-5 tracking-tight',
        'font-light',
        uppercase && 'uppercase',
        className
      )}
      {...rest}
    >
      {children}
    </h2>
  );
};

export default SubTitle;
