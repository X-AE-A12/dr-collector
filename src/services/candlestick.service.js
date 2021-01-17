const CandlestickModel = require('../models/candlestick.model')
const logger = require("../config/logger")
const { insertCandles } = require("../config/config")

// Returns the last *closed* candle
const getLastSavedCandlestick = async ({
    poolContract = null,
    interval = null
} = {}) => {
    try {
        if (!poolContract || !interval) throw new Error("Params missing")
        const query = {
            poolContract: poolContract,
            i: interval
        }
        const result = await CandlestickModel.aggregate([
            { $match: query },
            { $sort: { t: -1} }
        ])
        return (result.length > 0)
            ? result[0]
            : null
    } catch (err) {
        throw err
    }
};

// Returns the last *closed* candle its blockNumber
const getLastSavedCandlestickBlocknumber = async ({
    poolContract = null,
    interval = null
} = {}) => {
    try {
        if (!poolContract || !interval) throw new Error("Params missing")
        const query = {
            poolContract: poolContract,
            interval: interval
        }
        const candle = await getLastSavedCandlestick(query)
        return (candle)
            ? candle.b
            : null
    } catch (err) {
        throw err
    }
};

// Insert an array of candlesticks to database. Array can be empty.
function insertCandlesticks(candlesticks) {
    try {
        if (!insertCandles) return logger.debug("Insertion of candles disabled")
        return CandlestickModel.insertMany(candlesticks, (err, result) => {
            if (err) throw err
            return result
        })
    } catch (err) {
        logger.error(err)
    }
} // End of insert_candles

module.exports = {
    getLastSavedCandlestick,
    getLastSavedCandlestickBlocknumber,
    insertCandlesticks
}
