import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';
import { useForm } from 'react-hook-form';

import { FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { defaultNumberOfWords } from 'app/pages/ImportAccount/constants';
import { SeedPhraseInput } from 'app/templates/SeedPhraseInput';
import { T, t } from 'lib/i18n';

import { ImportFromSeedPhraseSelectors } from './ImportFromSeedPhrase.selectors';

interface ImportFromSeedPhraseProps {
  seedPhrase: string;
  setSeedPhrase: (seed: string) => void;
  setIsSeedEntered: (value: boolean) => void;
}

export const ImportFromSeedPhrase: FC<ImportFromSeedPhraseProps> = ({
  seedPhrase,
  setSeedPhrase,
  setIsSeedEntered
}) => {
  const { handleSubmit, formState, reset } = useForm();
  const [seedError, setSeedError] = useState('');
  const [numberOfWords, setNumberOfWords] = useState(defaultNumberOfWords);
  const { fullPage } = useAppEnv();

  const onSubmit = useCallback(() => {
    if (seedPhrase && !seedPhrase.split(' ').includes('') && !seedError) {
      setIsSeedEntered(true);
    } else if (seedError === '') {
      setSeedError(t('mnemonicWordsAmountConstraint', [numberOfWords]) as string);
    }
  }, [seedPhrase, seedError, setIsSeedEntered, numberOfWords]);

  return (
    <form
      className={classNames('w-full mx-auto ', fullPage ? 'my-8 px-12 pb-8' : 'mt-4 pb-8')}
      onSubmit={handleSubmit(onSubmit)}
    >
      <SeedPhraseInput
        isFirstAccount
        submitted={formState.submitCount !== 0}
        seedError={seedError}
        onChange={setSeedPhrase}
        setSeedError={setSeedError}
        reset={reset}
        testID={ImportFromSeedPhraseSelectors.wordInput}
        numberOfWords={numberOfWords}
        setNumberOfWords={setNumberOfWords}
      />

      <FormSubmitButton className="w-96 mx-auto" testID={ImportFromSeedPhraseSelectors.nextButton}>
        <T id="next" />
      </FormSubmitButton>
    </form>
  );
};
