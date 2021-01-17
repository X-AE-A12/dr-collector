const Master = require("./master")
const logger = require("../config/logger")

module.exports = class Uniswap extends Master {
    constructor( pool ) {
        super( pool )
    }

    getTransactionFromSwapEvent = ({
        arg7 = null
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

                const amount0In =  this._bigNumberToNumber(transaction.args.amount0In)
                const amount1In =  this._bigNumberToNumber(transaction.args.amount1In)
                const amount0Out = this._bigNumberToNumber(transaction.args.amount0Out)
                const amount1Out = this._bigNumberToNumber(transaction.args.amount1Out)

                let tokenAmount
                let pairAmount

                // Selling the token
                if (amount1In == 0) {
                    tokenAmount = amount0In * Number(`1e-${tokenDecimals}`)
                    pairAmount = amount1Out * Number(`1e-${pairDecimals}`)

                // Buying the token
                } else {
                    tokenAmount = amount0Out * Number(`1e-${tokenDecimals}`)
                    pairAmount = amount1In * Number(`1e-${pairDecimals}`)
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
        return "Swap"
    }

    getName = () => {
        return "uniswap"
    }
}
