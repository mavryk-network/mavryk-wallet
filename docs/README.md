# Documentation

This doc describes how Mavryk Wallet works internally.

## Feature Reports

- [Contacts v3 architecture](contacts-v3.md)

## Architecture

The application consists of three main parts: UI scripts, one Background script, and the Content script that is injected on every page.

![Highlevel architecture](highlevel-architecture.jpeg)

All the communications in the application work through the internal `Intercom` module. It's a wrapper over native means of communication in the browser extension.

### Background Script

- Only one per application. It starts as soon as the browser is started and runs until the browser closes.
- Listens to requests from UI scripts and Content script. It can broadcast messages to them and also notify them directly.

### Actions

- Top-level function set.
- Work with Store, browser API and can call the methods of the current Vault instance.
- New-wallet bootstrap authenticates the spawned account before broadcasting `unlocked`; the regular unlock path still broadcasts first and refreshes auth in the background on a best-effort basis.

### Store

- Very simple in-memory storage by [Effector](https://github.com/zerobias/effector). It displays the current state of the wallet.
- Exposes a public version of its state, which is accessible from the front-end at any time.
- Events: `inited`, `locked`, `unlocked`, `accountsUpdated`, `settingsUpdated`.

### Vault

- A class describing general wallet behavior.
- Its instance is created during initialization, and stored in the state of `Store`. One instance is created per one wallet (one seed-phrase etc).
- Contains only one property: `passKey` - private, typeof CryptoKey, byte projection of the user's password.
- Manages all sensitive data: encrypts/decrypts, stores, deletes.
- Methods that require a mandatory password are static so that they don't have access to an already existing key from the context.
- Also implements migrations because it works with the storage.

## DApps

To communicate with DApps, the wallet inherits the behavior of the [tzip10](https://gitlab.com/tzip/tzip/-/blob/master/proposals/tzip-10/tzip-10.md) standard: first - permissions, then - transaction requests.

### Custom RPC networks

A DApp may request a custom network (`{ name, rpc }`) instead of a built-in network id. The wallet accepts it only when:

- The URL is `https:`. Plain `http:` is accepted only for `localhost`, `127.0.0.1` and `[::1]`.
- The URL has no query string (`?`), fragment (`#`) or credentials (`user:password@`). Provider API keys must not be passed in the URL.
- The RPC answers with a chain id when the user opens the connect prompt.

Otherwise the permission request fails with `INVALID_PARAMS`. The session is bound to that chain id: an operation or broadcast fails with `INVALID_PARAMS` once the RPC reports a different chain, and the DApp must reconnect. Sessions with a custom RPC saved before this rule existed are treated as not connected.

If the RPC reports the chain of the user's selected network or of a built-in network, the wallet uses its own RPC for that chain. For any other chain, before signing, the wallet checks that the operation's branch is unknown to the built-in Mavryk networks, and refuses to sign when a built-in network knows the branch or cannot be reached. This check usually takes one RPC round trip. It takes about one block longer when a built-in node may be behind the head, and signing is refused if that node has still not caught up. To sign for a local node without this check, select that node as the wallet network.

## Transaction flow

The image below shows how DApp transactions are processed.

![Transaction flow](transaction-flow.jpeg)

Internal transactions (inside wallet) works in the same way, but with minimal technical differences.
