const ethers = require("ethers")

const logger = require('../config/logger');
const { pollingEnabled } = require('../config/config');
const { containsNull } = require('../utils')
const TransactionTransporter = require("../transporters/transaction.transporter")
const CandlestickBuilder = require("../candlestickBuilder")
const Helpers = require("./helpers")

module.exports = class Master {
    constructor(pool){
        this.pool = pool
        this.contractListener = undefined
        this.candlestickBuilder = undefined
        this.destroyIntervals = false
        this.isDoneSyncing = false
        this.transactionsMemory = []
        this.transactionsInLastBlock = []
    }

    // Triggered on boot, destroys itself when it's done synchronizing
    // This is important to use considering the backfill might take a long time for procession,
    // whilst the ContractListener is already picking up new transactions (which it pushes to
    // this.transactionsMemory).
    awaitDoneSyncing() {
        const self = setInterval(async () => {
            if (this.destroyIntervals) {
                return clearInterval(self)
            }

            if (this.isDoneSyncing) {
                clearInterval(self)

                // Sometimes the listener goes a bit bezerk e.g. it tries to resync blocks causing duplicates to form.
                // Also, other duplicates might form since toBlock (in the queryFilter function) is the same block as the one our Listener starts with
                if (!this.transactionsMemory.length) {
                    return this.candlestickBuilder.resolveTransactionsAllIntervals()
                }
                if (!this.transactionsInLastBlock.length) {
                    this.modelAndInsertTransactions(this.transactionsMemory) // it didn't record any new transactions in the backfill's current block
                    return this.candlestickBuilder.resolveTransactionsAllIntervals()
                }

                // Both arrays have lengths (else they'd return already), so now cross-compare.
                const blockNumber = this.transactionsInLastBlock[0].blockNumber
                const logsIndexes = this.transactionsInLastBlock.map(tx => tx.logIndex)
                const validTransactions = this.transactionsMemory.filter(tx => {
                    if (tx.blockNumber < blockNumber) return false
                    if (logsIndexes.includes(tx.logIndex)) return false
                    return true
                })

                this.modelAndInsertTransactions(validTransactions)
                this.candlestickBuilder.resolveTransactionsAllIntervals()
            }
        }, 10000)
    }

    async synchronize() {
        try {

            // Init the candlestickBuilder, this is where we transform all transactions into candlesticks
            // This remains idle until this.isDoneSyncing returns true (see awaitDoneSyncing)
            this.candlestickBuilder = new CandlestickBuilder(this.pool)
            this.candlestickBuilder.init()

            this.awaitDoneSyncing()
            pollingEnabled && this.initiatePolling()

            // No need to transform all transactions per interval as they're literally all the same *before* they're turned into candlesticks
            // Make new array starting from the oldest block (this array is the same length as intervals, so we can peg the index)
            // If the candle doesn't exist yet, then the hardcoded contract.fromBlock will be returned.
            // Also store the last recorded candlesticks from the database.
            const [ fromBlocks, lastSavedTransactionBlockNumber ] = await Promise.all([
                  Helpers.getFromBlocksPerInterval({ poolContract: this.pool.poolContract, fromBlock: this.pool.fromBlock }) // TODO: use liveCandlesticks so the $sort pipeline doesn't need to be triggered.
                , Helpers.getLastSavedTransactionBlockNumber({ poolContract: this.pool.poolContract })
            ])

            // The oldest block is the one that needs the most new transactions
            let oldestBlock = Math.min(...fromBlocks)

            oldestBlock = (lastSavedTransactionBlockNumber)
                ? Math.max(lastSavedTransactionBlockNumber, oldestBlock)
                : oldestBlock

            // Get all transactions since the oldest block (returns native JSON-RPC response formatting)
            // Can return an empty array [], as candlesticks still need to be formed.
            // This can be a heavy task when there's 100's of thousands of transactions => batching them into smaller chunks.
            const latestBlockNumber = await Helpers.getLatestBlockNumber()
            logger.debug(`Processing ${latestBlockNumber - oldestBlock} blocks`)

            if (latestBlockNumber < oldestBlock) {
                logger.warn("Provider sync is skewed (latestBlockNumber is lower than our last recorded candlestick blockNumber), Quiknode doesn this sometimes. For now exiting. (you need to fix this btw)")
                this.disablePolling()
                this.candlestickBuilder.changeIsAllowedToBuildCandlesticks(false)
                this.destroyIntervals = true
                this.isDoneSyncing = false
                proces.exit(1)
                return
            }

            const batchSizing = 100 // limited due to Memory Usage // TODO: optimize this and see how we can make this less memory extensive
            let from = oldestBlock + 1
            let to = from + batchSizing

            while (from < latestBlockNumber) {
                if (to > latestBlockNumber) to = latestBlockNumber
                const transactionHistory = await Helpers.getTransactionHistoryForContract({
                    poolContract: this.pool.poolContract,
                    poolABI: this.pool.poolABI,
                    eventName: this.getEventName(),
                    fromBlock: from,
                    toBlock: to,
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
                let resolvedSimplifiedTransactionHistory = await this.resolveSimplifiedTransactionHistory(simplifiedTransactionHistory)
                if (!resolvedSimplifiedTransactionHistory) throw new Error("resolveSimplifiedTransactionHistory returned an error")

                // Store the last transaction that we backfill (is used by awaitDoneSyncing function) so we know what our latest blockNumber is
                // resets on each iteration (so only the last one is actually used)
                this.transactionsInLastBlock = [ resolvedSimplifiedTransactionHistory[resolvedSimplifiedTransactionHistory.length - 1]]

                // Save the transactions
                this.modelAndInsertTransactions(resolvedSimplifiedTransactionHistory)

                from = to + 1
                to = from + batchSizing
            }

            this.isDoneSyncing = true
            logger.info(`Done synchronizing ${this.pool.poolContract}`);

        } catch (err) {
            this.disablePolling()
            this.candlestickBuilder.changeIsAllowedToBuildCandlesticks(false)
            this.destroyIntervals = true
            this.isDoneSyncing = false
            logger.error(err)
        }
    } // End of synchronize

    disablePolling() {
        try {
            this.contractListener && this.contractListener.removeAllListeners()
        } catch (err) {
            logger.error(err)
        }
    } // End of disablePolling

    initiatePolling() {
        try {
            // Start listening for new tx's and place them in the proper reference
            this.contractListener = Helpers.getContractListener({ pool: this.pool })
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

                // Resolve timestamps, array is length of 1
                let resolvedSimplifiedTransactionHistory = await this.resolveSimplifiedTransactionHistory(simplifiedTransactionHistory)
                if (!resolvedSimplifiedTransactionHistory) throw new Error("resolveSimplifiedTransactionHistory returned an error")

                if (this.isDoneSyncing) {
                    this.modelAndInsertTransactions(resolvedSimplifiedTransactionHistory)
                    this.candlestickBuilder.pushTransactionToLiveMemory(resolvedSimplifiedTransactionHistory[0])
                    // logger.debug('New Transaction coming in: %O', resolvedSimplifiedTransactionHistory);
                } else {
                    this.transactionsMemory.push(...resolvedSimplifiedTransactionHistory)
                }
            } // End of eventCB

            this.contractListener.on(this.getEventName(), eventCB)
            logger.info(`Listening to incoming transactions for: ${this.pool.poolContract}`)

        } catch (err) {
            this.disablePolling()
            this.candlestickBuilder.changeIsAllowedToBuildCandlesticks(false)
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
            Helpers.insertTransactions(modeledTransactions)
        } catch (err) {
            this.disablePolling()
            this.candlestickBuilder.changeIsAllowedToBuildCandlesticks(false)
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
    formatSimplifiedTransaction = ({
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
                block: transaction.getBlock(), // returns a promise => we need this to access the block.timestamp
                blockNumber: transaction.blockNumber,
                volume: pairAmount,
                price: price,
                logIndex: transaction.logIndex,
            }
        } catch (err) { // TODO: there is a VERY RARE error happening with this, has to do with transaction most likely
            console.log(transaction);
            console.log(tokenAmount);
            console.log(pairAmount);
            console.log(inversePrice);
            throw err
        }
    } // End of formatSimplifiedTransaction

    resolveSimplifiedTransactionHistory = async (simplifiedTransactionHistory) => {
        try {
            if (!simplifiedTransactionHistory || !simplifiedTransactionHistory.length) throw new Error("simplifiedTransactionHistory is an empty array")
            const promises = simplifiedTransactionHistory.map(tx => tx.block)
            const resolvedPromises = await Promise.allSettled(promises)

            const results = []
            for (let i = 0; i < simplifiedTransactionHistory.length; i++) {
                const resolvedPromise = resolvedPromises[i]
                const transaction = simplifiedTransactionHistory[i]
                const { blockNumber } = transaction

                if (resolvedPromise.status == "fulfilled") {
                    try {
                        delete transaction['block']
                        transaction.timestamp = resolvedPromise.value.timestamp
                        results.push(transaction)
                    } catch (err) {
                        logger.warn('An error occured while handling timestamp in a fulfilled promise, skipping this transaction: %O', err);
                        logger.warn('transaction details: %O', transaction)
                        logger.warn('promise details: %O', resolvedPromise)
                    }

                } else {
                    // An error occured, do a manual fetch later instead.
                    logger.warn('An error occured with resolving blocks, retrying manually:  %O', resolvedPromise.reason)
                    const timestamp = await Helpers.getTimestampForSpecificBlock({ blockNumber: blockNumber })
                    if (!timestamp) {
                        // if it still doesn't resolve then fuck it, log the tx but move on. // TODO: fix this
                        logger.warn('Unable to fetch timestamp for transaction:  %O', transaction)
                    }

                    delete transaction['block']
                    transaction.timestamp = timestamp
                    results.push(transaction)
                    logger.warn('Secondary attempt succesfull.')
                }
            }
            return results
        } catch (err) {
            logger.error(err)
            return null
        }
    } // End of resolveSimplifiedTransactionHistory

    /**
     * Convert big numbers (in hex) to JS supportive numbers without causing overflow etc.
     *
     * @param  {String} bigNumber   hex formatted big number
     * @return {Number}             JS formatted big number
     */
    bigNumberToNumber = (bigNumber) => {
        try {
            if (!bigNumber) throw "@parse_big_number params missing"
            return Number(ethers.BigNumber.from(bigNumber).toString())
        } catch (err) {
            throw err
        }
    } // End of bigNumberToNumber

} // End of class
