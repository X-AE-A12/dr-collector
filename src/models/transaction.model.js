const mongoose = require("mongoose")
const { toJSON } = require('./plugins');

const transactionSchema = mongoose.Schema({
    protocol:       {type: String, required: true},
    poolContract:   {type: String, required: true},
    timestamp:      {type: Number, required: true},
    blockNumber:    {type: Number, required: true},
    poolContract:   {type: String, required: true},
    volume:         {type: Number, required: true},
    price:          {type: Number, required: true},
    logIndex:       {type: Number, required: true},
}, { timestamps: true })

transactionSchema.index({
    protocol: 1,
    poolContract: 1,
    logIndex: 1,
}) // schema level

// add plugin that converts mongoose to json
transactionSchema.plugin(toJSON);

module.exports = mongoose.model("Transaction", transactionSchema)
