const CandlestickModel = require('../models/candlestick.model')
const LiveCandlestickModel = require('../models/liveCandlestick.model')
const logger = require("../config/logger")
const { allowCandlestickInsertion, modifyLiveCandles } = require("../config/config")

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
         // TODO: this can be extremely fucked (RAM usage) if we have a gazillion documents
         // need to FIX THIS ASAP 
        const result = await CandlestickModel.aggregate([
            { $match: query },
            { $sort: { t: -1} },
            { $limit: 1 },
        ]).allowDiskUse(true)

        return (result.length > 0)
            ? result[0]
            : null
    } catch (err) {
        throw err
    }
}; // End of getLastSavedCandlestick

// Returns the last *closed* candle its blockNumber
const getLastSavedCandlestickBlockNumber = async ({
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
}; // End of getLastSavedCandlestickBlockNumber

// Insert an array of candlesticks to database. Array can be empty.
const insertCandlesticks = (candlesticks) => {
    try {
        if (!allowCandlestickInsertion) return logger.debug("Insertion of candles disabled")
        return CandlestickModel.insertMany(candlesticks, (err, result) => {
            if (err) throw err
            return result
        })
    } catch (err) {
        logger.error(err)
    }
}; // End of insertCandlesticks

const modifyLiveCandlestick = (
    query,
    fields,
) => {
    try {
        if (!query || !fields) throw new Error("Params are missing")
        if (!modifyLiveCandles) return logger.debug("Modification of LIVE candlesticks disabled")

        return LiveCandlestickModel.findOneAndUpdate(query, { $set: fields }, {
            upsert: true
        }, (err, result) => {
            if (err) throw err
            return result
        })
    } catch (err) {
        throw err
    }
} // End of modifyLiveCandlestick

// Special modification for the liveCandlestick
const modifyLiveCandlestickOnTransaction = (
    query,
    fields
) => {
    try {
        if (!query || !fields) throw new Error("Params are missing")
        if (!modifyLiveCandles) return logger.debug("Modification of LIVE candlesticks disabled")

        const { h, l, c, v } = fields
        if (typeof h != "number" || typeof h != "number" || typeof c != "number" || typeof v != "number") {
            throw new Error("Fields are not numbers or are missing")
        }

        return LiveCandlestickModel.findOneAndUpdate(query, {
            $max: { h: h },
            $min: { l: l },
            $inc: { v: v },
            $set: { c: c },
        }, {
            upsert: false
        }, (err, result) => {
            if (err) throw err
            return result
        })
    } catch (err) {
        throw err
    }
} // End of modifyLiveCandlestickOnTransaction

module.exports = {
    getLastSavedCandlestick,
    getLastSavedCandlestickBlockNumber,
    modifyLiveCandlestick,
    modifyLiveCandlestickOnTransaction,
    insertCandlesticks,
};
