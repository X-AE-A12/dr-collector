const { transactionService } = require('../services');

const getLastSavedTransaction = async (args) => {
    try {
        return await transactionService.getLastSavedTransaction(args)
    } catch (err) {
        throw err
    }
};

const getLastSavedTransactionBlockNumber = async (args) => {
    try {
        return await transactionService.getLastSavedTransactionBlockNumber(args)
    } catch (err) {
        throw err
    }
};

const getSavedTransactionsInBlock = async (args) => {
    try {
        return await transactionService.getSavedTransactionsInBlock(args)
    } catch (err) {
        throw err
    }
};

const getSavedTransactionsFromBlock = async (args) => {
    try {
        return await transactionService.getSavedTransactionsFromBlock(args)
    } catch (err) {
        throw err
    }
};

const getSavedTransactionsFromTimestamp = async (args) => {
    try {
        return await transactionService.getSavedTransactionsFromTimestamp(args)
    } catch (err) {
        throw err
    }
};

const insertTransactions = async (args) => {
    try {
        return await transactionService.insertTransactions(args)
    } catch (err) {
        throw err
    }
};

module.exports = {
    getLastSavedTransaction,
    getLastSavedTransactionBlockNumber,
    getSavedTransactionsInBlock,
    getSavedTransactionsFromBlock,
    getSavedTransactionsFromTimestamp,
    insertTransactions
}
