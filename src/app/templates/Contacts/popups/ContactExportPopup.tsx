import React, { FC } from 'react';

import clsx from 'clsx';

import { ExportFormat, useFileExportActions } from 'app/compound/FileTransfer';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { TempleContact } from 'lib/temple/types';

type ContactExportPopupProps = {
  close: () => void;
};

const fileOptions: ExportFormat[] = ['json', 'csv'];

export const ContactExportPopup: FC<ContactExportPopupProps> = () => {
  const { popup } = useAppEnv();
  const { exportAs, pendingExport } = useFileExportActions<TempleContact>();

  return (
    <section className={clsx('flex flex-col', popup ? 'px-4' : 'px-12')}>
      <div className="w-full grid grid-cols-2 gap-6">
        {fileOptions.map(fileType => (
          <React.Fragment key={fileType}>
            <ButtonRounded
              size="big"
              btnType="primary"
              fill={false}
              onClick={() => exportAs(fileType)}
              disabled={!pendingExport}
            >
              {fileType}
            </ButtonRounded>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};
