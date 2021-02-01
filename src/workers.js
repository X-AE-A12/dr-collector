const config = require('./config/config');
const logger = require('./config/logger');
const pools = require('./config/pools')

const { supportedProtocols, supportedIntervals } = config

const InfoModel = require("./models/info.model")

const initiate = () => {
    const { updateInfo } = config
    if (updateInfo) initUpdateInfo()
}

async function initUpdateInfo() {
    try {
        logger.info("worker:updateInfo deployed")
        await InfoModel.findOneAndUpdate({},{
            $set: {
                pools: pools,
                protocols: supportedProtocols,
                intervals: supportedIntervals
            }
        }, {
          new: true,
          upsert: true
        })
    } catch (err) {
        logger.error(err)
    }
} // End of initUpdateInfo()

module.exports = { initiate }
