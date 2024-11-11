"use strict";

const request = require('request');
const ZenDeskClient = require("zendesk-node-api");
const config = require("../configs/config.json");
const Bottleneck = require("bottleneck");
const { logger } = require('../configs/logger');

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

// Wrap functions with the limiter
const limitedGetZendeskUserByEmail = limiter.wrap(getZendeskUserByEmail);
const limitedMergeUserOnZendesk = limiter.wrap(mergeUserOnZendesk);
const limitedSetEmailAsPrimaryEmail = limiter.wrap(setEmailAsPrimaryEmail);
const limitedGetZendeskUserByZendeskId = limiter.wrap(getZendeskUserByZendeskId);
const limitedGetZendeskTickets = limiter.wrap(getZendeskTickets);


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

async function mergeUserOnZendesk(existingUserId, zendeskId) {
  try {
    const parsedMergeResponse = await zendeskRequest(`${config.zendesk.url}/api/v2/users/${existingUserId}/merge.json`, 'PUT', { user: { id: zendeskId } }, true);
    if (!parsedMergeResponse || !parsedMergeResponse.user || !parsedMergeResponse.user.id || parsedMergeResponse.user.id.toString() !== zendeskId.toString()) {
      logger.error(`mergeUserOnZendesk_FAILED orphanZendeskId: ${existingUserId}, oldZendeskId: ${zendeskId}, error: ${JSON.stringify(parsedMergeResponse)}`);
      return false;
    }

    return parsedMergeResponse.user.external_id !== null && typeof parsedMergeResponse.user.external_id === 'string';
  } catch (error) {
    logger.error(`mergeUserOnZendesk_FAILED orphanZendeskId: ${existingUserId}, oldZendeskId: ${zendeskId}, error: ${JSON.stringify(error)}`);
    return false;
  }
}

async function setEmailAsPrimaryEmail(zendeskId, email) {

  try {
    /* First get all identities */
    const identitiesData = await zendeskRequest(`${config.zendesk.url}/api/v2/users/${zendeskId}/identities.json`, 'GET');

    if (!identitiesData) {
      logger.error(`setEmailAsPrimaryEmail -> Could not get zendesk identities of this user. zendeskId: ${zendeskId}, email: ${email}, identitiesData: ${JSON.stringify(identitiesData)}`);
      return false;
    }

    const parsedResponse = JSON.parse(identitiesData);

    const mappedIdentity = parsedResponse.identities.find(data => (data.type === 'email' && data.value === email.toLowerCase()));

    /* First check this email was not primary email */
    if (mappedIdentity.primary === true) return true;

    /* Now make this email as primary email */
    const response = await zendeskRequest(`${config.zendesk.url}/api/v2/users/${zendeskId}/identities/${mappedIdentity.id}/make_primary.json`, 'PUT');
    if (!response) {
      logger.error(`setEmailAsPrimaryEmail -> Could not update email of zendesk user. zendeskId: ${zendeskId}, email: ${email}, identitiesData: ${JSON.stringify(response)}`);
      return false;
    }

    const parsedIdentityResponse = JSON.parse(response);
    const mappedIdentityResponse = parsedIdentityResponse.identities.find(data => (data.type === 'email' && data.value === email.toLowerCase()));
    return mappedIdentityResponse.primary === true;
  } catch (error) {
    logger.error(`setEmailAsPrimaryEmail_FAILED zendeskId: ${zendeskId}, email: ${email}, error: ${JSON.stringify(error)}`);
    return false;
  }
}

async function getZendeskUserByZendeskId(zenDeskId) {

  const result = await zenDeskClient.users.show(zenDeskId);

  if (result.error) return false;

  return result;
}

async function getZendeskTickets(zendeskUserId) {
  const result = await zendeskRequest(`${config.zendesk.url}/api/v2/users/${zendeskUserId}/tickets/requested.json`, 'GET');

  return JSON.parse(result);
}

module.exports = {
  limitedGetZendeskUserByZendeskId,
  limitedGetZendeskUserByEmail,
  limitedMergeUserOnZendesk,
  limitedSetEmailAsPrimaryEmail,
  limitedGetZendeskTickets
};
