const fs = require('fs');
const path = require('path');
const winston = require('winston');


const directory = './logs';

// Create the directories if they don't exist
if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
}

// Define the transports for each directory
const transport1 = new winston.transports.File({
    filename: path.join(`${directory}/worker_${process.pid}_${Date.now()}.log`),
    handleExceptions: true,
});


// Create the logger and add the transports
const logger = winston.createLogger({
    transports: [
        transport1,
        new winston.transports.Console(),
    ],
});


module.exports = { logger };
