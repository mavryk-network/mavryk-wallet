import React, { CSSProperties, memo } from 'react';

import clsx from 'clsx';

import { FormField } from 'app/atoms';

type RawPayloadViewProps = {
  payload: string;
  rows?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
  fieldWrapperBottomMargin?: boolean;
};

const RawPayloadView = memo(
  ({ className, payload, label, rows, style = {}, fieldWrapperBottomMargin = false }: RawPayloadViewProps) => (
    <div>
      <FormField
        textarea
        rows={rows}
        id="sign-payload"
        label={label}
        value={payload}
        spellCheck={false}
        readOnly
        fieldWrapperBottomMargin={fieldWrapperBottomMargin}
        className={clsx('scrollbar', className)}
        style={{
          resize: 'none',
          marginBottom: 0,
          ...style
        }}
      />
    </div>
  )
);

export default RawPayloadView;
