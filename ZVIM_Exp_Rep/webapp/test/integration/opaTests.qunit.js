/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"vim/ap/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});