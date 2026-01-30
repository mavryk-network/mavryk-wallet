import React, { FC, useCallback, useMemo } from 'react';

import clsx from 'clsx';

import { useTabSlug } from 'app/atoms/useTabSlug';
import { FileImportWrapper } from 'app/compound/FileTransfer';
import { useAppEnv } from 'app/env';
import { ReactComponent as UploadCloudSvg } from 'app/icons/feather-upload-cloud.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { TabsBar } from 'app/templates/TabBar';
import { T, TID } from 'lib/i18n';
import { TempleContact } from 'lib/temple/types';

import { AddressBookSelectors } from '../AddressBook.selectors';

type TabName = 'JSON' | '.csv';

interface TabData {
  name: TabName;
  titleI18nKey: TID;
  Component: FC;
  testID: string;
  disabled?: boolean;
}

// bg-gray-900
export const ImportContacts: React.FC = () => {
  const { popup } = useAppEnv();
  const tabSlug = useTabSlug();

  const tabs = useMemo<TabData[]>(() => {
    return [
      {
        name: 'JSON',
        titleI18nKey: 'json',
        Component: JSONImportInfo,
        testID: AddressBookSelectors.jsonTab
      },
      {
        name: '.csv',
        titleI18nKey: 'csv',
        Component: CSVImportInfo,
        testID: AddressBookSelectors.csvTab
      }
    ];
  }, []);

  const { name, Component } = useMemo(() => {
    const tab = tabSlug ? tabs.find(currentTab => currentTab.name === tabSlug) : null;
    return tab ?? tabs[0];
  }, [tabSlug, tabs]);

  const onContactsImported = useCallback((data: any) => {
    console.log(data);
  }, []);

  return (
    <div className={clsx('w-full h-full mx-auto flex-1 flex flex-col text-primary-white', popup && 'pb-8 max-w-sm')}>
      <p className="text-base-plus text-center mb-4">
        <T id="fileImportDescr" />
      </p>

      <div className="flex items-center relative mx-auto mb-2">
        <TabsBar tabs={tabs} activeTabName={name} />
      </div>

      <div className="px-4 py-3 bg-gray-900 rounded-2xl overflow-hidden mb-3">{Component && <Component />}</div>

      <FileImportWrapper<TempleContact> onImported={onContactsImported}>
        <section className="px-4 py-6 flex items justify-center border border-dashed border-blue-200 rounded-lg">
          <div className="flex flex-col gap-4 items-center">
            <UploadCloudSvg className="text-white w-9 h-9 stroke-current" />
            <div className="text-center">
              <p className="mb-1 text-sm">
                <T id="selectFIleOrDrag" />
              </p>
              <p className="text-xs text-secondary-white">
                <T id="fileImportLimitationDescr" />
              </p>
            </div>

            <ButtonRounded size="small" fill={false}>
              <T id="selectFile" />
            </ButtonRounded>
          </div>
        </section>
      </FileImportWrapper>
    </div>
  );
};

const JSONImportInfo = () => {
  return (
    <pre className="codeFont text-base-plus whitespace-pre leading-snug select-text">
      <span>[</span>
      <span style={{ letterSpacing: '-0.3rem' }}>...</span>
      {'\n'}
      <span className="ml-3 inline-block">
        <span className="text-accent-blue">{'{'}</span>
        {'\n'}
        <span>“address”: “mv1..”</span>
        {'\n'}
        <span>“name”: </span>
        <span style={{ color: '#C09EEC' }}>“Sammy”</span>
        {'\n'}
        <span>{'}'}</span>
      </span>
      {'\n'}
      <span>]</span>
    </pre>
  );
};

const CSVImportInfo = () => {
  return (
    <div className="codeFont text-base-plus">
      <T id="csvFileImportDescr" />
    </div>
  );
};
