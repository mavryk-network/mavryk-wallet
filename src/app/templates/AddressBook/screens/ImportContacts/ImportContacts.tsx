import React, { FC, useCallback, useMemo, useState } from 'react';

import clsx from 'clsx';

import { useTabSlug } from 'app/atoms/useTabSlug';
import { FileImportWrapper, ImportResult, useFileImportState } from 'app/compound/FileTransfer';
import { formatFileSize } from 'app/compound/FileTransfer/utils';
import { useAppEnv } from 'app/env';
import { ReactComponent as CloseSvg } from 'app/icons/close.svg';
import { ReactComponent as UploadCloudSvg } from 'app/icons/feather-upload-cloud.svg';
import { ReactComponent as FileSvg } from 'app/icons/file-v2.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { SuccessStateType } from 'app/pages/SuccessScreen/SuccessScreen';
import { TabsBar } from 'app/templates/TabBar';
import { t, T, TID } from 'lib/i18n';
import { useContactsActions } from 'lib/temple/front';
import { TempleContact } from 'lib/temple/types';
import { useAlert } from 'lib/ui';
import { useLoading } from 'lib/ui/hooks/useLoading';
import { navigate } from 'lib/woozie';

import { AddressBookSelectors } from '../../AddressBook.selectors';

import styles from './importContacts.module.css';

type TabName = 'JSON' | '.csv';

interface TabData {
  name: TabName;
  titleI18nKey: TID;
  Component: FC;
  testID: string;
  disabled?: boolean;
}

const SELECT_FILE_VIEW = 'SELECT_FILE_VIEW';
const TRACK_PROGRESS_VIEW = 'TRACK_PROGRESS_VIEW';

type ActiveViewType = typeof SELECT_FILE_VIEW | typeof TRACK_PROGRESS_VIEW;

const importViewsData: ActiveViewType[] = [SELECT_FILE_VIEW, TRACK_PROGRESS_VIEW];

export const ImportContacts: React.FC = () => {
  const { popup } = useAppEnv();

  // views state
  const [activeView, setActiveView] = useState<ActiveViewType>(importViewsData[0]);
  // we dont know what is inside file - therefore any type
  const [fileContacts, setFilesContacts] = useState<ImportResult<any> | null>(null);

  const changeActiveView = useCallback((view: ActiveViewType) => {
    setActiveView(view);
  }, []);

  return (
    <div className={clsx('w-full h-full mx-auto flex-1 flex flex-col text-primary-white', popup && 'pb-8 max-w-sm')}>
      {activeView === SELECT_FILE_VIEW && (
        <ImportFileView changeActiveView={changeActiveView} setFilesContacts={setFilesContacts} />
      )}
      {activeView === TRACK_PROGRESS_VIEW && (
        <ImportFileInProgressView changeActiveView={changeActiveView} fileContacts={fileContacts} />
      )}
    </div>
  );
};

// File import view -------------------------------------

type ImportFileViewProps = {
  changeActiveView: (view: ActiveViewType) => void;
  setFilesContacts: React.Dispatch<React.SetStateAction<ImportResult<any> | null>>;
};
const ImportFileView: FC<ImportFileViewProps> = ({ changeActiveView, setFilesContacts }) => {
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
    setFilesContacts(data);
  }, []);

  const onImportStart = useCallback(() => {
    changeActiveView(TRACK_PROGRESS_VIEW);
  }, [changeActiveView]);

  return (
    <>
      <p className="text-base-plus text-center mb-4">
        <T id="fileImportDescr" />
      </p>

      <div className="flex items-center relative mx-auto mb-2">
        <TabsBar tabs={tabs} activeTabName={name} />
      </div>

      <div className="px-4 py-3 bg-gray-900 rounded-2xl overflow-hidden mb-3">{Component && <Component />}</div>

      <FileImportWrapper<TempleContact> onImported={onContactsImported} onImportStart={onImportStart}>
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
    </>
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

// File import in progress view -------------------------------------

type ImportFileInProgressProps = {
  changeActiveView: (view: ActiveViewType) => void;
  fileContacts: ImportResult<any> | null;
};

const ImportFileInProgressView: FC<ImportFileInProgressProps> = ({ changeActiveView, fileContacts }) => {
  const { importProgress } = useFileImportState();
  const { addMultipleContacts } = useContactsActions();
  const customAlert = useAlert();
  const loader = useLoading();

  const handleImportContacts = useCallback(async () => {
    try {
      if (fileContacts !== null) {
        loader.start();
        await addMultipleContacts(fileContacts.data);
        loader.stop();

        navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'importContacts',
          subHeader: 'importFileSubmitted',
          btnText: 'openContacts',
          btnLink: '/settings/contacts',
          description: 'contactsImportSuccessMsg'
        });
      }
    } catch (e: any) {
      console.error(e);
      loader.stop();

      await customAlert({
        title: t('errorAddingContacts'),
        children: e.message
      });
    }
  }, [addMultipleContacts, customAlert, fileContacts, loader]);

  const onClosehandler = useCallback(() => {
    changeActiveView(SELECT_FILE_VIEW);
  }, [changeActiveView]);

  const size = useMemo(() => formatFileSize(importProgress.fileSize), [importProgress.fileSize]);

  return (
    <>
      <p className="text-base-plus text-center mb-4">
        <T id="submitFileTitle" />
      </p>

      <div className="flex items-center gap-2">
        <div className="px-3 py-4 bg-gray-900 rounded-2xl overflow-hidden flex items-center gap-3 flex-1">
          <FileSvg className="text-white w-6 h-6 stroke-current" />
          <div className="flex flex-col gap-1 w-full">
            <div className="flex text-sm text-primary-white justify-between gap-4">
              <p className="flex-1 truncate">{importProgress.fileName}</p>
              <p className="text-secondary-white">{size}</p>
            </div>
            <FileProgressBar percent={importProgress.percent} />
          </div>
        </div>
        <div aria-label="Close" className="p-1 rounded-full bg-gray-900 cursor-pointer" onClick={onClosehandler}>
          <CloseSvg className="text-white w-6 h-6 stroke-current stroke-2" />
        </div>
      </div>

      <div className="flex-1" />

      <div className="w-full">
        <ButtonRounded
          onClick={handleImportContacts}
          size="big"
          className="w-full"
          fill
          isLoading={loader.status === 'loading'}
          disabled={importProgress.percent !== 100 || !fileContacts}
        >
          <T id="import" />
        </ButtonRounded>
      </div>
    </>
  );
};

type FileProgressBarProps = {
  percent: number;
};

const FileProgressBar: FC<FileProgressBarProps> = ({ percent }) => {
  return (
    <div style={{ '--file-percentage': `${percent}%` } as React.CSSProperties} className="flex items-center gap-2">
      <div className={clsx(styles.progressBar, 'flex-1')} />
      <p className="text-base-plus text-white">{percent}%</p>
    </div>
  );
};
