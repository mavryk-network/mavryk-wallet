import { OperationContentsAndResult } from '@mavrykdynamics/webmavryk-rpc';
import Dexie from 'dexie';

import { MvktOperation, MvktTokenTransfer } from 'lib/apis/mvkt';

enum Table {
  AccountTokens = 'accountTokens',
  Operations = 'operations',
  SyncTimes = 'syncTimes'
}

export const db = new Dexie('TempleMain');

db.version(1).stores({
  [Table.Operations]: indexes('&hash', 'chainId', '*members', '*assetIds', 'addedAt', '[chainId+addedAt]'),
  [Table.SyncTimes]: indexes('[service+chainId+address]')
});
db.version(2).stores({
  [Table.AccountTokens]: indexes('', '[chainId+account+type]', '[chainId+type]')
});
db.version(3).stores({
  [Table.AccountTokens]: indexes('', '[chainId+account]', '[chainId]')
});

export const accountTokens = db.table<IAccountToken, string>(Table.AccountTokens);

export const operations = db.table<IOperation, string>(Table.Operations);

export enum ITokenStatus {
  Idle,
  Enabled,
  Disabled,
  Removed
}

interface IAccountToken {
  chainId: string;
  account: string;
  tokenSlug: string;
  status: ITokenStatus;
  addedAt: number;
  latestBalance?: string;
}

interface IOperation {
  hash: string;
  chainId: string;
  members: Array<string>;
  assetIds: Array<string>;
  addedAt: number; // timestamp
  data: IOperationData;
}

type IOperationData = AtLeastOne<{
  localGroup: Array<OperationContentsAndResult>;
  mvktGroup: Array<MvktOperation>;
  mvktTokenTransfers: Array<MvktTokenTransfer>;
}>;

function indexes(...items: string[]) {
  return items.join(',');
}

type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
