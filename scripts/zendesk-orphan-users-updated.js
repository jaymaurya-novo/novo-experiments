"use strict";

const { users, zendesk_users, sequelize } = require("../models");
const fs = require("fs");
const { writeCsv } = require("../utilities/writeCsv");
const { limitedGetZendeskUserByEmail } = require("../services/zendesk");
const config = require("../configs/config.json");

const directory = "./files";
const fileName = `orphanZendeskUsers_updated_${Date.now()}.csv`;

const csvHeader = [
    { id: "Novo Email In Users Table", title: "Novo Email In Users Table" },
    { id: "Zendesk account Link associated with email in users table", title: "Zendesk account Link associated with email in users table" },
    { id: "Zendesk account external ID associated with email in users table", title: "Zendesk account external ID associated with email in users table" },
    { id: "Email listed in zendesk_users table for this user account", title: "Email listed in zendesk_users table for this user account" },
    { id: "Zendesk account Link associated with email in zendesk_users  table", title: "Zendesk account Link associated with email in zendesk_users  table" },
    { id: "Zendesk account external ID associated with email in zendesk_users  table", title: "Zendesk account external ID associated with email in zendesk_users  table" }
];

async function run() {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }

    let emailChangeCount = 0; // Number of users with diff emails in users and zendesk_users meta
    let orphanZendeskUsersCount = 0; // Count of orphan Zendesk users
    let oldZendeskUsersCount = 0; // Count of zendesk_users
    const csvData = [];

    const limit = 50; // Number of records per batch
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
                        limitedGetZendeskUserByEmail(result.zendesk_user_meta.email, result.zendesk_user_meta.id)
                    ]);

                    const csvRow = {};

                    csvRow["Novo Email In Users Table"] = result.user_email;
                    csvRow["Email listed in zendesk_users table for this user account"] = result.zendesk_user_meta.email;

                    if (zendeskOrphanUser && zendeskOrphanUser.id) {

                            if(zendeskOrphanUser.external_id === null) orphanZendeskUsersCount++;
                            csvRow["Zendesk account Link associated with email in users table"] = `${config.zendesk.url}agent/users/${zendeskOrphanUser.id}`;
                            csvRow["Zendesk account external ID associated with email in users table"] = zendeskOrphanUser.external_id || "NULL";

                    } else {
                        csvRow["Zendesk account Link associated with email in users table"] = "NOT FOUND ON ZENDESK";
                        csvRow["Zendesk account external ID associated with email in users table"] = "NOT FOUND ON ZENDESK";
                    }

                    if (zendeskOldUser && zendeskOldUser.id) {
                            oldZendeskUsersCount++;
                            csvRow["Zendesk account Link associated with email in zendesk_users  table"] = `${config.zendesk.url}agent/users/${zendeskOldUser.id}`;
                            csvRow["Zendesk account external ID associated with email in zendesk_users  table"] = zendeskOldUser.external_id || "NULL";
                    } else {
                        csvRow["Zendesk account Link associated with email in zendesk_users  table"] = "NOT FOUND ON ZENDESK";
                        csvRow["Zendesk account external ID associated with email in zendesk_users  table"] = "NOT FOUND ON ZENDESK";
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