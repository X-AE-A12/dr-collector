module.exports = class Candlestick {
    constructor(
        protocol,
        tokenName,
        pairName,
        poolContract,
        interval,
        blockNumber,
        time,
        open,
        high,
        low,
        close,
        quoteVolume
    ){

        if (![ "1m", "5m", "15m", "30m", "1h", "4h", "1d", "3d"].includes(interval)) {
            throw "Invalid candlestick interval: " + interval + " - " + JSON.stringify(Object.values(arguments))
        }

        // Simple time validation
        time = parseInt(time)
        if (time <= 631148400) {
            throw "Invalid candlestick time given: " + time + " - " + JSON.stringify(Object.values(arguments))
        }

        this.protocol = protocol
        this.tokenName = tokenName
        this.pairName = pairName
        this.poolContract = poolContract
        this.i = interval
        this.b = blockNumber // last recorded block for this candle (for backfill purposes)
        this.t = time
        this.o = open
        this.h = high
        this.l = low
        this.c = close
        this.v = quoteVolume
    }
}
