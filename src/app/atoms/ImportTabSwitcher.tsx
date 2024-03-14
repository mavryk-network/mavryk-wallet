import React from 'react';

import classNames from 'clsx';

import { TID, T } from 'lib/i18n';
import { Link } from 'lib/woozie';

type ImportTabDescriptor = {
  slug: string;
  i18nKey: TID;
};

type ImportTabSwitcherProps = {
  className?: string;
  tabs: ImportTabDescriptor[];
  activeTabSlug: string;
  urlPrefix: string;
};

const ImportTabSwitcher: React.FC<ImportTabSwitcherProps> = ({ className, tabs, activeTabSlug, urlPrefix }) => {
  return (
    <div className={classNames('w-full text-base-plus', className)}>
      <div className={classNames('grid grid-cols-2 gap-x-6')}>
        {tabs.map(({ slug, i18nKey }) => {
          const active = slug === activeTabSlug;

          return (
            <Link key={slug} to={`${urlPrefix}/${slug}`} replace>
              <div
                className={classNames(
                  'text-center cursor-pointer border-b-2',
                  ' pb-2 pt-4 px-4',
                  'text-white truncate',
                  'transition ease-in-out duration-300',
                  active ? 'border-accent-blue text-white' : 'border-transparent text-secondary-white hover:text-white'
                )}
              >
                <T id={i18nKey} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ImportTabSwitcher;
