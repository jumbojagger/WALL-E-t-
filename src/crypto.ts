import * as ed from "@noble/ed25519";
import crypto from "node:crypto";
import { prisma } from "./db";
import { ethers } from "ethers";
import { SUPPORTED_CHAINS, SupportedChain } from "./chains";
import { base58 } from "ethers/lib/utils";
import * as nearAPI from "near-api-js";

export function encrypt(text: string) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.ENCRYPTION_KEY as string)
    .digest("hex")
    .substring(0, 32);

  const iv = crypto
    .createHash("sha256")
    .update("abcdef")
    .digest("hex")
    .substring(0, 16);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString("hex");
}

export function decrypt(text: string) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.ENCRYPTION_KEY as string)
    .digest("hex")
    .substring(0, 32);

  const iv = crypto
    .createHash("sha256")
    .update("abcdef")
    .digest("hex")
    .substring(0, 16);

  const encryptedText = Buffer.from(text, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export async function generateOrderlyAccessKeys({
  telegramUserId,
}: {
  telegramUserId: string;
}) {
  const wallet = await prisma.wallet.findUnique({
    where: {
      telegramUserId,
    },
  });

  if (wallet?.orderlyKey && wallet?.orderlySecret) {
    console.log({
      key: wallet.orderlyKey,
      secret: wallet.orderlySecret,
    });
    return;
  }

  let keypair = nearAPI.utils.KeyPair.fromRandom("ED25519");

  // const randomPrivKey = ed.utils.randomPrivateKey();
  // const pubKey = await ed.getPublicKeyAsync(randomPrivKey);

  // const keypair = crypto.generateKeyPairSync("ed25519", {
  //   privateKeyEncoding: { format: "pem", type: "pkcs8" },
  //   publicKeyEncoding: { format: "pem", type: "spki" },
  // });

  // const randomPrivKey = keypair.privateKey;
  // const pubKey = keypair.publicKey;

  // const privKeyB58 = base58.encode(Buffer.from(randomPrivKey));
  // const pubKeyB58 = base58.encode(Buffer.from(pubKey));

  // const privKeyB58 =
  //   "4qAABW9HfVW4UNQjuQAaAWpB21jqoP58kGqDia18FZDRat6Lg6TLWdAD9FyvAd3PPQLYF4hhx2mZAotJudVjoqfs";
  // const pubKeyB58 = "BGCCDDHfysuuVnaNVtEhhqeT4k9Muyem3Kpgq2U1m9HX";

  const privKey = keypair.toString();
  const pubKey = keypair.getPublicKey().toString();

  await prisma.wallet.update({
    where: {
      telegramUserId,
    },
    data: {
      orderlySecret: privKey,
      orderlyKey: pubKey,
    },
  });
}

export async function getWalletFromTelegramUserId(
  telegramUserId: string,
  opts?: {
    chain: SupportedChain;
    network: "mainnet" | "testnet";
  }
) {
  const wallet = await prisma.wallet.findUnique({
    where: {
      telegramUserId,
    },
  });

  if (!wallet) throw new Error("Wallet not found");

  const decryptedPrivateKey = decrypt(wallet.encryptedPrivateKey);
  const signer = new ethers.Wallet(decryptedPrivateKey);

  if (opts) {
    const rpcUrl = SUPPORTED_CHAINS[opts.chain][opts.network].rpcUrl;
    return signer.connect(new ethers.providers.JsonRpcProvider(rpcUrl));
  }

  return signer;
}
