# Dr. Collector
Candlestick aggregator for Registrar trades on various DEXs built on Ethereum.

## Warning
This is still a work in progress, so far we can only listen to & backfill transactions and store them in our database. I still need to write the workers that actually transforms those transactions into valid candlesticks!

#### Requirements
- MongoDB
- NodeJS

#### Setup
- Copy `env.example` and fill in the blanks. To use Quiknode you must have an account (there is no free plan, cheapest is 10$ a month). All other ETH Providers are not fit for the job as this requires heavy load upon synchronization (can take hundreds of thousands of transactions to fetch). Quicknode doesn't have a rate limit so processing time is in our favor.
- Alter config in `~/src/config/config` (perhaps the pollingEnabled & allowTransactionInsertion fields when testing)

#### How it Works
- Contracts that we intend to track are listed in `~/src/config/pools`
- Most logic is found in `~/src/protocols/master`. Each protocol (Uniswap, Balancer etc..) and its respective protocol tokens (UniswapV2Factory, BPT etc...) have different methods of emitting SWAP events. Master acts as a layer on top of these protocols and unifies their outputs.
- Upon start we need to synchronize the database first before we can even listen to new SWAP events.
- When it's done synchronizing (starting timestamp from which we can start syncing can either be an arbitrary block, the genesis block of a specific poolContract, or the blockNumber + 1 of the last recorded candle). After synchronization the polling events can be logged. All recorded transactions (whether backfill or polled) are stored in our database.
- TODO: this is not done yet. But, a seperate module transforms all these transactions into valid candlesticks (and subsequently clears the transactions database), so the transactions database is constantly aiming to be empty. The candlesticks database is, naturally, ever growing in size.
