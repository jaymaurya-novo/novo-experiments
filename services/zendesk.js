"use strict";

const request = require('request');
const ZenDeskClient = require("zendesk-node-api");
const config = require("../configs/config.json");
const Bottleneck = require("bottleneck");

const zenDeskClient = new ZenDeskClient({
    url: config.zendesk.url,
    email: config.zendesk.email,
    token: config.zendesk.token,
});

const zendeskAuthorization = 'Basic ' + new Buffer(`${config.zendesk.email}/token:${config.zendesk.token}`).toString('base64');


function zendeskRequest(url, method, body, isJSON) {
  const options = {
    url,
    method,
    headers: { Authorization: zendeskAuthorization },
    ...(body && { body }),
    ...(isJSON && { json: true }),
  };

  return new Promise(function(resolve, reject){
    request(options, function(err, res, responseBody){
      if (err) { return reject(err); }
      return resolve(responseBody);
    });
  });
}

// Create a Bottleneck limiter
const limiter = new Bottleneck({
    minTime: 600, // Minimum time between requests (in milliseconds)
    maxConcurrent: 1, // Maximum number of concurrent requests
    reservoir: 100, // Number of requests that can be sent in a time window
    reservoirRefreshAmount: 100, // Number of requests to add to the reservoir
    reservoirRefreshInterval: 60 * 1000, // Time window (in milliseconds)
});

// Wrap the getZendeskUserByEmail function with the limiter
const limitedGetZendeskUserByEmail = limiter.wrap(getZendeskUserByEmail);


async function getZendeskUserByZendeskId(zendeskId) {
    const result = await zenDeskClient.users.show(zendeskId);

    return result;
}

async function getZendeskUserByEmail(email, zendeskId) {
//  Number of allowed API requests per minute exceeded
    const rawSearchResponse = await zendeskRequest(`${config.zendesk.url}/api/v2/search.json?query=email:${encodeURIComponent(email)}`, 'GET');

    if (!rawSearchResponse) { };

    const parsedSearchResponse = JSON.parse(rawSearchResponse);

    if (parsedSearchResponse.error) {};

    const searchResults = parsedSearchResponse.results;

    let existingUser = {};

    if (searchResults.length) {
    existingUser = searchResults.find((entry) => (entry.result_type === 'user' && (entry.email.toLowerCase() === email.toLowerCase() || entry.id.toString() === zendeskId.toString() )));
    }

    if (!existingUser || !existingUser.id) { };

    return existingUser;
}

module.exports = {
    getZendeskUserByZendeskId,
    limitedGetZendeskUserByEmail
};
