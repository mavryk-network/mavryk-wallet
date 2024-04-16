import React, { FC, useMemo } from 'react';

import clsx from 'clsx';

import { Alert } from 'app/atoms/Alert/Alert';
import { ReadOnlySecretField } from 'app/atoms/ReadOnlySecretField';
import { useAppEnv } from 'app/env';
import { ButtonNavigate } from 'app/molecules/ButtonNavigate';
import { TID, T } from 'lib/i18n';

import { RevealSecretsSelectors } from './RevealSecrets.selectors';

interface Props {
  revealType: 'private-key' | 'seed-phrase';
  value: string;
}

interface Texts {
  title: TID;
  description?: React.ReactNode;
  attention: TID;
}

export const SecretField: FC<Props> = ({ revealType, value }) => {
  const { popup } = useAppEnv();

  const texts = useMemo<Texts>(() => {
    switch (revealType) {
      case 'private-key':
        return {
          title: 'privateKey',
          attention: 'doNotSharePrivateKey'
        };

      case 'seed-phrase':
        return {
          title: 'seedPhrase',
          attention: 'doNotSharePhrase'
        };
    }
  }, [revealType]);

  return (
    <>
      <Alert
        title={<T id="attentionExclamation" />}
        description={
          <p>
            <T id={texts.attention} />
          </p>
        }
        className="mb-6"
      />

      <div className="flex-grow">
        <ReadOnlySecretField
          value={value}
          label={texts.title}
          description={texts.description}
          testID={RevealSecretsSelectors.RevealSecretsValue}
          secretCoverTestId={RevealSecretsSelectors.RevealSecretsProtectedMask}
        />
      </div>

      <div className={clsx(popup && 'pb-8')}>
        <ButtonNavigate link="/" i18nKey="goToMain" />
      </div>
    </>
  );
};
