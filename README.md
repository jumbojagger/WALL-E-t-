# AI Wallet

### [Demo Video](https://streamable.com/w39gfb)

AI Wallet is a Telegram based chat bot that combines AI with blockchain technology to make it easier for users to interact with crypto. It abstracts away complexities of doing on-chain actions and allows users to do a variety of things simply by sending messages to the bot on Telegram.

Currently, AI Wallet supports Ethereum Mainnet, Ethereum Goerli, BNB/BSC Mainnet, BNB/BSC Testnet, Arbitrum One, and Arbitrum One Goerli.

## Features

- Create or Import Wallets
- Get Account Information
- Resolve SPACE ID and ENS Domains
- Reverse Resolve Addresses to SPACE ID and ENS Domains
- Calculate Rent for SPACE ID Domains
- Buy and Manage SPACE ID Domains
- Bridge tokens cross-chain through Wormhole

## Roadblocks

This was a challenging project to build as it was my first time using OpenAI to this level and also first time learning about SPACE ID and Wormhole technologies. I faced a few roadblocks that I had to work around, which can also be used as feedback for the Sponsoring Teams.

### SPACE ID - Web3 Name SDK

The `@web3-name-sdk/register` package has incorrect TypeScript typings, which made it hard to fully understand how some of the functions work. I had to ignore a lot of errors in VS Code, and read through the code of the SDK myself to understand how to properly use it. Other than that, it was fairly straightforward to get going!

### Wormhole Connect SDK

This SDK is very, very new - so bugs are expected. I've tried to document the ones I found as feedback.

The Wormhole Connect SDK is broken when used with a package manager other than `npm`. I initially started this project using `bun` and then switched over to `pnpm` but eventually had to move to using `npm` due to the issues I was facing. The usage of `*` as versions between the `connect-sdk` and `connect-sdk-evm` causes package resolution to absolutely not work in Bun, and Bun is unable to install the `connect-sdk-evm` package at all.

With `pnpm`, due to how it symlinks `node_modules`, the `sdk-definitions` subpackage which relied on `sdk-base` was having a version mismatch. Also, the `sdk-base` package, when installed through `pnpm`, doesn't include the `dist` build folder causing my app to not run. With `npm`, the problem went away - but the typings mismatch still existed. There is a lot of `@ts-ignore` throughout my Wormhole-related codebase for this reason.

Additionally, the `Signer` interface required to implement `EthSigner` - which I originally copied from the given examples of the Connect SDK - are incorrect when trying to use the automatic token bridge. Some parts of the SDK codebase require `chain` and `address` to be variables, whereas others require it to be a function. That is, some parts of the SDK are internally invoking those things are `this.transfer.from.chain` whereas somewhere else it is like `from.chain()`. Since TypeScript doesn't allow declaring a function and a variable by the same name in a class, this led to a lot of issues I had to work around to fix my `EthSigner` implementation to make token bridging actually work.

There was also a weird issue where I could not bridge to Arbitrum. Some internal function somewhere in the SDK is unable to get the proper chain context for Arbitrum testnet - and I did not have enough time to figure out why. Bridging from Goerli to BSC Testnet works just fine - and vice versa as well - but Arbitrum Goerli is broken.

Also, I would have loved to add NFT Bridging to my bot as well, but looks like the Connect SDK at the time of building does not have support for that.

### Orderly EVM API

This API is also actively under development and extremely new, so it's understandable that there were issues here. I've tried to document some issues I came across as feedback.

The documentation website only provides a very high level overview of building for the EVM on Orderly. I had to request the LearnWeb3 team to help me find more specific documentation about the API so I could build it for my application.

The documentation around generating access keys, secrets, account ids, etc. could be improved with some examples - I spent a lot of time trying to figure that out as it wasn't super clear to me.

The EIP-712 signature required to add an access key to EVM was very confusing because the EIP-712 structure was not provided.

Even after figuring all of that out, the Testnet REST API kept giving me "Unknown Exception" errors and after spending many hours and days on this, I could not figure it out.

Unfortunately, I was not able to complete Orderly EVM integration because of this.
Please look at my code, I have kept it all - I am not sure why it does not work. Here was my thought process:

1. I thought EIP-712 signature was wrong, I confirmed with team and could not get it to work still
2. I thought i was missing auth headers or calculating them wrong, but I tried a lot and couldnt figure it out
3. I thought my keys/signatures were wrong format - I tried hex, base64, base64url, and base58 - even to the point of using the Near SDK directly because their private keys seem to be longer compared to the ones generated by @noble/ed25519 - did not work either

I was stuck at not being able to register so I couldnt test my code further.
