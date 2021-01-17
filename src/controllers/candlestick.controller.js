const { candlestickService } = require('../services');

const getLastSavedCandlestick = async (args) => {
    try {
        return await candlestickService.getLastSavedCandlestick(args)
    } catch (err) {
        throw err
    }
};

const getLastSavedCandlestickBlocknumber = async (args) => {
    try {
        return await candlestickService.getLastSavedCandlestickBlocknumber(args)
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
    getLastSavedCandlestickBlocknumber,
    insertCandlesticks
}
