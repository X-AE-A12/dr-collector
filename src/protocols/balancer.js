const Master = require("./master")
const logger = require("../config/logger")

module.exports = class Balancer extends Master {
    constructor( pool ) {
        super( pool )
    }

    getTransactionFromSwapEvent = ({
        arg7 = null // // TODO: this is still the Uniswap event arg, not Balancer's
    } = {}) => {
        return arg7
    } // End of getTransactionFromSwapEvent

    simplifyTransactions = ({
        transactionHistory = null,
        pool = null,
    } = {}) => {
        try {
            if (!transactionHistory || !pool) throw new Error("Params are missing")
            const { tokenDecimals, pairDecimals, inversePrice } = pool

            let simplifiedTransactions = []
            for (let i = 0; i < transactionHistory.length; i++) {
                const transaction = transactionHistory[i]

                const contractIn = tx.args.tokenIn
                const amountIn =  this._bigNumberToNumber(transaction.args.tokenAmountIn)
                const amountOut = this._bigNumberToNumber(transaction.args.tokenAmountOut)

                let tokenAmount
                let pairAmount

                // Selling the token
                if (contractIn.toUpperCase() == this.pool.tokenContract.toUpperCase()) {
                    tokenAmount = amountIn * Number(`1e-${tokenDecimals}`)
                    pairAmount = amountOut * Number(`1e-${pairDecimals}`)

                // Buying the token
                } else {
                    tokenAmount = amountOut * Number(`1e-${tokenDecimals}`)
                    pairAmount = amountIn * Number(`1e-${pairDecimals}`)
                }

                const simplifiedTransaction = this._formatSimplifiedTransaction({
                    transaction: transaction,
                    tokenAmount: tokenAmount,
                    pairAmount: pairAmount,
                    inversePrice: inversePrice
                })
                if (simplifiedTransaction.DIV_BY_ZERO) {
                    logger.info("Rare occasion with 0 swap rates for transaction:")
                    logger.info(transaction)
                    continue
                }
                simplifiedTransactions.push(simplifiedTransaction)
            }
            return simplifiedTransactions
        } catch (err) {
            logger.error(err)
            return []
        }
    }

    getEventName = () => {
        return "LOG_SWAP"
    }

    getName = () => {
        return "balancer"
    }
}
