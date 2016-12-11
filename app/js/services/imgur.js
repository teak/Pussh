const fs = require('fs');
const path = require('path');

const request = require('request');

const ServiceSettings = require('../service-settings');

const ImgurClientID = 'b4723b6a37fa1bb';

class Service extends ServiceSettings {
    constructor(pusshSettings) {
        super(pusshSettings, 'imgur');

        this.name = 'Imgur';
        this.description = 'Share screenshots easily to Imgur.com';

        this.settings = [];
    }

    upload(filePath, callback) {
        fs.readFile(filePath, (err, data) => {
            if (err) return callback(err);

            request.post({
                url: 'https://api.imgur.com/3/upload',
                headers: {
                    'Authorization': `Client-ID ${ImgurClientID}`
                },
                form: {
                    type: 'base64',
                    image: new Buffer(data).toString('base64')
                },
                json: true
            }, (err, res, body) => {
                if (err || !res || res.statusCode !== 200 || !body) {
                    return callback(new Error(`HTTP error occurred: ${err ? err.message : `${response && response.statusCode} server response code`}`));
                }

                callback(null, body.data.link.replace(/^http:/,'https:'));
            });
        });
    }
}

module.exports = Service;
