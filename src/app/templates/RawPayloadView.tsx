import React, { CSSProperties, memo } from 'react';

import { FormField } from 'app/atoms';

type RawPayloadViewProps = {
  payload: string;
  rows?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
  fieldWrapperBottomMargin?: boolean;
  modifyFeeAndLimitComponent: JSX.Element | null;
};

const RawPayloadView = memo(
  ({
    className,
    payload,
    label,
    rows,
    modifyFeeAndLimitComponent,
    style = {},
    fieldWrapperBottomMargin = false
  }: RawPayloadViewProps) => (
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
        className={className}
        style={{
          resize: 'none',
          marginBottom: 0,
          ...style
        }}
      />
      {modifyFeeAndLimitComponent}
    </div>
  )
);

export default RawPayloadView;
