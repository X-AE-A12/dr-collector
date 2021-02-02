const mongoose = require("mongoose")
const { toJSON } = require('./plugins');

const protocolSchema = mongoose.Schema({
    value:  { type: String, required: true },
    name:   { type: String, required: true },
    desc:   { type: String, required: true },
    type:   { type: String, required: true },
    abi:    { type: Array,  required: true },
})

// add plugin that converts mongoose to json
protocolSchema.plugin(toJSON);

module.exports = mongoose.model("Protocol", protocolSchema)
