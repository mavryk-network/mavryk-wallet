# Mavryk Wallet

Cryptocurrency wallet for [Mavryk blockchain](https://mavryk.org/) as Web Extension for your Browser.<br>
Providing ability to manage NFT, mav tokens and interact with dApps.

![Mavryk Wallet](https://raw.githubusercontent.com/mavryk-network/mavryk-wallet/dev/public/misc/wallet-readme.svg)

<hr />

## ▶️ Install

You can install Mavryk Wallet right now: https://mavryk.org/wallet.

## Browser Support

| [![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png)](https://chromewebstore.google.com/detail/mavryk-wallet/cgddkajmbckbjbnondgfcbcojjjdnmji) | [![Firefox](https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png)](https://addons.mozilla.org/en-US/firefox/addon/mavryk-wallet/) | [![Brave](https://raw.github.com/alrra/browser-logos/master/src/brave/brave_48x48.png)](https://chromewebstore.google.com/detail/mavryk-wallet/cgddkajmbckbjbnondgfcbcojjjdnmji) |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 49 & later ✔                                                                                                                                                                        | 52 & later ✔                                                                                                                                                 | Latest                                                                                                                                                                           |

## 🚀 Quick Start

Ensure you have:

- [Node.js](https://nodejs.org) 10 or later installed
- [Yarn](https://yarnpkg.com) v1 or v2 installed

Then run the following:

### 1) Clone the repository

```bash
git clone https://github.com/mavryk-network/mavryk-wallet && cd mavryk-wallet
```

### 2) Install dependencies

```bash
yarn
```

### 3) Create a `.env.local` file and copy the contents of `.env.dist` into it

> You can still build the extension without filling in all the environment variables, but it won’t work properly.

### 4) Build

Builds the extension for production to the `dist` folder.<br>
It correctly bundles in production mode and optimizes the build for the best performance.

```bash
# for Chrome by default
yarn build
```

Optional for different browsers:

```bash
# for Chrome directly
yarn build:chrome
# for Firefox directly
yarn build:firefox
# for Opera directly
yarn build:opera

# for all at once
yarn build-all
```

### 5) Load extension to your Browser

![MavrykWallet_Load](https://raw.githubusercontent.com/mavryk-network/mavryk-wallet/dev/public/misc/install.gif)

## 🧱 Development

```bash
yarn start
```

Runs the extension in the development mode for Chrome target.<br>
It's recommended to use Chrome for developing.

### Debugging

To enable Redux DevTools during development, specify some port in the `.env` file before running `yarn start` like so:

```toml
REDUX_DEVTOOLS_PORT=8000
```

Install [`@redux-devtools/cli`](https://github.com/reduxjs/redux-devtools) globally:

```bash
yarn global add @redux-devtools/cli
```

Then open an explorer at previously specified port:

```bash
redux-devtools --open --port=8000
```

> Other UI options like `--open=browser` are available.

Go to settings to specify port one more time.

## Ledger Runtime Notes

- Ledger transport is reused as a singleton across operations instead of reopening the device per signer instance.
- Passive state changes such as network switching do not trigger Ledger signing prompts. Ledger interaction is limited to explicit Ledger actions like connect, sign, and send.
