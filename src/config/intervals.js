module.exports = [
    // {
    //     interval: "1m",
    //     tradingview: 1,
    //     intervalInSeconds: 60,
    //     hour: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
    //     minute: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59 ],
    // },
    {
        interval: "5m",
        tradingview: 5,
        intervalInSeconds: 300,
        hour: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
        minute: [ 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 ],
    },
    {
        interval: "15m",
        tradingview: 15,
        intervalInSeconds: 900,
        hour: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
        minute: [ 0, 15, 30, 45]
    },
    {
        interval: "30m",
        tradingview: 30,
        intervalInSeconds: 1800,
        hour: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
        minute: [ 0, 30 ]
    },
    {
        interval: "1h",
        tradingview: 60,
        intervalInSeconds: 3600,
        hour: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
        minute: [ 0 ]
    },
    {
        interval: "4h",
        tradingview: 240,
        intervalInSeconds: 14400,
        hour: [ 0, 4, 8, 12, 16, 20 ],
        minute: [ 0 ]
    },
    {
        interval: "12h",
        tradingview: 720,
        intervalInSeconds: 43200,
        hour: [ 0, 12 ],
        minute: [ 0 ]
    },
    {
        interval: "1d",
        tradingview: 1440,
        intervalInSeconds: 86400,
        hour: [ 0 ],
        minute: [ 0 ]
    },
]
