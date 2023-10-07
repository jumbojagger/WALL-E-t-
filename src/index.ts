import { config } from "dotenv";
import crypto from "node:crypto";
global.crypto = crypto;

config();

import { AIWalletBot } from "./bot";

const bot = new AIWalletBot();

async function main() {
  await bot.start();
}

main();
