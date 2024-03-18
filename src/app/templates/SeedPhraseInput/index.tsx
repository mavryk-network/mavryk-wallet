import React, { FC, useCallback, useRef, useState } from 'react';

import { validateMnemonic } from 'bip39';
import classNames from 'clsx';

import { Alert } from 'app/atoms';
import { FormFieldElement } from 'app/atoms/FormField';
import { formatMnemonic } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { setTestID, TestIDProperty } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { clearClipboard } from 'lib/ui/utils';

import { ImportAccountSelectors } from '../../pages/ImportAccount/selectors';
import { SeedLengthSelect } from './SeedLengthSelect/SeedLengthSelect';
import { numberOfWordsOptions } from './SeedLengthSelect/utils';
import { SeedWordInput, SeedWordInputProps } from './SeedWordInput';
import { useRevealRef } from './use-reveal-ref.hook';

interface SeedPhraseInputProps extends TestIDProperty {
  isFirstAccount?: boolean;
  submitted: boolean;
  seedError: string | React.ReactNode;
  labelWarning?: string;
  onChange: (seed: string) => void;
  setSeedError: (e: string) => void;
  reset: () => void;
  numberOfWords: number;
  setNumberOfWords: (n: number) => void;
}

const defaultNumberOfWords = 12;

export const SeedPhraseInput: FC<SeedPhraseInputProps> = ({
  isFirstAccount,
  submitted,
  seedError,
  labelWarning,
  onChange,
  setSeedError,
  reset,
  numberOfWords,
  setNumberOfWords,
  testID
}) => {
  const inputsRef = useRef<Array<FormFieldElement | null>>([]);

  const { popup } = useAppEnv();

  const [pasteFailed, setPasteFailed] = useState(false);
  const [draftSeed, setDraftSeed] = useState(new Array<string>(defaultNumberOfWords).fill(''));
  const [wordSpellingErrorsCount, setWordSpellingErrorsCount] = useState(0);

  const { getRevealRef, onReveal, resetRevealRef } = useRevealRef();

  const onSeedChange = useCallback(
    (newDraftSeed: string[]) => {
      setDraftSeed(newDraftSeed);

      const joinedDraftSeed = newDraftSeed.join(' ');
      let newSeedError = '';

      if (!newDraftSeed.some(Boolean)) {
        onChange(joinedDraftSeed);
        return;
      }

      if (newDraftSeed.some(word => word === '')) {
        newSeedError = t('mnemonicWordsAmountConstraint', [numberOfWords]) as string;
      }

      if (!validateMnemonic(formatMnemonic(joinedDraftSeed))) {
        newSeedError = t('justValidPreGeneratedMnemonic');
      }

      setSeedError(newSeedError);
      onChange(newSeedError ? '' : joinedDraftSeed);
    },
    [setDraftSeed, setSeedError, onChange, numberOfWords]
  );

  const onSeedWordChange = useCallback(
    (index: number, value: string) => {
      if (pasteFailed) {
        setPasteFailed(false);
      }
      const newSeed = draftSeed.slice();
      newSeed[index] = value.trim();
      onSeedChange(newSeed);
    },
    [draftSeed, onSeedChange, pasteFailed]
  );

  const onSeedPaste = useCallback(
    (rawSeed: string) => {
      const parsedSeed = formatMnemonic(rawSeed);
      let newDraftSeed = parsedSeed.split(' ');

      if (newDraftSeed.length > 24) {
        setPasteFailed(true);
        return;
      } else if (pasteFailed) {
        setPasteFailed(false);
      }

      let newNumberOfWords = numberOfWords;
      if (newDraftSeed.length !== numberOfWords) {
        if (newDraftSeed.length < 12) {
          newNumberOfWords = 12;
        } else if (newDraftSeed.length % 3 === 0) {
          newNumberOfWords = newDraftSeed.length;
        } else {
          newNumberOfWords = newDraftSeed.length + (3 - (newDraftSeed.length % 3));
        }
        setNumberOfWords(newNumberOfWords);
      }

      if (newDraftSeed.length < newNumberOfWords) {
        newDraftSeed = newDraftSeed.concat(new Array(newNumberOfWords - newDraftSeed.length).fill(''));
      }

      resetRevealRef();
      onSeedChange(newDraftSeed);
      clearClipboard();
    },
    [numberOfWords, onSeedChange, pasteFailed, setPasteFailed, resetRevealRef, setNumberOfWords]
  );

  const onSeedWordPaste = useCallback<Defined<SeedWordInputProps['onPaste']>>(
    event => {
      const newSeed = event.clipboardData.getData('text');

      if (newSeed.trim().match(/\s/u)) {
        event.preventDefault();
        onSeedPaste(newSeed);
      }
    },
    [onSeedPaste]
  );

  const hasError = Boolean(seedError) || Boolean(wordSpellingErrorsCount) || pasteFailed;

  return (
    <div>
      <div className="w-full text-left text-sm pb-4 text-secondary-white" style={{ maxWidth: 300 }}>
        <p>{t('seedPhraseTip')}</p>
      </div>
      <div className="flex justify-between mb-4">
        <h1
          className={classNames(
            'font-aeonik flex self-center text-white',
            popup ? 'text-base-plus' : 'text-xl leading-6 tracking-tight'
          )}
        >
          <T id="seedPhrase" />
        </h1>

        <div className={classNames('relative', 'w-40 h-12')}>
          <SeedLengthSelect
            options={numberOfWordsOptions}
            currentOption={draftSeed.length.toString()}
            defaultOption={`${numberOfWords}`}
            onChange={newSelectedOption => {
              const newNumberOfWords = parseInt(newSelectedOption, 10);
              if (Number.isNaN(newNumberOfWords)) {
                throw new Error('Unable to parse option as integer');
              }

              const newDraftSeed = new Array(newNumberOfWords).fill('');
              setNumberOfWords(newNumberOfWords);
              onSeedChange(newDraftSeed);
              reset();
              setSeedError('');
              setWordSpellingErrorsCount(0);
            }}
          />
        </div>
      </div>

      {labelWarning && <Alert title={t('attention')} description={labelWarning} className="mb-4" />}

      <div className={classNames('grid gap-4', popup ? 'grid-cols-2' : 'grid-cols-3')}>
        {[...Array(numberOfWords).keys()].map(index => {
          const key = `import-seed-word-${index}`;

          const handleChange = (event: React.ChangeEvent<FormFieldElement>) => {
            event.preventDefault();
            onSeedWordChange(index, event.target.value);
          };

          return (
            <SeedWordInput
              key={key}
              id={index}
              inputsRef={inputsRef}
              numberOfWords={numberOfWords}
              submitted={submitted}
              onChange={handleChange}
              revealRef={getRevealRef(index)}
              onReveal={() => onReveal(index)}
              value={draftSeed[index]}
              testID={testID}
              onPaste={onSeedWordPaste}
              setWordSpellingErrorsCount={setWordSpellingErrorsCount}
              onSeedWordChange={onSeedWordChange}
              seedError={seedError}
            />
          );
        })}
      </div>

      {hasError && (
        <div
          className={classNames('mt-4 text-primary-error', popup ? 'text-sm' : 'text-base-plus')}
          {...setTestID(ImportAccountSelectors.mnemonicValidationErrorText)}
        >
          {submitted && seedError && <div>{seedError}</div>}

          {pasteFailed && (
            <div>
              <T id="seedPasteFailedTooManyWords" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const isSeedPhraseFilled = (seedPhrase: string) => seedPhrase && !seedPhrase.split(' ').includes('');
