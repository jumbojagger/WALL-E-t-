import * as ed from "@noble/ed25519";
import {
  base58,
  keccak256,
  solidityKeccak256,
  toUtf8Bytes,
} from "ethers/lib/utils";
import { getWalletFromTelegramUserId } from "./crypto";
import { prisma } from "./db";
import { KeyPair } from "near-api-js";
import { BigNumber, ethers } from "ethers";

const BASE_URL = "https://testnet-api-evm.orderly.org";
const BROKER_ID = "woofi_dex";
const VAULT_ADDRESS = "0xd64AeB281f3E8cd70e668b6cb24De7e532dC214D";
const USDC_ADDRESS = "0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63";

export async function calculateOrderlyAccountId({
  telegramUserId,
}: {
  telegramUserId: string;
}) {
  const wallet = await getWalletFromTelegramUserId(telegramUserId);

  // This is an ETH address
  const address = await wallet.getAddress();

  const BROKER_ID_HASH = solidityKeccak256(["string"], [BROKER_ID]);
  // const BROKER_ID_HASH = keccak256(toUtf8Bytes(BROKER_ID));

  const addressAsBytes = Buffer.from(address);
  const brokerIdAsBytes = Buffer.from(BROKER_ID_HASH);

  const concatenatedBytes = Buffer.concat([addressAsBytes, brokerIdAsBytes]);

  const accountId = keccak256(concatenatedBytes);

  return accountId;
}

export async function registerOrderlyAccount({
  telegramUserId,
}: {
  telegramUserId: string;
}) {
  const dbWallet = await prisma.wallet.findUnique({
    where: { telegramUserId },
  });
  const wallet = await getWalletFromTelegramUserId(telegramUserId);

  const res = await fetch(`${BASE_URL}/v1/registration_nonce`);
  const json = await res.json();

  const nonce = json.data.registration_nonce as string;

  const domain = {
    name: "Orderly",
    version: "1",
    chainId: 421613, // the chainId of the connected network by Metamask
    // verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  };
  const timestamp = Date.now();

  const definedTypes = {
    Registration: [
      { name: "brokerId", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "timestamp", type: "uint64" },
      { name: "registrationNonce", type: "uint256" },
    ],
    AddOrderlyKey: [
      { name: "brokerId", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "orderlyKey", type: "string" },
      { name: "scope", type: "string" },
      { name: "timestamp", type: "uint64" },
      { name: "expiration", type: "uint64" },
    ],
    Withdraw: [
      { name: "brokerId", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "token", type: "string" },
      { name: "amount", type: "uint256" },
      { name: "withdrawNonce", type: "uint256" },
      { name: "timestamp", type: "uint64" },
    ],
    SettlePnl: [
      { name: "brokerId", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "settleNonce", type: "uint64" },
      { name: "timestamp", type: "uint64" },
    ],
  };

  const registerMessage = {
    brokerId: BROKER_ID,
    chainId: 421613,
    timestamp,
    registrationNonce: nonce,
  };

  try {
    const sig = await wallet._signTypedData(
      domain,
      {
        Registration: definedTypes.Registration,
      },
      registerMessage
    );

    const registerJson = await sendRequestToOrderly({
      telegramUserId,
      path: "/v1/register_account",
      method: "POST",
      data: {
        message: registerMessage,
        signature: sig,
        userAddress: wallet.address,
      },
      timestamp,
    });

    console.log({ registerJson });

    if (!registerJson.success) {
      console.error("reg failed");
      process.exit(1);
    }

    const addAccessKeyMsg = {
      brokerId: BROKER_ID,
      orderlyKey: `ed25519:${dbWallet!.orderlyKey}`,
      scope: "read,trading",
      timestamp: Date.now(),
      expiration: Date.now() + 1000 * 60 * 60 * 24 * 364,
    };

    const addKeySig = await wallet._signTypedData(
      domain,
      { AddOrderlyKey: definedTypes.AddOrderlyKey },
      addAccessKeyMsg
    );

    const addKeyRes = await fetch(`${BASE_URL}/v1/orderly_key`, {
      method: "POST",
      body: JSON.stringify({
        message: addAccessKeyMsg,
        signature: addKeySig,
        userAddress: wallet.address,
      }),
    });
    const addKeyJson = await addKeyRes.json();

    console.log({ addKeyJson });
  } catch (error) {
    console.error(error);
  }
}

export async function signMessage(message: string, keypair: KeyPair) {
  const base64url = function (aStr: string) {
    return aStr.replace(/\+/g, "-").replace(/\//g, "_");
  };

  const u8 = Buffer.from(message);
  const signStr = keypair.sign(u8);
  return base64url(Buffer.from(signStr.signature).toString("base64"));
}

export async function sendRequestToOrderly({
  telegramUserId,
  path,
  method,
  data,
  timestamp,
}: {
  telegramUserId: string;
  path: string;
  method: string;
  data?: any;
  timestamp: number;
}) {
  const accountId = await calculateOrderlyAccountId({ telegramUserId });

  const dbWallet = await prisma.wallet.findUnique({
    where: {
      telegramUserId,
    },
  });

  const normalizedMsg = `${timestamp}${method}${path}${
    data ? JSON.stringify(data) : ""
  }`;

  console.log({ normalizedMsg });

  const keypair = KeyPair.fromString(dbWallet.orderlySecret);
  const sig = await signMessage(normalizedMsg, keypair);

  const headers = {
    "orderly-account-id": accountId,
    "orderly-key": dbWallet.orderlyKey,
    "orderly-signature": sig,
    "orderly-timestamp": timestamp.toString(),
  };

  console.log({
    headers,
    path,
    method,
    body: data,
  });

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function depositToken({
  telegramUserId,
  amount,
}: {
  telegramUserId: string;
  amount: BigNumber;
}) {
  const wallet = await getWalletFromTelegramUserId(telegramUserId, {
    chain: "arbitrum",
    network: "testnet",
  });
  const vault = new ethers.Contract(
    VAULT_ADDRESS,
    [
      "function deposit(bytes accountId, bytes brokerHash, bytes tokenHash, uint256 amount) external",
    ],
    wallet
  );

  const accountId = await calculateOrderlyAccountId({ telegramUserId });

  const brokerHash = solidityKeccak256(["string"], [BROKER_ID]);
  const tokenHash = solidityKeccak256(["string"], ["USDC"]);
  const tokenAmount = amount;

  const tx = await vault.deposit(accountId, brokerHash, tokenHash, tokenAmount);

  await tx.wait();

  return tx.hash;
}
