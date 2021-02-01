const mongoose = require("mongoose")
const { toJSON } = require('./plugins');

const poolSchema = mongoose.Schema({
      protocol:        { type: String, required: true },
      poolRatio:       { type: String, required: true },
      poolContract:    { type: String, required: true },
      poolABI:         { type: Object, required: true },

      tokenName:       { type: String, required: true },
      tokenDecimals:   { type: Number, required: true },
      tokenContract:   { type: String, required: true },
      pairName:        { type: String, required: true },
      pairDecimals:    { type: Number, required: true },
      pairContract:    { type: String, required: true },

      inversePrice:    { type: Boolean,required: true },
      fromBlock:       { type: Number, required: true }
})

const infoSchema = mongoose.Schema({
    pools:      { type: [ poolSchema ]},
    intervals:  { type: Array, default: [] },
    protocols:  { type: Array, default: [] },
})

// add plugin that converts mongoose to json
infoSchema.plugin(toJSON);

module.exports = mongoose.model("Info", infoSchema)
