const fs = require('fs');
const path = require('path');
const url = require('url');

const ServiceSettings = require('../service-settings');

class Service extends ServiceSettings {
    constructor(pusshSettings) {
        super(pusshSettings, 'local_transfer');

        this.name = 'Local Filesystem';
        this.description = 'Move screenshots to a directory other then the desktop';

        this.settings = [
            {
                name: 'Location',
                key: 'location',
                type: 'text',
                password: false,
                default: '',
                helpText: 'Move new screenshots to this directory'
            }
        ];

        this.loadSettings();
    }

    upload(file, callback) {
        if (!this.getSetting('location')) return callback(new Error('No location configured'));

        const newFile = path.join(this.getSetting('location'), path.basename(file));

        fs.writeFileSync(newFile, fs.readFileSync(file));

        callback(null, url.resolve('file://', newFile));
    }
}

module.exports = Service;
