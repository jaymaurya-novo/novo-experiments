'use strict';

const http = require('http');
const express = require('express');
const config = require('./configs/config.json');
const { logger } = require('./configs/logger.js');
const { sequelize } = require('./services/database/connection.js');

const app = express();

process.on('unhandledRejection', (ex) => {
    logger.error(`Uncaught Exception: ${ex.message}`, ex);
    throw ex;
});

process.on('uncaughtException', (ex) => {
    logger.error(`Uncaught Exception: ${ex.message}`, ex);
    process.exit(1);
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function logRequest(req, res, next) {
    logger.info(`[${process.pid}]: [${new Date()}], path: ${req.url}`);
    next();
}

app.get('/ping', logRequest, (req, res) => {
    res.send("pong");
});

const server = http.createServer(app);
const port = config.port;

(async () => {
    try {
        // Connect to the database
        await sequelize.authenticate();
        logger.info(`[${process.pid}]: Database connection successfully established`);

        // Start the server
        server.listen(port, () => {
            logger.info(`[${process.pid}]: Server is Listening on port ${port}...`);
        });

         // Run the script after the server starts
        await require('./scripts/index.js').run();
    } catch (error) {
        logger.error(`[${process.pid}]: Failed to start server: ${error.message}`);
        process.exit(1);
    }
})();

// Graceful shutdown
process.on('SIGINT', function () {
    server.close(() => {
        logger.info(`[${process.pid}]: Server closed mode on port ${port}...`);
        sleep(100).then(() => {
            process.exit(0);
        });
    });
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}