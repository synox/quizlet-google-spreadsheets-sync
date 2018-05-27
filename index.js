#!/usr/local/bin/node
'use strict';

const google_login = require('./google-auth');
const fs = require('fs');
const GoogleSheetsHelper = require('./sheets_client');
const QuizletClient = require('./quizlet_client');
let config = JSON.parse(fs.readFileSync('config.json'));
const sheets_document_id = config.sheet_id;
if (!sheets_document_id) {
    console.log('Please provide a sheets_document_id in config.json');
    process.exit(1);
}
let sheetsClient = null;

const quizletCredentials = JSON.parse(fs.readFileSync('quizlet_credentials.json'));
if (!quizletCredentials.access_token) {
    console.log('Please check credentials in quizlet_credentials.json');
    process.exit(1);
}
const quizletClient = new QuizletClient(quizletCredentials.access_token);


async function copySheetToQuizlet(sheet, quizlet_set_id) {
    const rows = await sheetsClient.getValues(sheets_document_id, sheet, config.columns);
    let wordList = mapWordList(rows);
    const quizlet_set_name = config.prefix + sheet.properties.title;
    let new_quizlet_set_id = await quizletClient.createOrUpdateSet(quizlet_set_id, quizlet_set_name,
        {
            definitions: wordList.map(i => i.definition),
            terms: wordList.map(i => i.term),
        },
        config.quizlet_lang_terms,
        config.quizlet_lang_definitions,
        config.quizlet_visibility);
    return new_quizlet_set_id;
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

async function updateQuizletSetMetadata(sheet_id, quizlet_set_id) {
    let config = JSON.parse(fs.readFileSync('config.json'));
    config["quizlet_set_id"] = quizlet_set_id;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
}


async function main() {
    try {
        let auth = await google_login();
        sheetsClient = new GoogleSheetsHelper(auth);

        let sheetsList = await sheetsClient.getTabs(sheets_document_id);
        // TODO: run all sheets, but first it must be possible to save quizlet_set_id for each sheet
        const firstSheet = sheetsList[0];
        const new_quizlet_set_id = await copySheetToQuizlet(firstSheet, config["quizlet_set_id"]);
        await updateQuizletSetMetadata(sheets_document_id, new_quizlet_set_id);
        console.log(`done`);
    } catch
        (reason) {
        console.log('error', reason);
        process.exit(1);
    }
}

main();
