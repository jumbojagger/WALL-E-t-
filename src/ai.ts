import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  checkDomainAvailability,
  registerDomain,
  resolveDomain,
  reverseResolveAddress,
} from "./spaceId";
import { getBalance, getWalletAddress } from "./wallets";
import { bridgeNativeToken } from "./wormhole";

const openai = new OpenAI();

const prompt: ChatCompletionMessageParam = {
  role: "system",
  content: `You are an AI Wallet managing user wallets on EVM Chains - specifically Ethereum, Binance Chain, and Arbitrum One (and their testnets). You can help users manage, trade, and register SPACE ID Domains on different blockchains. You can also leverage Wormhole's bridging technology to help users bridge funds across chains. You have functions you can call - only use the provided functions. When explaining the output of these functions to the user, provide detail and context. Be friendly towards the user and help them out in whatever way possible. Provide context on the functions you called and the arguments that were passed to explain to the user how you got the result you did.`,
};

const functions = [
  {
    name: "get_wallet_address",
    description:
      "Get the wallet address of the current user. This returns the wallet address of the user that is currently using the AI Wallet.",
    parameters: {
      type: "object",
      properties: {
        time: {
          type: "string",
          description: "Get the current time.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_wallet_balance",
    description:
      "Get the balance of the current user. This returns the balance of the user that is currently using the AI Wallet across all the different chains and networks.",
    parameters: {
      type: "object",
      properties: {
        time: {
          type: "string",
          description: "Get the current time.",
        },
      },
      required: [],
    },
  },
  {
    name: "resolve_domain",
    description:
      "Resolve a SPACE ID or ENS Domain to an Ethereum or EVM Address. This finds the registered owner and controller address of the given domain name.",
    parameters: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["ethereum", "binance", "arbitrum"],
        },
        network: {
          type: "string",
          enum: ["mainnet", "testnet"],
        },
        domain: {
          type: "string",
        },
      },
      required: ["chain", "network", "domain"],
    },
  },
  {
    name: "reverse_resolve_address",
    description:
      "Reverse resolve an EVM Address to a SPACE ID Domain Name. This finds the registered names across all chains and networks for the given address.",
    parameters: {
      type: "object",
      properties: {
        address: {
          type: "string",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "register_domain",
    description:
      "Purchases or register a domain name through on the given chain and network. Returns the normalized name, or an error if it failed.",
    parameters: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["ethereum", "binance", "arbitrum"],
        },
        network: {
          type: "string",
          enum: ["mainnet", "testnet"],
        },
        label: {
          type: "string",
        },
      },
      required: ["chain", "network", "label"],
    },
  },
  {
    name: "check_domain_availability",
    description:
      "This checks if the given domain is available on the chain based on the given chain and network. Returns yes/no along with the rental price per year.",
    parameters: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["ethereum", "binance", "arbitrum"],
        },
        network: {
          type: "string",
          enum: ["mainnet", "testnet"],
        },
        label: {
          type: "string",
        },
      },
      required: ["chain", "network", "label"],
    },
  },

  {
    name: "bridge_native_token",
    description:
      "Bridge the native token from one chain to another. Source and recipient chains must be distinct. The amount must be just the number and greater than 0. The nativeGasAmount can be 0 if not specified, otherwise must be a number greater than or equal to 0. Returns links to Wormhole's block explorer with all the relevant transactions.",
    parameters: {
      type: "object",
      properties: {
        from: {
          type: "string",
          enum: ["ethereum", "binance", "arbitrum"],
        },
        to: {
          type: "string",
          enum: ["ethereum", "binance", "arbitrum"],
        },
        network: {
          type: "string",
          enum: ["mainnet", "testnet"],
        },
        amount: {
          type: "string",
        },
        nativeGasAmount: {
          type: "string",
        },
      },
      required: ["from", "to", "network", "amount", "nativeGasAmount"],
    },
  },
];

const functionMap = {
  get_wallet_address: getWalletAddress,
  get_wallet_balance: getBalance,
  resolve_domain: resolveDomain,
  reverse_resolve_address: reverseResolveAddress,
  check_domain_availability: checkDomainAvailability,
  register_domain: registerDomain,
  bridge_native_token: bridgeNativeToken,
};

export async function getChatCompletion(
  telegramUserId: string,
  message: string
) {
  const messages: ChatCompletionMessageParam[] = [
    prompt,
    {
      role: "user",
      content: message,
    },
  ];
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
    functions,
    function_call: "auto",
  });

  const responseMsg = response.choices[0].message;
  console.log({ responseMsg });

  let finalResponse = "Sorry, I couldn't figure this out.";

  if (!responseMsg.function_call) {
    finalResponse = responseMsg.content ?? finalResponse;
  }

  if (responseMsg.function_call) {
    const functionName = responseMsg.function_call.name;
    // @ts-ignore
    const fn = functionMap[functionName];
    const args = JSON.parse(responseMsg.function_call.arguments);
    args.telegramUserId = telegramUserId;

    console.log({
      fn,
      args,
    });

    let fnRes = "";
    try {
      fnRes = await fn(args);
    } catch (error) {
      console.error(error);
      fnRes = error instanceof Error ? error.message : `${error}`;
    }

    messages.push(responseMsg);
    messages.push({
      role: "function",
      name: functionName,
      content: fnRes,
    });

    const secondResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
    });

    const secondResponseMsg = secondResponse.choices[0].message;

    finalResponse = secondResponseMsg.content ?? finalResponse;
  }

  return finalResponse;
}
