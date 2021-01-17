const mongoose = require('mongoose');
const express = require('express');

const config = require('./config/config');
const logger = require('./config/logger');
const main = require('./main')

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
    logger.info('Connected to MongoDB');

    const app = express();
    server = app.listen(config.port, () => {
        logger.info(`Listening to port ${config.port}`);
        main.initiate()
    });

});

const exitHandler = () => {
    if (server) {
        server.close(() => {
            logger.info('Server closed');
            process.exit(1);
        });
    } else {
        process.exit(1);
    }
};

const unexpectedErrorHandler = (error) => {
    logger.error(error);
    exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    if (server) {
        server.close();
    }
});
