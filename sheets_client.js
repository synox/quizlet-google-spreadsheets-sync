const {google} = require('googleapis');

class GoogleSheetsHelper {

    constructor(auth) {
        this.auth = auth;
        google.options({auth: auth});
        this.sheets = google.sheets('v4');

    }


    async getTabs(sheet_id) {
        let response = await this.sheets.spreadsheets.get({spreadsheetId: sheet_id});
        return response.data.sheets;
    }

    async getValues(document_id, sheet, columns) {
        const tab_name = sheet.properties.title;
        let range = `${tab_name}!${columns}`;
        console.log('fetching', range);

        const tableDataResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: document_id,
            range: range
        });
        return tableDataResponse.data.values || [];
    }

}


module.exports = GoogleSheetsHelper;

