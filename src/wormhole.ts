import {
  ChainName,
  SignedTx,
  Signer,
  TransferState,
  UnsignedTransaction,
  Wormhole,
  chainIdToChain,
  nativeChainAddress,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import { EvmPlatform } from "@wormhole-foundation/connect-sdk-evm";
import { BigNumber, ethers } from "ethers";
import { SUPPORTED_CHAINS, SupportedChain } from "./chains";
import { getWalletFromTelegramUserId } from "./crypto";
import { parseEther } from "ethers/lib/utils";

export async function bridgeNativeToken({
  telegramUserId,
  from,
  to,
  network,
  amount,
  nativeGasAmount,
}: {
  telegramUserId: string;
  from: SupportedChain;
  to: SupportedChain;
  network: "testnet" | "mainnet";
  amount: string;
  nativeGasAmount: string;
}) {
  const weiAmount = parseEther(amount);
  const weiGasAmount = parseEther(nativeGasAmount);

  const whNetwork = network === "testnet" ? "Testnet" : "Mainnet";
  // @ts-ignore
  const context = new Wormhole(whNetwork, [EvmPlatform]);

  const sendChainName = chainIdToChain(
    // @ts-ignore
    SUPPORTED_CHAINS[from][network].wormholeChainId
  );
  const toChainName = chainIdToChain(
    // @ts-ignore
    SUPPORTED_CHAINS[to][network].wormholeChainId
  );

  console.log({ sendChainName, toChainName });

  const sendEthersSigner = await getWalletFromTelegramUserId(telegramUserId, {
    chain: from,
    network,
  });

  const toEthersSigner = await getWalletFromTelegramUserId(telegramUserId, {
    chain: to,
    network,
  });

  const sendSigner = await getEvmSigner(sendChainName, sendEthersSigner);
  const toSigner = await getEvmSigner(toChainName, toEthersSigner);

  const recipientAddress = {
    chain: toChainName,
    address: toNative(toChainName, toSigner.address),
  };

  const xfer = await context.tokenTransfer(
    "native",
    weiAmount.toBigInt(),
    // @ts-ignore
    sendSigner,
    recipientAddress,
    true,
    undefined,
    weiGasAmount.toBigInt()
  );

  // @ts-ignore
  const srcTxIds = await xfer.initiateTransfer(sendSigner);

  console.log({ srcTxIds });

  const links: string[] = [];
  for (const txId of srcTxIds) {
    links.push(`https://wormholescan.io/#/tx/${txId}?network=TESTNET`);
  }

  // while ((await xfer.getTransferState()) < TransferState.Completed) {
  //   console.log("Waiting for xfer...");
  //   await new Promise((f) => setTimeout(f, 1000));
  // }

  return links.join("\n");
}

async function getEvmSigner(chain: ChainName, signer: ethers.Signer) {
  const txCount = await signer.getTransactionCount();
  const address = await signer.getAddress();

  return new EthSigner(chain, address, txCount, signer);
}

class EthSigner implements Signer {
  constructor(
    private _chain: ChainName,
    private _address: string,
    private nonce: number,
    private signer: ethers.Signer
  ) {}

  // @ts-ignore
  get chain(): ChainName {
    return this._chain;
  }

  // @ts-ignore
  get address(): string {
    return this._address;
  }
  async sign(tx: UnsignedTransaction[]): Promise<SignedTx[]> {
    const signed = [];

    let gasPrice = 40_000_000_000n;
    let maxFeePerGas = 40_000_000_000n;

    if (this._chain !== "Celo") {
      const feeData = await this.signer.getFeeData();
      console.log({ feeData });
      gasPrice = feeData.gasPrice?.toBigInt() ?? gasPrice;
      maxFeePerGas = feeData.maxFeePerGas?.toBigInt() ?? maxFeePerGas;
    }

    for (const txn of tx) {
      const { transaction, description } = txn;
      console.log({ transaction });
      console.log(`Signing: ${description} for ${this.address}`);

      const t: ethers.providers.TransactionRequest = {
        ...transaction,
        chainId: BigNumber.from(transaction.chainId).toNumber(),
        gasLimit: BigNumber.from(10_000_000n),
        gasPrice: BigNumber.from(gasPrice),
        // maxFeePerGas: BigNumber.from(maxFeePerGas).toString(),
        nonce: this.nonce,
      };
      signed.push(await this.signer.signTransaction(t));

      this.nonce += 1;
    }
    return signed;
  }
}
