import { ethers } from "ethers";
import { SUPPORTED_CHAINS, SupportedChain } from "./chains";
// @ts-ignore
import sidjs, { getSidAddress } from "@siddomains/sidjs";
import { SupportedChainId } from "@web3-name-sdk/register";
import RegisterSDK from "@web3-name-sdk/register";
import { formatEther } from "ethers/lib/utils";
import { getWalletFromTelegramUserId } from "./crypto";

// @ts-ignore
const SIDRegister = RegisterSDK;
const SID = sidjs;

export async function resolveDomain({
  chain,
  network,
  domain,
}: {
  chain: SupportedChain;
  network: "testnet" | "mainnet";
  domain: string;
}): Promise<string> {
  const rpcUrl = SUPPORTED_CHAINS[chain][network].rpcUrl;
  const chainId = SUPPORTED_CHAINS[chain][network].chainId;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const sid = new SID({ provider, sidAddress: getSidAddress(chainId) });
  const address = await sid.name(domain).getAddress();

  if (address === ethers.constants.AddressZero)
    throw new Error(
      `${domain} does not exist on ${chain.toString()}-${network}`
    );

  return address;
}

export async function reverseResolveAddress({ address }: { address: string }) {
  const names: string[] = [];

  for (const _chain of Object.keys(SUPPORTED_CHAINS)) {
    const chain = _chain as SupportedChain;
    for (const _network of Object.keys(SUPPORTED_CHAINS[chain])) {
      const network = _network as "testnet" | "mainnet";

      const rpcUrl = SUPPORTED_CHAINS[chain][network].rpcUrl;
      const chainId = SUPPORTED_CHAINS[chain][network].chainId;
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const sid = new SID({ provider, sidAddress: getSidAddress(chainId) });
      const { name } = await sid.getName(address);

      console.log({ name });

      if (name) {
        names.push(`${address} owns ${name} on ${chain.toString()} ${network}`);
      }
    }
  }

  return names.join("\n");
}

export type DomainAvailabilityResponse = {
  isAvailable: boolean;
  priceForOneYear: string;
};

export async function checkDomainAvailability({
  telegramUserId,
  label,
  chain,
  network,
}: {
  telegramUserId: string;
  label: string;
  chain: SupportedChain;
  network: "testnet" | "mainnet";
}) {
  const signer = await getWalletFromTelegramUserId(telegramUserId, {
    chain,
    network,
  });
  const chainId = await signer.getChainId();
  const sidRegister = new SIDRegister({
    signer,
    chainId: chainId as SupportedChainId,
  });
  const isAvailable = await sidRegister.getAvailable(label);
  const price = await sidRegister.getRentPrice(label, 1);
  return JSON.stringify(
    {
      isAvailable,
      priceForOneYear: `${formatEther(price)} ${
        SUPPORTED_CHAINS[chain][network].tokenName
      }`,
    },
    null,
    2
  );
}

export async function registerDomain({
  telegramUserId,
  label,
  chain,
  network,
}: {
  telegramUserId: string;
  label: string;
  chain: SupportedChain;
  network: "testnet" | "mainnet";
}) {
  const signer = await getWalletFromTelegramUserId(telegramUserId, {
    chain,
    network,
  });
  const chainId = await signer.getChainId();
  const sidRegister = new SIDRegister({
    signer,
    chainId: chainId as SupportedChainId,
  });
  const address = await signer.getAddress();
  const name = await sidRegister.register(label, address, 1);

  return name;
}
