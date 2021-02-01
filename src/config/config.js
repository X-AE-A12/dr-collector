const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

const intervals = require("./intervals")

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
      NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
      PORT: Joi.number().default(3000),
      MONGODB_URL: Joi.string().required().description('Mongo DB url'),
      QUIKNODE_API_KEY: Joi.string().required().description('Quiknode API KEY'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const self = module.exports = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    mongoose: {
        url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
        options: {
          useCreateIndex: true,
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useFindAndModify: false
        },
    },

    // network
    network: "homestead", // mainnet
    QUIKNODE_API_KEY: envVars.QUIKNODE_API_KEY,

    // dev config
    pollingEnabled:             true,
    allowTransactionInsertion:  true,
    allowCandlestickInsertion:  true,
    allowCandlestickDeletion:   false,
    modifyLiveCandles:          true,

    // workers
    enableWorkers:       true,
    updateInfo:          true,

    // even if there are NO pools we can still return these values
    // this config has no internal use, its only used for the external API.
    // internal use is simply by resolving files in the ~src/protocols dir
    supportedProtocols: [
        // {
        //   value: 'balancer',
        //   name: 'balancer',
        //   desc: 'balancer',
        //   type: "BalancerPoolTokens",
        // },
        {
          value: 'uniswap',
          name: 'uniswap',
          desc: 'uniswap',
          type: "UniswapV2Factory",
        },
    ],

    supportedIntervals: intervals

};
