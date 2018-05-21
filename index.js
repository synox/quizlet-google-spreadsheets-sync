#!/usr/local/bin/node
'use strict';

const {google} = require('googleapis');
const fs = require('fs');
const request = require('request-promise-native');

let config = JSON.parse(fs.readFileSync('config.json'));
const sheet_id = config.sheet_id;
if (!sheet_id) {
    console.log('Please provide a sheet_id in config.json');
    process.exit(1);
}

const googleClientSecret = JSON.parse(fs.readFileSync('google_client_secret.json')).installed;
if (!googleClientSecret.client_id || !googleClientSecret.client_secret) {
    console.log('Please check credentials in google_client_secret.json');
    process.exit(1);
}

const quizletCredentials = JSON.parse(fs.readFileSync('quizlet_credentials.json'));
if (!quizletCredentials.access_token) {
    console.log('Please check credentials in quizlet_credentials.json');
    process.exit(1);
}


// Authorize google client library
const authClient = new google.auth.OAuth2(googleClientSecret.client_id, quizletCredentials.access_token);
authClient.credentials = JSON.parse(fs.readFileSync('google_credentials.json'));
google.options({auth: authClient});
const sheets = google.sheets('v4');

async function quizlet_get_setinfo(quizlet_set_id) {
    let httpResponse = await request.get({
        url: `https://api.quizlet.com/2.0/sets/${quizlet_set_id}`,
        headers: {
            Authorization: `Bearer ${quizletCredentials.access_token}`,
            'Content-Type': 'application/javascript'
        }
    });
    return JSON.parse(httpResponse);
}

async function quizlet_update_set(quizlet_set_name, set_data) {
    let httpResponseJson = await request.put({
        url: `https://api.quizlet.com/2.0/sets/${quizlet_set_name}`,
        headers: {
            Authorization: `Bearer ${quizletCredentials.access_token}`,
            'Content-Type': 'application/javascript'
        },
        form: set_data
    });
    return JSON.parse(httpResponseJson);
}

async function quizlet_create_set(quizlet_set_name, set_data) {
    let httpResponseJson = await request.post({
        url: `https://api.quizlet.com/2.0/sets`,
        headers: {
            Authorization: `Bearer ${quizletCredentials.access_token}`,
            'Content-Type': 'application/javascript'
        },
        form: set_data
    });
    return JSON.parse(httpResponseJson);
}

// Update a Quizlet set with the given data.
async function updateSet(quizlet_set_id, quizlet_set_name, data) {
    let set_data = {
        title: `${quizlet_set_name}`,
        whitespace: 1,
        lang_terms: config.quizlet_lang_terms,
        lang_definitions: config.quizlet_lang_definitions,
        visibility: config.quizlet_visibility,
    };


    Object.assign(set_data, data);
    console.log(`Updating set ${quizlet_set_id}: ${quizlet_set_name}`);
    try {
        let httpResponse = await quizlet_update_set(quizlet_set_id, set_data);
        console.log(`Updated set ${quizlet_set_id}`);
        return Promise.resolve(quizlet_set_id);
    } catch (statusCodeError) {
        if (statusCodeError.statusCode === 410 || statusCodeError.statusCode === 404) {
            // Create new set
            console.log(`Set ${quizlet_set_id} not found, creating new set`);
            let httpResponse = await quizlet_create_set(quizlet_set_name, set_data);
            let new_quizlet_set_id = httpResponse.id;
            console.log(`Created set ${new_quizlet_set_id}`);
            return Promise.resolve(new_quizlet_set_id);
        } else {
            throw statusCodeError;
        }
    }

}


async function getWordlistFromSheet(sheet) {
    const tab_id = sheet.properties.sheetId;
    const tab_name = sheet.properties.title;

    let range = `${tab_name}!${config.columns}`;
    console.log('fetching', range);
    const tableDataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheet_id,
        range: range
    });

    const rows = tableDataResponse.data.values || [];

    if (config.skip_first_row) {
        rows.shift();
    }

    return rows
        .filter(row => row[0] && row[1])
        .map(row => {
            return {
                term: row[0],
                definition: row[1]
            }

        });
}

async function copySheetToQuizlet(sheet, quizlet_set_id) {
    const wordList = await getWordlistFromSheet(sheet);

    const tab_name = sheet.properties.title;
    const quizlet_set_name = config.prefix + tab_name;

    let new_quizlet_set_id = updateSet(quizlet_set_id, quizlet_set_name, {
        definitions: wordList.map(i => i.definition),
        terms: wordList.map(i => i.term),
    });
    return await new_quizlet_set_id;
}

async function updateQuizletSetMetadata(sheet_id, quizlet_set_id) {
    let config = JSON.parse(fs.readFileSync('config.json'));
    config["quizlet_set_id"] = quizlet_set_id;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
}

async function main() {
    try {
        let response = await sheets.spreadsheets.get({spreadsheetId: sheet_id});
        let sheetsList = response.data.sheets;
        // TODO: run all sheets
        const firstSheet = sheetsList[0];
        const new_quizlet_set_id = await copySheetToQuizlet(firstSheet, config["quizlet_set_id"]);
        await updateQuizletSetMetadata(sheet_id, new_quizlet_set_id);
        console.log(`done`);
    } catch
        (reason) {
        console.log('error', reason);
        process.exit(1);
    }
}

main();
