module.exports = class Transaction {
    constructor(
        protocol,
        poolContract,
        timestamp,
        blockNumber,
        volume,
        price,
        logIndex,
    ){
        this.protocol = protocol
        this.poolContract = poolContract
        this.timestamp = timestamp
        this.blockNumber = blockNumber
        this.volume = volume
        this.price = price
        this.logIndex = logIndex
    }
}
