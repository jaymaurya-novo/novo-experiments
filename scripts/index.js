'use strict'

async function run() {
    // await require('./zendesk-orphan-users.js').run();
    // await require('./zendesk-orphan-users-updated.js').run();
    await require('./merge-zendesk-orphan-accounts.js').run();
}

module.exports = { run };