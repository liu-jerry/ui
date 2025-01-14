import Ember from 'ember';

export default Ember.Route.extend({
  projects: Ember.inject.service(),
  k8s: Ember.inject.service(),

  beforeModel() {
    this._super(...arguments);
    var auth = this.modelFor('authenticated');
    return this.get('projects.current').checkForWaiting(auth.get('hosts'));
  },

  model() {
    var k8s = this.get('k8s');
    return Ember.RSVP.hash({
      namespaces: k8s.allNamespaces(),
      services: k8s.allServices(),
      rcs: k8s.allRCs(),
      pods: k8s.allPods(),
      containers: this.get('store').findAll('container'),
    }).then((hash) => {
      return k8s.selectNamespace().then(() => {
        k8s.setProperties(hash);
      });
    });
  },
});
