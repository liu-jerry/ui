import Ember from 'ember';
import C from 'ui/utils/constants';
import {get as getTree} from 'ui/utils/navigation-tree';

function fnOrValue(val, ctx) {
  if ( typeof val === 'function' )
  {
    return val.call(ctx);
  }
  else
  {
    return val;
  }
}


export default Ember.Component.extend({
  // Inputs
  hasCattleSystem: null,
  currentPath: null,

  // Injections
  projects         : Ember.inject.service(),
  project          : Ember.computed.alias('projects.current'),
  k8s              : Ember.inject.service(),
  namespace        : Ember.computed.alias('k8s.namespace'),
  projectId        : Ember.computed.alias(`tab-session.${C.TABSESSION.PROJECT}`),
  namespaceId      : Ember.computed.alias('k8s.namespace.id'),
  settings         : Ember.inject.service(),
  access           : Ember.inject.service(),
  isAdmin          : Ember.computed.alias('access.admin'),

  // Component options
  tagName          : 'header',
  classNames       : ['clearfix','no-select'],

  actions: {
    switchProject(id) {
      this.sendAction('switchProject', id);
    },

    switchNamespace(id) {
      this.sendAction('switchNamespace', id);
    },
  },

  didInitAttrs() {
    this._super();
    this.updateNavTree();
  },

  // This computed property generates the active list of choices to display
  navTree: null,
  updateNavTree() {
    let out = getTree().filter((item) => {
      if ( typeof item.condition === 'function' )
      {
        if ( !item.condition.call(this) )
        {
          return false;
        }
      }

      item.label = fnOrValue(item.label, this);
      item.route = fnOrValue(item.route, this);
      item.ctx = (item.ctx||[]).map((prop) => {
        return fnOrValue(prop, this);
      });
      item.submenu = fnOrValue(item.submenu, this);

      item.submenu = (item.submenu||[]).filter((subitem) => {
        if ( typeof subitem.condition === 'function' )
        {
          return subitem.condition.call(this);
        }

        subitem.label = fnOrValue(subitem.label, this);
        subitem.route = fnOrValue(subitem.route, this);
        subitem.ctx = (subitem.ctx||[]).map((prop) => {
          return fnOrValue(prop, this);
        });

        return true;
      });

      return true;
    });

    this.set('navTree', out);
  },

  shouldUpdateNavTree: function() {
    Ember.run.once(this, 'updateNavTree');
  }.observes('currentPath','project.orchestrationState','projectId','namespaceId',`settings.${C.SETTING.CATALOG_URL}`,'settings.hasVm','isAdmin'),

  // Utilities you can use in the condition() function to decide if an item is shown or hidden,
  // beyond things listed in "Inputs"
  pathIs(prefix) {
    return this.get('currentPath').indexOf(prefix) === 0;
  },

  hasProject: function() {
    return !!this.get('project');
  }.property('project'),

  hasSwarm:       Ember.computed.alias('project.orchestrationState.hasSwarm'),
  hasKubernetes:  Ember.computed.alias('project.orchestrationState.hasKubernetes'),
  hasMesos:       Ember.computed.alias('project.orchestrationState.hasMesos'),

  kubernetesReady: function() {
    return this.get('hasKubernetes') &&
    this.get('project.orchestrationState.kubernetesReady') &&
    this.get('namespaceId');
  }.property('hasKubernetes','project.orchestrationState.kubernetesReady','namespaceId'),
});
