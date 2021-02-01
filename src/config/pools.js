const BalancerABI = require('./abi/balancer')
const UniswapABI = require('./abi/uniswap')

// be careful: use the official pair direction, e.g. WBTC:WETH vs. using WETH:WBTC makes a huge difference, use the official token:pair notation!
const pools = [
    {
        protocol: "uniswap",
        poolRatio: "50:50",
        poolContract: "0x92adab6d8dc13dbd9052b291cfc1d07888299d65",
        poolABI: UniswapABI,

        tokenName: "DEUS",
        tokenDecimals: 18,
        tokenContract: "0x3b62f3820e0b035cc4ad602dece6d796bc325325",
        pairName: "DEA",
        pairDecimals: 18,
        pairContract: "0x80ab141f324c3d6f2b18b030f1c4e95d4d658778",
    
        inversePrice: false, // DEUS per DEA
        fromBlock: 11029389 // DEA genesis blockNumber https://etherscan.io/tx/0x60ee7b62278ec0ab22fd443172fbbb4574e4daae8dd091b1503ad7dcf8f4f83b
    },
    // {
    //     protocol: "uniswap",
    //     poolRatio: "50:50",
    //     poolContract: "0x83973dcaa04a6786ecc0628cc494a089c1aee947",
    //     poolABI: UniswapABI,
    //
    //     tokenName: "DEA",
    //     tokenDecimals: 18,
    //     tokenContract: "0x80ab141f324c3d6f2b18b030f1c4e95d4d658778",
    //     pairName: "USDC",
    //     pairDecimals: 6,
    //     pairContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    //
    //     inversePrice: true, // USDC per DEA
    //     fromBlock: 11723389 //11029389 // https://etherscan.io/tx/0x60ee7b62278ec0ab22fd443172fbbb4574e4daae8dd091b1503ad7dcf8f4f83b
    // },
    // {
    //     protocol: "uniswap",
    //     poolRatio: "50:50",
    //     poolContract: "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11",
    //     poolABI: UniswapABI,
    //
    //     tokenName: "DAI",
    //     tokenDecimals: 18,
    //     tokenContract: "0x6b175474e89094c44da98b954eedeac495271d0f",
    //     pairName: "WETH",
    //     pairDecimals: 18,
    //     pairContract: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    //
    //     inversePrice: false, // token/pair or pair/token
    //     fromBlock: 11694643 // 11668536
    // },
]

module.exports = pools
