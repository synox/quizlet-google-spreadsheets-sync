#!/usr/local/bin/node
'use strict';

const google_login = require('./lib/google-auth');

const GoogleSheetsHelper = require('./lib/GoogleSheetsClient');
const QuizletClient = require('./lib/QuizletClient');
const quizletClient = new QuizletClient('quizlet_credentials.json');

const Config = require('./lib/config');
const config = new Config('config.json');


async function copySheetToQuizlet(sheet, quizlet_set_id, sheetsClient) {
    const rows = await sheetsClient.getRows(config.getSheetsDocumentId(), sheet, config.getColumns());
    let wordList = mapWordList(rows);
    let newData = {
        definitions: wordList.map(i => i.definition),
        terms: wordList.map(i => i.term),
    };
    return await quizletClient.createOrUpdateSet(quizlet_set_id,
        config.getPrefix() + sheet.properties.title,
        newData, config.getQuizletLangTerms(), config.getQuizletLangDefinitions(), config.getQuizletVisibility());
}


function mapWordList(rows) {
    if (config.getSkipFirstRow()) {
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


async function main() {
    try {
        const sheetsClient = new GoogleSheetsHelper(await google_login('google_client_secret.json'));
        let sheetsList = await sheetsClient.getTabs(config.getSheetsDocumentId());
        // TODO: run all sheets, but first it must be possible to save quizlet_set_id for each sheet
        const firstSheet = sheetsList[0];
        const new_quizlet_set_id = await copySheetToQuizlet(firstSheet, config.getQuizletSetId(), sheetsClient);
        await config.setQuizletSetId(new_quizlet_set_id);
        process.exit(0);
    } catch
        (reason) {
        console.log('error', reason);
        process.exit(1);
    }
}

main();
