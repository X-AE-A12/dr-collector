const TransactionModel = require('../models/transaction.model')
const logger = require("../config/logger")
const { allowTransactionInsertion } = require("../config/config")

const getLastSavedTransaction = async ({
    poolContract = null
} = {}) => {
    try {
        if (!poolContract) throw new Error("Params are missing")
        const query = {
            poolContract: poolContract,
        }
        const result = await TransactionModel.aggregate([
            { $match: query },
            { $sort: { timestamp: -1} }
        ])
        return (result.length > 0)
            ? result[0]
            : null
    } catch (err) {
        throw err
    }
}; // End of getLastSavedTransaction

const getLastSavedTransactionBlockNumber = async ({
    poolContract = null,
} = {}) => {
    try {
        if (!poolContract) throw new Error("Params are missing")
        const query = {
            poolContract: poolContract,
        }
        const transaction = await getLastSavedTransaction(query)
        return (transaction)
            ? transaction.blockNumber
            : null
    } catch (err) {
        throw err
    }
}; // End of getLastSavedTransactionBlockNumber

const getSavedTransactionsInBlock = async ({
    poolContract = null,
    blockNumber = null,
} = {}) => {
    try {
        if (!poolContract || !blockNumber) throw new Error("Params are missing")
        const query = {
            poolContract: poolContract,
            blockNumber: blockNumber,
        }
        return await TransactionModel.find(query)
    } catch (err) {
        throw err
    }
}; // End of getLastSavedTransactionBlockNumber

const getSavedTransactionsFromBlock = async ({
    poolContract = null,
    fromBlock = null,
} = {}) => {
    try {
        if (!poolContract || !fromBlock) throw new Error("Params are missing")
        const query = {
            poolContract: poolContract,
            blockNumber: { $gte: fromBlock }
        }

        return await TransactionModel.aggregate([
            { $match: query },
            { $sort: { blockNumber: 1 } }
        ])
    } catch (err) {
        throw err
    }
}; // End of getSavedTransactionsFromBlock

const getSavedTransactionsFromTimestamp = async ({
    poolContract = null,
    timestamp = null,
} = {}) => {
    try {
        if (!poolContract || !timestamp) throw new Error("Params are missing")
        const query = {
            poolContract: poolContract,
            timestamp: { $gte: timestamp }
        }

        return await TransactionModel.aggregate([
            { $match: query },
            { $sort: { timestamp: 1 } }
        ])
    } catch (err) {
        throw err
    }
}; // End of getSavedTransactionsFromTimestamp

const insertTransactions = (transactions) => {
    try {
        if (!allowTransactionInsertion) return logger.warn("Insertion of transactions disabled")
        return TransactionModel.insertMany(transactions, (err, result) => {
            if (err) throw err
            return result
        })
    } catch (err) {
        logger.error(err)
    }
}; // End of insertTransactions

module.exports = {
    getLastSavedTransaction,
    getLastSavedTransactionBlockNumber,
    getSavedTransactionsInBlock,
    getSavedTransactionsFromBlock,
    getSavedTransactionsFromTimestamp,
    insertTransactions,
};
