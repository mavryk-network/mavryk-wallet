import React, { FC } from 'react';

import clsx from 'clsx';

import { Button } from 'app/atoms/Button';
import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { isBrowserVersionSafe } from 'lib/browser';
import { T } from 'lib/i18n';

import styles from '../Onboarding.module.css';

const AttentionPage: FC = () => {
  const { onBack } = useAppEnv();

  const browserVersionIsSafe = isBrowserVersionSafe();

  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={
        <>
          <T id="onboarding" />
        </>
      }
    >
      <div style={{ maxWidth: '360px' }} className="mx-auto pb-8 text-center">
        <p className={styles['title']}>
          <T id={'attention'} />
        </p>
        {!browserVersionIsSafe && (
          <p className={styles['alert']}>
            <T id={'browserVersionIsOutOfDate'} />
          </p>
        )}
        <p className={styles['description']} style={browserVersionIsSafe ? {} : { marginTop: 24 }}>
          <T id={'attentionDescription'} />
        </p>
        <p className={clsx(styles['description'], 'mb-5')} style={{ textAlign: 'start' }}>
          <T id={'attentionListTitle1'} />
        </p>
        <ul className={styles['listContainer']}>
          <li>
            <T id={'attentionListItem1'} />
          </li>
          <li>
            <T id={'attentionListItem2'} />
          </li>
          <li>
            <T id={'attentionListItem3'} />
          </li>
          <li>
            <T id={'attentionListItem4'} />
          </li>
        </ul>
        <p className={clsx(styles['description'], 'my-5')} style={{ textAlign: 'start' }}>
          <T id={'attentionListTitle2'} />
        </p>
        <ul className={styles['listContainer']}>
          <li>
            <T id={'attentionListItem5'} />
          </li>
          <li>
            <T id={'attentionListItem6'} />
          </li>
          <li>
            <T id={'attentionListItem7'} />
          </li>
          <li>
            <T id={'attentionListItem8'} />
          </li>
        </ul>
        <p className={clsx(styles['description'], 'my-6')}>
          <T id={'takeCare'} />
        </p>
        <p className={styles['description']} style={{ marginTop: 0, marginBottom: 0, color: '#3182CE' }}>
          <T id={'readMore'} />
          <a
            href={'https://madfish.crunch.help/temple-wallet/a-note-on-security'}
            target="_blank"
            rel="noreferrer"
            className={clsx(styles['link'], 'text-xs')}
          >
            link
          </a>
        </p>
        <Button
          className="w-full justify-center border-none"
          style={{
            padding: '10px 2rem',
            background: '#4198e0',
            color: '#ffffff',
            marginTop: '40px',
            borderRadius: 4
          }}
          onClick={onBack}
        >
          <T id={'thanks'} />
        </Button>
      </div>
    </PageLayout>
  );
};

export default AttentionPage;
