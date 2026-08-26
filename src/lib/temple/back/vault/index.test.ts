import browser from 'webextension-polyfill';

import * as Passworder from 'lib/temple/passworder';
import { TempleAccount, TempleAccountType, TempleChainKind } from 'lib/temple/types';

import { createMemorySigner, mnemonicToTezosAccountCreds } from './misc';
import { encryptAndSaveMany } from './safe-storage';
import { accPrivKeyStrgKey, accountsStrgKey, walletMnemonicStrgKey } from './storage-keys';

import { Vault } from './index';

const PASSWORD = 'contacts-key-password';
const HD_WALLET_ID = 'wallet-1';
const OTHER_HD_WALLET_ID = 'wallet-2';
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER_MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const HD_BOOK_ADDR = 'mv1HmdN1hRxhJW1aeLpGJdvAuBY48z38JjVq';
const HD_CONTACTS_KEY = 'VSYYIdcn152RonVoIgDuA5HbGQRmYNurQKoWMfrK9w8=';
const HD_LEGACY_GCM_CONTACTS_KEY = 'T6SG4pNv8Ff1/v0SPlfa5cEdG0Lx770K4vsn1Rl2wJ0=';
const IMPORTED_PRIVATE_KEY_SEED = 'edsk4BBVKnpwdnJrx9PB4hLkXZHtceSdSZVTfKBXArhmZ3Jg87Lcxi';
const IMPORTED_PRIVATE_KEY_CANONICAL =
  'edskS3wZrW6P38vvgnrHqjuLLz76vy5dv9QduxAQ2yG7WL5WjEubiJQUcwS49tFfwym1MBioLATPzQFckaYgGhWBUS7nmikuME';
const IMPORTED_CONTACTS_KEY = 'olY3X/PJDm0HDDbb/UnhtHwIJ2lw+kCY6ze9GcngKD8=';
const IMPORTED_CANONICAL_LEGACY_GCM_CONTACTS_KEY = 'QnbW1Vd4iulU9oSUNYOOcXCdAXN6p2/5XgwFWmHZ/WE=';
const IMPORTED_STORED_FORM_CONTACTS_KEY = 'W/Qtg/a/Lgm+emlswqBMZ95DwC5vU/ejqNJ8aGzDkyE=';
const IMPORTED_STORED_FORM_LEGACY_GCM_CONTACTS_KEY = 'RPR11O9HF8xoqyqbTJ+3EPLcxTIMrYO1AcsZxkjuWu0=';

let passKey: CryptoKey;

function buildHdAccount(publicKeyHash: string, hdIndex: number, walletId = HD_WALLET_ID): TempleAccount {
  return {
    id: `${walletId}-${hdIndex}`,
    type: TempleAccountType.HD,
    name: `HD ${hdIndex}`,
    publicKeyHash,
    hdIndex,
    walletId,
    isKYC: undefined
  };
}

function buildImportedAccount(publicKeyHash: string): TempleAccount {
  return {
    id: `imported-${publicKeyHash}`,
    type: TempleAccountType.Imported,
    name: 'Imported',
    publicKeyHash,
    chain: TempleChainKind.Tezos,
    isKYC: undefined
  };
}

async function saveAccounts(accounts: TempleAccount[], extraItems: [string, unknown][] = []) {
  await encryptAndSaveMany([[accountsStrgKey, accounts], ...extraItems], passKey);
}

describe('Vault contacts key derivation', () => {
  beforeAll(async () => {
    passKey = await Passworder.generateKey(PASSWORD);
  });

  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('derives a pinned HD book address and contacts key from the wallet seed', async () => {
    const [bookCreds, childCreds] = await Promise.all([
      mnemonicToTezosAccountCreds(MNEMONIC, 0),
      mnemonicToTezosAccountCreds(MNEMONIC, 1)
    ]);
    const accounts = [buildHdAccount(bookCreds.address, 0), buildHdAccount(childCreds.address, 1)];

    await saveAccounts(accounts, [[walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC]]);

    const vault = new Vault(passKey);
    const childResult = await vault.deriveContactsKey(childCreds.address);
    const unlockedAgainResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    expect(childResult).toEqual({
      status: 'available',
      key: HD_CONTACTS_KEY,
      legacyKeys: [HD_LEGACY_GCM_CONTACTS_KEY],
      bookAddr: HD_BOOK_ADDR,
      identityKind: 'hd'
    });
    expect(unlockedAgainResult).toEqual(childResult);
  });

  it('keeps an HD group key local to that group when another group is added or removed', async () => {
    const [bookCreds, otherBookCreds] = await Promise.all([
      mnemonicToTezosAccountCreds(MNEMONIC, 0),
      mnemonicToTezosAccountCreds(OTHER_MNEMONIC, 0)
    ]);
    const mainAccount = buildHdAccount(bookCreds.address, 0);
    const otherAccount = buildHdAccount(otherBookCreds.address, 0, OTHER_HD_WALLET_ID);

    await saveAccounts([mainAccount], [[walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC]]);
    const initialResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    await saveAccounts(
      [mainAccount, otherAccount],
      [
        [walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC],
        [walletMnemonicStrgKey(OTHER_HD_WALLET_ID), OTHER_MNEMONIC]
      ]
    );
    const withOtherGroupResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    await saveAccounts([mainAccount], [[walletMnemonicStrgKey(HD_WALLET_ID), MNEMONIC]]);
    const afterRemovalResult = await new Vault(passKey).deriveContactsKey(bookCreds.address);

    expect(initialResult).toEqual({
      status: 'available',
      key: HD_CONTACTS_KEY,
      legacyKeys: [HD_LEGACY_GCM_CONTACTS_KEY],
      bookAddr: HD_BOOK_ADDR,
      identityKind: 'hd'
    });
    expect(withOtherGroupResult).toEqual(initialResult);
    expect(afterRemovalResult).toEqual(initialResult);
  });

  it('derives the same imported contacts key from equivalent private-key spellings', async () => {
    const signer = await createMemorySigner(IMPORTED_PRIVATE_KEY_SEED);
    const publicKeyHash = await signer.publicKeyHash();
    const account = buildImportedAccount(publicKeyHash);

    await saveAccounts([account], [[accPrivKeyStrgKey(publicKeyHash), IMPORTED_PRIVATE_KEY_SEED]]);
    const seedFormResult = await new Vault(passKey).deriveContactsKey(publicKeyHash);

    await browser.storage.local.clear();
    await saveAccounts([account], [[accPrivKeyStrgKey(publicKeyHash), IMPORTED_PRIVATE_KEY_CANONICAL]]);
    const canonicalFormResult = await new Vault(passKey).deriveContactsKey(publicKeyHash);

    expect(seedFormResult).toEqual({
      status: 'available',
      key: IMPORTED_CONTACTS_KEY,
      legacyKeys: [
        IMPORTED_CANONICAL_LEGACY_GCM_CONTACTS_KEY,
        IMPORTED_STORED_FORM_CONTACTS_KEY,
        IMPORTED_STORED_FORM_LEGACY_GCM_CONTACTS_KEY
      ],
      bookAddr: publicKeyHash,
      identityKind: 'imported'
    });
    expect(canonicalFormResult).toMatchObject({
      status: 'available',
      key: IMPORTED_CONTACTS_KEY,
      legacyKeys: [IMPORTED_CANONICAL_LEGACY_GCM_CONTACTS_KEY],
      bookAddr: publicKeyHash,
      identityKind: 'imported'
    });
  });
});
