/*
 *
 *
 *
 * This is deprecated code, still needs rewriting for transforming transactions into candlesticks.
 *
 *
 *
 */


// const pd = require("parse-duration")
// const { round } = require("@qc/date-round")
// const _ = require("lodash")
//
// const logger = require("./config/logger")
// const { containsNull } = require("./utils")
// const { candlestickController, providerController } = require("./controllers")
// const { pollingEnabled } = require('./config/config');
// const EventEmitter = require('./eventEmitter');
// const CandlestickTransporter = require("./transporters/candlestick.transporter")
//
// module.exports = class CandlestickBuilder {
//     constructor( pool ) {
//         this.pool = pool
//         this.intervalInSeconds = pd(this.interval) / 1000
//
//         this.isAllowedToResolveTransactions = false
//     }
//
//     init() {
//
//     }
//
//     async resolveTransactions() {
//         try {
//             this.isAllowedToResolveTransactions = false // make sure everything remains chronologically in case resolveTransactions() takes too long.
//
//             const transactions = await this.getAllSavedTransactions({ poolContract: this.pool.poolContract })
//             const batchedTransactions = _batchTransactionsPerDuration(transactions, this.openTimes, this.intervalInSeconds)
//
//             // Process all closed candles + place the unclosed candle transactions in memory (the last key in batchedTransactions)
//             const builtCandlesticks = []
//             const unclosedCandlestickKey = Object.keys(batchedTransactions).pop()
//             let previousCandlestick = this.lastSavedCandlestick
//
//             for (const key in batchedTransactions) {
//                 if (key == unclosedCandlestickKey) break // ignore the unclosed candle
//                 const transactionsInThisCandlestick = batchedTransactions[key]
//                 if (!previousCandlestick && !transactionsInThisCandlestick.length) break
//                 const candlestick = _buildCandlestick({
//                     openTime: key,
//                     transactionsInThisCandlestick: transactionsInThisCandlestick,
//                     previousCandlestick: previousCandlestick
//                 })
//                 builtCandlesticks.push(candlestick)
//                 previousCandlestick = candlestick
//             }
//             this.memory.unshift(...batchedTransactions[unclosedCandlestickKey]) // transactions from the unclosed candle are now put back in memory, this is a job for the poller now.
//
//             // Insert to database
//             this.modelAndInsertCandlesticks(builtCandlesticks)
//             logger.info(`Succesfully inserted ${builtCandlesticks.length} candlesticks`);
//
//             this.isAllowedToResolveTransactions = true
//         } catch (err) {
//             logger.error(err)
//             this.isAllowedToResolveTransactions = false
//         }
//     } // End of resolveMemory
//
//     modelAndInsertCandlesticks(candlesticks) {
//         try {
//             const finalCandlesticks = candlesticks.map(candle => new CandlestickTransporter(
//                 this.getProtocol(),
//                 this.getTokenName(),
//                 this.getPairName(),
//                 this.getPoolContract(),
//                 this.getInterval(),
//                 candle.b,
//                 candle.t, // opentime
//                 candle.o, // open
//                 candle.h, // high
//                 candle.l, // low
//                 candle.c, // close
//                 candle.v // quote volume
//             ))
//             candlestickController.insertCandlesticks(finalCandlesticks)
//         } catch (err) {
//             throw err
//         }
//     }
//
//     getProtocol() {
//         return this.pool.protocol
//     }
//
//     getTokenName() {
//         return this.pool.tokenName
//     }
//
//     getPairName(){
//         return this.pool.pairName
//     }
//
//     getPoolContract() {
//         return this.pool.poolContract
//     }
//
//     getInterval() {
//         return this.interval
//     }
// }
//
// function _sleep(ms) {
//   return new Promise((resolve) => {
//     setTimeout(resolve, ms);
//   });
// }
//
// async function getAllSavedTransactions({
//     poolContract = null,
// } = {}) {
//     try {
//         if (!poolContract) throw new Error("Params are missing")
//         return transactionController.getAllSavedTransactions({
//             poolContract: poolContract,
//         })
//     } catch (err) {
//         throw err
//     }
// } // End of getAllSavedTransactions
//
// function _buildCandlestick({
//     openTime = null,
//     transactionsInThisCandlestick = [], // can actually be empty
//     previousCandlestick = null, // can actually be null
//     // note: it is NOT possible for both of them to default empty (1 of the 2 must contain values)
// } = {}) {
//     try {
//         if (!openTime || !transactionsInThisCandlestick) throw new Error("Params are missing")
//         if (!transactionsInThisCandlestick.length && !previousCandlestick) throw new Error("It is impossible for the transactionsInThisCandlestick to be empty & the previousCandlestick to be null")
//
//         let blockNumber, time, open, high, low, close, volume
//         if (!transactionsInThisCandlestick.length) {
//             blockNumber = previousCandlestick.b
//             time        = openTime
//             open        = previousCandlestick.c
//             high        = previousCandlestick.c
//             low         = previousCandlestick.c
//             close       = previousCandlestick.c
//             volume      = 0
//         } else {
//             blockNumber = transactionsInThisCandlestick[transactionsInThisCandlestick.length - 1].blockNumber
//             time        = openTime
//             open        = transactionsInThisCandlestick[0].price
//             high        = (_.maxBy(transactionsInThisCandlestick, (tx) => tx.price)).price
//             low         = (_.minBy(transactionsInThisCandlestick, (tx) => tx.price)).price
//             close       = transactionsInThisCandlestick[transactionsInThisCandlestick.length - 1].price
//             volume      = _.sumBy(transactionsInThisCandlestick, (tx) => tx.price)
//         }
//         return {
//             b: blockNumber,
//             t: time,
//             o: open,
//             h: high,
//             l: low,
//             c: close,
//             v: volume
//         }
//     } catch (err) {
//         throw err
//     }
// }
//
// function _batchTransactionsPerDuration(transactions, openTimes, intervalInSeconds) {
//     try {
//         if (!transactions || !openTimes || !intervalInSeconds) throw new Error("Params are missing")
//
//         const transactionsByOpentime = {}
//         openTimes.forEach((openTime, index) => {
//             const a = transactions,
//                 b = a.filter(tx => tx.timestamp < openTime + intervalInSeconds)
//             b.forEach(() => a.splice(a.findIndex(tx => tx.timestamp < openTime + intervalInSeconds), 1)) // this alters the original transactions array
//
//             transactionsByOpentime[openTime] = []
//             transactionsByOpentime[openTime] = b
//         });
//         return transactionsByOpentime
//     } catch (err) {
//         throw err
//     }
// }
//
// /**
//  * @returns {Array}   openTimes of all missing candlesticks in our database, includes the currently *unclosed* candle openTime
//  */
// function _getOpenTimes({
//     intervalInSeconds = null,
//     firstTransaction = null, // Object => may actually be null
//     lastSavedCandlestick = null // Object => may actually be null
// }) {
//     try {
//         if (!intervalInSeconds) throw new Error("Params are missing")
//
//         // When building candlesticks we're counting backwards so the timestamps are according to the interval times in UTC
//         const now = Math.floor(Date.now() / 1000) // in seconds
//         const nearestOpenTime = (round(now, intervalInSeconds).getTime()) // in seconds, but can also be the future value
//
//         // Calculate the openTime of the currently active candle in seconds
//         // Note: this is in the past (has to with round() rounding to above/below)
//         let currentUnclosedCandlestickOpenTime = (nearestOpenTime <= now)
//             ? nearestOpenTime
//             : nearestOpenTime - intervalInSeconds
//
//         // Calculate the earliest known (either from the database, or from contract creation)
//         const lastRecordedOpenTime = (lastSavedCandlestick)
//             ? lastSavedCandlestick.t // we have stored something in the database
//             : (firstTransaction)
//                 ? firstTransaction.timestamp // NO history in the database, so the first tx we have will mark the openTime
//                 : currentUnclosedCandlestickOpenTime // NO history and NO transactions, so use the currently open candlestick
//
//         const openTimes = []
//         while (currentUnclosedCandlestickOpenTime > lastRecordedOpenTime) { // the first open_time after the last recorded candle, that ">" is CRUCIAL instead of ">="
//             openTimes.push(currentUnclosedCandlestickOpenTime)
//             currentUnclosedCandlestickOpenTime -= intervalInSeconds
//         }
//
//         // Flip openTimes so we can loop from the past until now
//         return openTimes.reverse()
//     } catch (err) {
//         throw err
//     }
// }
