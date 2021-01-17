const ethers = require("ethers")

const logger = require('../config/logger');
const { candlestickController, providerController } = require('../controllers')
const { pollingEnabled, supportedIntervals } = require('../config/config');
const { containsNull } = require('../utils')
const Watcher = require("../watcher")

module.exports = class Master {
    constructor(pool){
        this.pool = pool
        this.watchers = []
        this.contractListener = undefined
    }

    async synchronize() {
        try {

            // No need to transform all transactions per interval as they're literally all the same *before* they're turned into candlesticks
            // Make new array starting from the oldest block (this array is the same length as intervals, so we can peg the index)
            // If the candle doesn't exist yet, then the hardcoded contract.fromBlock will be returned.
            // Also store the last recorded candlesticks from the database.
            const [ fromBlocks, lastSavedCandlesticksPerInterval ]= await Promise.all([
                  getFromBlocksPerInterval({ poolContract: this.pool.poolContract, fromBlock: this.pool.fromBlock })
                , getLastSavedCandlesticksPerInterval({ poolContract: this.pool.poolContract })
            ])

            if (pollingEnabled) {
                this.initiatePolling()
            }

            // Init the watchers (per pool & per interval)
            for (let i = 0; i < supportedIntervals.length; i++) {
                const interval = supportedIntervals[i]
                const lastSavedCandlestick = lastSavedCandlesticksPerInterval[interval]
                const watcher = new Watcher(this, {
                    interval: interval,
                    fromBlock: fromBlocks[i],
                    lastSavedCandlestick: lastSavedCandlestick,
                })
                this.watchers.push(watcher)
            }

            // The oldest block is the one that contains unique tx's, later on when the other intervals share the same tx's => split them
            const oldestBlock = Math.min(...fromBlocks)

            // Get all transactions since the oldest block (returns native JSON-RPC response formatting)
            // Can return an empty array [], as candlesticks still need to be formed.
            const transactionHistory = await providerController.getTransactionHistoryForContract({
                poolContract: this.pool.poolContract,
                poolABI: this.pool.poolABI,
                eventName: this.getEventName(),
                fromBlock: oldestBlock,
                toBlock: await providerController.getLatestBlockNumber()  // must be a number so "latest" doesn't work
            })
            if (!transactionHistory) throw new Error("TransactionHistory has thrown an unknown error")
            logger.debug(`Processing ${transactionHistory.length} transactions for ${this.pool.poolContract}`)

            if (!transactionHistory.length) {
                logger.info("There seems to be no transactionHistory for this pool, retrying in 10 minutes.")
                this.disablePolling()
                await _sleep(20000) // try again in 2 seconds
                return this.synchronize()
            }

            // Make the transactionHistory more readable, even if there are 0 tx's (0 tx's are still valid for candlesticks)
            // Use specific event logs as written in the contract ABI, this function is found in the various protocol files.
            // Contains a promise for the timestamp (so we can resolve them asynchronously later)
            let simplifiedTransactionHistory = this.simplifyTransactions({
                transactionHistory: transactionHistory,
                pool: this.pool,
            })
            if (containsNull(simplifiedTransactionHistory)) throw new Error("simplifiedTransactionHistory contains a nullified value")

            // Resolve timestamps
            let resolvedSimplifiedTransactionHistory = await this._resolveSimplifiedTransactionHistory(simplifiedTransactionHistory)
            if (!resolvedSimplifiedTransactionHistory || containsNull(resolvedSimplifiedTransactionHistory)) {
                // try again
                logger.warn("simplifiedTransactionHistory returned an error, most likely to do with the promises.. Retrying again in 30 seconds.")
                await _sleep(30000) // try again in 30 seconds
                resolvedSimplifiedTransactionHistory = await this._resolveSimplifiedTransactionHistory(simplifiedTransactionHistory)

                if (!resolvedSimplifiedTransactionHistory) {
                  logger.info("resolvedSimplifiedTransactionHistory returned another error, retrying in 10 minutes.")
                  this.disablePolling()
                  await _sleep(20000) // try again in 20 seconds
                  return this.synchronize()
                }
            }

            // Reminder that each watcher represents a pool & a specific interval in that pool.
            this.watchers.forEach((watcher, i) => {
                watcher.insertInitialTransactionHistory(resolvedSimplifiedTransactionHistory)
            });

        } catch (err) {
            logger.error(err)
        }
    } // End of synchronize

    disablePolling() {
        try {
            this.contractListener.removeAllListeners()
        } catch (err) {
            logger.error(err)
        }
    }

    initiatePolling() {
        try {
            // Start listening for new tx's and place them in the proper reference
            this.contractListener = providerController.getContractListener(this.pool)
            const eventCB = async (
                arg1,
                arg2,
                arg3,
                arg4,
                arg5,
                arg6,
                arg7,
                arg8,
                arg9,
                arg10
            ) => {
                const transaction = this.getTransactionFromSwapEvent({ arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10 })
                let simplifiedTransactionHistory = this.simplifyTransactions({
                    transactionHistory: [ transaction ],
                    pool: this.pool,
                })
                if (containsNull(simplifiedTransactionHistory)) throw new Error("simplifiedTransactionHistory contains a nullified value")

                logger.debug("Incoming transaction:")
                logger.debug(JSON.stringify(simplifiedTransactionHistory))

                // Resolve timestamps
                simplifiedTransactionHistory = await this._resolveSimplifiedTransactionHistory(simplifiedTransactionHistory) // issue

                this.watchers.forEach((watcher, i) => {
                    watcher.addTransactionToMemory(simplifiedTransactionHistory[0]) // 0 because it's always a singulair array
                });

            } // End of eventCB

            this.contractListener.on(this.getEventName(), eventCB)

        } catch (err) {
            logger.error(err)
        }
    }

    /**
     * This is an internal function and should be called by the various protocol classes. Whereas they dissect
     * the incoming tranactions into readable formats, this function unifies their output across all protocol classes.
     *
     * @param   {Object}  tx            a transaction as formatted by the default Ethereum JSON-RPC API
     * @param   {Number}  tokenAmount   how many of the base asset have been swapped  DAI-WETH => DAI
     * @param   {Number}  pairAmount    how many of the quote asset have been swapped DAI-WETH => WETH
     * @param   {Boolean} inversePrice  the method of expressing the price => DAI per WETH or WETH per DAI
     * @return  {Object}                the format used before the tx's will be turned into candlesticks
     */
    _formatSimplifiedTransaction = ({
        transaction = null,
        tokenAmount = null,
        pairAmount = null,
        inversePrice = null,
    } = {}) => {
        try {
            if (!transaction || !tokenAmount || !pairAmount || inversePrice == null) throw new Error("Params are missing")
            if (typeof tokenAmount != "number" || typeof pairAmount != "number" || typeof inversePrice != "boolean") throw new Error("Params have incorrect types")

            const price = (!inversePrice)
                ? Number((tokenAmount / pairAmount).toFixed(10))
                : Number((pairAmount / tokenAmount).toFixed(10))

            return {
                timestamp: transaction.getBlock(),
                blockNumber: transaction.blockNumber,
                volume: pairAmount,
                price: price
            }
        } catch (err) {
            throw err
        }
    } // End of _formatSimplifiedTransaction

    _resolveSimplifiedTransactionHistory = async (simplifiedTransactionHistory) => {
        try {
            if (!simplifiedTransactionHistory || !simplifiedTransactionHistory.length) throw new Error("simplifiedTransactionHistory is an empty array")
            const promises = simplifiedTransactionHistory.map(tx => tx.timestamp)
            const timestamps = await Promise.all(promises)
            return simplifiedTransactionHistory.reduce((acc, transaction, index) => {
                transaction.timestamp = timestamps[index].timestamp
                acc.push(transaction)
                return acc
            }, [])
        } catch (err) {
            logger.error(err)
            return null // let's retry this
        }
    } // End of _resolveSimplifiedTransactionHistory

    /**
     * Convert big numbers (in hex) to JS supportive numbers without causing overflow etc.
     *
     * @param  {String} bigNumber   hex formatted big number
     * @return {Number}             JS formatted big number
     */
    _bigNumberToNumber = (bigNumber) => {
        try {
            if (!bigNumber) throw "@parse_big_number params missing"
            return Number(ethers.BigNumber.from(bigNumber).toString())
        } catch (err) {
            throw err
        }
    } // End of _bigNumberToNumber

} // End of class

async function getFromBlocksPerInterval({
    poolContract = null,
    fromBlock = null,
} = {}) {
    try {
        const promises = supportedIntervals.map(interval => {
            return _chooseFromBlock({
                interval: interval,
                poolContract: poolContract,
                fromBlock: fromBlock
            })
        })
        const results = await Promise.all(promises);
        if (containsNull(results)) throw new Error("fromBlocks contains a nullified value")
        return results
    } catch (err) {
        throw err
    }
} // End of getFromBlocksPerInterval

async function getLastSavedCandlesticksPerInterval({
    poolContract = null,
} = {}) {
    try {
        const promises = supportedIntervals.map(interval => {
            return candlestickController.getLastSavedCandlestick({
                poolContract: poolContract,
                interval: interval,
            })
        })
        const candles = await Promise.all(promises);
        return supportedIntervals.reduce((acc, interval, index) => {
            acc[interval] = {}
            acc[interval] = candles[index]
            return acc
        }, {})
    } catch (err) {
        throw err
    }
} // End of getLastSavedCandlesticksPerInterval

async function _chooseFromBlock ({
    interval = null,
    poolContract = null,
    fromBlock = null
} = {}) {
    try {
        if (!interval || !poolContract || !fromBlock) throw new Error("Params are missing");
        const lastCandlestickBlockNumber = await candlestickController.getLastSavedCandlestickBlocknumber({
            poolContract: poolContract,
            interval: interval,
        })
        return (!lastCandlestickBlockNumber)
            ? fromBlock
            : lastCandlestickBlockNumber + 1
    } catch (err) {
        logger.error(err);
        return null
    }
} // End of _chooseFromBlock

function _sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
