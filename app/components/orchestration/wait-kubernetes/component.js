import Ember from 'ember';
import { debouncedObserver } from 'ui/utils/debounce';

export default Ember.Component.extend({
  k8s: Ember.inject.service(),
  settings: Ember.inject.service(),

  timer: null,
  currentStep: 0,

  didInitAttrs() {
    this.updateStep();
  },

  willDestroyElement() {
    Ember.run.cancel(this.get('timer'));
  },

  steps: [
    'Add at least one host',
    'Waiting for a host to be active',
    'Creating Kubernetes system stack',
    'Starting services',
    'Waiting for Kubernetes API',
    'Creating Namespace',
  ],

  updateStep: debouncedObserver('model.hosts.@each.state','model.stacks.@each.{state,externalId}', function() {
    if ( (this.get('model.hosts.length') + this.get('model.machines.length')) === 0 )
    {
      this.set('currentStep', 0);
      return;
    }

    if ( this.get('model.hosts').filterBy('state','active').get('length') === 0 )
    {
      this.set('currentStep', 1);
      return;
    }

    var stack = this.get('model.stacks').filterBy('externalId','system://kubernetes')[0];
    if ( !stack )
    {
      this.set('currentStep', 2);
      return;
    }

    if ( stack.get('state') !== 'active' )
    {
      if ( stack.get('state') === 'inactive' )
      {
        stack.doAction('activate');
      }

      this.set('currentStep', 3);
      return;
    }

    var services = this.get('model.services').filterBy('environmentId', stack.get('id'));
    var num = services.get('length');
    var active = services.filterBy('state','active').get('length');
    if ( num === 0 || active < num )
    {
      this.set('currentStep', 3);
      return;
    }

    this.set('currentStep', 4);
    this.get('k8s').isReady().then((ready) => {
      if ( ready )
      {
        this.get('k8s').getNamespace('default',true).then(() => {
          this.set('currentStep', 6);
        }).catch(() => {
          this.set('currentStep', 5);
          reschedule();
        });
      }
      else
      {
        reschedule();
      }
    }).catch(() => {
      reschedule();
    });

    var self = this;
    function reschedule() {
      self.set('timer', Ember.run.later(self, 'updateStep', 5000));
    }
  }),

  stepChanged: function(){
    if ( this.get('currentStep') >= this.get('steps.length') )
    {
      this.sendAction('ready');
    }
  }.observes('currentStep','steps.length'),
});
