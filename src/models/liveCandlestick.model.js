const mongoose = require("mongoose")
const { toJSON } = require('./plugins');

const liveCandlestickSchema = mongoose.Schema({
    poolContract:   {type: String, required: true},
    interval:       {type: String, required: true},
    t:              {type: Number, required: true},   // open time
    o:              {type: Number, required: true},
    h:              {type: Number, required: true},
    l:              {type: Number, required: true},
    c:              {type: Number, required: true},
    v:              {type: Number, required: true},   // volume of quote asset [ BAL:WETH 50:50 => in WETH]
}, { timestamps: false })

liveCandlestickSchema.index({
    poolContract: 1,
    interval: 1,
}) // schema level

// add plugin that converts mongoose to json
liveCandlestickSchema.plugin(toJSON);

module.exports = mongoose.model("LiveCandlestick", liveCandlestickSchema)
