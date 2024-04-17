import React, { ElementRef, FC, ReactNode, useCallback, useState } from 'react';

import clsx from 'clsx';
import useOnClickOutside from 'use-onclickoutside';

import { FormCheckbox } from 'app/atoms';
import { ReactComponent as ArrowIcon } from 'app/icons/chevron-down.svg';
import { ReactComponent as MinusIcon } from 'app/icons/negative.svg';
import { t } from 'lib/i18n';

export type CounterSelectOptionType = {
  checked: boolean;
  type: string;
  content: ReactNode;
  handleChange?: (checked: boolean) => void;
};

export type CounterSelectProps = {
  selectedCount: number;
  unselectAll: () => void;
  options: CounterSelectOptionType[];
};

export const CounterSelect: FC<CounterSelectProps> = ({ selectedCount, unselectAll, options }) => {
  const [opened, setOpened] = useState(false);
  const ref = React.useRef<ElementRef<'section'>>(null);

  const toggleOpened = useCallback(() => {
    setOpened(!opened);
  }, [opened]);

  const close = useCallback(() => {
    if (!opened) return;
    setOpened(false);
  }, [opened]);

  useOnClickOutside(ref, close);

  return (
    <section ref={ref} className="relative">
      <CounterSelectOptionFace
        count={selectedCount}
        unselectAll={unselectAll}
        toggleOpened={toggleOpened}
        opened={opened}
      />
      {opened && (
        <div className="absolute top-12 z-10" style={{ minWidth: 'fit-content' }}>
          <CounterSelectContent options={options} />
        </div>
      )}
    </section>
  );
};

type CounterSelectOptionFaceProps = {
  count: number;
  opened: boolean;
  unselectAll: () => void;
  toggleOpened: () => void;
};

const CounterSelectOptionFace: FC<CounterSelectOptionFaceProps> = ({ count, unselectAll, opened, toggleOpened }) => {
  const handleCheckBoxChange = useCallback(
    (checked: boolean) => {
      if (!checked) {
        unselectAll();
      }
    },
    [unselectAll]
  );

  return (
    <section
      className={clsx(
        'p-2 flex items-center gap-3 bg-primary-card rounded-md max-h-8',
        'transition ease-in-out duration-200 border border-transparent',
        opened && 'border border-accent-blue'
      )}
    >
      <FormCheckbox
        checked={count > 0}
        onChange={handleCheckBoxChange}
        IconFromProps={MinusIcon}
        iconClassName="h-4/6 w-4/6 stroke-accent-blue pointer-events-none"
        labelClassName={clsx(count === 0 && 'pointer-events-none opacity-75', 'py-0 bg-primary-card')}
        overrideClassNames="w-4 h-4 rounded"
        shouldFocus={false}
      />
      <div className="flex items-center gap-3 cursor-pointer" onClick={toggleOpened}>
        <p className="text-white text-sm capitalize">{t('selectedCount', [`${count}`])}</p>
        <ArrowIcon
          className={clsx(
            'w-6 h-auto stroke-white stroke-1 transition ease-in-out duration-200 cursor-pointer',
            opened && 'transform rotate-180'
          )}
        />
      </div>
    </section>
  );
};

type CounterSelectContentProps = {
  options: CounterSelectOptionType[];
};

const CounterSelectContent: FC<CounterSelectContentProps> = ({ options }) => {
  return (
    <section className="flex flex-col bg-primary-card rounded-2xl overflow-hidden animate-drop">
      {options.map(option => (
        <CounterSelectOption key={option.type} {...option} />
      ))}
    </section>
  );
};

const CounterSelectOption: FC<CounterSelectOptionType> = ({ checked, handleChange, content }) => {
  const handleOptionChange = useCallback(
    (checked: boolean) => {
      handleChange?.(checked);
    },
    [handleChange]
  );

  return (
    <div className="bg-primary-card">
      <FormCheckbox
        checked={checked}
        onChange={handleOptionChange}
        className="bg-primary-card"
        labelClassName="py-4 px-2 bg-primary-card hover:bg-primary-card-hover w-full"
        label={<div className="text-white text-sm whitespace-nowrap">{content}</div>}
        overrideClassNames="w-4 h-4 rounded"
      />
    </div>
  );
};
