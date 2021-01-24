const { providerService } = require('../services');

const getContractListener = (args) => {
    try {
        return providerService.getContractListener(args)
    } catch (err) {
        throw err
    }
};

const getTransactionHistoryForContract = async (args) => {
    try {
        return await providerService.getTransactionHistoryForContract(args)
    } catch (err) {
        throw err
    }
};

const getLatestBlockNumber = async () => {
    try {
        return await providerService.getLatestBlockNumber()
    } catch (err) {
        throw err
    }
};

const getSpecificBlock = async (args) => {
    try {
        return await providerService.getSpecificBlock(args)
    } catch (err) {
        throw err
    }
};

module.exports = {
    getContractListener,
    getTransactionHistoryForContract,
    getLatestBlockNumber,
    getSpecificBlock,
}
