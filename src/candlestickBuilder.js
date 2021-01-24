const { round } = require("@qc/date-round")
const _ = require("lodash")

const logger = require("./config/logger")
const { supportedIntervals, pollingEnabled } = require("./config/config")
const { candlestickController, transactionController, providerController } = require("./controllers")
const CandlestickTimer = require('./candlestickTimer');
const Helpers = require("./protocols/helpers")
const CandlestickTransporter = require("./transporters/candlestick.transporter")

module.exports = class CandlestickBuilder{
    constructor( pool ) {
        this.pool = pool
        this.isAllowedToBuildCandlesticks = false
        this.liveMemory = []
    }

    init(){
        pollingEnabled && this.timer()
    }

    timer() {
        // Wait for resolveTransactionsAllIntervals to finish.
        // This is a one-time setInterval, meaning it destroys itself when this.isAllowedToBuildCandlesticks turns true
        // Only called if polling is enabled, else we'd form empty candles.
        const self = setInterval(async () => {
            if (!this.isAllowedToBuildCandlesticks) return
            clearInterval(self)

            // Init the liveCandlesticks
            this.updateLiveCandlesticksOnBoot()
            this.initLiveCandlesticksOnTransaction()

            // Init candlestick closes
            // Whenever (most likely using the 1m interval) a candle closes but the synchronization/buildCandlesticks is still processing
            // then it won't register a candle close. This is okay, considering the this.resolveTransactions is a backfill function and
            // fills the missing gap (previously missed candlesticks) as well.
            CandlestickTimer.on("candlestickClose", async (args) => {
                const { interval, intervalInSeconds, currentOpenTime } = args
                if (!this.isAllowedToBuildCandlesticks) return // in case of an error that was thrown in other functions

                // this.resolveTransactions has 2 purposes: 1) backfilling and updating the db, 2) returning what's just closed for the liveCandlesticks
                const justClosedCandlestick = await this.resolveTransactions({ interval: interval, intervalInSeconds: intervalInSeconds })
                this.updateLiveCandlesticksOnCandleClose({
                    interval: interval,
                    currentOpenTime: currentOpenTime,
                    previousCandlestick: justClosedCandlestick,
                })
            })
        }, 1000)
    } // End of timer

    // Create (and if it already exists overwrites) a liveCandlestick
    // Applies to all intervals.
    updateLiveCandlesticksOnBoot() {
        try {
            for (let i = 0; i < supportedIntervals.length; i++) {
                const query = { poolContract: this.getPoolContract(), interval: supportedIntervals[i].interval }
                const fields = {
                    t: 0,
                    o: 0,
                    h: 0,
                    l: 0,
                    c: 0,
                    v: 0,
                }
                // Do not worry about these zero's, they might cause a UI 'glitch' in EXTREMELY rare cases, but as soon as
                // 1 transaction comes in this gets overruled. This could use optimization but is not priority.
                candlestickController.modifyLiveCandlestick(query, fields)
            }
        } catch (err) {
            logger.error(err)
            this.isAllowedToBuildCandlesticks = false
        }
    } // End of updateLiveCandlesticksOnBoot

    updateLiveCandlesticksOnCandleClose({
        interval = null,
        currentOpenTime = null,
        previousCandlestick,
    } = {}) {
      try {
          if (!interval || !currentOpenTime) throw new Error("Params are missing")
          const query = { poolContract: this.getPoolContract(), interval: interval }

          // When there is no previousCandlestick it's the RARE occassion where there is 0 txHistory (usually near contract creation)
          // fields should be 0 already based on the updateLiveCandlesticksOnBoot function (but it's for consistency)
          const fields = (!previousCandlestick)
              ? {
                  t: currentOpenTime,
                  o: 0,
                  h: 0,
                  l: 0,
                  c: 0,
                  v: 0,
                }
              : {
                  t: currentOpenTime,
                  o: previousCandlestick.c,
                  h: previousCandlestick.c,
                  l: previousCandlestick.c,
                  c: previousCandlestick.c,
                  v: 0,
              }
          candlestickController.modifyLiveCandlestick(query, fields)
      } catch (err) {
          logger.error(err)
          this.isAllowedToBuildCandlesticks = false
      }
    } // End of updateLiveCandlesticksOnCandleClose

    async initLiveCandlesticksOnTransaction() {
        try {
            const main = async () => {
                const liveMemory = [...this.liveMemory]
                this.liveMemory = []

                for (let i = 0; i < supportedIntervals.length; i++) {
                    const interval = supportedIntervals[i].interval

                    const query = { poolContract: this.getPoolContract(), interval: supportedIntervals[i].interval }
                    const fields = {
                        h: Math.max(...liveMemory.map(tx => tx.price)),
                        l: Math.min(...liveMemory.map(tx => tx.price)),
                        c: liveMemory[liveMemory.length - 1].price,
                        v: liveMemory.reduce((acc, tx) => {
                            acc += tx.volume
                            return acc
                        }, 0)
                    }

                    // Controller does a special operation in which the fields are once again compared to the actual live numbers.
                    // E.g. high and low are $min/$max, c is $set, and the volume is incremented $inc
                    candlestickController.modifyLiveCandlestickOnTransaction(query, fields) // fields carry a special operation
                }
            }
            setInterval(main, 10000)
        } catch (err) {
            logger.error(err)
        }
    }

    // We do not want to get flooded with new transactions, so cache transactions temporarily.
    pushTransactionToLiveMemory(tx) {
        this.liveMemory.push(tx)
    }

    // In case something goes wrong with the synchronization engine or the ContractListener from Master
    // this is called directly from Master from catch(err).
    changeIsAllowedToBuildCandlesticks(state) {
        this.isAllowedToBuildCandlesticks = state
    }

    // Can only be called by Master from awaitDoneSyncing
    // Will be executed only if synchronization is completely done
    // Candlestick closes are not allowed to perform their task if this function isn't ready yet,
    // this is communicated by the this.isAllowedToBuildCandlesticks Bool
    async resolveTransactionsAllIntervals() {
        try {
            for (let i = 0; i < supportedIntervals.length; i++) {
                const { interval, intervalInSeconds } = supportedIntervals[i]
                await this.resolveTransactions({ interval: interval, intervalInSeconds: intervalInSeconds }) // TODO: optimize this await function (turn into Promise.all or something)
            }
            this.isAllowedToBuildCandlesticks = true
        } catch (err) {
            logger.error(err)
            this.isAllowedToBuildCandlesticks = false
        }
    } // End of resolveTransactionsAllIntervals

    async resolveTransactions({
        interval = null,
        intervalInSeconds = null,
    } = {}) {
        try {
            if (!interval || !intervalInSeconds) throw new Error("Params are missing.")

            const lastSavedCandlestick = await Helpers.getLastSavedCandlestick({ poolContract: this.pool.poolContract, interval: interval })

            // Sometimes the contractListener fucks up and delays some events causing new transactions to not be
            // included in a new candle e.g. it emits them when the candle has already closed. Therefor NOT using
            // the latest timestamp of the last closed block, but rather its blockNumber + 1. In the rare scenario
            // of a *massive* delay, there is, for now, no solution for those rogue transactions.
            const transactions = (lastSavedCandlestick)
                ? await Helpers.getSavedTransactionsFromBlock({ poolContract: this.pool.poolContract, fromBlock: lastSavedCandlestick.b + 1 })
                : await Helpers.getSavedTransactionsFromTimestamp({ poolContract: this.pool.poolContract, fromTimestamp: 1 }) // not 0 to bypass isNull

            const openTimes = getOpenTimes({
                intervalInSeconds: intervalInSeconds,
                firstTransaction: (transactions.length) ? transactions[0] : null, // can be a null, it's a feature
                lastSavedCandlestick: lastSavedCandlestick // can be a null, it's a feature
            })
            const batchedTransactions = batchTransactionsPerDuration(transactions, openTimes, intervalInSeconds)

            // Process all closed candles & ignore the currently open candle (the last key in batchedTransactions)
            const builtCandlesticks = []
            const unclosedCandlestickKey = Object.keys(batchedTransactions).pop()
            let previousCandlestick = lastSavedCandlestick

            for (const key in batchedTransactions) {
                if (key == unclosedCandlestickKey) break // ignore the unclosed candle
                const transactionsInThisCandlestick = batchedTransactions[key]
                if (!previousCandlestick && !transactionsInThisCandlestick.length) break
                const candlestick = buildCandlestick({
                    openTime: Number(key),
                    transactionsInThisCandlestick: transactionsInThisCandlestick,
                    previousCandlestick: previousCandlestick
                })
                builtCandlesticks.push(candlestick)
                previousCandlestick = candlestick
            }
            // Insert to database
            this.modelAndInsertCandlesticks(builtCandlesticks, interval)
            logger.info(`Succesfully inserted ${builtCandlesticks.length} candlesticks`);

            return builtCandlesticks[builtCandlesticks.length - 1] // can return undefined if there are no candlesticks to work with, this a feature and we rely on it @updateLiveCandlesticks

        } catch (err) {
            this.isAllowedToBuildCandlesticks = false
            logger.error(err)
        }
    } // End of resolveTransactions

    modelAndInsertCandlesticks(candlesticks, interval) {
        try {
            if (!candlesticks || !interval ) throw new Error("Params are missing")
            const finalCandlesticks = candlesticks.map(candle => new CandlestickTransporter(
                this.getProtocol(),
                this.getTokenName(),
                this.getPairName(),
                this.getPoolContract(),
                interval,
                candle.b,
                candle.t, // opentime
                candle.o, // open
                candle.h, // high
                candle.l, // low
                candle.c, // close
                candle.v // quote volume
            ))
            candlestickController.insertCandlesticks(finalCandlesticks)
        } catch (err) {
            this.isAllowedToBuildCandlesticks = false
            throw err
        }
    }

    getProtocol() {
        return this.pool.protocol
    }

    getTokenName() {
        return this.pool.tokenName
    }

    getPairName(){
        return this.pool.pairName
    }

    getPoolContract() {
        return this.pool.poolContract
    }
}

function _sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildCandlestick({
    openTime = null,
    transactionsInThisCandlestick = [], // can actually be empty
    previousCandlestick = null, // can actually be null
    // note: it is NOT possible for both of them to default empty (1 of the 2 must contain values)
} = {}) {
    try {
        if (!openTime || !transactionsInThisCandlestick) throw new Error("Params are missing")
        if (!transactionsInThisCandlestick.length && !previousCandlestick) throw new Error("It is impossible for the transactionsInThisCandlestick to be empty & the previousCandlestick to be null")

        let blockNumber, time, open, high, low, close, volume
        if (!transactionsInThisCandlestick.length) {
            blockNumber = previousCandlestick.b
            time        = openTime
            open        = previousCandlestick.c
            high        = previousCandlestick.c
            low         = previousCandlestick.c
            close       = previousCandlestick.c
            volume      = 0
        } else {
            blockNumber = transactionsInThisCandlestick[transactionsInThisCandlestick.length - 1].blockNumber
            time        = openTime
            open        = transactionsInThisCandlestick[0].price
            high        = (_.maxBy(transactionsInThisCandlestick, (tx) => tx.price)).price
            low         = (_.minBy(transactionsInThisCandlestick, (tx) => tx.price)).price
            close       = transactionsInThisCandlestick[transactionsInThisCandlestick.length - 1].price
            volume      = _.sumBy(transactionsInThisCandlestick, (tx) => tx.volume)
        }
        return {
            b: blockNumber,
            t: time,
            o: open,
            h: high,
            l: low,
            c: close,
            v: volume
        }
    } catch (err) {
        throw err
    }
}

function batchTransactionsPerDuration(transactionsOriginal, openTimes, intervalInSeconds) {
    try {
        if (!transactionsOriginal || !openTimes || !intervalInSeconds) throw new Error("Params are missing")
        const transactions = [...transactionsOriginal] // cloning here because it alters the original array

        const transactionsByOpentime = {}
        openTimes.forEach((openTime, index) => {
            const a = transactions,
                b = a.filter(tx => tx.timestamp < openTime + intervalInSeconds)
            b.forEach(() => a.splice(a.findIndex(tx => tx.timestamp < openTime + intervalInSeconds), 1)) // this alters the original transactions array

            transactionsByOpentime[openTime] = []
            transactionsByOpentime[openTime] = b
        });
        return transactionsByOpentime
    } catch (err) {
        this.isAllowedToBuildCandlesticks = false
        throw err
    }
}

/**
 * @returns {Array}   openTimes of all missing candlesticks in our database, includes the currently *unclosed* candle openTime
 */
function getOpenTimes({
    intervalInSeconds = null,
    firstTransaction = null, // Object => may actually be null
    lastSavedCandlestick = null // Object => may actually be null
}) {
    try {
        if (!intervalInSeconds) throw new Error("Params are missing")

        // When building candlesticks we're counting backwards so the timestamps are according to the interval times in UTC
        const now = Math.floor(Date.now() / 1000) // in seconds
        const nearestOpenTime = (round(now, intervalInSeconds).getTime()) // in seconds, but can also be the future value

        // Calculate the openTime of the currently active candle in seconds
        // Note: this is in the past (has to with round() rounding to above/below)
        let currentUnclosedCandlestickOpenTime = (nearestOpenTime <= now)
            ? nearestOpenTime
            : nearestOpenTime - intervalInSeconds

        // Calculate the earliest known (either from the database, or from contract creation)
        const lastRecordedOpenTime = (lastSavedCandlestick)
            ? lastSavedCandlestick.t // we have stored something in the database
            : (firstTransaction)
                ? firstTransaction.timestamp // NO history in the database, so the first tx we have will mark the openTime
                : currentUnclosedCandlestickOpenTime // NO history and NO transactions, so use the currently open candlestick

        const openTimes = []
        while (currentUnclosedCandlestickOpenTime > lastRecordedOpenTime) { // the first open_time after the last recorded candle, that ">" is CRUCIAL instead of ">="
            openTimes.push(currentUnclosedCandlestickOpenTime)
            currentUnclosedCandlestickOpenTime -= intervalInSeconds
        }

        // Flip openTimes so we can loop from the past until now
        return openTimes.reverse()
    } catch (err) {
        this.isAllowedToBuildCandlesticks = false
        throw err
    }
}
