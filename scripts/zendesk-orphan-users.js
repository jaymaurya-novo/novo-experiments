"use strict";

const { users, zendesk_users, sequelize } = require("../models");
const fs = require("fs");
const { writeCsv } = require("../utilities/writeCsv");
const { getZendeskUserByZendeskId, getZendeskUserByEmail } = require("../services/zendesk");
const config = require("../configs/config.json");

const directory = "./files";
const fileName = `all_users_orphanZendeskUsers_${Date.now()}.csv`;

const csvHeader = [
    { id: "user_id", title: "user_id" },
    { id: "business_id", title: "business_id" },
    { id: "zendesk_id", title: "zendesk_id" },
    { id: "zendesk_user_meta_email", title: "zendesk_user_meta_email" },
    { id: "Novo Email", title: "Novo Email" },
    { id: "Zendesk account Link", title: "Zendesk account Link" },
    { id: "Zendesk account external ID", title: "Zendesk account external ID" },
    { id: "Zendesk orphan account email", title: "Zendesk orphan account email" },
    { id: "Zendesk orphan account link", title: "Zendesk orphan account link" },
    {
        id: "If CCd tickets for orphan account exists - Yes/No",
        title: "If CCd tickets for orphan account exists - Yes/No",
    },
];

async function run() {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }

    let emailChangeCount = 0; // Number of users with diff emails in users and zendesk_users meta
    let orphanZendeskUsersCount = 0; // Count of orphan Zendesk users
    const csvData = [];

    const limit = 50; // Number of records per batch
    let offset = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
        const query = `
            SELECT
            u.id AS user_id, u.business_id AS user_business_id, u.email AS user_email,
            zu.zendesk_id, zu.business_id,
            jsonb_build_object('email', zu.meta->>'email') AS zendesk_user_meta
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

        console.log("Fetched records: ", results.length);

        if (results.length > 0) {
            for (const result of results) {
                try {
                    const zendeskUser = await getZendeskUserByEmail(result.user_email);

                    if (zendeskUser && zendeskUser.external_id === null) {
                        orphanZendeskUsersCount += 1;
                        csvData.push({
                            "user_id": result.user_id,
                            "business_id": result.user_business_id,
                            "zendesk_id": result.zendesk_id,
                            "zendesk_user_meta_email": result.zendesk_user_meta.email,
                            "Novo Email": result.user_email,
                            "Zendesk account Link": `${config.zendesk.url}agent/users/${result.zendesk_id}`,
                            "Zendesk account external ID": zendeskUser.external_id,
                            "Zendesk orphan account email": zendeskUser.email,
                            "Zendesk orphan account link": `${config.zendesk.url}agent/users/${zendeskUser.id}`,
                            "If CCd tickets for orphan account exists - Yes/No": "",
                        });

                        console.log(
                            " orphan count ",
                            orphanZendeskUsersCount,
                            " csvData ", csvData.length
                        );
                    }
                } catch (error) {
                    console.log(error);
                }
            }

            emailChangeCount += results.length;
            offset += limit;

            console.log(
                "Fetched records: ",
                emailChangeCount,
                " orphan count ",
                orphanZendeskUsersCount
            );
        } else {
            hasMoreRecords = false;
        }
    }

    writeCsv({ directory, fileName, header: csvHeader, data: csvData, append: false });
}

module.exports = { run };