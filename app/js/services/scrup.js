const fs = require('fs');
const path = require('path');

const request = require('request');

const ServiceSettings = require('../service-settings');

class Service extends ServiceSettings {
    constructor(pusshSettings) {
        super(pusshSettings, 'scrup');

        this.name = 'Scrup';
        this.description = 'Scrup compatible uploader';

        this.settings = [
            {
                name: 'Upload URL',
                key: 'upload_url',
                type: 'text',
                password: false,
                default: '',
                helpText: 'The URL to recieve the POST request'
            }
        ];

        this.loadSettings();
    }

    upload(filePath, callback) {
        if (!this.getSetting('upload_url')) return callback(new Error('No url configured for upload'));

        request.post({
            url: this.getSetting('upload_url'),
            body: fs.readFileSync(filePath)
        }, (err, res, body) => {
            if (err || !res || res.statusCode !== 200 || !body) {
                return callback(new Error(`HTTP error occurred: ${err ? err.message : `${response && response.statusCode} server response code`}`));
            }

            callback(null, body);
        });
    }
}

module.exports = Service;
