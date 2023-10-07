import { ethers } from "ethers";
import { SUPPORTED_CHAINS, SupportedChain } from "./chains";
import { formatEther } from "ethers/lib/utils";
import { getWalletFromTelegramUserId } from "./crypto";

export async function generateNewWallet() {
  return ethers.Wallet.createRandom();
}

export async function loadWallet(privateKey: string) {
  return new ethers.Wallet(privateKey);
}

export async function getBalance({
  telegramUserId,
}: {
  telegramUserId: string;
}) {
  const wallet = await getWalletFromTelegramUserId(telegramUserId);
  const balancesData: string[] = [];

  for (const chain of Object.keys(SUPPORTED_CHAINS)) {
    for (const network of Object.keys(
      SUPPORTED_CHAINS[chain as SupportedChain]
    )) {
      const chainInfo =
        SUPPORTED_CHAINS[chain as SupportedChain][
          network as "testnet" | "mainnet"
        ];
      const provider = new ethers.providers.JsonRpcProvider(chainInfo.rpcUrl);
      const connectedWallet = wallet.connect(provider);
      const balance = await connectedWallet.getBalance();
      const humanReadableBalance = formatEther(balance);

      balancesData.push(
        `${chainInfo.name}: ${humanReadableBalance} ${chainInfo.tokenName}`
      );
    }

    balancesData.push("");
  }

  return balancesData.join("\n");
}

export async function getWalletAddress({
  telegramUserId,
}: {
  telegramUserId: string;
}) {
  const wallet = await getWalletFromTelegramUserId(telegramUserId);
  return wallet.address;
}
