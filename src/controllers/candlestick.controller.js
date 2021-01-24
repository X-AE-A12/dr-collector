const { candlestickService } = require('../services');

const getLastSavedCandlestick = async (args) => {
    try {
        return await candlestickService.getLastSavedCandlestick(args)
    } catch (err) {
        throw err
    }
};

const getLastSavedCandlestickBlockNumber = async (args) => {
    try {
        return await candlestickService.getLastSavedCandlestickBlockNumber(args)
    } catch (err) {
        throw err
    }
};

const insertCandlesticks = async (args) => {
    try {
        return await candlestickService.insertCandlesticks(args)
    } catch (err) {
        throw err
    }
};

const modifyLiveCandlestick = async (query, fields) => {
    try {
        return await candlestickService.modifyLiveCandlestick(query, fields)
    } catch (err) {
        throw err
    }
};

const modifyLiveCandlestickOnTransaction = async (query, fields) => {
    try {
        return await candlestickService.modifyLiveCandlestickOnTransaction(query, fields)
    } catch (err) {
        throw err
    }
};

module.exports = {
    getLastSavedCandlestick,
    getLastSavedCandlestickBlockNumber,
    insertCandlesticks,
    modifyLiveCandlestick,
    modifyLiveCandlestickOnTransaction,
}
