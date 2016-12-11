const app = require('electron').app;

const path = require('path');
const fs = require('fs');

const AutoLaunch = require('auto-launch');
const keytar = require('keytar');

const defaultSettingsPath = path.join(app.getAppPath(), 'settings.json');
const storagePath = path.join(app.getPath('userData'), 'settings.json');

class Settings {
    constructor() {
        this.name = app.getName();
        this.storagePath = storagePath;

        // prepopulate default settings on startup
        this.settings = require(defaultSettingsPath);

        this.keychain = keytar;
        this.autoLaunch = new AutoLaunch({
            name: this.name,
            path: app.getPath('exe').replace(new RegExp(`/Contents/MacOS/${this.name}$`, 'i'), '')
        });

        this.load(true);
    }

    load(sync=false) {
        if (sync) {
            try {
                this.settings = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
            } catch(error) {
                // file doesnt exist
            }
            return;
        }

        fs.readFile(this.storagePath, 'utf8', (error, data) => {
            if (error) return;

            this.settings = JSON.parse(data);
        });
    }

    save(sync=false) {
        if (sync) {
            fs.writeFileSync(this.storagePath, JSON.stringify(this.settings, null, 2), 'utf-8');
            return;
        }

        fs.writeFile(this.storagePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    }

    get(name) {
        return name ? this.settings[name] : this.settings;
    }

    set(name, value) {
        this.settings[name] = value;
    }

    getPassword(service) {
        return this.keychain.getPassword('pussh', service);
    }

    setPassword(service, password) {
        if (!password || password == '') {
            this.keychain.deletePassword('pussh', service);
        } else if (this.keychain.getPassword('pussh', service)) {
            this.keychain.replacePassword('pussh', service, password);
        } else {
            this.keychain.addPassword('pussh', service, password);
        }
    }

    setAutoLaunch(state) {
        this.autoLaunch.isEnabled().then(enabled => {
            if (enabled) {
                if (!state) this.autoLaunch.disable();
                return;
            }

            if (state) this.autoLaunch.enable();
        });
    }

    getAutoLaunch(callback) {
        this.autoLaunch.isEnabled().then(callback);
    }

    resetAll() {
        this.settings = require(defaultSettingsPath);
        this.setAutoLaunch(false);

        // todo reset passwords

        this.save(true);
    }
}

module.exports = Settings;
