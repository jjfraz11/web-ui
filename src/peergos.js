var Filesystem      = require('./components/filesystem');
var Login           = require('./components/login');
var Signup          = require('./components/signup');
var Modal           = require('./components/modal');
var SharedWithModal = require('./components/shared-with-modal');
var Share           = require('./components/share');
var Message         = require('./components/message');
var Social          = require('./components/social');
var Gallery          = require('./components/gallery');
var Hex             = require('./components/viewers/hex');
var Text             = require('./components/viewers/text');
var Password        = require('./components/password');
var ProgressBar     = require('./components/progressbar');
var Prompt          = require('./components/prompt');
var Spinner          = require('./components/spinner');
var Error          = require('./components/error');

var VueAsyncComputed = require('./plugins/vue-async-computed');
Vue.use(VueAsyncComputed);
var VueTouch = require('./plugins/vue-touch')
VueTouch.registerCustomEvent('doubletap', {
    type: 'tap',
    taps: 2
})
Vue.use(VueTouch)

    // Loading components
    Vue.component('filesystem', Vue.extend(Filesystem));
    Vue.component('login', Vue.extend(Login));
    Vue.component('signup', Vue.extend(Signup));
    Vue.component('modal', Vue.extend(Modal));
    Vue.component('message', Vue.extend(Message));
    Vue.component('share-with', Vue.extend(Share));
    Vue.component('shared-with-modal', Vue.extend(SharedWithModal));
    Vue.component('social', Vue.extend(Social));
    Vue.component('gallery', Vue.extend(Gallery));
    Vue.component('hex', Vue.extend(Hex));
    Vue.component('text', Vue.extend(Text));
    Vue.component('password', Vue.extend(Password));
    Vue.component('progressbar', Vue.extend(ProgressBar));
    Vue.component('prompt', Vue.extend(Prompt));
    Vue.component('spinner', Vue.extend(Spinner));
    Vue.component('error', Vue.extend(Error));

    // Initializing Vue after GWT has finished
    setTimeout(function() {
        var vueRoot = new Vue({
            el: 'body',
            data: {
                currentView: 'login',
                serverPort: 8000
            },
            events: {
                'child-msg': function (msg) {
                    // `this` in event callbacks are automatically bound
                    // to the instance that registered it
                    this.currentView = msg.view;

                    // this sends the received props to the new child component
                    this.$nextTick(function() {
                        this.$broadcast('parent-msg', msg.props);
                    });
                }
            }
        });
    }, 500);
