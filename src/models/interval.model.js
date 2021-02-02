const mongoose = require("mongoose")
const { toJSON } = require('./plugins');

const intervalSchema = mongoose.Schema({
    interval:          { type: String, required: true },
    tradingview:       { type: Number, required: true },
    intervalInSeconds: { type: Number, required: true },
})

// add plugin that converts mongoose to json
intervalSchema.plugin(toJSON);

module.exports = mongoose.model("Interval", intervalSchema)
