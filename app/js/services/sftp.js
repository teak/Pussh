const fs = require('fs');
const path = require('path');

const ssh = require('ssh2');

const ServiceSettings = require('../service-settings');

class Service extends ServiceSettings {
    constructor(pusshSettings) {
        super(pusshSettings, 'sftp');

        this.name = 'SFTP';
        this.description = 'Upload screenshots to a server via SFTP';

        this.settings = [
            {
                name: 'Hostname',
                key: 'hostname',
                type: 'text',
                password: false,
                default: '',
                helpText: 'The hostname or IP of the server'
            },
            {
                name: 'Port',
                key: 'port',
                type: 'text',
                password: false,
                default: 22,
                helpText: 'The port on the server to connect to'
            },
            {
                name: 'Path',
                key: 'path',
                type: 'text',
                password: false,
                default: '',
                helpText: 'The path to the directory to store screenshots'
            },
            {
                name: 'Username',
                key: 'username',
                type: 'text',
                password: false,
                default: '',
                helpText: 'The username you wish to authenticate as'
            },
            {
                name: 'Password',
                key: 'sftp_password',
                type: 'password',
                password: true,
                default: '',
                helpText: 'The password to login with'
            },
            {
                name: 'Private Key',
                key: 'sftp_private_key',
                type: 'textarea',
                password: true,
                default: '',
                helpText: '(optional) The SSH Private Key to login with'
            },
            {
                name: 'URL',
                key: 'url',
                type: 'text',
                password: false,
                default: '',
                helpText: 'The URL to the directory holding screenshots'
            }
        ];

        this.loadSettings();
    }

    upload(filePath, callback) {
        if (!this.getSetting('hostname')) return callback(new Error('No hostname configured for upload'));
        if (!this.getSetting('port')) return callback(new Error('No port configured for upload'));
        if (!this.getSetting('username')) return callback(new Error('No username configured for upload'));
        if (!this.getSetting('url')) return callback(new Error('No url configured for upload'));

        const conn = new ssh();
        conn.on('ready', () => {
            conn.sftp((err, sftp) => {
                if (err) {
                    conn.end();
                    return callback(new Error('Error connecting to server'));
                }

                const fileName = path.basename(filePath);

                sftp.fastPut(filePath, path.join(this.getSetting('path'), fileName), err => {
                    if (err) {
                        conn.end();
                        return callback(new Error('Error uploading to server'));
                    }

                    conn.end();
                    callback(null, this.getSetting('url') + encodeURIComponent(fileName));
                });
            });
        })
        .on('error', e => {
            conn.end();
            callback(e);
        })
        .connect({
            host: this.getSetting('hostname'),
            port: this.getSetting('port'),
            username: this.getSetting('username'),
            password: !this.getPassword('sftp_private_key') ? this.getPassword('sftp_password') : undefined,
            passphrase: this.getPassword('sftp_private_key') ? this.getPassword('sftp_password') : undefined,
            privateKey: this.getPassword('sftp_private_key') || undefined
        });
    }
}

module.exports = Service;
