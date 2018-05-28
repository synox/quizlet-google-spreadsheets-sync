const fs = require('fs');


class Config {

    constructor(conf_file) {
        this.config = JSON.parse(fs.readFileSync(conf_file));
        if (!this.getSheetsDocumentId()) {
            throw new Error('Please provide a sheets_document_id in config.json')
        }
    }

    getSheetsDocumentId() {
        return this.config.sheet_id;
    }

    getPrefix() {
        return this.config.prefix;
    }

    getColumns() {
        return this.config.columns;
    }

    getSkipFirstRow() {
        return this.config.skip_first_row;
    }

    getQuizletVisibility() {
        return this.config.quizlet_visibility;
    }

    getQuizletLangTerms() {
        return this.config.quizlet_lang_terms;
    }

    getQuizletLangDefinitions() {
        return this.config.quizlet_lang_definitions;
    }

    getQuizletSetId() {
        return this.config.quizlet_set_id;
    }

    setQuizletSetId(new_quizlet_set_id) {
        let config = JSON.parse(fs.readFileSync('config.json'));
        config["quizlet_set_id"] = new_quizlet_set_id;
        fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
        this.config = config;
    }

}


module.exports = Config;