/*
 *
 *
 *
 * This is deprecated code, still needs rewriting for the candlestickBuilder module.
 *
 *
 *
 */

// const Events = require('events')
// const schedule = require("node-schedule")
// const { round } = require("@qc/date-round")
//
// const { supportedIntervals, intervalJobs } = require('./config/config')
// const EventEmitter = new Events()
//
// supportedIntervals.forEach((interval, i) => {
//     const rule = new schedule.RecurrenceRule()
//     rule.hour = intervalJobs[interval].hour
//     rule.minute = intervalJobs[interval].minute
//     const intervalInSeconds = intervalJobs[interval].intervalInSeconds
//
//     schedule.scheduleJob(rule, () => {
//         const now = Math.floor(Date.now() / 1000) // in seconds
//         const currentOpenTime = (round(now, intervalInSeconds).getTime())
//
//         EventEmitter.emit("candleClose", {
//             currentOpenTime: currentOpenTime,
//             nextOpenTime: currentOpenTime + intervalInSeconds
//         })
//     })
// })
//
// module.exports = EventEmitter
