const fs = require('fs');
const path = require('path');

const request = require('request');

const ServiceSettings = require('../service-settings');

class Service extends ServiceSettings {
    constructor(pusshSettings) {
        super(pusshSettings, 'post');

        this.name = 'HTTP POST';
        this.description = 'Upload screenshots to a server via HTTP POST';

        this.settings = [
            {
                name: 'Upload URL',
                key: 'upload_url',
                type: 'text',
                password: false,
                default: '',
                helpText: 'The URL to recieve the POST request'
            },
            {
                name: 'Form Field',
                key: 'form_field',
                type: 'text',
                password: false,
                default: 'screenshot',
                helpText: 'The name of the form field for the POST request'
            },
            {
                name: 'URL',
                key: 'url',
                type: 'text',
                password: false,
                default: '',
                helpText: 'The remote URL for your screenshots'
            },
            {
                name: 'Append File Extension',
                key: 'append_extension',
                type: 'checkbox',
                helpText: 'Remove the image extension from the URL. E.g. example.org/image.png -> example.org/image'
            }
        ];

        this.loadSettings();
    }

    upload(filePath, callback) {
        if (!this.getSetting('upload_url')) return callback(new Error('No upload url configured for upload'));
        if (!this.getSetting('form_field')) return callback(new Error('You must set a POST form field'));
        if (!this.getSetting('url')) return callback(new Error('No url configured'));

        request.post({
            url: this.getSetting('upload_url'),
            formData: {
                [this.getSetting('form_field')]: fs.createReadStream(filePath)
            }
        }, (err, response, body) => {
            if (err || !response || response.statusCode >= 300) {
                return callback(new Error(`HTTP error occurred: ${err ? err.message : `${response && response.statusCode} server response code`}`));
            }

            const fileName = this.getSetting('append_extension') ? path.basename(filepath) : path.basename(filepath).split('.')[0];
            callback(null, this.getSetting('url') + encodeURIComponent(fileName));
        });
    }
}

module.exports = Service;
