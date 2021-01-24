const EventEmitter = require('events')
const schedule = require("node-schedule")
const { round } = require("@qc/date-round")

const { supportedIntervals } = require('./config/config')
const logger = require("./config/logger")
const CandlestickTimer = new EventEmitter()

supportedIntervals.forEach((interval, i) => {
    const rule = new schedule.RecurrenceRule()
    rule.hour = interval.hour
    rule.minute = interval.minute
    const intervalInSeconds = interval.intervalInSeconds

    schedule.scheduleJob(rule, () => {
        const now = Math.floor(Date.now() / 1000) // in seconds
        const currentOpenTime = (round(now, intervalInSeconds).getTime())

        CandlestickTimer.emit("candlestickClose", {
            interval: interval.interval,
            intervalInSeconds: intervalInSeconds,
            previousOpenTime: currentOpenTime - intervalInSeconds,
            currentOpenTime: currentOpenTime,
        })
    })
})

module.exports = CandlestickTimer
