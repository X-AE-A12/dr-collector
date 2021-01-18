const ethers = require("ethers")

const logger = require('../config/logger');
const { candlestickController, transactionController, providerController } = require('../controllers')
const { pollingEnabled, supportedIntervals } = require('../config/config');
const { containsNull } = require('../utils')
const TransactionTransporter = require("../transporters/transaction.transporter")
// const CandlestickBuilder = require("../candlestickBuilder")

module.exports = class Master {
    constructor(pool){
        this.pool = pool
        this.contractListener = undefined
        this.isDoneSyncing = false
        this.transactionsMemory = []
        this.transactionsInLastBlock = []
    }

    awaitDoneSyncing() {
        const self = setInterval(async () => {
            if (this.isDoneSyncing) {
                clearInterval(self)

                // Sometimes the listener goes a bit bezerk e.g. it tries to resync blocks causing duplicates to form.
                // Also, other duplicates might form since toBlock (in the queryFilter function) is the same block as the one our Listener starts with
                if (!this.transactionsMemory.length) return
                if (!this.transactionsInLastBlock.length) {
                    this.modelAndInsertTransactions(this.transactionsMemory) // it didn't record any new transactions in the backfill current block
                    return
                }

                // both arrays have lengths (else they'd return already), so now cross-compare.
                const blockNumber = this.transactionsInLastBlock[0].blockNumber
                const logsIndexes = this.transactionsInLastBlock.map(tx => tx.logIndex)
                const validTransactions = this.transactionsMemory.filter(tx => {
                    if (tx.blockNumber < blockNumber) return false
                    if (logsIndexes.includes(tx.logIndex)) return false
                    return true
                })

                this.modelAndInsertTransactions(validTransactions)
            }
        }, 2000)
    }

    async synchronize() {
        try {

            if (pollingEnabled) {
                this.awaitDoneSyncing()
                this.initiatePolling()
            }

            // No need to transform all transactions per interval as they're literally all the same *before* they're turned into candlesticks
            // Make new array starting from the oldest block (this array is the same length as intervals, so we can peg the index)
            // If the candle doesn't exist yet, then the hardcoded contract.fromBlock will be returned.
            // Also store the last recorded candlesticks from the database.
            const [ fromBlocks, lastSavedCandlesticksPerInterval, lastSavedTransactionBlockNumber ] = await Promise.all([
                  getFromBlocksPerInterval({ poolContract: this.pool.poolContract, fromBlock: this.pool.fromBlock })
                , getLastSavedCandlesticksPerInterval({ poolContract: this.pool.poolContract })
                , getLastSavedTransactionBlockNumber({ poolContract: this.pool.poolContract })
            ])

            // The oldest block is the one that needs the most new transactions
            let oldestBlock = Math.min(...fromBlocks)

            oldestBlock = (lastSavedTransactionBlockNumber)
                ? Math.max(lastSavedTransactionBlockNumber, oldestBlock)
                : oldestBlock

            // Get all transactions since the oldest block (returns native JSON-RPC response formatting)
            // Can return an empty array [], as candlesticks still need to be formed.
            // This can be a heavy task when there's 100's of thousands of transactions => batching them into smaller chunks.
            const latestBlockNumber = await providerController.getLatestBlockNumber()

            const batchSizing = 1000
            let from = oldestBlock + 1
            let to = from + batchSizing

            while (from < latestBlockNumber) {
                if (to > latestBlockNumber) to = latestBlockNumber
                const transactionHistory = await providerController.getTransactionHistoryForContract({
                    poolContract: this.pool.poolContract,
                    poolABI: this.pool.poolABI,
                    eventName: this.getEventName(),
                    fromBlock: from,
                    toBlock: to
                })
                if (!transactionHistory) throw new Error("transactionHistory has thrown an unknown error")
                if (!transactionHistory.length) {
                    from = to + 1
                    to = from + batchSizing
                    continue
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

                // Store the last transaction that we backfill (is used by awaitDoneSyncing function) so we know what our latest blockNumber is
                // reset on each iteration (so only the last one is actually used)
                this.transactionsInLastBlock = [ resolvedSimplifiedTransactionHistory[resolvedSimplifiedTransactionHistory.length - 1]]

                // Save the transactions
                this.modelAndInsertTransactions(resolvedSimplifiedTransactionHistory)

                from = to + 1
                to = from + batchSizing
            }

            this.isDoneSyncing = true
            logger.info(`Done synchronizing ${this.pool.poolContract}`);

            // Init the candlestickBuilder, this is where we transform all transactions into candlesticks
            // const candlestickBuilder = new CandlestickBuilder(this.pool)
            // candlestickBuilder.init()

        } catch (err) {
            this.disablePolling()
            this.isDoneSyncing = false
            logger.error(err)
        }
    } // End of synchronize

    disablePolling() {
        try {
            this.contractListener.removeAllListeners()
        } catch (err) {
            logger.error(err)
        }
    } // End of disablePolling

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

                // Resolve timestamps
                let resolvedSimplifiedTransactionHistory = await this._resolveSimplifiedTransactionHistory(simplifiedTransactionHistory) // issue

                if (this.isDoneSyncing) {
                    this.modelAndInsertTransactions(resolvedSimplifiedTransactionHistory)
                } else {
                    this.transactionsMemory.push(...resolvedSimplifiedTransactionHistory)
                }
            } // End of eventCB

            this.contractListener.on(this.getEventName(), eventCB)
            logger.info(`Listening to incoming transactions for: ${this.pool.poolContract}`)

        } catch (err) {
            logger.error(err)
        }
    } // End of initiatePolling

    modelAndInsertTransactions = (resolvedSimplifiedTransactionHistory) => {
        try {
            const modeledTransactions = resolvedSimplifiedTransactionHistory.map(tx => {
                return new TransactionTransporter(
                    this.pool.protocol,
                    this.pool.poolContract,
                    tx.timestamp,
                    tx.blockNumber,
                    tx.volume,
                    tx.price,
                    tx.logIndex,
                )
            })
            transactionController.insertTransactions(modeledTransactions)
        } catch (err) {
            logger.error(err)
        }
    } // End of modelAndInsertTransactions

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
            if (!transaction || !tokenAmount == null || !pairAmount == null || inversePrice == null) throw new Error("Params are missing")
            if (typeof tokenAmount != "number" || typeof pairAmount != "number" || typeof inversePrice != "boolean") throw new Error("Params have incorrect types")

            if (tokenAmount == 0 || pairAmount == 0) return {
                DIV_BY_ZERO: true
            }

            const price = (!inversePrice)
                ? Number((tokenAmount / pairAmount).toFixed(10))
                : Number((pairAmount / tokenAmount).toFixed(10))

            return {
                timestamp: transaction.getBlock(),
                blockNumber: transaction.blockNumber,
                volume: pairAmount,
                price: price,
                logIndex: transaction.logIndex,
            }
        } catch (err) {
            console.log(transaction);
            console.log(tokenAmount);
            console.log(pairAmount);
            console.log(inversePrice);
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
        if (!poolContract || !fromBlock) throw new Error("Params are missing")
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
        if (!poolContract) throw new Error("Params are missing")
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

async function getLastSavedTransaction({
    poolContract = null,
} = {}) {
    try {
        if (!poolContract) throw new Error("Params are missing")
        return transactionController.getLastSavedTransaction({
            poolContract: poolContract,
        })
    } catch (err) {
        throw err
    }
} // End of getLastSavedTransaction

async function getLastSavedTransactionBlockNumber({
    poolContract = null,
} = {}) {
    try {
        if (!poolContract) throw new Error("Params are missing")
        return transactionController.getLastSavedTransactionBlockNumber({
            poolContract: poolContract,
        })
    } catch (err) {
        throw err
    }
} // End of getLastSavedTransactionBlockNumber

async function getSavedTransactionsInBlock({
    poolContract = null,
    blockNumber = null
} = {}) {
    try {
        if (!poolContract || !blockNumber) throw new Error("Params are missing")
        return transactionController.getSavedTransactionsInBlock({
            poolContract: poolContract,
            blockNumber: blockNumber,
        })
    } catch (err) {
        throw err
    }
} // End of getLastSavedTransactionBlockNumber

async function _chooseFromBlock ({
    interval = null,
    poolContract = null,
    fromBlock = null
} = {}) {
    try {
        if (!interval || !poolContract || !fromBlock) throw new Error("Params are missing");
        const lastCandlestickBlockNumber = await candlestickController.getLastSavedCandlestickBlockNumber({
            poolContract: poolContract,
            interval: interval,
        })
        return (!lastCandlestickBlockNumber)
            ? fromBlock
            : lastCandlestickBlockNumber
    } catch (err) {
        logger.error(err);
        return null
    }
} // End of _chooseFromBlock

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
