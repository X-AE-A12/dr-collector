const ethers = require("ethers")

const config = require("../config/config")
const logger = require("../config/logger")

const url = config.QUIKNODE_API_KEY
const Provider = new ethers.providers.JsonRpcProvider(url);

const getTransactionHistoryForContract = async ({
    poolContract = null,
    poolABI = null,
    eventName = null,
    fromBlock = null,
    toBlock = null
} = {}) => {
    try {
        if (!poolContract || !poolABI || !eventName || !fromBlock || !toBlock) throw new Error("Params missing");
        if (typeof fromBlock != "number" || typeof toBlock != "number") throw new Error("fromBlock or toBlock should be numbers");
        if (fromBlock >= toBlock) return []
        await Provider.ready

        const listener = getContractListener({
            poolContract: poolContract,
            poolABI: poolABI,
        })

        const result = await listener.queryFilter(
            eventName,
            fromBlock,
            toBlock
        ).catch(async err => {
            if (
                    err.error == "Error: query returned more than 10000 results"
                ||  err.error == "Error: Log response size exceeded. You can make eth_getLogs requests with up to a 2K block range and no limit on the response size, or you can request any block range with a cap of 10K logs in the response."
            ) {
                // The query returned more than 10k results, batching into 10k segments => rinse repeat
                const midBlock = (fromBlock + toBlock) >> 1
                const promise1 = getTransactionHistoryForContract({poolContract, poolABI, eventName, fromBlock, toBlock: midBlock})
                const promise2 = getTransactionHistoryForContract({poolContract, poolABI, eventName, fromBlock: midBlock + 1, toBlock})
                const [ arr1, arr2 ] = await Promise.all([promise1, promise2])
                return [...arr1, ...arr2]
            }
            if (err.error == "Error: One of the blocks specified in filter (fromBlock, toBlock or blockHash) cannot be found") {
                logger.warn("=======================");
                logger.warn("Error: One of the blocks specified in filter (fromBlock, toBlock or blockHash) cannot be found. This is a caching problem with Quiknode.");
                logger.warn(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);
                logger.warn("Retrying with toBlock -1");
                logger.warn("=======================");
                return await getTransactionHistoryForContract({poolContract, poolABI, eventName, fromBlock, toBlock: toBlock - 1})
            }
            throw err
        })
        return result
    } catch (err) {
        throw err
    }
}; // End of getTransactionHistoryForContract

// https://docs.ethers.io/v5/api/contract/contract/#Contract--creating
const getContractListener = ({
    poolContract = null,
    poolABI = null
}) => {
    try {
        if (!poolContract || !poolABI) throw new Error("Params are missing")
        return new ethers.Contract(poolContract, poolABI, Provider)
    } catch (err) {
        logger.error("Unable to fetch the contract listener")
        throw err
    }
} // End of getContractListener

const getLatestBlockNumber = async () => {
    try {
        await Provider.ready
        return await Provider.getBlockNumber()
    } catch (err) {
        logger.error("Unable to get the latest block number")
        throw err
    }
} // End of getLatestBlockNumber

const getSpecificBlock = async ({
    blockNumber = null
}) => {
    try {
        if (!blockNumber) throw new Error("Params are missing")
        await Provider.ready
        return await Provider.getBlock(blockNumber)
    } catch (err) {
        logger.error("Unable to get a block")
        throw err
    }
} // End of getSpecificBlock

module.exports = {
    getContractListener,
    getTransactionHistoryForContract,
    getLatestBlockNumber,
    getSpecificBlock,
}
