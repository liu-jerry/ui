import Ember from 'ember';
import C from 'ui/utils/constants';

export function normalizeName(str) {
  return str.replace(/\./g, C.SETTING.DOT_CHAR).toLowerCase();
}

export function denormalizeName(str) {
  return str.replace(new RegExp('['+C.SETTING.DOT_CHAR+']','g'),'.').toLowerCase();
}

export default Ember.Service.extend(Ember.Evented, {
  access: Ember.inject.service(),
  cookies: Ember.inject.service(),

  all: null,
  promiseCount: 0,

  init() {
    this._super();
    this.set('all', this.get('userStore').all('activesetting'));
  },

  unknownProperty(key) {
    var obj = this.findByName(key);
    if ( obj )
    {
      var val = obj.get('value');
      if ( val === 'false' )
      {
        return false;
      }
      else if ( val === 'true' )
      {
        return true;
      }
      else
      {
        return val;
      }
    }

    return null;
  },

  setUnknownProperty(key, value) {
    var obj = this.findByName(key);

    if ( value === undefined )
    {
      // Delete by set to undefined is not needed for settings
      throw new Error('Deleting settings is not supported');
    }

    if ( !obj )
    {
      obj = this.get('userStore').createRecord({
        type: 'setting',
        name: denormalizeName(key),
      });
    }

    this.incrementProperty('promiseCount');

    obj.set('value', value+''); // Values are all strings in settings.
    obj.save().then(() => {
      this.notifyPropertyChange(normalizeName(key));
    }).catch((err) => {
      console.log('Error saving setting:', err);
    }).finally(() => {
      this.decrementProperty('promiseCount');
    });

    return value;
  },

  promiseCountObserver: function() {

    if (this.get('promiseCount') <= 0) {
      this.trigger('settingsPromisesResolved');
    }
  }.observes('promiseCount'),

  findByName(name) {
    return this.get('asMap')[normalizeName(name)];
  },

  load(names) {
    if ( !Ember.isArray(names) ) {
      names = [names];
    }

    var userStore = this.get('userStore');

    var promise = new Ember.RSVP.Promise((resolve, reject) => {
      async.eachLimit(names, 3, function(name, cb) {
        userStore
          .find('setting', denormalizeName(name))
          .then(function() { cb(); })
          .catch(function(err) { cb(err); });
      }, function(err) {
        if ( err ) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return promise;
  },

  asMap: function() {
    var out = {};
    (this.get('all')||[]).forEach((setting) => {
      var name = normalizeName(setting.get('name'));
      out[name] = setting;
    });

    return out;
  }.property('all.@each.{name,value}'),

  uiVersion: function() {
    return 'v' + this.get('app.version');
  }.property('app.version'),

  issueUrl: function() {
    var str = '*Describe your issue here*\n\n\n---\n| Useful | Info |\n| :-- | :-- |\n' +
      `|Versions|Rancher \`${this.get('rancherVersion')||'-'}\` ` +
        `Cattle: \`${this.get('cattleVersion')||'-'}\` ` +
        `UI: \`${this.get('uiVersion')||'--'}\` |\n`;

      if ( this.get('access.enabled') )
      {
        str += `|Access|\`${this.get('access.provider').replace(/config/,'')}\` ${this.get('access.admin') ? '\`admin\`' : ''}|\n`;
      }
      else
      {
        str += '|Access|`Disabled`|\n';
      }

      str += `|Route|\`${this.get('app.currentRouteName')}\`|\n`;

    var url = C.EXT_REFERENCES.GITHUB + '/issues/new?body=' + encodeURIComponent(str);
    return url;
  }.property('app.currentRouteName','access.{provider,admin}','cattleVersion','rancherVersion','uiVersion'),

  rancherVersion: Ember.computed.alias(`asMap.${C.SETTING.VERSION_RANCHER}.value`),
  composeVersion: Ember.computed.alias(`asMap.${C.SETTING.VERSION_COMPOSE}.value`),
  cattleVersion: Ember.computed.alias(`asMap.${C.SETTING.VERSION_CATTLE}.value`),
  dockerMachineVersion: Ember.computed.alias(`asMap.${C.SETTING.VERSION_MACHINE}.value`),
  goMachineVersion: Ember.computed.alias(`asMap.${C.SETTING.VERSION_GMS}.value`),

  hasVm: Ember.computed.equal(`asMap.${C.SETTING.VM_ENABLED}.value`, 'true'),

  _plValue: function() {
    return this.get(`cookies.${C.COOKIE.PL}`) || '';
  }.property(`cookies.${C.COOKIE.PL}`),

  isRancher: function() {
    return this.get('_plValue').toUpperCase() === C.COOKIE.PL_RANCHER_VALUE.toUpperCase();
  }.property('_plValue'),

  appName: function() {
    if ( this.get('isRancher') )
    {
      return this.get('app.appName'); // Rancher
    }
    else
    {
      return this.get('_plValue');
    }
  }.property('isRancher','_plValue'),
});
