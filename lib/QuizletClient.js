const request = require('request-promise-native');
const fs = require('fs');


class QuizletClient {

    constructor(credentials_file) {
        const quizletCredentials = JSON.parse(fs.readFileSync(credentials_file));
        if (!quizletCredentials.access_token) {
            throw new Error("Please check credentials in ${credentials_file}.")
        }

        this.access_token = quizletCredentials.access_token;
    }


    async _update_set(quizlet_set_name, set_data) {
        let httpResponseJson = await request.put({
            url: `https://api.quizlet.com/2.0/sets/${quizlet_set_name}`,
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'Content-Type': 'application/javascript'
            },
            form: set_data
        });
        return JSON.parse(httpResponseJson);
    }

    async create_set(quizlet_set_name, set_data) {
        let httpResponseJson = await request.post({
            url: `https://api.quizlet.com/2.0/sets`,
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'Content-Type': 'application/javascript'
            },
            form: set_data
        });
        return JSON.parse(httpResponseJson);
    }

    async get_set(quizlet_set_id) {
        let httpResponseJson = await request.get({
            url: `https://api.quizlet.com/2.0/sets/${quizlet_set_id}`,
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'Content-Type': 'application/javascript'
            }
        });
        return JSON.parse(httpResponseJson);
    }


    // Update a Quizlet set with the given data.
    async createOrUpdateSet(quizlet_set_id, quizlet_set_name, data, langTerms, langDefinitions, visibility) {
        let set_data = {
            title: `${quizlet_set_name}`,
            whitespace: 1,
            lang_terms: langTerms,
            lang_definitions: langDefinitions,
            visibility: visibility,
        };


        Object.assign(set_data, data);
        console.log(`Updating set ${quizlet_set_id}: ${quizlet_set_name}`);
        try {
            let httpResponse = await this._update_set(quizlet_set_id, set_data);
            console.log(`Updated set ${quizlet_set_id}`);
            return Promise.resolve(quizlet_set_id);
        } catch (statusCodeError) {
            if (statusCodeError.statusCode === 410 || statusCodeError.statusCode === 404) {
                // Create new set
                console.log(`Set ${quizlet_set_id} not found, creating new set`);
                let httpResponse = await this.create_set(quizlet_set_name, set_data);
                let new_quizlet_set_id = httpResponse.id;
                console.log(`Created set ${new_quizlet_set_id}`);
                return Promise.resolve(new_quizlet_set_id);
            } else {
                throw statusCodeError;
            }
        }

    }


}

module.exports = QuizletClient