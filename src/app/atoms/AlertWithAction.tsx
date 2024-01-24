import React, { ReactNode, FC } from 'react';

export type AlertWithActionProps = {
  children: ReactNode;
  btnLabel: string;
  onClick?: () => void;
};

export const AlertWithAction: FC<AlertWithActionProps> = ({ children, btnLabel, onClick }) => {
  return (
    <section className="bg-accent-blue-hover p-2 text-sm text-gray-410 flex items-center justify-between rounded-lg">
      <div>{children}</div>
      <div
        className="text-sm tracking-normal bg-accent-blue text-white py-1 px-10px text-center ml-3 rounded cursor-pointer"
        onClick={onClick}
      >
        {btnLabel}
      </div>
    </section>
  );
};
