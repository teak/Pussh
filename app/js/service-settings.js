class ServiceSettings {
    constructor(pusshSettings, name) {
        this._pusshSettings = pusshSettings;
        this._name = name;
    }

    saveSettings() {
        this.settings.forEach(option => {
            if (option.password) {
                this.setPassword(option.key, option.value);
            } else {
                this.setSetting(option.key, option.value);
            }
        });
    }

    getSettings() {
        return this.settings;
    }

    getSetting(key) {
        return this._pusshSettings.get(`${this._name}_${key}`);
    }

    setSetting(key, value) {
        return this._pusshSettings.set(`${this._name}_${key}`, value);
    }

    getPassword(key) {
        return this._pusshSettings.getPassword(`${this._name}_${key}`);
    }

    setPassword(key, password) {
        return this._pusshSettings.setPassword(`${this._name}_${key}`, password);
    }

    // Loads settings at service initialization
    loadSettings() {
        this.settings.forEach(option => {
            if(option.password) {
                option.value = this.getPassword(option.key);
            } else {
                option.value = this.getSetting(option.key) || option.default;
            }
        });
    }
}

module.exports = ServiceSettings;
