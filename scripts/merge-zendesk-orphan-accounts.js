"use strict";

const { sequelize } = require("../models");
const fs = require("fs");
const { writeCsv } = require("../utilities/writeCsv");
const { limitedGetZendeskUserByEmail, limitedMergeUserOnZendesk, limitedSetEmailAsPrimaryEmail, limitedGetZendeskUserByZendeskId, limitedGetZendeskTickets } = require("../services/zendesk");
const config = require("../configs/config.json");
const { logger } = require("../configs/logger");
const models = require('../models');


const directory = "./files";
const fileName = `merge_zendesk_orphan_accounts_${Date.now()}.csv`;

const csvHeader = [
    { id: "Novo Email In Users Table", title: "Novo Email In Users Table" },
    { id: "Zendesk account Link associated with email in users table", title: "Zendesk account Link associated with email in users table" },
    { id: "Zendesk account external ID associated with email in users table", title: "Zendesk account external ID associated with email in users table" },
    { id: "Ticket count with current Novo Email", title: "Ticket count with current Novo Email" },
    { id: "Email listed in zendesk_users table for this user account", title: "Email listed in zendesk_users table for this user account" },
    { id: "Zendesk account Link associated with email in zendesk_users  table", title: "Zendesk account Link associated with email in zendesk_users  table" },
    { id: "Zendesk account external ID associated with email in zendesk_users  table", title: "Zendesk account external ID associated with email in zendesk_users  table" },
    { id: "Ticket count with zendesk_users Email", title: "Ticket count with zendesk_users Email" },
    { id: "Eligible for merge", title: "Eligible for merge" },
    { id: "Is merge successful", title: "Is merge successful" },
    { id: "Is primary updated on zendesk", title: "Is primary updated on zendesk" },
    { id: "Is primary updated on zendesk_users meta", title: "Is primary updated on zendesk_users meta" },
    { id: "Total ticket count after merge", title: "Total ticket count after merge" },
];

function updateNovoZendeskUser(zendeskUsr, zendeskUser) {

    const oldMeta = zendeskUsr.meta || {};

    /* Just to make sure we dont overwrite the old/existing meta */
    const dataToUpdate = { meta: { ...oldMeta, ...zendeskUser } };
    const zendeskId = zendeskUsr.id;

    return models.zendesk_users.update(dataToUpdate, { where: { id: zendeskId } }).catch((error) => {

        throw new Error('Could not update zendesk user', error);
    });
};

function getZendeskUserDetails(userId, options = {}) {

    const { raw = true, attributes } = options;

    return models.zendesk_users.findOne({ attributes, where: { user_id: userId }, raw });
}

async function run() {

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }

    let emailChangeCount = 0; // Number of users with diff emails in users and zendesk_users meta
    let orphanZendeskUsersCount = 0; // Count of orphan Zendesk users
    let oldZendeskUsersCount = 0; // Count of zendesk_users
    const csvData = [];

   const limit = 100;// const limit = 50; // Number of records per batch
    let offset = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
        const query = `
            SELECT
            u.id AS user_id, u.business_id AS user_business_id, u.email AS user_email,
            zu.zendesk_id, zu.business_id,
            jsonb_build_object('email', zu.meta->>'email', 'id', zu.meta->>'id') AS zendesk_user_meta
            FROM users u
            JOIN zendesk_users zu ON u.id = zu.user_id
            WHERE u.status = 'active' AND zu.meta->>'email' != u.email
            ORDER BY u.created_at ASC
            LIMIT :limit
            OFFSET :offset;
        `;

        const results = await sequelize.query(query, {
            replacements: { limit, offset },
            type: sequelize.QueryTypes.SELECT,
        });

        if (results.length > 0) {
            for (const result of results) {
                try {
                    const [zendeskOrphanUser, zendeskOldUser] = await Promise.all([
                        limitedGetZendeskUserByEmail(result.user_email, result.zendesk_id),
                        limitedGetZendeskUserByEmail(result.zendesk_user_meta.email, result.zendesk_user_meta.id),
                    ]);

                    const csvRow = {};

                    csvRow["Novo Email In Users Table"] = result.user_email;
                    csvRow["Email listed in zendesk_users table for this user account"] = result.zendesk_user_meta.email;
                    csvRow["Eligible for merge"] = "NO";
                    csvRow["Is merge successful"] = "NO";
                    csvRow["Is primary updated on zendesk"] = "NO";
                    csvRow["Is primary updated on zendesk_users meta"] = "NO";


                    if (zendeskOrphanUser && zendeskOrphanUser.id) {

                        if (zendeskOrphanUser.external_id === null) orphanZendeskUsersCount++;
                        csvRow["Zendesk account Link associated with email in users table"] = `${config.zendesk.url}agent/users/${zendeskOrphanUser.id}`;
                        csvRow["Zendesk account external ID associated with email in users table"] = zendeskOrphanUser.external_id || "NULL";

                        const zendeskOrphanUserTickets = await limitedGetZendeskTickets(zendeskOrphanUser.id);

                        if (!zendeskOrphanUserTickets || zendeskOrphanUserTickets?.error === "RecordNotFound") {
                        csvRow["Ticket count with current Novo Email"] = "RecordNotFound";
                        } else {
                        csvRow["Ticket count with current Novo Email"] = zendeskOrphanUserTickets?.next_page === null ? zendeskOrphanUserTickets.count : "More than 100";
                        }

                    } else {
                        csvRow["Zendesk account Link associated with email in users table"] = "NOT FOUND ON ZENDESK";
                        csvRow["Zendesk account external ID associated with email in users table"] = "NOT FOUND ON ZENDESK";
                    }

                    if (zendeskOldUser && zendeskOldUser.id) {
                        oldZendeskUsersCount++;
                        csvRow["Zendesk account Link associated with email in zendesk_users  table"] = `${config.zendesk.url}agent/users/${zendeskOldUser.id}`;
                        csvRow["Zendesk account external ID associated with email in zendesk_users  table"] = zendeskOldUser.external_id || "NULL";

                        const zendeskOldUserTickets = await limitedGetZendeskTickets(zendeskOldUser.id);

                        if (!zendeskOldUserTickets || zendeskOldUserTickets?.error === "RecordNotFound") {
                        csvRow["Ticket count with zendesk_users Email"] = "RecordNotFound";
                        } else {
                        csvRow["Ticket count with zendesk_users Email"] = zendeskOldUserTickets?.next_page === null ? zendeskOldUserTickets.count : "More than 100";
                        }

                    } else {
                        csvRow["Zendesk account Link associated with email in zendesk_users  table"] = "NOT FOUND ON ZENDESK";
                        csvRow["Zendesk account external ID associated with email in zendesk_users  table"] = "NOT FOUND ON ZENDESK";
                    }

                    const isCurrentAccountOrphan = zendeskOrphanUser && zendeskOrphanUser.id && zendeskOrphanUser.external_id === null;
                    const isOldAccountValid = zendeskOldUser && zendeskOldUser.id && zendeskOldUser.external_id !== null && typeof zendeskOldUser.external_id === 'string';

                    if (isCurrentAccountOrphan && isOldAccountValid) {
                        csvRow["Eligible for merge"] = "YES";

                        // merge
                        const isMerged = await limitedMergeUserOnZendesk(zendeskOrphanUser.id, result.zendesk_id);

                        if (isMerged) {
                            csvRow["Is merge successful"] = "YES";

                            const zendeskTicketsAfterMerge = await limitedGetZendeskTickets(result.zendesk_id);

                            if (!zendeskTicketsAfterMerge || zendeskTicketsAfterMerge?.error === "RecordNotFound") {
                            csvRow["Total ticket count after merge"] = "RecordNotFound";
                            } else {
                            csvRow["Total ticket count after merge"] = zendeskTicketsAfterMerge?.next_page === null ? zendeskTicketsAfterMerge.count : "More than 100";
                            }

                            // make current novo email primary on zendesk
                            let isPrimaryUpdated = await limitedSetEmailAsPrimaryEmail(result.zendesk_id, result.user_email);

                            while (!isPrimaryUpdated) {
                                isPrimaryUpdated = await limitedSetEmailAsPrimaryEmail(result.zendesk_id, result.user_email);
                            }

                            if (isPrimaryUpdated) {
                                csvRow["Is primary updated on zendesk"] = "YES";

                                const [updatedZendeskUser, zendeskUserDetails] = await Promise.all([
                                    await limitedGetZendeskUserByZendeskId(result.zendesk_id),
                                    await getZendeskUserDetails(result.user_id),
                                ]);

                                if (updatedZendeskUser === false) logger.error(`getZendeskUserByZendeskId, Could not get user details from zendesk, zendeskId: ${result.zendesk_id}, email: ${result.user_email}`);
                                if (!zendeskUserDetails) logger.error(`zendeskUserDetails_FAILED, Could not get zendesk user details from DB, zendeskId: ${result.zendesk_id}, email: ${result.user_email}`);

                                // update zendesk_users meta
                                if (updatedZendeskUser !== false && zendeskUserDetails) {
                                    updatedZendeskUser.email = result.user_email;
                                    const hasUpdated = await updateNovoZendeskUser(zendeskUserDetails, updatedZendeskUser);
                                    if (!hasUpdated) logger.error(`updateNovoZendeskUser_FAILED zendeskId: ${result.zendesk_id}, email: ${result.user_email}`);
                                    csvRow["Is primary updated on zendesk_users meta"] = hasUpdated ? "YES" : "NO";
                                }
                            }
                        }

                    }

                    if (zendeskOrphanUser || zendeskOldUser) {
                        csvData.push(csvRow);
                    }

                    console.log(
                        " orphan count ", orphanZendeskUsersCount,
                        " oldZendeskUsersCount ", oldZendeskUsersCount,
                        " csvData ", csvData.length,
                        "zendeskOldUser ", !!zendeskOldUser,
                    );
                } catch (error) {
                    console.log(error);
                }
            }

            emailChangeCount += results.length;
            offset += limit;

            console.log(
                "Fetched records: ", emailChangeCount,
                " orphan count ", orphanZendeskUsersCount,
                " oldZendeskUsersCount ", oldZendeskUsersCount,
            );
        } else {
            hasMoreRecords = false;
        }
    }

    writeCsv({ directory, fileName, header: csvHeader, data: csvData, append: false });
}

module.exports = { run };