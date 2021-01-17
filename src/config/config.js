const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
      NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
      PORT: Joi.number().default(3000),
      MONGODB_URL: Joi.string().required().description('Mongo DB url'),
      ALCHEMY_API_KEY: Joi.string().required().description('Alchemy API KEY'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    mongoose: {
        url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
        options: {
          useCreateIndex: true,
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
    },

    // network
    network: "homestead", // mainnet
    ALCHEMY_API_KEY: envVars.ALCHEMY_API_KEY,
    // INFURA_PROJECT_ID: process.env.INFURA_PROJECT_ID,
    // INFURA_PROJECT_SECRET: process.env.INFURA_PROJECT_SECRET,

    // dev config
    pollingEnabled:       false,
    insertCandles:        true,
    deleteCandles:        false,
    modifyLiveCandles:    false,

    // workers
    enableWorkers:       false,
    updateInfo:          false,

    // exchanges (supported is used internally, api is used by Tradingview
    // even if there are NO pools we can still return these values
    supportedExchanges: [ "balancer", "uniswap" ],
    supportedExchangesAPI: [
        {
          value: 'balancer',
          name: 'balancer',
          desc: 'balancer',
          type: "BalancerPoolTokens",
        },
        {
          value: 'uniswap',
          name: 'uniswap',
          desc: 'uniswap',
          type: "UniswapV2Factory",
        },
    ],

    // intervals (supported is used internally, api is for Tradingview to use)
    // supported_intervals: [ "1m", "5m", "15m", "30m", "1h", "4h", "1d" ],
    supportedIntervals: [ "1m" ],
    supportedIntervalsAPI: [
        { tv: "1", api: "1m" },
        { tv: "5", api: "5m" },
        { tv: "15", api: "15m" },
        { tv: "30", api: "30m" },
        { tv: "60", api: "1h" },
        { tv: "240", api: "4h" },
        { tv: "1440", api: "1d" },
    ],

    // config for the listener schedule (when a candle should close)
    intervalJobs: require("./intervalJobs"),

};
