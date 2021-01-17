const mongoose = require("mongoose")
const { toJSON } = require('./plugins');

const candlestickSchema = mongoose.Schema({
    protocol:       {type: String, required: true},
    tokenName:      {type: String, required: true},
    pairName:       {type: String, required: true},
    poolContract:   {type: String, required: true},
    i:              {type: String, required: true},
    b:              {type: Number, required: true},
    t:              {type: Number, required: true},   // open time
    o:              {type: Number, required: true},
    h:              {type: Number, required: true},
    l:              {type: Number, required: true},
    c:              {type: Number, required: true},
    v:              {type: Number, required: true},   // volume of quote asset [ BAL:WETH 50:50 => in WETH]
}, { timestamps: false })

candlestickSchema.index({
    protocol: 1,
    tokenName: 1,
    pairName: 1,
    poolContract: 1,
    i: 1,
}) // schema level

// add plugin that converts mongoose to json
candlestickSchema.plugin(toJSON);

module.exports = mongoose.model("Candlestick", candlestickSchema)
