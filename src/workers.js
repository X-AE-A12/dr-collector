const config = require('./config/config');
const logger = require('./config/logger');
const pools = require('./config/pools')

const { supportedProtocols, supportedIntervals } = config

const BalancerABI = require('./config/abi/balancer')
const UniswapABI = require('./config/abi/uniswap')

const IntervalModel = require("./models/interval.model")
const PoolModel = require("./models/pool.model")
const ProtocolModel = require("./models/protocol.model")

const initiate = () => {
    const { updateInfo } = config
    if (updateInfo) {
        updateIntervals()
        updatePools()
        updateProtocols()
    }
}

const getAbiByProtocol = (protocolName) => {
    switch (protocolName) {
        case 'uniswap':
            return UniswapABI
        case 'balancer':
            logger.warn('Balancer is not activated yet.')
            return null
    }
}

async function updateIntervals() {
    try {
        logger.info("worker:updateIntervals deployed")

        // Nuke database first (in case we removed intervals)
        await IntervalModel.deleteMany({})
        IntervalModel.insertMany(supportedIntervals)

    } catch (err) {
        logger.error(err)
    }
} // End of updateIntervals()

async function updatePools() {
    try {
        logger.info("worker:updatePools deployed")

        // Nuke database first (in case we removed pools)
        await PoolModel.deleteMany({})
        PoolModel.insertMany(pools)

    } catch (err) {
        logger.error(err)
    }
} // End of updatePools()

async function updateProtocols() {
    try {
        logger.info("worker:updateProtocols deployed")

        // Nuke database first (in case we removed contracts)
        await ProtocolModel.deleteMany({})

        supportedProtocols.forEach(protocol => {
            protocol['abi'] = getAbiByProtocol(protocol.value)
            let doc = protocol
            ProtocolModel.create(doc)
        });
    } catch (err) {
        logger.error(err)
    }
} // End of updateProtocols()

module.exports = { initiate }
