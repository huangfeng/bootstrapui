(function (toolkit, $) {

    $.fn.on.proxy = function (event, selector, callback) {
        if (!callback) {
            if (!selector || !$.isFunction(selector)) {
                callback = function () {};
            } else if ($.isFunction (selector)) {
                callback = selector;
            }
            selector = "*";
        }
        var $this = $(this);
        $this.on(event, function (event) {
            var args = arguments;
            $(event.target).filter(selector).each(function () {
                callback.apply(this, args);
            });
        });
        return $this;
    };

    $.fn.on.forward = function (proxy, event, _) {
        var $this = $(this);
        var events = arguments;
        $this.each(function () {
            var target = $(this);
            $(events).each(function (index) {
                if (index == 0) {
                    return;
                }
                target.on(this, function () {
                    var args = [];
                    var event = arguments[0];
                    if (arguments.length > 1) {
                        for (var i = 1; i < arguments.length; i ++) {
                            args.push(arguments[i]);
                        }
                    }
                    console.error(proxy.jquery);
                    $(proxy).trigger(event, args);
                });
            });
        });
        return $this;
    };

    var init = function (prefix, registryCallback) {
        if (!registryCallback) {
            registryCallback = function (name, item) {
                toolkit.tools.console.log("Registering item " + name + " of type " + item.getType());
            };
        }
        if (!toolkit.ext[prefix]) {
            toolkit.ext[prefix] = {};
        }
        toolkit.ext[prefix].define = function (definition) {
            definition = $.extend(definition, {
                getType: function () {
                    return prefix;
                }
            });
            definition.templateLoader = $.Deferred();
            definition.templateAvailable = $.Deferred();
            if (definition.templateUrl) {
                definition.templateUrl = toolkit.config.base + "/" + toolkit.config.templateBase + "/" + toolkit.config.form.base + "/" + definition.templateUrl + ".html"
            } else {
                definition.templateLoader.reject();
                definition.templateAvailable.reject();
            }
            if (!definition.link) {
                definition.link = function () {};
            }
            if ($.isFunction(definition.link)) {
                definition.link = {
                    post: definition.link
                };
            }
            if (!definition.link.pre || !$.isFunction(definition.link.pre)) {
                definition.link.pre = function () {};
            }
            if (!definition.link.post || !$.isFunction(definition.link.post)) {
                definition.link.post = function () {};
            }
            if (!definition.controller || !$.isFunction(definition.controller)) {
                definition.controller = function () {};
            }
            return definition;
        };
        toolkit.preloader.qualifiers[prefix] = function (name) {
            return toolkit.config.base + "/" + toolkit.config.directivesBase + "/" + toolkit.config.form.base + "/" + name.replace(new RegExp("^" + prefix + "\\."), "") + ".js";
        };
        toolkit.preloader[prefix] = function (name, _) {
            if (arguments.length > 1) {
                $(arguments).each(function () {
                    toolkit.preloader[prefix](this);
                });
            } else if ($.isArray(name)) {
                $(name).each(function () {
                    toolkit.preloader[prefix](this);
                });
            } else {
                toolkit.preloader.add({
                    name: prefix + "." + name,
                    type: prefix
                });
            }
            return toolkit.preloader;
        };
        toolkit.types[prefix] = registryCallback;
    };
    var configure = function () {
        if (!toolkit.config.form) {
            toolkit.config.form = {};
        }
        if (typeof toolkit.config.form.preloadAll == "undefined") {
            toolkit.config.form.preloadAll = toolkit.config.preloadAll;
        }
        if (!toolkit.config.form.base) {
            toolkit.config.form.base = "form";
        }
        if (!toolkit.config.form.components) {
            toolkit.config.form.components = [];
        }
    };
    var load = function (prefix, defaultComponents) {
        var loaded = $.Deferred();
        if (toolkit.config.form.preloadAll) {
            toolkit.preloader[prefix](defaultComponents);
        }
        toolkit.preloader.load(prefix + ".*")
            .done(function (acceptance) {
                loaded.resolve(acceptance);
            })
            .fail(function (rejection) {
                loaded.reject(rejection);
                toolkit.tools.console.error("Some form components did not load properly");
                toolkit.tools.console.error(rejection);
            });
        return loaded.promise();
    };
    configure();
    toolkit.register("form", function (registry) {
        registry.formContainer = new toolkit.classes.Directive("1.0", "form-container", function () {
            return {
                restrict: "E",
                transclude: true,
                replace: true,
                templateUrl: registry.formContainer.templateUrl,
                scope: {
                    orientation: "@",
                    labelSize: "@"
                },
                controller: function ($scope) {
                    this.$scope = $scope;
                    if (!$scope.labelSize) {
                        $scope.labelSize = 3;
                    }
                    if (!$scope.orientation) {
                        $scope.orientation = "vertical";
                    }
                    $scope.labelSize = parseInt($scope.labelSize);
                }
            };
        });
        toolkit.ext.formInput = {
            components: {}
        };
        registry.formInput = new toolkit.classes.Directive("1.0", "form-placeholder", function ($compile, $http, $templateCache) {
            var renderQueue = {
                requests: {},
                timeouts: {},
                notify: function (type) {
                    if (!renderQueue.requests[type]) {
                        return;
                    }
                    if (renderQueue.timeouts[type]) {
                        clearTimeout(renderQueue.timeouts[type]);
                    }
                    var queue = renderQueue.requests[type];
                    toolkit.tools.console.debug("Running actions associated with component type <" + type + "/>");
                    delete renderQueue.requests[type];
                    for (var i = 0; i < queue.length; i++) {
                        var func = queue[i];
                        func.postpone();
                    }
                },
                perform: function (type, action) {
                    if (toolkit.ext.formInput.components[type]) {
                        action.postpone();
                        return;
                    }
                    toolkit.tools.console.debug("Postponing action until component of type <" + type + "/> becomes available");
                    if (!renderQueue.requests[type]) {
                        renderQueue.requests[type] = [];
                    }
                    if (!renderQueue.timeouts[type]) {
                        renderQueue.timeouts[type] = setTimeout(function () {
                            toolkit.tools.console.error("Timeout waiting for component of type <" + type + "/> to become available.");
                            renderQueue.requests[type] = [];
                        }, 5000);
                    }
                    renderQueue.requests[type].push(action);
                }
            };
            init("formInput", function (type, definition) {
                toolkit.tools.console.debug("Registered form component " + type);
                toolkit.ext.formInput.components[type] = definition;
                if (definition.templateUrl) {
                    renderQueue.notify("input." + type);
                    $http.get(definition.templateUrl, {
                        cache: $templateCache
                    }).success(function (data) {
                        definition.templateLoader.resolve(data);
                    });
                    definition.templateLoader.promise().done(function (template) {
                        definition.templateAvailable.resolve($compile(angular.element(template)));
                    });
                }
            });
            var loaded = load("formInput", ["basic"]);
            return {
                restrict: "E",
                require: "^" + toolkit.classes.Directive.qualify("formContainer"),
                transclude: true,
                replace: false,
                scope: {
                    type: "@",
                    id: "@",
                    label: "@",
                    value: "@",
                    feedback: "@",
                    placeholder: "@",
                    state: "@"
                },
                link: function ($scope, $element, $attributes, formController) {
                    $($element).get(0).removeAttribute('type');
                    $($element).get(0).removeAttribute('id');
                    $($element).get(0).removeAttribute('label');
                    $($element).get(0).removeAttribute('value');
                    $($element).get(0).removeAttribute('feedback');
                    $($element).get(0).removeAttribute('state');
                    $($element).get(0).removeAttribute('placeholder');
                    $scope.parent = formController.$scope;
                    if (!$scope.type) {
                        $scope.type = "text";
                    }
                    var self = this;
                    loaded.done(function () {
                        renderQueue.perform("input." + $scope.type, function () {
                            if (!toolkit.ext.formInput.components[$scope.type]) {
                                toolkit.tools.console.error("Invalid component type: " + $scope.type);
                                return;
                            }
                            var component = toolkit.ext.formInput.components[$scope.type];
                            var postlink = component.link.post;
                            component.link.post = function ($scope, $element, $attributes, formController, event) {
                                (function () {
                                    if ($scope.id) {
                                        $("#" + $scope.id).on.forward($element, "keypress", "keydown", "keyup", "focus", "blur",
                                            "enter", "leave", "click", "dblclick", "mousemove", "mouseover", "mouseout", "mousedown",
                                            "mouseup", "change", "contextmenu", "formchange", "forminput", "input", "invalid",
                                            "reset", "select", "drag", "dragend", "dragenter", "dragleave", "dragover", "dragstart",
                                            "drop");
                                    }
                                }).postpone(null, [], 0);
                                postlink.apply(this, arguments);
                            };
                            var event = function (scope) {
                                if (!scope) {
                                    scope = $scope;
                                }
                                return function (type) {
                                    return {
                                        element: $element,
                                        scope: scope,
                                        target: scope.id ? $("#" + scope.id) : $element,
                                        type: type
                                    };
                                }
                            };
                            component.link.pre.apply(self, [$scope, $element, $attributes, formController, event($scope)]);
                            (function () {
                                $scope.$apply();
                            }).postpone();
                            component.templateAvailable.then(function (compiled) {
                                compiled($scope, function ($clone, $localScope) {
                                    $element.replaceWith($clone);
                                    component.link.post.apply(self, [$localScope, $element, $attributes, formController, event($localScope)]);
                                    (function () {
                                        $scope.$apply();
                                    }).postpone();
                                });
                            });
                        });
                    });
                },
                controller: function ($scope, $element) {
                    var self = this;
                    loaded.done(function () {
                        $scope.scope = $scope;
                        renderQueue.perform($scope.type, function () {
                            var component = toolkit.ext.formInput.components[$scope.type];
                            if (component.controller && $.isFunction(component.controller)) {
                                component.controller.apply(self, [$scope, $element]);
                                (function () {
                                    $scope.$apply();
                                }).postpone();
                            }
                        });
                    });
                }
            };
        });
        registry.formSelect = new toolkit.classes.Directive("1.0", "form-placeholder", function () {
            return {
                restrict: "E",
                require: "^" + toolkit.classes.Directive.qualify("formContainer"),
                transclude: true,
                replace: false,
                templateUrl: registry.formInput.templateUrl,
                scope: {}
            };
        });
        registry.formAction = new toolkit.classes.Directive("1.0", "form-buttons", function () {
            return {
                restrict: "E",
                require: "^" + toolkit.classes.Directive.qualify("formContainer"),
                transclude: true,
                replace: true,
                templateUrl: registry.formAction.templateUrl,
                scope: {}
            };
        });
    });

})(BootstrapUI, jQuery);