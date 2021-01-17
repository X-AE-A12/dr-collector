const logger = require('./config/logger');
const pools = require('./config/pools')

const UniswapProtocol = require('./protocols/uniswap')
const BalancerProtocol = require('./protocols/balancer')

const getPoolManagerByProtocol= (protocolName) => {
    switch (protocolName) {
        case 'uniswap':
            return UniswapProtocol
        case 'balancer':
            logger.warn('Balancer is not activated yet.')
            return null
    }
}

function initiate() {
    pools.forEach((pool, i) => {
        logger.info(`Initiating ${pool.poolContract}`)
        let PoolManager = getPoolManagerByProtocol(pool.protocol)
        if (!PoolManager) return
        PoolManager = new PoolManager(pool)
        PoolManager.synchronize()
    });
}

module.exports = { initiate }
