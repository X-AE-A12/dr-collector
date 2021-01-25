const  logger = require('../config/logger')
const { candlestickController, transactionController, providerController } = require('../controllers')
const { supportedIntervals } = require('../config/config')
const { containsNull } = require('../utils')

async function getFromBlocksPerInterval({
    poolContract = null,
    fromBlock = null,
} = {}) {
    try {
        if (!poolContract || !fromBlock) throw new Error("Params are missing")
        const promises = supportedIntervals.map(intervalProps => {
            return chooseFromBlock({
                interval: intervalProps.interval,
                intervalInSeconds: intervalProps.intervalInSeconds,
                poolContract: poolContract,
                fromBlock: fromBlock
            })
        })
        const results = await Promise.all(promises);
        if (containsNull(results)) throw new Error("fromBlocks contains a nullified value")
        return results
    } catch (err) {
        throw err
    }
} // End of getFromBlocksPerInterval

async function getLastSavedCandlestick({
    poolContract = null,
    interval = null,
    intervalInSeconds = null
} = {}) {
    try {
        if (!poolContract || !interval || !intervalInSeconds) throw new Error("Params are missing")
        return await candlestickController.getLastSavedCandlestick({
            poolContract: poolContract,
            interval: interval,
            intervalInSeconds: intervalInSeconds
        })
    } catch (err) {
        throw err
    }
} // End of getLastSavedCandlestick

async function getLastSavedCandlesticksPerInterval({
    poolContract = null,
} = {}) {
    try {
        if (!poolContract) throw new Error("Params are missing")
        const promises = supportedIntervals.map(intervalProps => {
            return candlestickController.getLastSavedCandlestick({
                poolContract: poolContract,
                interval: intervalProps.interval,
                intervalInSeconds: intervalProps.intervalInSeconds,
            })
        })
        const candles = await Promise.all(promises);
        return intervals.reduce((acc, interval, index) => {
            acc[interval] = {}
            acc[interval] = candles[index]
            return acc
        }, {})
    } catch (err) {
        throw err
    }
} // End of getLastSavedCandlesticksPerInterval

async function getLastSavedTransaction({
    poolContract = null,
} = {}) {
    try {
        if (!poolContract) throw new Error("Params are missing")
        return transactionController.getLastSavedTransaction({
            poolContract: poolContract,
        })
    } catch (err) {
        throw err
    }
} // End of getLastSavedTransaction

async function getLastSavedTransactionBlockNumber({
    poolContract = null,
} = {}) {
    try {
        if (!poolContract) throw new Error("Params are missing")
        return transactionController.getLastSavedTransactionBlockNumber({
            poolContract: poolContract,
        })
    } catch (err) {
        throw err
    }
} // End of getLastSavedTransactionBlockNumber

async function getSavedTransactionsInBlock({
    poolContract = null,
    blockNumber = null,
} = {}) {
    try {
        if (!poolContract || !blockNumber) throw new Error("Params are missing")
        return transactionController.getSavedTransactionsInBlock({
            poolContract: poolContract,
            blockNumber: blockNumber,
        })
    } catch (err) {
        throw err
    }
} // End of getLastSavedTransactionBlockNumber

async function getSavedTransactionsFromBlock({
    poolContract = null,
    fromBlock = null,
} = {}) {
    try {
        if (!poolContract || !fromBlock) throw new Error("Params are missing")
        return transactionController.getSavedTransactionsFromBlock({
            poolContract: poolContract,
            fromBlock: fromBlock,
        })
    } catch (err) {
        throw err
    }
} // End of getSavedTransactionsFromBlock

async function getSavedTransactionsFromTimestamp({
    poolContract = null,
    fromTimestamp = null,
} = {}) {
    try {
        if (!poolContract || !fromTimestamp) throw new Error("Params are missing")
        return transactionController.getSavedTransactionsFromTimestamp({
            poolContract: poolContract,
            timestamp: fromTimestamp,
        })
    } catch (err) {
        throw err
    }
} // End of getSavedTransactionsFromTimestamp

async function getLatestBlockNumber() {
    try {
        return providerController.getLatestBlockNumber()
    } catch (err) {
        throw err
    }
} // End of getLatestBlockNumber

async function getTransactionHistoryForContract({
    poolContract = null,
    poolABI = null,
    eventName = null,
    fromBlock = null,
    toBlock = null,
} = {}) {
    try {
        if (!poolContract || !poolABI || !eventName || !fromBlock || !toBlock) throw new Error("Params are missing")
        return providerController.getTransactionHistoryForContract({
            poolContract: poolContract,
            poolABI: poolABI,
            eventName: eventName,
            fromBlock: fromBlock,
            toBlock: toBlock,
        })
    } catch (err) {
        throw err
    }
} // End of getTransactionHistoryForContract

function getContractListener({
    pool = null,
} = {}) {
    try {
        if (!pool) throw new Error("Params are missing")
        return providerController.getContractListener({
            poolContract: pool.poolContract,
            poolABI: pool.poolABI,
        })
    } catch (err) {
        throw err
    }
} // End of getContractListener

async function getTimestampForSpecificBlock({
    blockNumber = null,
} = {}) {
    try {
        if (!blockNumber) throw new Error("Params are missing")
        const block = await providerController.getSpecificBlock({
            blockNumber: blockNumber,
        })
        return block.timestamp
    } catch (err) {
        throw err
    }
} // End of getContractListener

async function chooseFromBlock ({
    interval = null,
    intervalInSeconds = null,
    poolContract = null,
    fromBlock = null
} = {}) {
    try {
        if (!interval || !intervalInSeconds || !poolContract || !fromBlock) throw new Error("Params are missing");
        const lastCandlestickBlockNumber = await candlestickController.getLastSavedCandlestickBlockNumber({
            poolContract: poolContract,
            interval: interval,
            intervalInSeconds: intervalInSeconds
        })
        return (!lastCandlestickBlockNumber)
            ? fromBlock
            : lastCandlestickBlockNumber
    } catch (err) {
        logger.error(err);
        return null
    }
} // End of chooseFromBlock

function insertTransactions(modeledTransactions) {
    try {
        if (!modeledTransactions) throw new Error("Params are missing")
        return transactionController.insertTransactions(modeledTransactions)
    } catch (err) {
        throw err
    }
} // End of insertTransactions

module.exports = {
    getFromBlocksPerInterval,
    getLastSavedCandlestick,
    getLastSavedCandlesticksPerInterval,
    getLastSavedTransaction,
    getLastSavedTransactionBlockNumber,
    getSavedTransactionsInBlock,
    getSavedTransactionsFromBlock,
    getSavedTransactionsFromTimestamp,
    getLatestBlockNumber,
    getTransactionHistoryForContract,
    getContractListener,
    getTimestampForSpecificBlock,
    chooseFromBlock,
    insertTransactions,
}
