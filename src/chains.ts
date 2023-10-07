export type SupportedChain = "ethereum" | "binance" | "arbitrum";

export type ChainInformation = {
  testnet: NetworkInformation;
  mainnet: NetworkInformation;
};

export type NetworkInformation = {
  name: string;
  tokenName: string;
  rpcUrl: string;
  chainId: string;
  wormholeChainId: number;
};

export const SUPPORTED_CHAINS: Record<SupportedChain, ChainInformation> = {
  ethereum: {
    testnet: {
      name: "ETH Goerli",
      tokenName: "ETH",
      rpcUrl: "https://rpc.ankr.com/eth_goerli",
      chainId: "4",
      wormholeChainId: 2,
    },
    mainnet: {
      name: "ETH Mainnet",
      tokenName: "ETH",
      rpcUrl: "https://rpc.ankr.com/eth",
      chainId: "1",
      wormholeChainId: 2,
    },
  },
  binance: {
    testnet: {
      name: "BSC Testnet",
      tokenName: "BNB",
      rpcUrl: "https://rpc.ankr.com/bsc_testnet_chapel",
      chainId: "97",
      wormholeChainId: 4,
    },
    mainnet: {
      name: "BSC Mainnet",
      tokenName: "BNB",
      rpcUrl: "https://rpc.ankr.com/bsc",
      chainId: "56",
      wormholeChainId: 4,
    },
  },
  arbitrum: {
    // Goerli
    testnet: {
      name: "Arbitrum Goerli",
      tokenName: "ETH",
      rpcUrl: "https://goerli-rollup.arbitrum.io/rpc",
      chainId: "421613",
      wormholeChainId: 23,
    },
    mainnet: {
      name: "Arbitrum Mainnet",
      tokenName: "ETH",
      rpcUrl: "https://rpc.ankr.com/arbitrum",
      chainId: "42161",
      wormholeChainId: 23,
    },
  },
};
