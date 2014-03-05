(function (toolkit, $) {
    toolkit.register("formInput.basic", function (registry) {
        registry.text = toolkit.ext.formInput.define({
            templateUrl: "basic"
        });
        registry.email = $.extend({}, registry.text);
        registry.password = $.extend({}, registry.text);
        registry.static = toolkit.ext.formInput.define({
            templateUrl: "static"
        });
        registry.textarea = toolkit.ext.formInput.define({
            templateUrl: "textarea",
            controller: function ($scope, $element, $attrs) {
                if ($attrs.rows) {
                    $scope.rows = parseInt($attrs.rows);
                }
                if (!$scope.rows) {
                    $scope.rows = 3;
                }
            }
        });
        registry.checkbox = toolkit.ext.formInput.define({
            templateUrl: "checkbox",
            controller: function ($scope) {
                if (typeof $scope.value == "string") {
                    $scope.value = $scope.value == "true";
                }
                if (!$scope.value) {
                    $scope.value = false;
                }
            }
        });
        registry.radio = toolkit.ext.formInput.define({
            templateUrl: "radio",
            controller: function ($scope, $element, $attrs) {
                if ($attrs.group) {
                    $scope.group = $attrs.group;
                }
                if ($attrs.checked) {
                    $scope.checked = $attrs.checked;
                }
            }
        });
    });
}).postpone(null, [BootstrapUI, jQuery], function () {
        return  typeof BootstrapUI.ext.formInput != "undefined" && !BootstrapUI.ext.formInput.components.text;
    }, 10000, "loading basic form inputs");