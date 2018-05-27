#!/usr/local/bin/node
'use strict';

const google_login = require('./google-auth');
const fs = require('fs');
const request = require('request-promise-native');
const GoogleSheetsHelper = require('./sheets_helper');
let config = JSON.parse(fs.readFileSync('config.json'));
const sheets_document_id = config.sheet_id;
if (!sheets_document_id) {
    console.log('Please provide a sheets_document_id in config.json');
    process.exit(1);
}

const quizletCredentials = JSON.parse(fs.readFileSync('quizlet_credentials.json'));
if (!quizletCredentials.access_token) {
    console.log('Please check credentials in quizlet_credentials.json');
    process.exit(1);
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


function mapWordList(rows) {
    if (config.skip_first_row) {
        rows.shift();
    }

    return rows.filter(row => row[0] && row[1])
        .map(row => {
            return {
                term: row[0],
                definition: row[1]
            }

        });
}

async function copySheetToQuizlet(mySheets, sheet, quizlet_set_id) {
    const rows = await mySheets.getValues(sheets_document_id, sheet, config.columns);
    let wordList = mapWordList(rows);
    const quizlet_set_name = config.prefix + sheet.properties.title;
    let new_quizlet_set_id = await updateSet(quizlet_set_id, quizlet_set_name, {
        definitions: wordList.map(i => i.definition),
        terms: wordList.map(i => i.term),
    });
    return new_quizlet_set_id;
}

async function updateQuizletSetMetadata(sheet_id, quizlet_set_id) {
    let config = JSON.parse(fs.readFileSync('config.json'));
    config["quizlet_set_id"] = quizlet_set_id;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
}


async function main() {
    try {
        let auth = await google_login();
        let mySheets = new GoogleSheetsHelper(auth);

        let sheetsList = await mySheets.getTabs(sheets_document_id);
        // TODO: run all sheets
        const firstSheet = sheetsList[0];
        const new_quizlet_set_id = await copySheetToQuizlet(mySheets, firstSheet, config["quizlet_set_id"]);
        await updateQuizletSetMetadata(sheets_document_id, new_quizlet_set_id);
        console.log(`done`);
    } catch
        (reason) {
        console.log('error', reason);
        process.exit(1);
    }
}

main();
