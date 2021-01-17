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

module.exports = {
    getLastSavedCandlestick,
    getLastSavedCandlestickBlockNumber,
    insertCandlesticks
}
