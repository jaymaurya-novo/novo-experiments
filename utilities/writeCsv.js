const path = require('path');
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

function writeCsv({directory, fileName, header, data, append = false}) {
  const csvWriter = createCsvWriter({
    path: path.join(`${directory}/${fileName}`),
    header: header,
    append
  });

  csvWriter
    .writeRecords(data)
    .then(() => console.log(`The CSV file ${fileName} written successfully`))
    .catch((error) => console.error(`Error writing CSV file: ${error}`));
}

module.exports = { writeCsv };
